import { claimChatSlot } from '../chatbot/rate-limit.ts';
import { generateCourierAiReply, isGeminiConfigured, GeminiNotConfiguredError, GeminiProviderError, type CourierAiContent, type GeminiErrorReason, } from './gemini.ts';
export const COURIER_AI_LIMIT_USER = 10;
export interface CourierAiArgs {
    userId: string;
    orderCode: string;
    orderStatus: string;
    contents: CourierAiContent[];
}
export type CourierAiOutcome = {
    ok: true;
    reply: string;
} | {
    ok: false;
    reason: 'not_configured' | 'rate_limited' | 'provider_failed';
    providerReason?: GeminiErrorReason;
    message: string;
    retryAfterSeconds?: number;
};
export function claimCourierAiSlot(userId: string, now?: number) {
    return claimChatSlot(`courier-ai:${userId}`, COURIER_AI_LIMIT_USER, now);
}
export function friendlyCourierAiFailure(providerReason?: GeminiErrorReason): string {
    switch (providerReason) {
        case 'invalid_key':
            return 'Kunci Gemini belum benar. Hubungi pengelola aplikasi.';
        case 'quota_exceeded':
            return 'Kuota Kurir AI habis untuk sementara. Coba lagi nanti.';
        case 'model_unavailable':
            return 'Model Kurir AI tidak tersedia. Hubungi pengelola aplikasi.';
        case 'timeout':
            return 'Kurir AI tidak menjawab dalam batas waktu. Coba lagi sebentar.';
        case 'blocked':
            return 'Permintaan ditolak oleh filter keamanan Gemini.';
        default:
            return 'Kurir AI sedang tidak dapat menjawab. Coba lagi sebentar.';
    }
}
export async function generateDemoCourierAiReply(args: CourierAiArgs, deps: {
    fetchImpl?: typeof fetch;
    env?: NodeJS.ProcessEnv;
} = {}): Promise<CourierAiOutcome> {
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
            providerReason: 'quota_exceeded',
            message: `Terlalu banyak permintaan Kurir AI. Coba lagi dalam ${slot.retryAfterSeconds} detik.`,
            retryAfterSeconds: slot.retryAfterSeconds,
        };
    }
    try {
        const reply = await generateCourierAiReply({
            orderCode: args.orderCode,
            orderStatus: args.orderStatus,
            contents: args.contents,
        }, { fetchImpl: deps.fetchImpl, env: deps.env });
        return { ok: true, reply };
    }
    catch (err) {
        if (err instanceof GeminiNotConfiguredError) {
            return {
                ok: false,
                reason: 'not_configured',
                message: 'Kurir AI belum dikonfigurasi di server.',
            };
        }
        if (err instanceof GeminiProviderError) {
            return {
                ok: false,
                reason: 'provider_failed',
                providerReason: err.reason,
                message: friendlyCourierAiFailure(err.reason),
            };
        }
        console.error('[courier-ai] unexpected', err instanceof Error ? err.message : String(err));
        return {
            ok: false,
            reason: 'provider_failed',
            message: friendlyCourierAiFailure(undefined),
        };
    }
}
