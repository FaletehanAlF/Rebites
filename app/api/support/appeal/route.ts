import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { SUPPORT_MESSAGE_MAX, escapeLikePattern, isPlausibleAppealCode, isValidSupportEmail, normalizeAppealCode, normalizeSupportEmail, } from '@/lib/support';
import { allowSupportRequest, clientIpFrom, } from '@/lib/server/support-rate-limit';
export const runtime = 'nodejs';
const REQUEST_TIMEOUT_MS = 10000;
const IP_LIMIT_PER_HOUR = 10;
export async function POST(req: NextRequest) {
    try {
        let body: {
            email?: unknown;
            message?: unknown;
        } | null = null;
        try {
            body = (await req.json()) as {
                email?: unknown;
                message?: unknown;
            } | null;
        }
        catch {
            body = null;
        }
        const email = normalizeSupportEmail(typeof body?.email === 'string' ? body.email : '');
        const message = (typeof body?.message === 'string' ? body.message : '').trim();
        if (!isValidSupportEmail(email)) {
            return NextResponse.json({ error: 'Alamat email tidak valid.' }, { status: 400 });
        }
        if (message.length === 0) {
            return NextResponse.json({ error: 'Ceritakan dulu alasan bandingmu.' }, { status: 400 });
        }
        if (message.length > SUPPORT_MESSAGE_MAX) {
            return NextResponse.json({ error: `Pesan maksimal ${SUPPORT_MESSAGE_MAX} karakter.` }, { status: 400 });
        }
        const ip = clientIpFrom(req.headers);
        if (!allowSupportRequest(`appeal:${ip}`, IP_LIMIT_PER_HOUR)) {
            return NextResponse.json({
                error: 'Terlalu banyak permintaan banding dari jaringan ini. Tunggu sebentar, lalu coba lagi.',
            }, { status: 429 });
        }
        const service = createServiceClient(REQUEST_TIMEOUT_MS);
        let profileId: string | null = null;
        const { data: profileRows, error: profileError } = await service
            .from('profiles')
            .select('id, email')
            .ilike('email', escapeLikePattern(email))
            .limit(5);
        if (profileError) {
            console.error('[support/appeal] gagal mencari profil:', profileError.message);
            return NextResponse.json({ error: 'Layanan banding sedang tidak tersedia. Coba lagi beberapa menit lagi.' }, { status: 503 });
        }
        const exactMatch = (profileRows ?? []).find((row) => String((row as Record<string, unknown>).email ?? '').toLowerCase() === email);
        if (exactMatch) {
            profileId = String((exactMatch as Record<string, unknown>).id);
        }
        const { data: result, error: rpcError } = await service.rpc('create_support_appeal', { p_email: email, p_message: message, p_profile_id: profileId });
        if (rpcError) {
            console.error('[support/appeal] gagal membuat banding:', rpcError.message);
            return NextResponse.json({ error: 'Layanan banding sedang tidak tersedia. Coba lagi beberapa menit lagi.' }, { status: 503 });
        }
        const payload = (result ?? null) as {
            result?: string;
            code?: string;
        } | null;
        switch (payload?.result) {
            case 'created':
                break;
            case 'rate_limited':
                return NextResponse.json({
                    error: 'Untuk email ini sudah ada 3 banding dalam 1 jam terakhir. Tunggu sekitar satu jam, lalu coba lagi.',
                }, { status: 429 });
            case 'invalid_email':
            case 'invalid_message':
                return NextResponse.json({ error: 'Isian banding tidak valid.' }, { status: 400 });
            default:
                console.error('[support/appeal] hasil tidak dikenal:', payload?.result);
                return NextResponse.json({ error: 'Layanan banding sedang tidak tersedia. Coba lagi beberapa menit lagi.' }, { status: 503 });
        }
        const code = normalizeAppealCode(payload?.code ?? '');
        if (!isPlausibleAppealCode(code)) {
            console.error('[support/appeal] kode dari database tidak berbentuk benar');
            return NextResponse.json({ error: 'Layanan banding sedang tidak tersedia. Coba lagi beberapa menit lagi.' }, { status: 503 });
        }
        return NextResponse.json({ code }, { status: 201 });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[support/appeal] unexpected', err);
        return NextResponse.json({ error: 'Layanan banding sedang tidak tersedia. Coba lagi beberapa menit lagi.' }, { status: 503 });
    }
}
