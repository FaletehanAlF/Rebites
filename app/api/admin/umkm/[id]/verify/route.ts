import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  getAdminUser,
  getUserFromBearer,
} from '@/lib/server/supabase';

export const runtime = 'nodejs';

/**
 * POST /api/admin/umkm/:id/verify
 * Toggle status verifikasi UMKM (khusus admin).
 * Schema hanya memiliki boolean is_verified, sehingga endpoint ini
 * membalik nilai yang ada: false -> true, true -> false.
 * Auth: Authorization: Bearer <supabase access_token admin>
 */

type UmkmRow = Record<string, unknown>;

export async function POST(
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
      return NextResponse.json({ error: 'ID UMKM wajib.' }, { status: 400 });
    }

    const db = createAuthedServerClient(authHeader);

    const { data: existing, error: fetchErr } = await db
      .from('umkm_profiles')
      .select('id, is_verified')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      console.error('[admin/umkm/verify] fetch error', fetchErr.message);
      return NextResponse.json({ error: 'Gagal memuat UMKM.' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'UMKM tidak ditemukan.' }, { status: 404 });
    }

    const nextValue = !((existing as UmkmRow).is_verified ?? false);

    const { data: updated, error: updErr } = await db
      .from('umkm_profiles')
      .update({ is_verified: nextValue })
      .eq('id', id)
      .select('id, is_verified')
      .maybeSingle();

    if (updErr) {
      console.error('[admin/umkm/verify] update error', updErr.message);
      return NextResponse.json({ error: 'Gagal mengubah status verifikasi.' }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: 'UMKM tidak ditemukan.' }, { status: 404 });
    }

    const row = updated as UmkmRow;
    return NextResponse.json({
      id: row.id,
      is_verified: row.is_verified ?? nextValue,
    });
  } catch (err) {
    console.error('[admin/umkm/verify] unexpected', err);
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
