import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getAdminUser, getUserFromBearer, } from '@/lib/server/supabase';
export const runtime = 'nodejs';
const KEY_MAX = 80;
const KEY_PATTERN = /^[A-Za-z0-9-]{8,80}$/;
const RECORD_TIMEOUT_MS = 10000;
function asKey(value: unknown): string | null {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > KEY_MAX)
        return null;
    return KEY_PATTERN.test(trimmed) ? trimmed : null;
}
export async function POST(req: NextRequest) {
    const body = (await req.json().catch(() => null)) as {
        key?: unknown;
    } | null;
    const anonKey = asKey(body?.key);
    if (!anonKey) {
        return NextResponse.json({ error: 'Kunci pengunjung tidak valid.' }, { status: 400 });
    }
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    if (authHeader) {
        try {
            const admin = await getAdminUser(authHeader);
            if (admin) {
                return NextResponse.json({ recorded: false, skipped: 'admin' }, { status: 202 });
            }
            const user = await getUserFromBearer(authHeader);
            userId = user?.id ?? null;
        }
        catch (err) {
            console.warn('[visitors] verifikasi sesi gagal, kunjungan tidak dicatat:', err instanceof Error ? err.message : err);
            return NextResponse.json({ recorded: false }, { status: 202 });
        }
    }
    const key = userId ? `u:${userId}` : `a:${anonKey}`;
    try {
        const service = createServiceClient(RECORD_TIMEOUT_MS);
        const { error } = await service.rpc('record_site_visit', {
            p_key: key,
            p_user_id: userId,
        });
        if (error) {
            console.warn('[visitors] gagal mencatat kunjungan:', error.message);
            return NextResponse.json({ recorded: false }, { status: 202 });
        }
        return NextResponse.json({ recorded: true }, { status: 202 });
    }
    catch (err) {
        console.warn('[visitors] gangguan saat mencatat kunjungan:', err instanceof Error ? err.message : err);
        return NextResponse.json({ recorded: false }, { status: 202 });
    }
}
