/**
 * Klasifikasi kegagalan Supabase — modul MURNI (tanpa dependensi runtime)
 * sehingga perilakunya dapat diuji langsung dengan `node --test`, sama seperti
 * `lib/admin-access.ts`.
 *
 * Kenapa dipisah dari `lib/server/supabase.ts`: modul itu mengimpor
 * `@supabase/supabase-js` dan `next/server`, yang tidak dapat dimuat oleh
 * runner tes offline (alias '@/', next/server, dan sesi Supabase asli tidak
 * tersedia). Memisahkan klasifikasi membuat bug "gangguan jaringan dilaporkan
 * sebagai 500" punya tes regresi yang benar-benar menjalankannya.
 *
 * DUA BENTUK KEGAGALAN YANG BERBEDA — dan keduanya pernah salah dilaporkan:
 *
 * 1. Auth (`auth.getUser`) MELEMPAR `AuthRetryableFetchError` (status 0) saat
 *    jaringan/TLS gagal. Kalau itu diterjemahkan menjadi 401, klien mengira
 *    sesinya habis dan admin terlempar ke halaman login padahal tokennya sah.
 *
 * 2. PostgREST TIDAK melempar. `postgrest-js` memakai
 *    `shouldThrowOnError = false` secara default, jadi kegagalan jaringan
 *    pulang sebagai nilai biasa:
 *      { data: null, error: { message: 'TypeError: fetch failed', code: '' } }
 *    Route yang menulis `(result.data ?? [])` lalu melaporkan gangguan sebagai
 *    data kosong — dashboard menampilkan 0 pengguna / 0 pesanan dan berbohong
 *    bahwa sistem sehat. Inilah akar masalah HTTP 500 yang dilaporkan.
 */

/** Dilempar saat Node tidak bisa menjangkau Supabase (DNS/TLS/timeout). */
export class SupabaseUnavailableError extends Error {
  constructor(cause: unknown) {
    super('Supabase tidak terjangkau');
    this.name = 'SupabaseUnavailableError';
    this.cause = cause;
  }
}

/**
 * Type guard sungguhan, bukan cast. `as` pada nilai `unknown` tetap boleh
 * menjadi `null`, sehingga TypeScript menolak setiap akses properti — cast
 * hanya memindahkan masalah, tidak menyelesaikannya. Guard ini mempersempit
 * `unknown` menjadi objek yang boleh dibaca field-fieldnya.
 */
function toErrorShape(value: unknown): {
  name?: unknown;
  status?: unknown;
  message?: unknown;
  code?: unknown;
} | null {
  if (typeof value !== 'object' || value === null) return null;
  return value as { name?: unknown; status?: unknown; message?: unknown; code?: unknown };
}

/**
 * Kegagalan transport (DNS / TLS / koneksi / timeout) pada error PostgREST.
 *
 * Sengaja mensyaratkan `code` KOSONG. Penolakan yang sah dari PostgREST selalu
 * membawa kode — '42501' (RLS), '42P01' (tabel hilang), 'PGRST116' (0 baris),
 * '23505' (unique) — dan penolakan itu BUKAN gangguan upstream: ia harus
 * tetap terlihat sebagai bug/drift di server, bukan 503.
 */
export function isTransportFailure(error: unknown): boolean {
  const err = toErrorShape(error);
  if (!err) return false;
  const code = typeof err.code === 'string' ? err.code.trim() : '';
  if (code) return false;
  const message = typeof err.message === 'string' ? err.message : '';
  if (!message) return false;
  return (
    /fetch failed/i.test(message) ||
    /UNABLE_TO_VERIFY_LEAF_SIGNATURE|CERT_HAS_EXPIRED|DEPTH_ZERO_SELF_SIGNED_CERT|SELF_SIGNED_CERT_IN_CHAIN|ERR_TLS_CERT_ALTNAME_INVALID|CERT_UNTRUSTED/i.test(
      message
    ) ||
    /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|UND_ERR_/i.test(message) ||
    /AbortError|TimeoutError/i.test(message)
  );
}

/**
 * true bila `error` berarti "Supabase tidak terjangkau" (→ 503, bisa diulang),
 * BUKAN "permintaan ditolak" (→ 4xx/500 sungguhan).
 */
