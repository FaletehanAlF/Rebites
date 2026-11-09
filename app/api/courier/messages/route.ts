import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAuthedServerClient, createServiceClient, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { buildDemoCourierReply } from '@/lib/demo-courier';
import { generateDemoCourierAiReply } from '@/lib/server/courier-ai';
import { normalizeCourierSenderKind } from '@/lib/courier-sender-kind';
import { buildHistoryContents, hasBuyerMessage } from '@/lib/server/courier-history';
import { decideAutoReplyMode } from '@/lib/courier-auto-reply';
import { isGeminiConfigured } from '@/lib/server/gemini';
import type { CourierAiContent } from '@/lib/server/gemini';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_BODY_LENGTH = 1000;
const HISTORY_LIMIT = 12;
async function loadCourierHistory(service: SupabaseClient, orderId: string): Promise<CourierAiContent[]> {
    try {
        const res = await service
            .from('courier_messages')
            .select('sender_kind, body')
            .eq('order_id', orderId)
            .order('created_at', { ascending: false })
            .limit(HISTORY_LIMIT);
        const rows = (res.data ?? []).slice().reverse() as Array<Record<string, unknown>>;
        return buildHistoryContents(rows.map((r) => ({
            senderKind: normalizeCourierSenderKind(r.sender_kind),
            body: String(r.body ?? ''),
        })));
    }
    catch (err) {
        console.error('[courier/messages] gagal memuat riwayat:', err instanceof Error ? err.message : String(err));
        return [];
    }
}
interface AutomatedInsertResult {
    alreadyAnswered: boolean;
    error: {
        message?: string;
        code?: string;
    } | null;
}
async function insertAutomatedReply(service: SupabaseClient, params: {
    orderId: string;
    kind: 'ai_courier' | 'demo_courier';
    body: string;
    replyToMessageId: string;
}): Promise<AutomatedInsertResult> {
    const base = {
        order_id: params.orderId,
        sender_user_id: null,
        sender_kind: params.kind,
        body: params.body,
    };
    const first = await service
        .from('courier_messages')
        .insert({ ...base, reply_to_message_id: params.replyToMessageId || null });
    if (!first.error)
        return { alreadyAnswered: false, error: null };
    const message = String(first.error.message ?? '').toLowerCase();
    const code = (first.error as {
        code?: string;
    }).code ?? '';
    if (message.includes('reply_to_message_id') || code === 'PGRST204' || code === '42703') {
        console.warn('[courier/messages] reply_to_message_id belum ada; lanjut tanpa dedup.');
        const retry = await service.from('courier_messages').insert(base);
        return retry.error
            ? { alreadyAnswered: false, error: retry.error }
            : { alreadyAnswered: false, error: null };
    }
    if (/unique|duplicate/.test(message) || code === '23505') {
        return { alreadyAnswered: true, error: first.error };
    }
    return { alreadyAnswered: false, error: first.error };
}
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const user = await getUserFromBearer(authHeader);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
        }
        const orderId = req.nextUrl.searchParams.get('orderId')?.trim() ?? '';
        if (!orderId) {
            return NextResponse.json({ error: 'orderId wajib diisi.' }, { status: 400 });
        }
        const supabase = createAuthedServerClient(authHeader as string);
        let usedDemoColumns = true;
        let data: Array<Record<string, unknown>> | null = null;
        let error: {
            message: string;
        } | null = null;
        {
            const first = await supabase
                .from('courier_messages')
                .select('id, sender_user_id, sender_kind, body, created_at')
                .eq('order_id', orderId)
                .order('created_at', { ascending: true })
                .limit(200);
            data = (first.data ?? null) as Array<Record<string, unknown>> | null;
            error = first.error;
        }
        if (error) {
            usedDemoColumns = false;
            const fallbackQuery = await supabase
                .from('courier_messages')
                .select('id, sender_user_id, body, created_at')
                .eq('order_id', orderId)
                .order('created_at', { ascending: true })
                .limit(200);
            data = (fallbackQuery.data ?? null) as Array<Record<string, unknown>> | null;
            error = fallbackQuery.error;
        }
        if (error) {
            console.error('[courier/messages] gagal membaca pesan:', error.message);
            return NextResponse.json({ error: 'Gagal memuat pesan.' }, { status: 500 });
        }
        return NextResponse.json({
            messages: ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
                id: String(row.id),
                senderUserId: row.sender_user_id ? String(row.sender_user_id) : null,
                senderKind: usedDemoColumns
                    ? normalizeCourierSenderKind(row.sender_kind)
                    : 'user',
                body: String(row.body ?? ''),
                createdAt: row.created_at ? String(row.created_at) : null,
                isMine: row.sender_user_id === user.id,
            })),
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[courier/messages] unexpected', err);
        return NextResponse.json({ error: 'Gagal memuat pesan.' }, { status: 500 });
    }
}
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const user = await getUserFromBearer(authHeader);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
        }
        let body: {
            orderId?: unknown;
            message?: unknown;
        };
        try {
            body = await req.json();
        }
        catch {
            return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
        }
        const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
        const message = typeof body.message === 'string' ? body.message.trim() : '';
        if (!orderId) {
            return NextResponse.json({ error: 'orderId wajib diisi.' }, { status: 400 });
        }
        if (!message) {
            return NextResponse.json({ error: 'Pesan tidak boleh kosong.' }, { status: 400 });
        }
        if (message.length > MAX_BODY_LENGTH) {
            return NextResponse.json({ error: `Pesan maksimal ${MAX_BODY_LENGTH} karakter.` }, { status: 400 });
        }
        const supabase = createAuthedServerClient(authHeader as string);
        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .select('id, buyer_id')
            .eq('id', orderId)
            .maybeSingle();
        if (orderErr) {
            console.error('[courier/messages] gagal membaca pesanan:', orderErr.message);
            return NextResponse.json({ error: 'Gagal memuat pesanan.' }, { status: 500 });
        }
        if (!order) {
            return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
        }
        const isBuyer = order.buyer_id === user.id;
        let isCourier = false;
        if (!isBuyer) {
            const { data: assignment } = await supabase
                .from('delivery_assignments')
                .select('courier_user_id')
                .eq('order_id', orderId)
                .maybeSingle();
            isCourier = assignment?.courier_user_id === user.id;
        }
        if (!isBuyer && !isCourier) {
            return NextResponse.json({ error: 'Anda bukan peserta percakapan pesanan ini.' }, { status: 403 });
        }
        const { data, error } = await supabase
            .from('courier_messages')
            .insert({
            order_id: orderId,
            sender_user_id: user.id,
            sender_kind: 'user',
            body: message,
        })
            .select('id, sender_user_id, body, created_at')
            .maybeSingle();
        if (error) {
            console.error('[courier/messages] gagal mengirim pesan:', error.message);
            return NextResponse.json({ error: 'Gagal mengirim pesan.' }, { status: 500 });
        }
        const row = data as Record<string, unknown> | null;
        const userMessageId = row?.id ? String(row.id) : '';
        let aiReply: {
            status: 'sent' | 'fallback' | 'already_answered' | 'failed';
            reason?: string;
            message?: string;
        } | undefined;
        if (isBuyer) {
            try {
                const service = createServiceClient();
                const { data: demoAssignment } = await service
                    .from('delivery_assignments')
                    .select('is_demo')
                    .eq('order_id', orderId)
                    .maybeSingle();
                const isDemoOrder = Boolean(demoAssignment?.is_demo);
                if (isDemoOrder) {
                    const { data: orderRow } = await service
                        .from('orders')
                        .select('order_code, order_status')
                        .eq('id', orderId)
                        .maybeSingle();
                    const orderCode = String(orderRow?.order_code ?? '');
                    const orderStatus = String(orderRow?.order_status ?? 'processing');
                    const geminiConfigured = isGeminiConfigured();
                    const history = geminiConfigured
                        ? await loadCourierHistory(service, orderId)
                        : [];
                    const mode = decideAutoReplyMode({
                        role: 'buyer',
                        isDemoOrder,
                        geminiConfigured: geminiConfigured && hasBuyerMessage(history),
                    });
                    let automatedKind: 'ai_courier' | 'demo_courier' | null = null;
                    let automatedBody = '';
                    let fallbackReason: string | undefined;
                    let fallbackMessage: string | undefined;
                    if (mode === 'ai') {
                        const outcome = await generateDemoCourierAiReply({
                            userId: user.id,
                            orderCode,
                            orderStatus,
                            contents: history,
                        });
                        if (outcome.ok) {
                            automatedKind = 'ai_courier';
                            automatedBody = outcome.reply;
                        }
                        else {
                            automatedKind = 'demo_courier';
                            automatedBody = buildDemoCourierReply({ message, stage: orderStatus, orderCode });
                            fallbackReason = outcome.providerReason ?? outcome.reason;
                            fallbackMessage = outcome.message;
                        }
                    }
                    else {
                        automatedKind = 'demo_courier';
                        automatedBody = buildDemoCourierReply({ message, stage: orderStatus, orderCode });
                        fallbackReason = 'not_configured';
                    }
                    const inserted = await insertAutomatedReply(service, {
                        orderId,
                        kind: automatedKind,
                        body: automatedBody,
                        replyToMessageId: userMessageId,
                    });
                    if (inserted.alreadyAnswered) {
                        aiReply = { status: 'already_answered' };
                    }
                    else if (inserted.error) {
                        aiReply = {
                            status: 'failed',
                            message: 'Kurir AI sedang tidak dapat menjawab. Coba lagi sebentar.',
                        };
                    }
                    else if (automatedKind === 'ai_courier') {
                        aiReply = { status: 'sent' };
                    }
                    else {
                        aiReply = { status: 'fallback', reason: fallbackReason, message: fallbackMessage };
                    }
                }
            }
            catch (replyErr) {
                const safe = replyErr instanceof Error ? replyErr.message : String(replyErr);
                console.error('[courier/messages] gagal membalas otomatis:', safe);
                aiReply = {
                    status: 'failed',
                    message: 'Kurir AI sedang tidak dapat menjawab. Coba lagi sebentar.',
                };
            }
        }
        return NextResponse.json({
            message: {
                id: String(row?.id ?? ''),
                senderUserId: user.id,
                senderKind: 'user',
                body: message,
                createdAt: row?.created_at ? String(row.created_at) : new Date().toISOString(),
                isMine: true,
            },
            aiReply,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[courier/messages] unexpected', err);
        return NextResponse.json({ error: 'Gagal mengirim pesan.' }, { status: 500 });
    }
}
