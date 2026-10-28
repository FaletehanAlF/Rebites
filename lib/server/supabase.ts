import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isSuperAdminUserId, type AdminActor } from '@/lib/admin-access';
import {
  AdminProfileQueryError,
  SupabaseUnavailableError,
  classifyAdminProfile,
  isSupabaseUnavailable,
} from '@/lib/server/supabase-errors';

export {
  AdminProfileQueryError,
  SupabaseUnavailableError,
  isSupabaseUnavailable,
};

function requireEnv(name: string): string {
  const raw = process.env[name];
  const value = raw?.trim();
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

// Batas waktu untuk panggilan server -> Supabase. Tanpa ini, DNS yang
// diarahkan ke host salah (atau jaringan putus) membuat tiap request admin
// menggantung sampai fetch default menyerah — dashboard memanggil 3 endpoint
// sekaligus, jadi halaman terasa "rusak" alih-alih menampilkan pesan.
const SUPABASE_FETCH_TIMEOUT_MS = 10_000;

function withTimeout(timeoutMs = SUPABASE_FETCH_TIMEOUT_MS): typeof fetch {
  return (input, init) =>
    fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

export function createAnonServerClient(
  timeoutMs = SUPABASE_FETCH_TIMEOUT_MS
): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: withTimeout(timeoutMs) },
  });
}

/**
 * Respons untuk query yang gagal, dengan status yang jujur:
 * 503 bila Supabase tidak terjangkau (bisa dicoba lagi), 500 bila PostgREST
 * menolak permintaannya (RLS/kolom/tabel — bug atau drift schema).
 *
 * @param message Pesan publik yang aman; TIDAK pernah memuat pesan internal.
 */
export function queryFailureResponse(error: unknown, message: string): Response {
  if (isSupabaseUnavailable(error)) return upstreamUnavailableResponse();
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Respons standar saat Supabase tidak terjangkau. 503 — bukan 401 — supaya
 * klien tidak "keluar" dari sesi dan tahu bahwa ini bisa dicoba lagi.
 */
export function upstreamUnavailableResponse(): Response {
  return NextResponse.json(
    {
      error:
        'Tidak dapat menghubungi server data. Periksa koneksi internet lalu coba lagi.',
      code: 'UPSTREAM_UNAVAILABLE',
    },
    { status: 503, headers: { 'Cache-Control': 'no-store' } }
  );
}

export function createServiceClient(
  timeoutMs?: number
): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Default tetap tanpa timeout agar perilaku pemanggil lama (webhook,
    // checkout, verifikasi) tidak berubah. Pemeriksaan admin meminta timeout
    // eksplisit: tanpa itu, DNS yang salah membuat setiap route admin
    // menggantung alih-alih menjawab 503.
    ...(timeoutMs === undefined ? {} : { global: { fetch: withTimeout(timeoutMs) } }),
  });
}

