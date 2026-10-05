import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  getAdminUser,
  getUserFromBearer,
} from '@/lib/server/supabase';

export const runtime = 'nodejs';

/**
 * GET /api/admin/users/:id/role-history?limit=20&offset=0
 * Riwayat perubahan role satu pengguna (read-only, khusus admin).
 * Auth: Authorization: Bearer <supabase access_token admin>
 */

type Row = Record<string, unknown>;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = req.headers.get('authorization');
    const admin = await getAdminUser(authHeader);
    if (!admin) {
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

    const url = req.nextUrl;
    const rawLimit = Number(url.searchParams.get('limit') ?? '20');
    const rawOffset = Number(url.searchParams.get('offset') ?? '0');
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 20;
    const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;

    const db = createAuthedServerClient(authHeader);

    const { data, error, count } = await db
      .from('role_change_logs')
      .select('id, old_role, new_role, created_at, actor_admin_id', { count: 'exact' })
      .eq('target_user_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[admin/users/role-history] fetch error', error.message);
      return NextResponse.json({ error: 'Gagal memuat riwayat role.' }, { status: 500 });
    }

    const rows = ((data ?? []) as unknown) as Row[];
    const actorIds = rows
      .map((r) => r.actor_admin_id)
      .filter((v): v is string => typeof v === 'string' && v.length > 0);

    // Batch query aktor (bukan N+1).
    const { data: actors, error: actorsErr } =
      actorIds.length > 0
        ? await db.from('profiles').select('id, full_name, email').in('id', actorIds)
        : { data: [] as Row[], error: null };

    if (actorsErr) {
      console.error('[admin/users/role-history] actors error', actorsErr.message);
    }

    const actorById = new Map<string, Row>();
    for (const a of ((actors ?? []) as unknown as Row[])) {
      if (typeof a.id === 'string') actorById.set(a.id, a);
    }

    const logs = rows.map((r) => {
      const actor =
        typeof r.actor_admin_id === 'string'
          ? (actorById.get(r.actor_admin_id) ?? null)
          : null;
      return {
        id: r.id ?? null,
        old_role: r.old_role ?? null,
        new_role: r.new_role ?? null,
        created_at: r.created_at ?? null,
        actor: actor
          ? {
              id: actor.id ?? null,
              full_name: actor.full_name ?? null,
              email: actor.email ?? null,
            }
          : null,
      };
    });

    return NextResponse.json({
      logs,
      total: count ?? logs.length,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[admin/users/role-history] unexpected', err);
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
