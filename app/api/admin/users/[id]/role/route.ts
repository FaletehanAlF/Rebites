import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  getAdminUser,
  getUserFromBearer,
} from '@/lib/server/supabase';

export const runtime = 'nodejs';

/**
 * PATCH /api/admin/users/:id/role
 * Ubah role pengguna (khusus admin, server-side).
 * Body: { "role": "buyer" | "umkm" | "admin" }
 *
 * Rules:
 * - Role divalidasi allowlist (tidak percaya metadata/role client).
 * - Role TIDAK pernah disinkron otomatis dengan kepemilikan UMKM.
 * - Perubahan dilakukan server; client tidak boleh update profiles langsung.
 * - PENTING: memakai authed client (bukan service-role) agar trigger
 *   lock_profiles_role_on_update melihat is_admin() = true. service-role
 *   memiliki auth.uid() NULL sehingga trigger akan mengembalikan role.
 * - Admin tidak dapat mencabut hak admin dirinya sendiri (anti lockout).
 * - Setiap perubahan dicatat ke role_change_logs (server-side).
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

    // Cegah admin mencabut hak admin dirinya sendiri (lockout).
    if (id === admin.id && nextRole !== 'admin') {
      return NextResponse.json(
        { error: 'Tidak dapat mencabut hak admin dari akun sendiri.' },
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
    if (currentRole === nextRole) {
      return NextResponse.json(
        { error: `Role sudah '${nextRole}'. Tidak ada perubahan.` },
        { status: 409 }
      );
    }

    const { data: updated, error: updErr } = await db
      .from('profiles')
      .update({ role: nextRole as AllowedRole })
      .eq('id', id)
      .select('id, role')
      .maybeSingle();

    if (updErr) {
      console.error('[admin/users/role] update error', updErr.message);
      return NextResponse.json({ error: 'Gagal mengubah role.' }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: 'Gagal mengubah role.' }, { status: 500 });
    }

    // Audit log server-side (tabel role_change_logs).
    const { error: logErr } = await db.from('role_change_logs').insert({
      actor_admin_id: admin.id,
      target_user_id: id,
      old_role: currentRole,
      new_role: nextRole,
    });

    if (logErr) {
      console.error('[admin/users/role] log error', logErr.message);
      return NextResponse.json(
        { error: 'Role berubah, tetapi riwayat perubahan gagal dicatat.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user: {
        id: ((updated as unknown) as Row).id ?? id,
        old_role: currentRole,
        role: ((updated as unknown) as Row).role ?? nextRole,
      },
    });
  } catch (err) {
    console.error('[admin/users/role] unexpected', err);
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
