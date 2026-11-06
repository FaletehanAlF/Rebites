'use client';

import { supabase } from './supabase';

/**
 * Helper TUNGGAL untuk Authorization Bearer di browser (buyer + admin + checkout).
 *
 * Root cause 401 sebelumnya: hampir semua fetch buyer memanggil
 * `supabase.auth.getSession()` lalu langsung memakai `session.access_token`.
 * `getSession()` hanya membaca cache lokal dan TIDAK me-refresh token yang
 * sudah expired. Supabase `autoRefreshToken` berjalan di background, tetapi
 * ada window di mana token cached sudah expired sementara refresh belum jalan
 * (tab idle, race antar request). Server memvalidasi JWT via
 * `auth.getUser(token)` -> expired -> null -> API 401, padahal UI masih
 * terlihat login (user lokal masih ada).
 *
 * Helper ini dipakai SEMUA fetch ke /api/* yang butuh Bearer:
 * - memakai SATU browser client yang sudah ada (@/lib/supabase, anon key)
 * - memakai token cached bila masih valid (> margin 60 detik)
 * - refresh HANYA bila perlu, secara serial via shared in-flight promise
 *   (menghindari double-refresh + refresh-token rotation race)
 * - WAJIB mengecek error refresh; TIDAK PERNAH fallback ke token basi
 * - tidak menyimpan token manual ke localStorage (persist milik supabase-js)
 * - tidak signOut otomatis, tidak reload halaman
 */

export class AuthError extends Error {
  status: number;

  constructor(message = 'Sesi habis, silakan login ulang.', status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

const REFRESH_MARGIN_MS = 60_000;

let inFlightRefresh: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  debugLog('doRefresh: memanggil supabase.auth.refreshSession()...');
  const { data, error } = await supabase.auth.refreshSession();
  const fresh = data.session?.access_token ?? null;
  // Jangan pernah fallback ke token lama: refresh gagal / session null
  // berarti tidak ada kredensial valid untuk dikirim ke API.
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
      if (inFlightRefresh === task) inFlightRefresh = null;
    };
    task.then(clear, clear);
  }
  return inFlightRefresh;
}

export interface ValidAuthHeaderOptions {
  /** Bila true, lewati token cached dan paksa refresh serial satu kali. */
  forceRefresh?: boolean;
}

/**
 * Kembalikan `Bearer <access_token>` yang valid (fresh bila perlu).
 * Throw AuthError(401) bila tidak ada session valid dan refresh gagal.
 * Tidak pernah mengembalikan token basi.
 */
export async function getValidAuthHeader(
  opts?: ValidAuthHeaderOptions
): Promise<string> {
  if (!opts?.forceRefresh) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? null;
    const expiresAt = session?.expires_at;
    debugLog('getValidAuthHeader: session?', Boolean(session), 'expires_at?', expiresAt ?? '(none)', 'token', safeTokenInfo(token ? `Bearer ${token}` : null));
    if (token) {
      // Bila expires_at tidak tersedia, jangan tebak: pakai token apa adanya,
      // server yang menilai. Ini menghindari refresh membabi-buta.
      if (typeof expiresAt !== 'number' || expiresAt <= 0) {
        debugLog('getValidAuthHeader: tanpa expires_at -> pakai token cached');
        return `Bearer ${token}`;
      }
      if (expiresAt * 1000 - Date.now() >= REFRESH_MARGIN_MS) {
        debugLog('getValidAuthHeader: token masih valid -> pakai cached');
        return `Bearer ${token}`;
      }
      debugLog('getValidAuthHeader: token masuk refresh window -> refresh serial');
      // Token masuk refresh window -> lanjut ke refresh serial di bawah.
    } else {
      debugLog('getValidAuthHeader: tanpa token cached -> coba refresh sekali');
    }
    // Tanpa token -> coba refresh sekali (tab idle mungkin masih punya
    // refresh_token valid). Gagal = throw 401, bukan kirim string kosong.
  } else {
    debugLog('getValidAuthHeader: forceRefresh=true -> refresh serial');
  }

  const fresh = await runSharedRefresh();
  debugLog('getValidAuthHeader: refresh OK, token baru', safeTokenInfo(`Bearer ${fresh}`));
  return `Bearer ${fresh}`;
}

/**
 * Paksa refresh session secara aman (serial, shared promise).
 * Return true bila ada session valid setelah refresh, false bila gagal.
 * Tidak pernah throw; tidak pernah signOut otomatis.
 */
