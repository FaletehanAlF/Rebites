import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAuthedServerClient, getUserFromBearer } from '@/lib/server/supabase';
export const runtime = 'nodejs';
const VALID_CATEGORIES = ['harassment', 'spam', 'fraud', 'inappropriate_content', 'other'] as const;
const MIN_DESCRIPTION_LENGTH = 10;
const MAX_DESCRIPTION_LENGTH = 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function hasReportableOrderRelation(db: SupabaseClient, reporterId: string, reportedUserId: string): Promise<'related' | 'no_store' | 'no_order' | 'lookup_failed'> {
    const { data: stores, error: storeErr } = await db
        .from('umkm_profiles')
        .select('id, slug')
        .eq('user_id', reportedUserId);
    if (storeErr) {
        console.error('[reports] lookup toko gagal', storeErr.message);
        return 'lookup_failed';
    }
    const storeIds = (stores ?? [])
        .map((s) => (s as {
        id?: unknown;
    }).id)
        .filter((v): v is string => typeof v === 'string' && UUID_RE.test(v));
    const storeSlugs = (stores ?? [])
        .map((s) => (s as {
        slug?: unknown;
    }).slug)
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((v) => v.trim());
    if (storeIds.length === 0 && storeSlugs.length === 0)
        return 'no_store';
    let lookupFailed = false;
    if (storeIds.length > 0) {
        const { data: byId, error: idErr } = await db
            .from('orders')
            .select('id')
            .eq('buyer_id', reporterId)
            .in('umkm_id', storeIds)
            .limit(1);
        if (idErr) {
            console.error('[reports] lookup pesanan (umkm_id) gagal', idErr.message);
            lookupFailed = true;
        }
        else if (byId && byId.length > 0) {
            return 'related';
        }
    }
    if (storeSlugs.length > 0) {
        const { data: bySlug, error: slugErr } = await db
            .from('orders')
            .select('id')
            .eq('buyer_id', reporterId)
            .in('vendor_slug', storeSlugs)
            .limit(1);
        if (slugErr) {
            console.error('[reports] lookup pesanan (vendor_slug) gagal', slugErr.message);
            lookupFailed = true;
        }
        else if (bySlug && bySlug.length > 0) {
            return 'related';
        }
    }
    return lookupFailed ? 'lookup_failed' : 'no_order';
}
type PgError = {
    code?: string;
    message?: string;
};
function respondInsertError(error: PgError): NextResponse {
    const code = typeof error.code === 'string' ? error.code : '';
    switch (code) {
        case '23503':
            return NextResponse.json({ error: 'Pengguna yang dilaporkan tidak valid.' }, { status: 400 });
        case '23514':
        case '23502':
        case '22P02':
            return NextResponse.json({ error: 'Data laporan tidak sesuai format yang diizinkan.' }, { status: 400 });
        case '23505':
            return NextResponse.json({ error: 'Laporan ini sudah pernah dikirim.' }, { status: 409 });
        case '42501':
            console.error('[reports] insert ditolak RLS/privilege', error.message);
            return NextResponse.json({ error: 'Laporan ditolak oleh aturan keamanan.' }, { status: 403 });
        default:
            console.error('[reports] insert error', code, error.message);
            return NextResponse.json({ error: 'Gagal menyimpan laporan.' }, { status: 500 });
    }
}
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
        }
        const user = await getUserFromBearer(authHeader);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
        }
        const body = (await req.json().catch(() => null)) as {
            reportedUserId?: unknown;
            category?: unknown;
            description?: unknown;
            activityId?: unknown;
        } | null;
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 });
        }
        const reportedUserId = typeof body.reportedUserId === 'string' ? body.reportedUserId.trim() : '';
        if (!reportedUserId) {
            return NextResponse.json({ error: 'Pengguna yang dilaporkan wajib dipilih.' }, { status: 400 });
        }
        if (!UUID_RE.test(reportedUserId)) {
            return NextResponse.json({ error: 'Pengguna yang dilaporkan tidak valid.' }, { status: 400 });
        }
        if (reportedUserId === user.id) {
            return NextResponse.json({ error: 'Anda tidak dapat melaporkan diri sendiri.' }, { status: 400 });
        }
        const category = typeof body.category === 'string' ? body.category.trim() : '';
        if (!(VALID_CATEGORIES as readonly string[]).includes(category)) {
            return NextResponse.json({ error: `Kategori tidak valid. Gunakan: ${VALID_CATEGORIES.join(', ')}.` }, { status: 400 });
        }
        const description = typeof body.description === 'string' ? body.description.trim() : '';
        if (description.length < MIN_DESCRIPTION_LENGTH) {
            return NextResponse.json({ error: `Deskripsi minimal ${MIN_DESCRIPTION_LENGTH} karakter.` }, { status: 400 });
        }
        if (description.length > MAX_DESCRIPTION_LENGTH) {
            return NextResponse.json({ error: `Deskripsi maksimal ${MAX_DESCRIPTION_LENGTH} karakter.` }, { status: 400 });
        }
        const rawActivityId = typeof body.activityId === 'string' ? body.activityId.trim() : '';
        if (rawActivityId && !UUID_RE.test(rawActivityId)) {
            return NextResponse.json({ error: 'Referensi aktivitas tidak valid.' }, { status: 400 });
        }
        const activityId = rawActivityId || null;
        const db = createAuthedServerClient(authHeader);
        const relation = await hasReportableOrderRelation(db, user.id, reportedUserId);
        if (relation === 'lookup_failed') {
            return NextResponse.json({ error: 'Gagal memuat data pesanan. Coba lagi sebentar.' }, { status: 503 });
        }
        if (relation === 'no_store') {
            return NextResponse.json({ error: 'Pengguna yang dilaporkan tidak memiliki toko yang dapat ditindaklanjuti.' }, { status: 400 });
        }
        if (relation === 'no_order') {
            return NextResponse.json({ error: 'Anda hanya dapat melaporkan pemilik toko dari pesanan Anda sendiri.' }, { status: 403 });
        }
        const { data, error } = await db
            .from('reports')
            .insert({
            reported_user_id: reportedUserId,
            reported_by: user.id,
            category,
            description,
            activity_id: activityId,
            status: 'open',
        })
            .select('id, status, created_at')
            .single();
        if (error) {
            return respondInsertError(error as PgError);
        }
        if (!data) {
            return NextResponse.json({ error: 'Gagal menyimpan laporan.' }, { status: 500 });
        }
        return NextResponse.json({ report: data }, { status: 201 });
    }
    catch (err) {
        console.error('[reports] unexpected', err);
        return NextResponse.json({ error: 'Terjadi kesalahan.' }, { status: 500 });
    }
}
export async function GET() {
    return NextResponse.json({ error: 'Method not allowed.' }, { status: 405 });
}
