import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { SUPPORT_MESSAGE_MAX, isPlausibleAppealCode, normalizeAppealCode, } from '@/lib/support';
import { allowSupportRequest, clientIpFrom, } from '@/lib/server/support-rate-limit';
export const runtime = 'nodejs';
const REQUEST_TIMEOUT_MS = 10000;
const IP_LIMIT_PER_HOUR = 60;
const MESSAGE_LIMIT = 100;
export async function POST(req: NextRequest) {
    try {
        let body: {
            code?: unknown;
            message?: unknown;
        } | null = null;
        try {
            body = (await req.json()) as {
                code?: unknown;
                message?: unknown;
            } | null;
        }
        catch {
            body = null;
        }
        const code = normalizeAppealCode(typeof body?.code === 'string' ? body.code : '');
        const message = (typeof body?.message === 'string' ? body.message : '').trim();
        const notFound = () => NextResponse.json({
            error: 'Kode banding tidak ditemukan. Periksa kembali kode yang kamu simpan saat mengirim banding.',
        }, { status: 404 });
        if (!isPlausibleAppealCode(code))
            return notFound();
        if (message.length > SUPPORT_MESSAGE_MAX) {
            return NextResponse.json({ error: `Pesan maksimal ${SUPPORT_MESSAGE_MAX} karakter.` }, { status: 400 });
        }
        const ip = clientIpFrom(req.headers);
        if (!allowSupportRequest(`appeal-status:${ip}`, IP_LIMIT_PER_HOUR)) {
            return NextResponse.json({ error: 'Terlalu banyak pemeriksaan status. Tunggu sebentar, lalu coba lagi.' }, { status: 429 });
        }
        const service = createServiceClient(REQUEST_TIMEOUT_MS);
        const { data: appeal, error: appealError } = await service
            .from('support_appeals')
            .select('id, status, message, decision_note, created_at, decided_at, thread_id')
            .eq('code', code)
            .maybeSingle();
        if (appealError) {
            console.error('[support/appeal/status] gagal membaca banding:', appealError.message);
            return NextResponse.json({ error: 'Layanan banding sedang tidak tersedia. Coba lagi beberapa menit lagi.' }, { status: 503 });
        }
        if (!appeal)
            return notFound();
        const appealRow = appeal as Record<string, unknown>;
        const threadId = String(appealRow.thread_id);
        const appealCreatedAt = String(appealRow.created_at);
        if (message.length > 0) {
            const { data: appendResult, error: appendError } = await service.rpc('append_appeal_followup', { p_code: code, p_message: message });
            if (appendError) {
                console.error('[support/appeal/status] gagal menambah pesan:', appendError.message);
                return NextResponse.json({ error: 'Pesan lanjutan gagal dikirim. Coba lagi sebentar lagi.' }, { status: 503 });
            }
            const outcome = String(appendResult ?? '');
            if (outcome === 'not_found')
                return notFound();
            if (outcome === 'limit') {
                return NextResponse.json({
                    error: 'Batas pesan lanjutan untuk banding ini sudah tercapai. Tunggu balasan admin.',
                }, { status: 429 });
            }
            if (outcome === 'invalid_message') {
                return NextResponse.json({ error: 'Pesan tidak valid.' }, { status: 400 });
            }
            if (outcome !== 'ok') {
                console.error('[support/appeal/status] hasil append tidak dikenal:', outcome);
                return NextResponse.json({ error: 'Pesan lanjutan gagal dikirim. Coba lagi sebentar lagi.' }, { status: 503 });
            }
        }
        const { data: messages, error: messagesError } = await service
            .from('support_messages')
            .select('id, sender_kind, channel, body, created_at')
            .eq('thread_id', threadId)
            .gte('created_at', appealCreatedAt)
            .order('created_at', { ascending: true })
            .limit(MESSAGE_LIMIT);
        if (messagesError) {
            console.error('[support/appeal/status] gagal membaca pesan:', messagesError.message);
            return NextResponse.json({ error: 'Layanan banding sedang tidak tersedia. Coba lagi beberapa menit lagi.' }, { status: 503 });
        }
        return NextResponse.json({
            appeal: {
                status: String(appealRow.status ?? 'pending'),
                message: String(appealRow.message ?? ''),
                decisionNote: appealRow.decision_note ? String(appealRow.decision_note) : null,
                createdAt: appealCreatedAt,
                decidedAt: appealRow.decided_at ? String(appealRow.decided_at) : null,
            },
            messages: ((messages ?? []) as Array<Record<string, unknown>>).map((row) => ({
                id: String(row.id),
                senderKind: String(row.sender_kind ?? 'user'),
                channel: String(row.channel ?? 'banding'),
                body: String(row.body ?? ''),
                createdAt: row.created_at ? String(row.created_at) : null,
            })),
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[support/appeal/status] unexpected', err);
        return NextResponse.json({ error: 'Layanan banding sedang tidak tersedia. Coba lagi beberapa menit lagi.' }, { status: 503 });
    }
}
