import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
export const ACTION_TOKEN_TTL_MS = 10 * 60 * 1000;
const TOKEN_PREFIX = 'v1';
export interface ActionPayload {
    adminId: string;
    action: string;
    payload: Record<string, string | number | boolean | null>;
    reason: string;
    exp: number;
    nonce: string;
}
export class ActionTokenError extends Error {
    code: 'missing-secret' | 'malformed' | 'bad-signature' | 'expired' | 'wrong-admin';
    constructor(code: ActionTokenError['code'], message: string) {
        super(message);
        this.name = 'ActionTokenError';
        this.code = code;
    }
}
function base64url(input: Buffer | string): string {
    return Buffer.from(input).toString('base64url');
}
export function resolveActionSecret(env: NodeJS.ProcessEnv = process.env): Buffer {
    const explicit = env.CHATBOT_ACTION_SECRET?.trim();
    if (explicit)
        return Buffer.from(explicit, 'utf8');
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (serviceKey) {
        return Buffer.from(createHmac('sha256', serviceKey).update('chatbot-actions').digest('hex'), 'utf8');
    }
    throw new ActionTokenError('missing-secret', 'CHATBOT_ACTION_SECRET atau SUPABASE_SERVICE_ROLE_KEY harus diisi untuk menandatangani aksi.');
}
function sign(encoded: string, secret: Buffer): string {
    return createHmac('sha256', secret).update(encoded).digest('base64url');
}
function safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length)
        return false;
    return timingSafeEqual(bufA, bufB);
}
export interface SignActionArgs {
    adminId: string;
    action: string;
    payload: Record<string, string | number | boolean | null>;
    reason: string;
    now?: number;
    nonce?: string;
    env?: NodeJS.ProcessEnv;
}
export function signAction(args: SignActionArgs): {
    token: string;
    exp: number;
} {
    const now = args.now ?? Date.now();
    const exp = now + ACTION_TOKEN_TTL_MS;
    const body: ActionPayload = {
        adminId: args.adminId,
        action: args.action,
        payload: args.payload,
        reason: args.reason,
        exp,
        nonce: args.nonce ?? createHash('sha256').update(`${now}:${Math.random()}`).digest('hex').slice(0, 16),
    };
    const encoded = base64url(JSON.stringify(body));
    const secret = resolveActionSecret(args.env);
    const token = `${TOKEN_PREFIX}.${encoded}.${sign(encoded, secret)}`;
    return { token, exp };
}
export function verifyAction(token: string, expectedAdminId: string, opts?: {
    now?: number;
    env?: NodeJS.ProcessEnv;
}): ActionPayload {
    const raw = (token ?? '').trim();
    if (!raw)
        throw new ActionTokenError('malformed', 'Token aksi kosong.');
    const parts = raw.split('.');
    if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
        throw new ActionTokenError('malformed', 'Token aksi tidak dikenali.');
    }
    const [, encoded, signature] = parts;
    const secret = resolveActionSecret(opts?.env);
    const expectedSignature = sign(encoded, secret);
    if (!safeEqual(signature, expectedSignature)) {
        throw new ActionTokenError('bad-signature', 'Tanda tangan token aksi tidak sah.');
    }
    let parsed: ActionPayload;
    try {
        parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ActionPayload;
    }
    catch {
        throw new ActionTokenError('malformed', 'Isi token aksi tidak dapat dibaca.');
    }
    if (typeof parsed?.exp !== 'number' || typeof parsed?.action !== 'string') {
        throw new ActionTokenError('malformed', 'Isi token aksi tidak lengkap.');
    }
    const now = opts?.now ?? Date.now();
    if (now > parsed.exp) {
        throw new ActionTokenError('expired', 'Usulan aksi sudah kedaluwarsa. Minta ulang.');
    }
    if (parsed.adminId !== expectedAdminId) {
        throw new ActionTokenError('wrong-admin', 'Usulan aksi ini dibuat untuk admin lain dan tidak dapat dieksekusi.');
    }
    return parsed;
}
export function actionErrorMessage(error: unknown): string {
    if (error instanceof ActionTokenError) {
        switch (error.code) {
            case 'expired':
                return 'Usulan aksi sudah kedaluwarsa. Silakan minta ulang dari asisten.';
            case 'wrong-admin':
                return 'Usulan aksi ini bukan milik Anda. Minta ulang dari asisten.';
            case 'missing-secret':
                return 'Fitur aksi asisten belum dikonfigurasi di server.';
            default:
                return 'Usulan aksi tidak sah. Minta ulang dari asisten.';
        }
    }
    return 'Usulan aksi tidak dapat diproses.';
}
