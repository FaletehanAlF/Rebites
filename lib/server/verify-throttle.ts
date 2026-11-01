/**
 * Throttle panggilan Xendit dari polling endpoint verify.
 *
 * Server-only. Tanpa dependency dan tanpa migration/database.
 *
 * KETERBATASAN YANG DIAKUI (jangan diklaim sebagai rate limit kuat):
 * Map ini hidup di memori per proses Node. Pada deployment multi-instance
 * (serverless), tiap instance punya Map sendiri dan cold start menghapusnya,
 * sehingga batas ini TIDAK KERAS lintas instance. Ini perisai lunak untuk
 * polling client normal agar tidak memukul Xendit tiap 3 detik — BUKAN
 * pertahanan keamanan terhadap penyerang terdistribusi. Rate limit kuat
 * membutuhkan kolom database atau KV eksternal (butuh migration/dependency
 * — sengaja TIDAK dilakukan pada tahap ini).
 *
 * Aturan pakai di route verify:
 * - Panggil `claimXenditCheck(key)` tepat sebelum memanggil Xendit.
 * - `false` = masih dalam window: kembalikan status DATABASE apa adanya
 *   tanpa memanggil Xendit, tanpa mengubah status apa pun.
 * - JANGAN PERNAH mengembalikan PAID/ACTIVE dari jalur throttled kecuali
 *   database sudah mencatat status tersebut untuk invoice yang cocok.
 */

/** Jeda minimum antar panggilan Xendit untuk satu transaksi (ms). */
export const VERIFY_CHECK_WINDOW_MS = 15_000;

/** Versi detik dari window di atas, untuk dikembalikan sebagai petunjuk client. */
export const VERIFY_CHECK_WINDOW_SECONDS = 15;

const MAX_ENTRIES = 2000;

const lastCheck = new Map<string, number>();

function prune(now: number): void {
  if (lastCheck.size >= MAX_ENTRIES) {
    lastCheck.clear();
    return;
  }
  const expired: string[] = [];
  lastCheck.forEach((at, key) => {
    if (now - at >= VERIFY_CHECK_WINDOW_MS) expired.push(key);
  });
  expired.forEach((key) => lastCheck.delete(key));
}

/**
 * Klaim slot panggilan Xendit untuk `key` (mis. `order:RB-...`).
 * @returns true bila boleh memanggil Xendit sekarang (sekaligus mencatat
 * waktu); false bila masih dalam window dan pemanggil harus menjawab dari
 * status database tanpa menyentuh Xendit.
 */
export function claimXenditCheck(key: string): boolean {
  const now = Date.now();
  prune(now);
  const prev = lastCheck.get(key);
  if (prev !== undefined && now - prev < VERIFY_CHECK_WINDOW_MS) return false;
  lastCheck.set(key, now);
  return true;
}
