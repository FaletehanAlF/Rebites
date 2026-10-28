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
  canChangeUserRole,
  isSuperAdminUserId,
  resolveSuperAdminId,
} from '@/lib/admin-access';

export const runtime = 'nodejs';

/**
 * PATCH /api/admin/users/:id/role
 * Ubah role pengguna (KHUSUS SUPER ADMIN, server-side).
 * Body: { "role": "buyer" | "umkm" | "admin" }
 *
 * Rules (setelah hardening Super Admin):
 * - Role divalidasi allowlist (tidak percaya metadata/role client).
 * - Admin tim (role='admin' TANPA SUPER_ADMIN_USER_ID) SELALU ditolak 403:
 *   tidak ada eskalasi hak akses, tidak bisa menyentuh Super Admin.
 * - Hanya Super Admin (env SUPER_ADMIN_USER_ID, dicocokkan dengan user
 *   hasil verifikasi token server) yang dapat mengubah peran — termasuk
 *   menunjuk/mencabut admin tim.
 * - Akun Super Admin tidak dapat didemosi (termasuk oleh dirinya sendiri).
 * - Environment belum dikonfigurasi → endpoint fail-closed (403) tanpa
 *   diam-diam menganggap semua admin sebagai Super Admin.
 * - Role TIDAK pernah disinkron otomatis dengan kepemilikan UMKM.
 * - Perubahan dilakukan server; client tidak boleh update profiles langsung.
 * - PENTING (hardening 20261017000000): penulisan role memakai RPC
 *   `apply_role_change` lewat service-role client. Trigger
 *   lock_profiles_role_on_update hanya mengizinkan perubahan role dari
 *   konteks service_role, sehingga admin tim TIDAK bisa lagi mengubah role
 *   langsung via PostgREST untuk melewati API/persetujuan. RPC yang sama
 *   mencatat role_change_logs dalam transaksi yang sama (atomik).
 * Auth: Authorization: Bearer <supabase access_token admin>
 */

type Row = Record<string, unknown>;

const ALLOWED_ROLES = ['buyer', 'umkm', 'admin'] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

export async function PATCH(
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

    const id = params.id?.trim();
    if (!id) {
      return NextResponse.json({ error: 'ID pengguna wajib.' }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as {
      role?: unknown;
    } | null;
    const nextRole = typeof body?.role === 'string' ? body.role.trim() : '';
    if (!(ALLOWED_ROLES as readonly string[]).includes(nextRole)) {
      return NextResponse.json(
        { error: 'Role tidak valid. Nilai yang diizinkan: buyer, umkm, admin.' },
        { status: 400 }
      );
    }

    // Tolak lebih awal untuk admin tim: keputusan tidak bergantung data target,
    // sehingga tidak perlu membaca DB hanya untuk menolak.
    if (!actor.isSuperAdmin) {
      const configured = resolveSuperAdminId() !== null;
      return NextResponse.json(
        {
          error: configured
            ? 'Akses ditolak. Perubahan peran hanya dapat dilakukan oleh Super Admin.'
            : 'Perubahan peran belum aktif: SUPER_ADMIN_USER_ID belum dikonfigurasi di server.',
        },
        { status: 403 }
      );
    }

    const db = createAuthedServerClient(authHeader);

    const { data: existing, error: fetchErr } = await db
      .from('profiles')
      .select('id, role')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      console.error('[admin/users/role] fetch error', fetchErr.message);
      return NextResponse.json({ error: 'Gagal memuat pengguna.' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 });
    }

    const currentRole = ((existing as unknown) as Row).role as string | null;

    // Keputusan tunggal dari modul kebijakan (matriks izin teruji).
    const decision = canChangeUserRole(
      actor,
      { id, role: currentRole, isSuperAdmin: isSuperAdminUserId(id) },
      nextRole as AllowedRole
    );
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.message }, { status: decision.status });
    }

    if (currentRole === nextRole) {
      return NextResponse.json(
        { error: `Role sudah '${nextRole}'. Tidak ada perubahan.` },
        { status: 409 }
      );
    }

    // Jalur tulis tunggal (hardening 20261017000000): RPC service-role
    // mengubah role + mencatat role_change_logs dalam SATU transaksi.
    // Trigger lock_profiles_role_on_update hanya mengizinkan perubahan role
    // dari konteks service_role, sehingga admin tim tidak dapat memakai
    // PostgREST langsung untuk melewati API ini.
    const service = createServiceClient();
    const { data: result, error: rpcErr } = await service.rpc('apply_role_change', {
      p_target_id: id,
      p_new_role: nextRole,
      p_actor_id: actor.id,
    });

    if (rpcErr) {
      // Fungsi RPC belum ada di server (migrasi role_request_approval belum
      // dijalankan). Jawab dengan pesan yang dapat ditindaklanjuti, bukan
      // "Gagal mengubah role." yang tidak menjelaskan apa pun.
      // PGRST202 = fungsi tidak ditemukan PostgREST; 42883 = undefined_function.
      const rpcCode = (rpcErr as { code?: string }).code ?? '';
      if (rpcCode === 'PGRST202' || rpcCode === '42883' || rpcCode === '42P01') {
        console.error('[admin/users/role] rpc belum tersedia', rpcCode, rpcErr.message);
        return NextResponse.json(
          {
            error:
              'Fitur ubah peran belum diaktifkan di server: migrasi role_request_approval belum dijalankan.',
            code: 'ROLE_FEATURE_NOT_PROVISIONED',
          },
          { status: 503 }
        );
      }
      console.error('[admin/users/role] rpc error', rpcErr.message);
      return NextResponse.json({ error: 'Gagal mengubah role.' }, { status: 500 });
    }

    const outcome = ((result ?? {}) as unknown) as Row;
    const outcomeCode = typeof outcome.result === 'string' ? outcome.result : '';

    if (outcomeCode === 'no_change') {
      return NextResponse.json(
        { error: `Role sudah '${nextRole}'. Tidak ada perubahan.` },
        { status: 409 }
      );
    }
    if (outcomeCode === 'not_found') {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 });
    }
    if (outcomeCode !== 'ok') {
      console.error('[admin/users/role] respons rpc tidak dikenali', JSON.stringify(outcome));
      return NextResponse.json({ error: 'Respons perubahan role tidak valid.' }, { status: 500 });
    }

    return NextResponse.json({
      user: {
        id,
        old_role: outcome.old_role ?? currentRole,
        role: outcome.new_role ?? nextRole,
      },
    });
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[admin/users/role] unexpected', err);
    // Pesan internal (stack trace, detail TLS/query) hanya ke log server;
    // client menerima pesan publik agar tidak ada informasi internal yang bocor.
    return NextResponse.json({ error: "Gagal memproses data pengguna." }, { status: 500 });
  }
}