// Client anon yang meneruskan JWT caller (Authorization: Bearer <token>)
// sehingga RLS + public.is_admin() + trigger verifikasi produk melihat
// user yang sebenarnya. WAJIB dipakai untuk aksi admin (moderasi produk):
// service_role memiliki auth.uid() = null sehingga trigger
// enforce_product_verification_* akan mengembalikan kolom verifikasi ke OLD.
export function createAuthedServerClient(
  authHeader: string,
  timeoutMs?: number
): SupabaseClient {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: authHeader },
      // Default tetap tanpa timeout agar perilaku route admin lama tidak
      // berubah. Health check meminta timeout eksplisit yang lebih pendek.
      ...(timeoutMs === undefined ? {} : { fetch: withTimeout(timeoutMs) }),
    },
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
  let data, error;
  try {
    ({ data, error } = await client.auth.getUser(token));
  } catch (e) {
    // fetch/AbortError yang lolos dari Supabase: Supabase tidak terjangkau.
    if (process.env.NODE_ENV !== 'production') {
      console.debug(
        `[supabase-server]${tag} getUserFromBearer: JARINGAN`,
        JSON.stringify(safeAuthErrorDetail(e)),
        `host=${safeSupabaseHost()}`
      );
    }
    throw new SupabaseUnavailableError(e);
  }
  if (error && isSupabaseUnavailable(error)) {
    // Supabase membungkus kegagalan jaringan sebagai AuthRetryableFetchError
    // (status 0). Ini BUKAN penolakan token: jangan diterjemahkan jadi 401.
    if (process.env.NODE_ENV !== 'production') {
      console.debug(
        `[supabase-server]${tag} getUserFromBearer: JARINGAN`,
        JSON.stringify(safeAuthErrorDetail(error)),
        `host=${safeSupabaseHost()}`,
        safeKeyPresence('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
        '-> DNS/TLS/jaringan lokal. Cek: Resolve-DnsName <host> harus ke Cloudflare (104.18.x / 172.64.x)'
      );
    }
    throw new SupabaseUnavailableError(error);
  }
  if (error || !data.user) {
    // Supabase terjangkau tapi menolak token / tidak mengembalikan user:
    // ini benar-benar "tidak login", bukan gangguan jaringan.
    if (process.env.NODE_ENV !== 'production') {
      // Detail aman: name/message/cause/status — TIDAK ada token/secret/URL penuh.
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

/**
 * Verifikasi admin: token terverifikasi + profiles.role='admin' + tidak kena
 * sanksi suspend/ban.
 *
 * `null` HANYA berarti "bukan admin" (tanpa sesi, token ditolak, role bukan
 * admin, atau akun dikenai sanksi). Kegagalan MEMBACA profil sengaja dilempar:
 * - `SupabaseUnavailableError` → route menjawab 503 (boleh dicoba lagi);
 * - `AdminProfileQueryError`   → route menjawab 500 (RLS/schema, bukan 403).
 *
 * Sebelumnya keduanya menyamar sebagai `null`, sehingga admin yang sah ditolak
 * 403 "Hanya admin" tepat ketika database sedang bermasalah — dan klien
 * mengira sesinya hilang.
 */
export async function getAdminUser(
  authHeader: string | null
): Promise<{ id: string; email: string | null } | null> {
  const user = await getUserFromBearer(authHeader);
  if (!user) return null;

  const service = createServiceClient(SUPABASE_FETCH_TIMEOUT_MS);
  const { data, error } = await service
    .from('profiles')
    .select('role, account_status')
    .eq('id', user.id)
    .maybeSingle();

  const verdict = classifyAdminProfile(data, error);
  if (verdict.status === 'unavailable') {
    throw new SupabaseUnavailableError(verdict.error);
  }
  if (verdict.status === 'profile-error') {
    throw new AdminProfileQueryError(verdict.error);
  }
  // Status sanksi (suspend/ban) HARUS mencabut akses admin.
  //
  // Sebelumnya kolom ini hanya ditulis (api/admin/sanctions) dan dihitung
  // untuk statistik dasbor, tetapi tidak pernah dibaca saat otorisasi —
  // sehingga admin yang "diblokir" tetap memegang seluruh wewenang admin.
  // Aturan nilainya ada di classifyAdminProfile() agar dapat diuji langsung.
  if (verdict.status !== 'admin') return null;

  return user;
}

export async function isAdminUser(
  authHeader: string | null
): Promise<boolean> {
  return (await getAdminUser(authHeader)) !== null;
}

/**
 * Actor admin untuk keputusan sensitif (ubah peran / sanksi).
 *
 * `isSuperAdmin` HANYA true bila id user hasil verifikasi server
 * (`auth.getUser`) sama persis dengan SUPER_ADMIN_USER_ID yang
 * dikonfigurasi. Env kosong/tidak valid → semua actor isSuperAdmin=false
 * (fail-closed; admin tim tetap admin biasa). Nilai env/UUID TIDAK pernah
 * dikembalikan ke client — hanya boolean.
 */
export async function getAdminActor(
  authHeader: string | null
): Promise<AdminActor | null> {
  const user = await getAdminUser(authHeader);
  if (!user) return null;
  return {
    id: user.id,
    role: 'admin',
    isSuperAdmin: isSuperAdminUserId(user.id),
  };
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
