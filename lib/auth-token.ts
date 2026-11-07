'use client';
import { supabase } from './supabase';
export class AuthError extends Error {
    status: number;
    constructor(message = 'Sesi habis, silakan login ulang.', status = 401) {
        super(message);
        this.name = 'AuthError';
        this.status = status;
    }
}
const REFRESH_MARGIN_MS = 60000;
let inFlightRefresh: Promise<string> | null = null;
async function doRefresh(): Promise<string> {
    debugLog('doRefresh: memanggil supabase.auth.refreshSession()...');
    const { data, error } = await supabase.auth.refreshSession();
    const fresh = data.session?.access_token ?? null;
    if (error || !fresh) {
        debugLog('doRefresh: GAGAL', error?.message ?? '(session null)');
        throw new AuthError('Sesi habis, silakan login ulang.', 401);
    }
    debugLog('doRefresh: OK, session baru expires_at?', data.session?.expires_at ?? '(none)');
    return fresh;
}
function runSharedRefresh(): Promise<string> {
    if (!inFlightRefresh) {
        const task = doRefresh();
        inFlightRefresh = task;
        const clear = () => {
            if (inFlightRefresh === task)
                inFlightRefresh = null;
        };
        task.then(clear, clear);
    }
    return inFlightRefresh;
}
export interface ValidAuthHeaderOptions {
    forceRefresh?: boolean;
}
export async function getValidAuthHeader(opts?: ValidAuthHeaderOptions): Promise<string> {
    if (!opts?.forceRefresh) {
        const { data: { session }, } = await supabase.auth.getSession();
        const token = session?.access_token ?? null;
        const expiresAt = session?.expires_at;
        debugLog('getValidAuthHeader: session?', Boolean(session), 'expires_at?', expiresAt ?? '(none)', 'token', safeTokenInfo(token ? `Bearer ${token}` : null));
        if (token) {
            if (typeof expiresAt !== 'number' || expiresAt <= 0) {
                debugLog('getValidAuthHeader: tanpa expires_at -> pakai token cached');
                return `Bearer ${token}`;
            }
            if (expiresAt * 1000 - Date.now() >= REFRESH_MARGIN_MS) {
                debugLog('getValidAuthHeader: token masih valid -> pakai cached');
                return `Bearer ${token}`;
            }
            debugLog('getValidAuthHeader: token masuk refresh window -> refresh serial');
        }
        else {
            debugLog('getValidAuthHeader: tanpa token cached -> coba refresh sekali');
        }
    }
    else {
        debugLog('getValidAuthHeader: forceRefresh=true -> refresh serial');
    }
    const fresh = await runSharedRefresh();
    debugLog('getValidAuthHeader: refresh OK, token baru', safeTokenInfo(`Bearer ${fresh}`));
    return `Bearer ${fresh}`;
}
export async function refreshSessionSafe(): Promise<boolean> {
    try {
        await runSharedRefresh();
        return true;
    }
    catch {
        return false;
    }
}
function safeTokenInfo(authHeader: string | null): {
    present: boolean;
    length: number;
    prefix: string;
} {
    if (!authHeader)
        return { present: false, length: 0, prefix: '(none)' };
    const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : authHeader.trim();
    if (!token)
        return { present: false, length: 0, prefix: '(empty)' };
    return { present: true, length: token.length, prefix: `${token.slice(0, 6)}...` };
}
function debugLog(...args: unknown[]): void {
    if (process.env.NODE_ENV === 'production')
        return;
// eslint-disable-next-line no-console
    console.debug('[auth-token]', ...args);
}
function mergeAuthHeader(init: RequestInit | undefined, authHeader: string, opts?: {
    overwrite?: boolean;
    debugId?: string;
}): RequestInit {
    const baseHeaders = new Headers(init?.headers);
    if (opts?.overwrite || !baseHeaders.has('Authorization')) {
        baseHeaders.set('Authorization', authHeader);
    }
    if (opts?.debugId && !baseHeaders.has('X-Debug-Request-Id')) {
        baseHeaders.set('X-Debug-Request-Id', opts.debugId);
    }
    return { ...init, headers: baseHeaders };
}
export interface FetchWithAuthOptions {
    retryOn401?: boolean;
}
export async function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit, opts?: FetchWithAuthOptions): Promise<Response> {
    const retryOn401 = opts?.retryOn401 !== false;
    const debugId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? (crypto as Crypto).randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : '(request)';
    const firstHeader = await getValidAuthHeader();
    debugLog(`fetchWithAuth [${debugId}] attempt#1`, url, 'token', safeTokenInfo(firstHeader));
    const res = await fetch(input, mergeAuthHeader(init, firstHeader, { debugId }));
    debugLog(`fetchWithAuth [${debugId}] response#1 status=`, res.status);
    if (res.status !== 401 || !retryOn401)
        return res;
    debugLog(`fetchWithAuth [${debugId}] 401 -> force-refresh + retry sekali`);
    try {
        const retryHeader = await getValidAuthHeader({ forceRefresh: true });
        debugLog(`fetchWithAuth [${debugId}] attempt#2 (retry)`, url, 'token', safeTokenInfo(retryHeader));
        const retryRes = await fetch(input, mergeAuthHeader(init, retryHeader, { overwrite: true, debugId: `${debugId}-retry` }));
        debugLog(`fetchWithAuth [${debugId}] response#2 status=`, retryRes.status);
        return retryRes;
    }
    catch (err) {
        debugLog(`fetchWithAuth [${debugId}] refresh gagal, kembalikan 401 asli`, err instanceof Error ? err.message : err);
        return res;
    }
}
