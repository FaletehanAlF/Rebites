import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function requireEnv(name: string): string {
  const raw = process.env[name];
  const value = raw?.trim();
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export function createAnonServerClient(): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createServiceClient(): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Client anon yang meneruskan JWT caller (Authorization: Bearer <token>)
// sehingga RLS + public.is_admin() + trigger verifikasi produk melihat
// user yang sebenarnya. WAJIB dipakai untuk aksi admin (moderasi produk):
// service_role memiliki auth.uid() = null sehingga trigger
// enforce_product_verification_* akan mengembalikan kolom verifikasi ke OLD.
export function createAuthedServerClient(authHeader: string): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });
}

/** Ringkas info token untuk log dev: TIDAK PERNAH mencetak JWT penuh. */
function safeServerTokenInfo(authHeader: string | null): {
  present: boolean;
  length: number;
  prefix: string;
} {
  if (!authHeader?.startsWith('Bearer ')) return { present: false, length: 0, prefix: '(missing)' };
  const token = authHeader.slice(7).trim();
  if (!token) return { present: false, length: 0, prefix: '(empty)' };
  return { present: true, length: token.length, prefix: `${token.slice(0, 6)}...` };
}

/**
 * Diagnostik dev-only untuk koneksi server -> Supabase Auth.
 * TIDAK PERNAH log secret/token/URL penuh: hanya hostname + status
 * keberadaan key (panjang saja, bukan nilai).
 */
function safeSupabaseHost(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return '(missing NEXT_PUBLIC_SUPABASE_URL)';
  try {
    const host = new URL(raw).hostname;
    return host || '(invalid URL: no hostname)';
  } catch {
    return '(invalid NEXT_PUBLIC_SUPABASE_URL)';
  }
}

function safeKeyPresence(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) return `${name}: MISSING`;
  return `${name}: present(len=${v.length})`;
}

/**
 * Petakan error object secara aman untuk membedakan:
 * DNS failure (cause.code=ENOTFOUND) / refused (ECONNREFUSED) /
 * timeout (ETIMEDOUT/UND_ERR_CONNECT_TIMEOUT) / TLS (CERT_*) /
 * URL invalid / HTTP error Supabase (status) / JWT rejection.
 * Hanya field name/message/code/status — tidak ada secret.
 */
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
  if (typeof err?.status !== 'undefined') out.status = err.status;
  if (typeof err?.statusCode !== 'undefined') out.statusCode = err.statusCode;
  if (typeof err?.code !== 'undefined') out.code = err.code;
  const cause = err?.cause as
    | { name?: unknown; message?: unknown; code?: unknown; errno?: unknown }
    | undefined;
  if (cause && typeof cause === 'object') {
    if (typeof cause.name === 'string') out['cause.name'] = cause.name;
    if (typeof cause.message === 'string') out['cause.message'] = cause.message;
    if (typeof cause.code !== 'undefined') out['cause.code'] = cause.code;
    if (typeof cause.errno !== 'undefined') out['cause.errno'] = cause.errno;
  }
  return out;
}

export async function getUserFromBearer(
  authHeader: string | null,
  debugId?: string | null
): Promise<{ id: string; email: string | null } | null> {
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
    console.debug(
      `[supabase-server]${tag} getUserFromBearer: token present, len=${info.length}, prefix=${info.prefix} -> auth.getUser()...`
    );
  }

  let client: SupabaseClient;
  try {
    client = createAnonServerClient();
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      // Config error (env hilang): tanpa secret, hanya nama var + hostname.
      console.debug(
        `[supabase-server]${tag} getUserFromBearer: CONFIG ERROR (${e instanceof Error ? e.message : e})`,
        `host=${safeSupabaseHost()}`,
        safeKeyPresence('NEXT_PUBLIC_SUPABASE_ANON_KEY')
      );
    }
    return null;
  }
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    if (process.env.NODE_ENV !== 'production') {
      // Detail aman: name/message/cause/status — TIDAK ada token/secret/URL penuh.
      // "fetch failed" + cause.code (ENOTFOUND/ECONNREFUSED/ETIMEDOUT/CERT_*)
      // = jaringan Node->Supabase, BUKAN penolakan JWT.
      console.debug(
        `[supabase-server]${tag} getUserFromBearer: DITOLAK`,
        JSON.stringify(safeAuthErrorDetail(error ?? new Error('no user'))),
        `host=${safeSupabaseHost()}`,
        safeKeyPresence('NEXT_PUBLIC_SUPABASE_ANON_KEY')
      );
    }
    return null;
  }
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[supabase-server]${tag} getUserFromBearer: OK user=${data.user.id.slice(0, 8)}...`);
  }
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function getAdminUser(
  authHeader: string | null
): Promise<{ id: string; email: string | null } | null> {
  const user = await getUserFromBearer(authHeader);
  if (!user) return null;

  const service = createServiceClient();
  const { data } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!data || data.role !== 'admin') return null;
  return user;
}

export async function isAdminUser(
  authHeader: string | null
): Promise<boolean> {
  return (await getAdminUser(authHeader)) !== null;
}

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[supabase] NEXT_PUBLIC_SITE_URL tidak di-set di production - fallback ke http://localhost:3000. Set di Vercel Env (mis. https://rebites.vercel.app) agar redirect Xendit benar.'
      );
    }
    return 'http://localhost:3000';
  }
  return raw;
}