export function isSupabaseUnavailable(error: unknown): boolean {
  if (!error) return false;
  // Dibungkus oleh getUserFromBearer() SETELAH diklasifikasikan. Tanpa cabang
  // ini pembungkusan justru menyembunyikan penyebabnya: fungsi ini memeriksa
  // `name` mentah milik Supabase, sedangkan SupabaseUnavailableError memberi
  // name-nya sendiri — sehingga route menjawab 500, bukan 503.
  if (error instanceof SupabaseUnavailableError) return true;
  const err = toErrorShape(error);
  if (!err) return false;
  if (err.name === 'SupabaseUnavailableError') return true;
  if (err.name === 'AuthRetryableFetchError') return true;
  // AbortSignal.timeout menandai dirinya sebagai AbortError/TimeoutError.
  if (err.name === 'TimeoutError' || err.name === 'AbortError') return true;
  if (typeof err.status === 'number' && err.status === 0) return true;
  if (err.message === 'fetch failed') return true;
  // Bentuk kedua: error PostgREST yang tidak pernah sampai ke catch route.
  return isTransportFailure(err);
}

/**
 * Cari kegagalan pertama di antara sekumpulan hasil query yang diberi label.
 *
 * Dashboard menjalankan belasan query sekaligus dan selama ini menulis
 * `(result.data ?? [])` + `count ?? 0`, sehingga query yang GAGAL terlihat
 * identik dengan query yang berhasil tetapi kosong. Fungsi ini membuat route
 * berhenti pada kegagalan pertama, dan label-nya menyebut query mana yang
 * gagal agar dapat ditelusuri di log server tanpa membocorkan query ke client.
 */
export function firstFailedQuery(
  entries: ReadonlyArray<readonly [string, unknown]>
): { label: string; error: unknown } | null {
  for (const [label, result] of entries) {
    if (typeof result !== 'object' || result === null) continue;
    if (!('error' in result)) continue;
    const error = (result as { error?: unknown }).error;
    if (error) return { label, error };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pemeriksaan admin (profiles.role + account_status)
// ---------------------------------------------------------------------------

/**
 * Dilempar saat query profil admin GAGAL karena PostgREST menolak permintaan
 * (RLS / kolom / tabel / drift schema). Berbeda dari `SupabaseUnavailableError`
 * (503, boleh diulang): ini bug atau drift di server, jadi route menjawab 500.
 *
 * Sebelumnya kegagalan seperti ini tidak pernah terlihat: `getAdminUser` hanya
 * membaca `{ data }`, sehingga `data === null` — baik karena baris tidak ada
 * maupun karena query gagal — sama-sama menjadi "bukan admin" alias 403.
 */
export class AdminProfileQueryError extends Error {
  constructor(cause: unknown) {
    super('Query profil admin gagal');
    this.name = 'AdminProfileQueryError';
    this.cause = cause;
  }
}

/** Status terminal yang mencabut seluruh wewenang admin. */
const REVOKED_ACCOUNT_STATUSES = ['suspended', 'banned'] as const;

export type AdminProfileVerdict =
  | { status: 'admin' }
  | { status: 'not-admin' }
  | { status: 'unavailable'; error: unknown }
  | { status: 'profile-error'; error: unknown };

/**
 * Nilai baris `profiles` hasil query admin.
 *
 * `error` WAJIB diteruskan apa adanya. Tanpa itu, kegagalan query tidak dapat
 * dibedakan dari "pengguna ini memang tidak punya baris profil" — dan admin
 * yang sah ditolak 403 tepat saat database bermasalah.
 *
 * Fail-open yang disengaja untuk `account_status`: NULL / 'active' / nilai tak
 * dikenal tetap diizinkan, supaya data lama tanpa kolom ini tidak mengunci
 * admin yang sah. Hanya dua status terminal yang ditolak — aturan yang sama
 * dengan perilaku sebelumnya.
 */
export function classifyAdminProfile(
  data: unknown,
  error: unknown
): AdminProfileVerdict {
  if (error) {
    return isSupabaseUnavailable(error)
      ? { status: 'unavailable', error }
      : { status: 'profile-error', error };
  }

  if (typeof data !== 'object' || data === null) return { status: 'not-admin' };

  const profile = data as { role?: unknown; account_status?: unknown };
  if (profile.role !== 'admin') return { status: 'not-admin' };

  const accountStatus =
    typeof profile.account_status === 'string'
      ? profile.account_status.trim().toLowerCase()
      : null;
  if (
    accountStatus !== null &&
    (REVOKED_ACCOUNT_STATUSES as readonly string[]).includes(accountStatus)
  ) {
    return { status: 'not-admin' };
  }

  return { status: 'admin' };
}
