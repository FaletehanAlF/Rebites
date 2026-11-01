import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminActor,
  getUserFromBearer,
  isSupabaseUnavailable,
  upstreamUnavailableResponse,
} from '@/lib/server/supabase';
import { buildAdminMePayload, resolveSuperAdminId } from '@/lib/admin-access';

export const runtime = 'nodejs';

/**
 * GET /api/admin/me
 * Status akses admin untuk gating UI (read-only).
 *
 * Respons SUKSES minimal (tanpa id/email/UUID siapa pun):
 *   { "is_super_admin": boolean, "super_admin_configured": boolean }
 *
 * - 200 hanya untuk admin (profiles.role='admin', token terverifikasi).
 * - 401 tanpa sesi valid; 403 untuk non-admin.
 * - `super_admin_configured=false` berarti SUPER_ADMIN_USER_ID belum diisi
 *   di server; UI harus menampilkan bahwa penunjukan Super Admin belum aktif.
 *
 * Endpoint ini BUKAN penegak otorisasi: setiap aksi sensitif tetap
 * diverifikasi ulang di route masing-masing (fail-closed).
 * Auth: Authorization: Bearer <supabase access_token admin>
 */
export async function GET(req: NextRequest) {
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

    return NextResponse.json(
      buildAdminMePayload(actor, resolveSuperAdminId() !== null)
    );
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[admin/me] unexpected', err);
    // Pesan internal (stack trace, detail TLS/query) hanya ke log server;
    // client menerima pesan publik agar tidak ada informasi internal yang bocor.
    return NextResponse.json({ error: "Gagal memeriksa status admin." }, { status: 500 });
  }
}
