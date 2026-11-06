import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminUser,
  getUserFromBearer,
  isSupabaseUnavailable,
  upstreamUnavailableResponse,
} from '@/lib/server/supabase';
import { withDeadline } from '@/lib/health-status';
import { runHealthChecks } from '@/lib/server/health-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Gate auth health tidak boleh menggantung tanpa batas. `getAdminUser` masih
 * memakai service client tanpa timeout, jadi route ini membungkus seluruh gate
 * dengan deadline 5 detik. Bila gate tidak selesai, route menjawab 503 —
 * bukan 401 — supaya admin tidak dianggap kehilangan sesi saat Supabase down.
 */
const AUTH_GATE_TIMEOUT_MS = 5_000;

function authFailureResponse(user: unknown): NextResponse {
  return NextResponse.json(
    {
      error: user
        ? 'Akses ditolak. Hanya admin.'
        : 'Unauthorized. Silakan login ulang.',
    },
    {
      status: user ? 403 : 401,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}

/**
 * GET /api/admin/health
 *
 * Pemeriksaan read-only:
 * - Database: SELECT head-count profil admin lewat JWT (RLS aktif).
 * - Auth: gate admin yang sama dengan endpoint admin lain.
 * - Storage: list satu object pada bucket publik.
 * - Payment/Shipping/Webhook: hanya status konfigurasi; tidak ada panggilan
 *   provider yang dapat membuat invoice, shipment, atau event.
 *
 * Respons sukses selalu 200 — termasuk `degraded`/`unknown` — karena status
 * layanan adalah data. 503 hanya untuk gate auth yang tidak dapat dijalankan.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const gateStartedAt = Date.now();

  try {
    const gate = await withDeadline(
      Promise.resolve(getAdminUser(authHeader)),
      AUTH_GATE_TIMEOUT_MS
    );
    if (gate.status === 'timeout') return upstreamUnavailableResponse();

    const authLatencyMs = Math.max(0, Date.now() - gateStartedAt);

    if (!gate.value) {
      const remainingMs = Math.max(
        1,
        AUTH_GATE_TIMEOUT_MS - (Date.now() - gateStartedAt)
      );
      const userGate = await withDeadline(
        Promise.resolve(getUserFromBearer(authHeader)),
        remainingMs
      );
      if (userGate.status === 'timeout') return upstreamUnavailableResponse();
      return authFailureResponse(userGate.value);
    }

    if (!authHeader) {
      return authFailureResponse(null);
    }

    const report = await runHealthChecks({
      authHeader,
      adminId: gate.value.id,
      authLatencyMs,
    });

    return NextResponse.json(report, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    // Nama error saja; detail internal (message/stack/URL) tetap di server
    // dan tidak pernah menjadi body respons.
    console.error(
      '[admin/health] GET error',
      err instanceof Error ? err.name : 'unknown'
    );
    return NextResponse.json(
      { error: 'Gagal memeriksa kesehatan sistem.' },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}
