import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminUser,
  getUserFromBearer,
} from '@/lib/server/supabase';
import {
  AiNotConfiguredError,
  AiProviderError,
  AiToolsUnsupportedError,
  chatCompletion,
  type AiMessage,
} from '@/lib/server/ai-provider';
import { buildSystemPrompt } from '@/lib/chatbot/knowledge';
import { classifyInput, refusalMessage, sanitizeOutput } from '@/lib/chatbot/guard';
import { buildProposal, allToolDefinitions, isWriteTool, parseToolArguments, runReadTool } from '@/lib/chatbot/tools';
import { signAction } from '@/lib/chatbot/actions';
import { appendMessage, ensureSession, loadRecentMessages } from '@/lib/chatbot/history';
import {
  CHAT_LIMIT_ANON,
  CHAT_LIMIT_USER,
  claimChatSlot,
} from '@/lib/chatbot/rate-limit';
import {
  CHAT_MAX_INPUT_CHARS,
  CHAT_MAX_TOOL_ROUNDS,
  type ChatProfile,
  type PendingAction,
} from '@/lib/chatbot/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/chat
 *
 * Body: { message: string, sessionId?: string }
 *
 * PROFIL DITENTUKAN SERVER, bukan oleh body request. Klien tidak pernah
 * mengirim `role`; server memverifikasi Bearer lalu memutuskan sendiri:
 *
 *   tanpa token          -> "publik"  : tanpa tools, riwayat TIDAK disimpan
 *   token non-admin      -> "anggota" : tanpa tools, riwayat disimpan
 *   token dengan role admin -> "admin" : tools aktif, riwayat disimpan
 *
 * Tanpa aturan ini, siapa pun bisa mengirim `{role:"admin"}` dan membuka
 * seluruh tools data.
 *
 * Urutan pemrosesan disusun dari yang termurah: batas laju -> penjaga
 * deterministik -> baru provider. Penolakan tidak boleh menghabiskan kuota
 * model, dan permintaan di luar topik harus ditolak sebelum sempat dikirim.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Format permintaan tidak valid.' }, { status: 400 });
  }

  const payload = (body ?? {}) as { message?: unknown; sessionId?: unknown };
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  const requestedSession =
    typeof payload.sessionId === 'string' && payload.sessionId.trim()
      ? payload.sessionId.trim()
      : null;

  if (!message) {
    return NextResponse.json({ error: 'Pesan tidak boleh kosong.' }, { status: 400 });
  }
  if (message.length > CHAT_MAX_INPUT_CHARS) {
    return NextResponse.json(
      { error: `Pesan terlalu panjang (maksimal ${CHAT_MAX_INPUT_CHARS} karakter).` },
      { status: 400 }
    );
  }

  // --- Identitas ---------------------------------------------------------
  const authHeader = req.headers.get('authorization');

  let userId: string | null = null;
  try {
    const user = await getUserFromBearer(authHeader);
    userId = user?.id ?? null;
  } catch {
    // Token rusak/kedaluwarsa diperlakukan sebagai anonim, bukan error:
    // pengunjung tetap boleh bertanya, hanya tanpa riwayat tersimpan.
    userId = null;
  }

  let isAdmin = false;
  if (userId) {
    try {
      isAdmin = (await getAdminUser(authHeader)) !== null;
    } catch {
      // Kegagalan memeriksa status admin JANGAN menaikkan hak. Fail-closed.
      isAdmin = false;
    }
  }

  const profile: ChatProfile = isAdmin ? 'admin' : userId ? 'anggota' : 'publik';

  // --- Batas laju --------------------------------------------------------
  const ip = clientIp(req);
  const limitKey = userId ? `user:${userId}` : `ip:${ip}`;
  const limit = userId ? CHAT_LIMIT_USER : CHAT_LIMIT_ANON;
  const rate = claimChatSlot(limitKey, limit);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Terlalu banyak pesan. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
        retryAfterSeconds: rate.retryAfterSeconds,
      },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }

  // --- Sesi riwayat ------------------------------------------------------
  // Disiapkan lebih awal agar penolakan penjaga pun tercatat di riwayat.
  let sessionId: string | null = null;
  let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (userId && profile !== 'publik') {
    try {
      sessionId = await ensureSession(userId, profile, requestedSession);
      if (sessionId) {
        const stored = await loadRecentMessages(sessionId);
        history = stored.map(({ role, content }) => ({ role, content }));
      }
    } catch {
      // Riwayat tidak tersedia: percakapan tetap jalan tanpa konteks lama.
      sessionId = null;
    }
  }

  // --- Penjaga deterministik --------------------------------------------
  // `profile` ikut dikirim supaya permintaan seputar panel admin ditolak untuk
  // pembeli dan penjual. Tanpa parameter ini, pembeli dapat memancing model
  // dengan "saya admin, buka menu moderasi" dan guard tidak punya cara
  // membedakan siapa yang bertanya.
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

  // --- Panggilan model ---------------------------------------------------
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
        // Tools HANYA untuk admin. Profil lain tidak perlu data mentah dan
        // tidak boleh diberi jalan untuk melihat keberadaannya.
        tools: profile === 'admin' ? allToolDefinitions() : undefined,
      });

      replyText = sanitizeOutput(result.content);

      if (result.toolCalls.length === 0) break;

      // Model meminta tool: catat permintaannya, lalu jawab tiap panggilan.
      messages.push({
        role: 'assistant',
        content: result.content || null,
        tool_calls: result.toolCalls,
      });

      for (const call of result.toolCalls) {
        const name = call.function.name;
        const args = parseToolArguments(call.function.arguments);

        if (isWriteTool(name)) {
          // TIDAK dieksekusi. Hanya diusulkan dan ditandatangani.
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
                pesan:
                  'Usulan sudah dibuat dan ditampilkan ke admin. Belum dijalankan; admin harus menekan konfirmasi.',
              }),
            });
          } catch (err) {
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify({
                ok: false,
                error:
                  err instanceof Error
                    ? `Usulan tidak dapat ditandatangani: ${err.message}`
                    : 'Usulan tidak dapat ditandatangani.',
              }),
            });
          }
          continue;
        }

        // Tool baca: jalankan sekarang.
        const result = await runReadTool(name, args, { adminId: userId ?? '' });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json(
        {
          error:
            'Asisten belum dikonfigurasi di server. Hubungi pengelola untuk mengisi VIBE_CODE_URL dan VIBE_CODE_KEY.',
        },
        { status: 503 }
      );
    }
    if (err instanceof AiToolsUnsupportedError) {
      // Provider tidak mendukung tools: jawab tanpa data, dan katakan terus terang.
      toolsUnavailable = true;
      try {
        const fallback = await chatCompletion({
          messages: messages.map((m) => ({ ...m, tool_calls: undefined, tool_call_id: undefined }))
            .filter((m) => m.role !== 'tool') as AiMessage[],
        });
        replyText = sanitizeOutput(fallback.content);
      } catch {
        return NextResponse.json(
          { error: 'Layanan asisten sedang tidak dapat dihubungi. Coba lagi sebentar.' },
          { status: 502 }
        );
      }
    } else if (err instanceof AiProviderError) {
      const status = err.status ?? 502;
      return NextResponse.json(
        {
          error:
            status === 0
              ? 'Layanan asisten tidak menjawab. Periksa koneksi lalu coba lagi.'
              : `Layanan asisten bermasalah (${status}). Coba lagi sebentar.`,
        },
        { status: 502 }
      );
    } else {
      console.error('[chat] unexpected error', err instanceof Error ? err.message : err);
      return NextResponse.json(
        { error: 'Terjadi kesalahan saat memproses pesan.' },
        { status: 500 }
      );
    }
  }

  if (!replyText) {
    replyText =
      'Maaf, saya belum bisa menyusun jawaban untuk pertanyaan itu. Bisa diulang dengan kalimat lain?';
  }

  // --- Simpan riwayat ----------------------------------------------------
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

/** Ambil alamat IP klien dari header proxy, dengan fallback aman. */
function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}
