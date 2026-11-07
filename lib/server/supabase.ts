import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isSuperAdminUserId, type AdminActor } from '@/lib/admin-access';
import { requestOriginFrom, resolveSiteUrl } from '@/lib/server/site-url';
import { AdminProfileQueryError, SupabaseUnavailableError, classifyAdminProfile, isSupabaseUnavailable, } from '@/lib/server/supabase-errors';
export { AdminProfileQueryError, SupabaseUnavailableError, isSupabaseUnavailable, };
function requireEnv(name: string): string {
    const raw = process.env[name];
    const value = raw?.trim();
    if (!value)
        throw new Error(`Missing env: ${name}`);
    return value;
}
const SUPABASE_FETCH_TIMEOUT_MS = 10000;
function withTimeout(timeoutMs = SUPABASE_FETCH_TIMEOUT_MS): typeof fetch {
    return (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}
export function createAnonServerClient(timeoutMs = SUPABASE_FETCH_TIMEOUT_MS): SupabaseClient {
    const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
    const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: withTimeout(timeoutMs) },
    });
}
export function queryFailureResponse(error: unknown, message: string): Response {
    if (isSupabaseUnavailable(error))
        return upstreamUnavailableResponse();
    return NextResponse.json({ error: message }, { status: 500 });
}
export function upstreamUnavailableResponse(): Response {
    return NextResponse.json({
        error: 'Tidak dapat menghubungi server data. Periksa koneksi internet lalu coba lagi.',
        code: 'UPSTREAM_UNAVAILABLE',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
export function createServiceClient(timeoutMs?: number): SupabaseClient {
    const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
    const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    return createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        ...(timeoutMs === undefined ? {} : { global: { fetch: withTimeout(timeoutMs) } }),
    });
}
export function createAuthedServerClient(authHeader: string, timeoutMs?: number): SupabaseClient {
    const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
    const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            headers: { Authorization: authHeader },
            ...(timeoutMs === undefined ? {} : { fetch: withTimeout(timeoutMs) }),
        },
    });
}
function safeServerTokenInfo(authHeader: string | null): {
    present: boolean;
    length: number;
    prefix: string;
} {
    if (!authHeader?.startsWith('Bearer '))
        return { present: false, length: 0, prefix: '(missing)' };
    const token = authHeader.slice(7).trim();
    if (!token)
        return { present: false, length: 0, prefix: '(empty)' };
    return { present: true, length: token.length, prefix: `${token.slice(0, 6)}...` };
}
function safeSupabaseHost(): string {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    if (!raw)
        return '(missing NEXT_PUBLIC_SUPABASE_URL)';
    try {
        const host = new URL(raw).hostname;
        return host || '(invalid URL: no hostname)';
    }
    catch {
        return '(invalid NEXT_PUBLIC_SUPABASE_URL)';
    }
}
function safeKeyPresence(name: string): string {
    const v = process.env[name]?.trim();
    if (!v)
        return `${name}: MISSING`;
    return `${name}: present(len=${v.length})`;
}
function safeAuthErrorDetail(error: unknown): Record<string, unknown> {
    const err = error as {
        name?: unknown;
        message?: unknown;
        status?: unknown;
        statusCode?: unknown;
        code?: unknown;
        cause?: unknown;
    };
    const out: Record<string, unknown> = {
        name: typeof err?.name === 'string' ? err.name : typeof error,
        message: typeof err?.message === 'string' ? err.message : String(error ?? '(unknown)'),
    };
    if (typeof err?.status !== 'undefined')
        out.status = err.status;
    if (typeof err?.statusCode !== 'undefined')
        out.statusCode = err.statusCode;
    if (typeof err?.code !== 'undefined')
        out.code = err.code;
    const cause = err?.cause as {
        name?: unknown;
        message?: unknown;
        code?: unknown;
        errno?: unknown;
    } | undefined;
    if (cause && typeof cause === 'object') {
        if (typeof cause.name === 'string')
            out['cause.name'] = cause.name;
        if (typeof cause.message === 'string')
            out['cause.message'] = cause.message;
        if (typeof cause.code !== 'undefined')
            out['cause.code'] = cause.code;
        if (typeof cause.errno !== 'undefined')
            out['cause.errno'] = cause.errno;
    }
    return out;
}
export async function getUserFromBearer(authHeader: string | null, debugId?: string | null): Promise<{
    id: string;
    email: string | null;
} | null> {
    const tag = debugId ? ` [${debugId}]` : '';
    if (!authHeader?.startsWith('Bearer ')) {
        if (process.env.NODE_ENV !== 'production') {
            console.debug(`[supabase-server]${tag} getUserFromBearer: Authorization header hilang/bukan Bearer`);
        }
        return null;
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
        if (process.env.NODE_ENV !== 'production') {
            console.debug(`[supabase-server]${tag} getUserFromBearer: token kosong setelah Bearer`);
        }
        return null;
    }
    if (process.env.NODE_ENV !== 'production') {
        const info = safeServerTokenInfo(authHeader);
        console.debug(`[supabase-server]${tag} getUserFromBearer: token present, len=${info.length}, prefix=${info.prefix} -> auth.getUser()...`);
    }
    let client: SupabaseClient;
    try {
        client = createAnonServerClient();
    }
    catch (e) {
        if (process.env.NODE_ENV !== 'production') {
            console.debug(`[supabase-server]${tag} getUserFromBearer: CONFIG ERROR (${e instanceof Error ? e.message : e})`, `host=${safeSupabaseHost()}`, safeKeyPresence('NEXT_PUBLIC_SUPABASE_ANON_KEY'));
        }
        return null;
    }
    let data, error;
    try {
        ({ data, error } = await client.auth.getUser(token));
    }
    catch (e) {
        if (process.env.NODE_ENV !== 'production') {
            console.debug(`[supabase-server]${tag} getUserFromBearer: JARINGAN`, JSON.stringify(safeAuthErrorDetail(e)), `host=${safeSupabaseHost()}`);
        }
        throw new SupabaseUnavailableError(e);
    }
    if (error && isSupabaseUnavailable(error)) {
        if (process.env.NODE_ENV !== 'production') {
            console.debug(`[supabase-server]${tag} getUserFromBearer: JARINGAN`, JSON.stringify(safeAuthErrorDetail(error)), `host=${safeSupabaseHost()}`, safeKeyPresence('NEXT_PUBLIC_SUPABASE_ANON_KEY'), '-> DNS/TLS/jaringan lokal. Cek: Resolve-DnsName <host> harus ke Cloudflare (104.18.x / 172.64.x)');
        }
        throw new SupabaseUnavailableError(error);
    }
    if (error || !data.user) {
        if (process.env.NODE_ENV !== 'production') {
            console.debug(`[supabase-server]${tag} getUserFromBearer: DITOLAK`, JSON.stringify(safeAuthErrorDetail(error ?? new Error('no user'))), `host=${safeSupabaseHost()}`, safeKeyPresence('NEXT_PUBLIC_SUPABASE_ANON_KEY'));
        }
        return null;
    }
    if (process.env.NODE_ENV !== 'production') {
        console.debug(`[supabase-server]${tag} getUserFromBearer: OK user=${data.user.id.slice(0, 8)}...`);
    }
    return { id: data.user.id, email: data.user.email ?? null };
}
export async function getAdminUser(authHeader: string | null): Promise<{
    id: string;
    email: string | null;
} | null> {
    const user = await getUserFromBearer(authHeader);
    if (!user)
        return null;
    const service = createServiceClient(SUPABASE_FETCH_TIMEOUT_MS);
    const { data, error } = await service
        .from('profiles')
        .select('role, account_status, deleted_at')
        .eq('id', user.id)
        .maybeSingle();
    const verdict = classifyAdminProfile(data, error);
    if (verdict.status === 'unavailable') {
        throw new SupabaseUnavailableError(verdict.error);
    }
    if (verdict.status === 'profile-error') {
        throw new AdminProfileQueryError(verdict.error);
    }
    if (verdict.status !== 'admin')
        return null;
    return user;
}
export async function isAdminUser(authHeader: string | null): Promise<boolean> {
    return (await getAdminUser(authHeader)) !== null;
}
export async function getAdminActor(authHeader: string | null): Promise<AdminActor | null> {
    const user = await getAdminUser(authHeader);
    if (!user)
        return null;
    return {
        id: user.id,
        role: 'admin',
        isSuperAdmin: isSuperAdminUserId(user.id),
    };
}
export function getSiteUrl(req?: Request): string {
    const result = resolveSiteUrl({
        configuredUrl: process.env.NEXT_PUBLIC_SITE_URL,
        requestOrigin: req ? requestOriginFrom(req) : null,
        isProduction: process.env.NODE_ENV === 'production',
    });
    if (result.missingInProduction) {
        console.warn('[supabase] NEXT_PUBLIC_SITE_URL tidak di-set di production - fallback ke http://localhost:3000. Set di Vercel Env (mis. https://rebites.vercel.app) agar redirect Xendit benar.');
    }
    if (result.replacedConfiguredPort) {
        console.warn(`[supabase] NEXT_PUBLIC_SITE_URL menunjuk port berbeda dari server yang berjalan; memakai ${result.url} agar redirect Xendit tidak berakhir ERR_CONNECTION_REFUSED.`);
    }
    return result.url;
}