export async function refreshSessionSafe(): Promise<boolean> {
  try {
    await runSharedRefresh();
    return true;
  } catch {
    return false;
  }
}

/**
 * DEBUG aman (dev-only): ringkas info token tanpa pernah mencetak JWT penuh,
 * refresh token, secret, atau cookie. Hanya: ada/tidak, panjang, prefix
 * 6 karakter pertama (untuk korelasi browser<->server), expires_at.
 */
function safeTokenInfo(authHeader: string | null): {
  present: boolean;
  length: number;
  prefix: string;
} {
  if (!authHeader) return { present: false, length: 0, prefix: '(none)' };
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : authHeader.trim();
  if (!token) return { present: false, length: 0, prefix: '(empty)' };
  return { present: true, length: token.length, prefix: `${token.slice(0, 6)}...` };
}

function debugLog(...args: unknown[]): void {
  if (process.env.NODE_ENV === 'production') return;
  // eslint-disable-next-line no-console
  console.debug('[auth-token]', ...args);
}

function mergeAuthHeader(
  init: RequestInit | undefined,
  authHeader: string,
  opts?: { overwrite?: boolean; debugId?: string }
): RequestInit {
  const baseHeaders = new Headers(init?.headers);
  // Attempt pertama: hormati Authorization caller bila sudah ada.
  // Retry setelah refresh: WAJIB overwrite dengan token hasil refresh,
  // kalau tidak retry mengirim token basi yang sama lagi (bug 401 berulang).
  if (opts?.overwrite || !baseHeaders.has('Authorization')) {
    baseHeaders.set('Authorization', authHeader);
  }
  if (opts?.debugId && !baseHeaders.has('X-Debug-Request-Id')) {
    baseHeaders.set('X-Debug-Request-Id', opts.debugId);
  }
  return { ...init, headers: baseHeaders };
}

export interface FetchWithAuthOptions {
  /** Default true: bila respons pertama 401, force-refresh sekali lalu retry sekali. */
  retryOn401?: boolean;
}

/**
 * Fetch ke API internal dengan Bearer yang selalu fresh + retry 1x saat 401.
 *
 * - Request pertama memakai getValidAuthHeader() (refresh proaktif bila
 *   token masuk margin expired).
 * - Bila server menjawab 401 (token expired di tengah jalan / race),
 *   lakukan force-refresh serial satu kali lalu ulangi request satu kali
 *   dengan token terbaru.
 * - Bila refresh gagal, kembalikan respons 401 asli agar caller menampilkan
 *   pesan login TANPA logout paksa / reload halaman.
 * - Throw AuthError hanya bila sejak awal tidak ada session valid sama sekali.
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts?: FetchWithAuthOptions
): Promise<Response> {
  const retryOn401 = opts?.retryOn401 !== false;
  // Correlation marker browser -> server (header X-Debug-Request-Id).
  const debugId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? (crypto as Crypto).randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : '(request)';

  const firstHeader = await getValidAuthHeader();
  debugLog(`fetchWithAuth [${debugId}] attempt#1`, url, 'token', safeTokenInfo(firstHeader));
  const res = await fetch(input, mergeAuthHeader(init, firstHeader, { debugId }));
  debugLog(`fetchWithAuth [${debugId}] response#1 status=`, res.status);
  if (res.status !== 401 || !retryOn401) return res;

  // 401 belum tentu sesi benar-benar habis: bisa token masuk refresh window
  // saat request dikirim. Refresh aman satu kali lalu retry satu kali
  // dengan header DITIMPA token hasil refresh (bukan header lama).
  debugLog(`fetchWithAuth [${debugId}] 401 -> force-refresh + retry sekali`);
  try {
    const retryHeader = await getValidAuthHeader({ forceRefresh: true });
    debugLog(`fetchWithAuth [${debugId}] attempt#2 (retry)`, url, 'token', safeTokenInfo(retryHeader));
    const retryRes = await fetch(
      input,
      mergeAuthHeader(init, retryHeader, { overwrite: true, debugId: `${debugId}-retry` })
    );
    debugLog(`fetchWithAuth [${debugId}] response#2 status=`, retryRes.status);
    return retryRes;
  } catch (err) {
    debugLog(`fetchWithAuth [${debugId}] refresh gagal, kembalikan 401 asli`, err instanceof Error ? err.message : err);
    return res;
  }
}
