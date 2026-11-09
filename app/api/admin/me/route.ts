import { NextRequest, NextResponse } from 'next/server';
import { getAdminActor, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { buildAdminMePayload, resolveSuperAdminId } from '@/lib/admin-access';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const actor = await getAdminActor(authHeader);
        if (!actor) {
            const user = await getUserFromBearer(authHeader);
            return NextResponse.json({ error: user ? 'Akses ditolak. Hanya admin.' : 'Unauthorized. Silakan login ulang.' }, { status: user ? 403 : 401 });
        }
        return NextResponse.json(buildAdminMePayload(actor, resolveSuperAdminId() !== null));
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/me] unexpected', err);
        return NextResponse.json({ error: "Gagal memeriksa status admin." }, { status: 500 });
    }
}
