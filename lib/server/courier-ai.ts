/**
 * Kurir AI untuk pesanan DEMO — jembatan antara route dan klien Gemini.
 *
 * SERVER-ONLY. Tidak menyentuh database: route yang memverifikasi partisipan
 * dan menulis baris `courier_messages` (lewat service client, sender_kind
 * `ai_courier`). Modul ini:
 *   1. menolak semua permintaan AI bila `GEMINI_API_KEY` belum diisi
 *      (route lalu memakai balasan Kurir Demo deterministik seperti dulu);
 *   2. membatasi panggilan AI per pengguna (rate limit di memori, pola yang
 *      sama dengan chatbot — BUKAN batas keras lintas instance);
 *   3. menghasilkan balasan yang sudah disanitasi.
 *
 * Keputusan "pesanan ini demo?" TIDAK diambil di sini — ia wajib diputuskan
 * server dari `delivery_assignments.is_demo`, bukan dari body request.
 */

// Import relatif (bukan alias @/): tes menjalankan file ini langsung dengan
// `node --test`, yang tidak memahami path alias tsconfig.
import { claimChatSlot } from '../chatbot/rate-limit.ts';
import {
  generateCourierAiReply,
  isGeminiConfigured,
  GeminiNotConfiguredError,
  GeminiProviderError,
} from './gemini.ts';

/** Kuota panggilan Kurir AI per pengguna (per 10 menit). */
export const COURIER_AI_LIMIT_USER = 10;

export type CourierAiOutcome =
  | { ok: true; reply: string }
  | {
      ok: false;
      reason: 'not_configured' | 'rate_limited' | 'provider_failed';
      /** Pesan publik yang aman — tidak pernah memuat key/internal. */
      message: string;
      /** Detik sampai kuota pulih; hanya untuk rate_limited. */
      retryAfterSeconds?: number;
    };

export function claimCourierAiSlot(userId: string, now?: number) {
  return claimChatSlot(`courier-ai:${userId}`, COURIER_AI_LIMIT_USER, now);
}

/**
 * Hasilkan balasan Kurir AI. Deps dipakai tes: `fetchImpl` menggantikan
 * panggilan jaringan dan `env` mengganti environment tanpa menyentuh proses.
 */
export async function generateDemoCourierAiReply(
  args: {
    userId: string;
    orderCode: string;
    orderStatus: string;
    message: string;
  },
  deps: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv } = {}
): Promise<CourierAiOutcome> {
  if (!isGeminiConfigured(deps.env)) {
    return {
      ok: false,
      reason: 'not_configured',
      message: 'Kurir AI belum dikonfigurasi di server.',
    };
  }

  const slot = claimCourierAiSlot(args.userId);
  if (!slot.allowed) {
    return {
      ok: false,
      reason: 'rate_limited',
      message: `Terlalu banyak permintaan Kurir AI. Coba lagi dalam ${slot.retryAfterSeconds} detik.`,
      retryAfterSeconds: slot.retryAfterSeconds,
    };
  }

  try {
    const reply = await generateCourierAiReply(
      {
        orderCode: args.orderCode,
        orderStatus: args.orderStatus,
        message: args.message,
      },
      { fetchImpl: deps.fetchImpl, env: deps.env }
    );
    return { ok: true, reply };
  } catch (err) {
    if (err instanceof GeminiNotConfiguredError) {
      return {
        ok: false,
        reason: 'not_configured',
        message: 'Kurir AI belum dikonfigurasi di server.',
      };
    }
    if (err instanceof GeminiProviderError) {
      // Pesan provider tidak pernah diteruskan apa adanya.
      return {
        ok: false,
        reason: 'provider_failed',
        message: 'Kurir AI sedang tidak dapat menjawab. Coba lagi sebentar.',
      };
    }
    console.error('[courier-ai] unexpected', err instanceof Error ? err.message : String(err));
    return {
      ok: false,
      reason: 'provider_failed',
      message: 'Kurir AI sedang tidak dapat menjawab. Coba lagi sebentar.',
    };
  }
}
