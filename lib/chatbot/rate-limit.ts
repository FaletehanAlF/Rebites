/**
 * Pembatas laju percakapan chatbot.
 *
 * SERVER-ONLY, tanpa dependency dan tanpa tabel database.
 *
 * KETERBATASAN YANG DIAKUI (jangan dianggap pertahanan penuh):
 * Map ini hidup di memori tiap proses Node. Pada deployment serverless,
 * setiap instance punya Map sendiri dan cold start menghapusnya, sehingga
 * batasnya TIDAK KERAS lintas instance. Ini perisai untuk pemakaian normal —
 * mencegah satu tab menembak ratusan pesan dan menghabiskan kuota model —
 * BUKAN pertahanan terhadap penyerang terdistribusi. Batas keras menuntut
 * penyimpanan bersama (Redis/tabel), yang berarti dependency atau migrasi baru.
 *
 * Pola dan pengakuannya sengaja meniru `lib/server/verify-throttle.ts` supaya
 * dua mekanisme setara di repo ini tidak menjelaskan hal berbeda.
 */

/** Kuota pesan untuk pengguna yang sudah login. */
export const CHAT_LIMIT_USER = 20;

/** Kuota pesan untuk pengunjung anonim (per alamat IP). */
export const CHAT_LIMIT_ANON = 8;

/** Jendela waktu kuota. */
export const CHAT_WINDOW_MS = 10 * 60 * 1000;

/** Batas jumlah entri agar Map tidak tumbuh tanpa batas. */
const MAX_ENTRIES = 5_000;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function prune(now: number): void {
  if (buckets.size < MAX_ENTRIES) return;
  // `Map.forEach` dipakai, bukan `for...of`, karena `tsconfig.json` proyek ini
  // tidak menetapkan `target` (defaultnya di bawah ES2015) — iterasi Map
  // lewat protokol iterator akan ditolak `tsc` dengan TS2802.
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) buckets.delete(key);
  });
  // Bila masih penuh, buang seluruhnya: menerima sedikit kelebihan sesaat jauh
  // lebih baik daripada menahan memori tanpa batas.
  if (buckets.size >= MAX_ENTRIES) {
    buckets.clear();
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Sisa kuota setelah pemakaian ini. */
  remaining: number;
  /** Detik sampai kuota pulih; hanya terisi saat ditolak. */
  retryAfterSeconds: number;
}

/**
 * Catat satu pemakaian dan nilai apakah masih diizinkan.
 *
 * Kunci ditentukan pemanggil: `user:<uuid>` untuk yang login, `ip:<alamat>`
 * untuk anonim. Memakai id pengguna (bukan IP) untuk yang login penting agar
 * pengguna di balik satu NAT kantor tidak saling menghabiskan kuota.
 */
export function claimChatSlot(
  key: string,
  limit: number,
  now = Date.now()
): RateLimitResult {
  prune(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + CHAT_WINDOW_MS });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: 0,
  };
}

/** Hanya untuk tes: kosongkan seluruh bucket. */
export function resetChatRateLimit(): void {
  buckets.clear();
}
