import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, getUserFromBearer, } from '@/lib/server/supabase';
import { AiNotConfiguredError, AiProviderError, AiToolsUnsupportedError, chatCompletion, type AiMessage, } from '@/lib/server/ai-provider';
import { buildSystemPrompt } from '@/lib/chatbot/knowledge';
import { classifyInput, refusalMessage, sanitizeOutput } from '@/lib/chatbot/guard';
import { buildProposal, allToolDefinitions, isWriteTool, parseToolArguments, runReadTool } from '@/lib/chatbot/tools';
import { signAction } from '@/lib/chatbot/actions';
import { appendMessage, ensureSession, loadRecentMessages } from '@/lib/chatbot/history';
import { CHAT_LIMIT_ANON, CHAT_LIMIT_USER, claimChatSlot, } from '@/lib/chatbot/rate-limit';
import { CHAT_MAX_INPUT_CHARS, CHAT_MAX_TOOL_ROUNDS, type ChatProfile, type PendingAction, } from '@/lib/chatbot/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
    let body: unknown;
    try {
        body = await req.json();
    }
    catch {
        return NextResponse.json({ error: 'Format permintaan tidak valid.' }, { status: 400 });
    }
    const payload = (body ?? {}) as {
        message?: unknown;
        sessionId?: unknown;
    };
    const message = typeof payload.message === 'string' ? payload.message.trim() : '';
    const requestedSession = typeof payload.sessionId === 'string' && payload.sessionId.trim()
        ? payload.sessionId.trim()
        : null;
    if (!message) {
        return NextResponse.json({ error: 'Pesan tidak boleh kosong.' }, { status: 400 });
    }
    if (message.length > CHAT_MAX_INPUT_CHARS) {
        return NextResponse.json({ error: `Pesan terlalu panjang (maksimal ${CHAT_MAX_INPUT_CHARS} karakter).` }, { status: 400 });
    }
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    try {
        const user = await getUserFromBearer(authHeader);
        userId = user?.id ?? null;
    }
    catch {
        userId = null;
    }
    let isAdmin = false;
    if (userId) {
        try {
            isAdmin = (await getAdminUser(authHeader)) !== null;
        }
        catch {
            isAdmin = false;
        }
    }
    const profile: ChatProfile = isAdmin ? 'admin' : userId ? 'anggota' : 'publik';
    const ip = clientIp(req);
    const limitKey = userId ? `user:${userId}` : `ip:${ip}`;
    const limit = userId ? CHAT_LIMIT_USER : CHAT_LIMIT_ANON;
    const rate = claimChatSlot(limitKey, limit);
    if (!rate.allowed) {
        return NextResponse.json({
            error: `Terlalu banyak pesan. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
            retryAfterSeconds: rate.retryAfterSeconds,
        }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });
    }
    let sessionId: string | null = null;
    let history: Array<{
        role: 'user' | 'assistant';
        content: string;
    }> = [];
    if (userId && profile !== 'publik') {
        try {
            sessionId = await ensureSession(userId, profile, requestedSession);
            if (sessionId) {
                const stored = await loadRecentMessages(sessionId);
                history = stored.map(({ role, content }) => ({ role, content }));
            }
        }
        catch {
            sessionId = null;
        }
    }
    const verdict = classifyInput(message, profile);
    if (!verdict.allowed) {
        const reply = refusalMessage(verdict.category);
        if (sessionId) {
            await appendMessage(sessionId, { role: 'user', content: message });
            await appendMessage(sessionId, { role: 'assistant', content: reply });
        }
        return NextResponse.json({
            reply,
            profile,
            pendingActions: [],
            toolsUnavailable: false,
            sessionId,
            blocked: true,
        });
    }
    const messages: AiMessage[] = [
        { role: 'system', content: buildSystemPrompt(profile) },
        ...history,
        { role: 'user', content: message },
    ];
    const pendingActions: PendingAction[] = [];
    let toolsUnavailable = false;
    let replyText = '';
    try {
        for (let round = 0; round < CHAT_MAX_TOOL_ROUNDS; round += 1) {
            const result = await chatCompletion({
                messages,
                tools: profile === 'admin' ? allToolDefinitions() : undefined,
            });
            replyText = sanitizeOutput(result.content);
            if (result.toolCalls.length === 0)
                break;
            messages.push({
                role: 'assistant',
                content: result.content || null,
                tool_calls: result.toolCalls,
            });
            if (profile !== 'admin') {
                for (const call of result.toolCalls) {
                    messages.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: JSON.stringify({
                            ok: false,
                            error: 'Data operasional hanya tersedia untuk admin.',
                        }),
                    });
                }
                continue;
            }
            for (const call of result.toolCalls) {
                const name = call.function.name;
                const args = parseToolArguments(call.function.arguments);
                if (isWriteTool(name)) {
                    const proposal = buildProposal(name, args);
                    if (!proposal) {
                        messages.push({
                            role: 'tool',
                            tool_call_id: call.id,
                            content: JSON.stringify({
                                ok: false,
                                error: 'Argumen usulan tidak lengkap (butuh ID target dan alasan).',
                            }),
                        });
                        continue;
                    }
                    if (!userId) {
                        messages.push({
                            role: 'tool',
                            tool_call_id: call.id,
                            content: JSON.stringify({ ok: false, error: 'Hanya admin yang dapat mengusulkan aksi.' }),
                        });
                        continue;
                    }
                    try {
                        const { token, exp } = signAction({
                            adminId: userId,
                            action: proposal.action,
                            payload: proposal.payload,
                            reason: proposal.reason,
                        });
                        pendingActions.push({
                            token,
                            action: proposal.action,
                            label: proposal.label,
                            summary: proposal.summary,
                            targetType: proposal.targetType,
                            targetId: proposal.targetId,
                            expiresAt: new Date(exp).toISOString(),
                        });
                        messages.push({
                            role: 'tool',
                            tool_call_id: call.id,
                            content: JSON.stringify({
                                ok: true,
                                status: 'menunggu_konfirmasi',
                                pesan: 'Usulan sudah dibuat dan ditampilkan ke admin. Belum dijalankan; admin harus menekan konfirmasi.',
                            }),
                        });
                    }
                    catch (err) {
                        messages.push({
                            role: 'tool',
                            tool_call_id: call.id,
                            content: JSON.stringify({
                                ok: false,
                                error: err instanceof Error
                                    ? `Usulan tidak dapat ditandatangani: ${err.message}`
                                    : 'Usulan tidak dapat ditandatangani.',
                            }),
                        });
                    }
                    continue;
                }
                const result = await runReadTool(name, args, { adminId: userId ?? '' });
                messages.push({
                    role: 'tool',
                    tool_call_id: call.id,
                    content: JSON.stringify(result),
                });
            }
        }
    }
    catch (err) {
        if (err instanceof AiNotConfiguredError) {
            return NextResponse.json({
                error: 'Asisten belum dikonfigurasi di server. Hubungi pengelola untuk mengisi VIBE_CODE_URL dan VIBE_CODE_KEY.',
            }, { status: 503 });
        }
        if (err instanceof AiToolsUnsupportedError) {
            toolsUnavailable = true;
            try {
                const fallback = await chatCompletion({
                    messages: messages.map((m) => ({ ...m, tool_calls: undefined, tool_call_id: undefined }))
                        .filter((m) => m.role !== 'tool') as AiMessage[],
                });
                replyText = sanitizeOutput(fallback.content);
            }
            catch {
                return NextResponse.json({ error: 'Layanan asisten sedang tidak dapat dihubungi. Coba lagi sebentar.' }, { status: 502 });
            }
        }
        else if (err instanceof AiProviderError) {
            const status = err.status ?? 502;
            return NextResponse.json({
                error: status === 0
                    ? 'Layanan asisten tidak menjawab. Periksa koneksi lalu coba lagi.'
                    : `Layanan asisten bermasalah (${status}). Coba lagi sebentar.`,
            }, { status: 502 });
        }
        else {
            console.error('[chat] unexpected error', err instanceof Error ? err.message : err);
            return NextResponse.json({ error: 'Terjadi kesalahan saat memproses pesan.' }, { status: 500 });
        }
    }
    if (!replyText) {
        replyText =
            'Maaf, saya belum bisa menyusun jawaban untuk pertanyaan itu. Bisa diulang dengan kalimat lain?';
    }
    if (sessionId) {
        await appendMessage(sessionId, { role: 'user', content: message });
        await appendMessage(sessionId, {
            role: 'assistant',
            content: replyText,
            pendingActions,
        });
    }
    return NextResponse.json({
        reply: replyText,
        profile,
        pendingActions,
        toolsUnavailable,
        sessionId,
        blocked: false,
    });
}
function clientIp(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) {
        const first = forwarded.split(',')[0]?.trim();
        if (first)
            return first;
    }
    return req.headers.get('x-real-ip')?.trim() || 'unknown';
}
