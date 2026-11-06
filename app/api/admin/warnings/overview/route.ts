import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  getAdminUser,
  getUserFromBearer,
  isSupabaseUnavailable,
  upstreamUnavailableResponse,
} from '@/lib/server/supabase';

export const runtime = 'nodejs';

/**
 * GET /api/admin/warnings/overview?limit=50&offset=0&q=
 * Overview peringatan per user (agregat di database via view
 * warning_user_summary; bukan group di browser).
 *
 * Catatan: `q` menyaring HANYA baris pada halaman yang sudah di-range, karena
 * view tidak menyimpan nama/email. UI memberi label "pada halaman ini".
 * Pencarian lintas halaman memerlukan view/RPC gabungan profil+warning.
 */
export async function GET(req: NextRequest) {
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

    const params = req.nextUrl.searchParams;
    const rawLimit = Number(params.get('limit') ?? '50');
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 50;
    const rawOffset = Number(params.get('offset') ?? '0');
    const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;
    const q = params.get('q')?.trim() ?? '';

    const db = createAuthedServerClient(authHeader);
    const { data, error, count } = await db
      .from('warning_user_summary')
      .select('user_id, warning_count, max_level, last_warning_at', { count: 'exact' })
      .order('warning_count', { ascending: false })
      .order('last_warning_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[admin/warnings/overview] fetch error', error.message);
      return NextResponse.json({ error: 'Gagal memuat ringkasan peringatan.' }, { status: 500 });
    }

    const rows = (data ?? []) as Array<{
      user_id: string;
      warning_count: number;
      max_level: number;
      last_warning_at: string | null;
    }>;

    const ids = rows.map((r) => r.user_id);
    const profilesById = new Map<string, { name: string; email: string | null }>();

    if (ids.length > 0) {
      const { data: profiles, error: profErr } = await db
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids);
      if (profErr) {
        console.error('[admin/warnings/overview] profiles error', profErr.message);
      }
      for (const p of (profiles ?? []) as Array<{
        id: string;
        full_name: string | null;
        email: string | null;
      }>) {
        profilesById.set(p.id, {
          name: p.full_name ?? p.email ?? 'Tidak diketahui',
          email: p.email,
        });
      }
    }

    const users = rows.map((r) => {
      const p = profilesById.get(r.user_id);
      return {
        userId: r.user_id,
        userName: p?.name ?? 'Tidak diketahui',
        userEmail: p?.email ?? null,
        warningCount: r.warning_count,
        maxLevel: r.max_level,
        lastWarningAt: r.last_warning_at,
      };
    });

    const filtered = q
      ? users.filter((u) => {
          const needle = q.toLowerCase();
          return (
            u.userName.toLowerCase().includes(needle) ||
            (u.userEmail ?? '').toLowerCase().includes(needle)
          );
        })
      : users;

    return NextResponse.json({
      users: filtered,
      total: q ? filtered.length : count ?? filtered.length,
      limit,
      offset,
    });
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[admin/warnings/overview] unexpected', err);
    // Pesan internal (stack trace, detail TLS/query) hanya ke log server;
    // client menerima pesan publik agar tidak ada informasi internal yang bocor.
    return NextResponse.json({ error: "Gagal memproses peringatan." }, { status: 500 });
  }
}
