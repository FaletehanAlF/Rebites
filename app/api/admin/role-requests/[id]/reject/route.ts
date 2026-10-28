import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  createServiceClient,
  getAdminActor,
  getUserFromBearer,
  isSupabaseUnavailable,
  upstreamUnavailableResponse,
} from '@/lib/server/supabase';
import {
  canDecideRoleRequest,
  isSuperAdminUserId,
  resolveSuperAdminId,
} from '@/lib/admin-access';

export const runtime = 'nodejs';

/**
 * POST /api/admin/role-requests/:id/reject
 * Tolak permintaan perubahan role (KHUSUS SUPER ADMIN, server-side).
 * Body opsional: { "note": "..." } (maks 500 karakter) — alasan penolakan.
 *
 * Alur sama dengan approve; keputusan 'rejected' TIDAK menyentuh
 * profiles.role. RPC decide_role_change_request mencatat keputusan +
 * admin_audit_logs dalam satu transaksi, dan menolak pemrosesan ulang
 * (status sudah bukan 'pending' -> 409).
 *
 * Auth: Authorization: Bearer <supabase access_token admin>
 */

type Row = Record<string, unknown>;

const NOTE_MAX = 500;

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = req.headers.get('authorization');
    const actor = await getAdminActor(authHeader);
    if (!actor) {
      const user = await getUserFromBearer(authHeader);
      return NextResponse.json(
        { error: user ? 'Akses ditolak. Hanya admin.' : 'Unauthorized. Silakan login ulang.' },
        { status: user ? 403 : 401 }
      );
    }

    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
    }

    // Tolak lebih awal untuk admin tim: keputusan tidak bergantung data request.
    if (!actor.isSuperAdmin) {
      const configured = resolveSuperAdminId() !== null;
      return NextResponse.json(
        {
          error: configured
            ? 'Akses ditolak. Hanya Super Admin yang dapat menolak permintaan.'
            : 'Persetujuan belum aktif: SUPER_ADMIN_USER_ID belum dikonfigurasi di server.',
        },
        { status: 403 }
      );
    }

    const id = params.id?.trim();
    if (!id) {
      return NextResponse.json({ error: 'ID permintaan wajib.' }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as { note?: unknown } | null;
    const note = typeof body?.note === 'string' ? body.note.trim() : '';
    if (note.length > NOTE_MAX) {
      return NextResponse.json(
        { error: `Catatan maksimal ${NOTE_MAX} karakter.` },
        { status: 400 }
      );
    }

    const db = createAuthedServerClient(authHeader);

    const { data: existing, error: fetchErr } = await db
      .from('role_change_requests')
      .select('id, status, requested_by, target_user_id, current_role, requested_role')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      console.error('[admin/role-requests/reject] fetch error', fetchErr.message);
      return NextResponse.json({ error: 'Gagal memuat permintaan.' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Permintaan tidak ditemukan.' }, { status: 404 });
    }

    const row = (existing as unknown) as Row;

    const decision = canDecideRoleRequest(actor, {
      requestedBy: asString(row.requested_by) ?? '',
      status: asString(row.status) ?? '',
      targetIsSuperAdmin: isSuperAdminUserId(asString(row.target_user_id)),
    });
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.message }, { status: decision.status });
    }

    // RPC service-role: klaim atomik 'rejected' + admin_audit_logs; role tetap.
    const service = createServiceClient();
    const { data: result, error: rpcErr } = await service.rpc('decide_role_change_request', {
      p_request_id: id,
      p_actor_id: actor.id,
      p_decision: 'rejected',
      p_note: note || null,
    });

    if (rpcErr) {
      console.error('[admin/role-requests/reject] rpc error', rpcErr.message);
      return NextResponse.json({ error: 'Gagal menolak permintaan role.' }, { status: 500 });
    }

    const outcome = ((result ?? {}) as unknown) as Row;
    const outcomeCode = asString(outcome.result);

    if (outcomeCode === 'ok') {
      return NextResponse.json({ request: { id, status: 'rejected' } });
    }
    if (outcomeCode === 'already_decided') {
      return NextResponse.json(
        { error: `Permintaan sudah diputuskan (status: ${asString(outcome.status) ?? 'lain'}).` },
        { status: 409 }
      );
    }
    if (outcomeCode === 'requester_cannot_decide') {
      return NextResponse.json(
        { error: 'Permintaan yang Anda ajukan sendiri tidak dapat Anda putuskan.' },
        { status: 403 }
      );
    }
    if (outcomeCode === 'no_change') {
      return NextResponse.json(
        { error: 'Permintaan tidak lagi dapat ditolak karena role target sudah berubah.' },
        { status: 409 }
      );
    }
    if (outcomeCode === 'not_found' || outcomeCode === 'target_missing') {
      return NextResponse.json(
        { error: 'Permintaan atau pengguna target tidak ditemukan.' },
        { status: 404 }
      );
    }

    console.error('[admin/role-requests/reject] respons tidak dikenali', JSON.stringify(outcome));
    return NextResponse.json({ error: 'Respons keputusan tidak valid.' }, { status: 500 });
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[admin/role-requests/reject] unexpected', err);
    // Pesan internal (stack trace, detail TLS/query) hanya ke log server;
    // client menerima pesan publik agar tidak ada informasi internal yang bocor.
    return NextResponse.json({ error: "Gagal memproses permintaan peran." }, { status: 500 });
  }
}
