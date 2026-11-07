import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { withDeadline } from '@/lib/health-status';
import { runHealthChecks } from '@/lib/server/health-service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const AUTH_GATE_TIMEOUT_MS = 5000;
function authFailureResponse(user: unknown): NextResponse {
    return NextResponse.json({
        error: user
            ? 'Akses ditolak. Hanya admin.'
            : 'Unauthorized. Silakan login ulang.',
    }, {
        status: user ? 403 : 401,
        headers: { 'Cache-Control': 'no-store' },
    });
}
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    const gateStartedAt = Date.now();
    try {
        const gate = await withDeadline(Promise.resolve(getAdminUser(authHeader)), AUTH_GATE_TIMEOUT_MS);
        if (gate.status === 'timeout')
            return upstreamUnavailableResponse();
        const authLatencyMs = Math.max(0, Date.now() - gateStartedAt);
        if (!gate.value) {
            const remainingMs = Math.max(1, AUTH_GATE_TIMEOUT_MS - (Date.now() - gateStartedAt));
            const userGate = await withDeadline(Promise.resolve(getUserFromBearer(authHeader)), remainingMs);
            if (userGate.status === 'timeout')
                return upstreamUnavailableResponse();
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
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/health] GET error', err instanceof Error ? err.name : 'unknown');
        return NextResponse.json({ error: 'Gagal memeriksa kesehatan sistem.' }, {
            status: 500,
            headers: { 'Cache-Control': 'no-store' },
        });
    }
}
