/**
 * Penyesuaian ReBites Coin oleh Super Admin — logika MURNI.
 *
 * Tanpa I/O, tanpa database, tanpa dependensi baru, supaya setiap aturan di
 * sini dapat diuji tanpa sesi login maupun koneksi.
 *
 * MENGAPA ADA MODUL INI
 * Saldo koin tidak disimpan sebagai kolom. Ia turunan ledger:
 *
 *   balance = (earned + refund) - spent        (clamp minimal 0)
 *
 * Rumus itu sudah dipakai klien di `deriveSnapshot()`
 * (`hooks/use-rebites-coins.ts`). Admin yang "menyetel saldo" akan menghapus
 * jejak asal koin, jadi admin hanya boleh MENAMBAH atau MENARIK lewat entri
 * baru. Modul ini menyiapkan entri tersebut dan menolak permintaan yang akan
 * membuat saldo tidak masuk akal.
 *
 * BATAS YANG TIDAK BISA DILANGGAR DI SINI
 * `coin_transactions.amount` punya CHECK (amount > 0). Karena itu penarikan
 * TIDAK diwakili angka negatif; ia memakai tipe `spent` yang memang sudah
 * dihitung sebagai pengurang. Menulis -150 akan gagal di database, bukan
 * sekadar salah hitung.
 */

/** Batas nominal satu aksi. Sengaja kecil: koin adalah hadiah, bukan transfer. */
export const COIN_ADJUST_MAX = 10_000;

/** Panjang minimal alasan. Alasan adalah satu-satunya konteks yang dilihat user. */
export const COIN_REASON_MIN = 10;

/** Bentuk baris transaksi yang sudah ada di database (hanya yang dibutuhkan). */
export interface CoinLedgerRow {
  type: string;
  amount: number;
}

/**
 * Saldo dari sekumpulan transaksi.
 *
 * Harus identik dengan `deriveSnapshot()` di `hooks/use-rebites-coins.ts`:
 * kalau keduanya menyimpang, admin dan user melihat angka berbeda untuk orang
 * yang sama, dan masing-masing "benar" di layarnya sendiri.
 *
 * Tipe yang tidak dikenal DIABAIKAN, bukan ditebak arahnya — lebih baik saldo
 * tidak berubah daripada berubah ke arah yang salah.
 */
export function computeCoinBalance(rows: readonly CoinLedgerRow[]): number {
  let earned = 0;
  let spent = 0;
  for (const row of rows) {
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    if (row.type === 'earned' || row.type === 'refund' || row.type === 'adjustment') {
      earned += amount;
    } else if (row.type === 'spent') {
      spent += amount;
    }
  }
  // Clamp: ledger lama yang tidak konsisten tidak boleh menampilkan saldo
  // negatif, karena checkout memakai saldo ini sebagai batas pemakaian.
  return Math.max(0, earned - spent);
}

export type AdjustmentErrorCode =
  | 'invalid-amount'
  | 'amount-too-large'
  | 'reason-too-short'
  | 'insufficient-balance';

export type AdjustmentResult =
  | { ok: true; delta: number; reason: string }
  | { ok: false; code: AdjustmentErrorCode; message: string };

/**
 * Periksa permintaan penyesuaian.
 *
 * `delta` negatif = menarik koin. Urutan pemeriksaan sengaja dari yang paling
 * murah dan paling jelas, supaya pesan yang diterima admin menunjuk sebab yang
 * sebenarnya, bukan sebab pertama yang kebetulan cocok.
 */
export function validateAdjustment(input: {
  delta: number;
  reason: string;
  currentBalance: number;
}): AdjustmentResult {
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';

  if (!Number.isFinite(input.delta) || !Number.isInteger(input.delta) || input.delta === 0) {
    return {
      ok: false,
      code: 'invalid-amount',
      message: 'Jumlah koin harus bilangan bulat dan tidak nol.',
    };
  }

  if (Math.abs(input.delta) > COIN_ADJUST_MAX) {
    return {
      ok: false,
      code: 'amount-too-large',
      message: `Maksimal ${COIN_ADJUST_MAX.toLocaleString('id-ID')} koin per aksi.`,
    };
  }

  // Dicek SETELAH trim: tanpa itu, 40 spasi lolos sebagai "alasan".
  if (reason.length < COIN_REASON_MIN) {
    return {
      ok: false,
      code: 'reason-too-short',
      message: `Alasan wajib diisi minimal ${COIN_REASON_MIN} karakter.`,
    };
  }

  const saldo = Number.isFinite(input.currentBalance) ? input.currentBalance : 0;
  if (input.delta < 0 && saldo + input.delta < 0) {
    return {
      ok: false,
      code: 'insufficient-balance',
      message: `Saldo saat ini ${saldo.toLocaleString('id-ID')} koin, tidak cukup untuk menarik ${Math.abs(
        input.delta
      ).toLocaleString('id-ID')} koin.`,
    };
  }

  return { ok: true, delta: input.delta, reason };
}

/**
 * Teks yang dibaca user pada riwayat koinnya.
 *
 * Ditaruh di satu fungsi agar penandaan "[Admin]" tidak hilang entah di mana:
 * tanpa penanda, penarikan admin terlihat persis seperti potongan pesanan.
 */
export function adjustmentDescription(delta: number, reason: string): string {
  const alasan = reason.trim();
  return delta >= 0
    ? `Disesuaikan admin — ${alasan}`
    : `Ditarik admin — ${alasan}`;
}

export interface AdjustmentRow {
  type: 'adjustment' | 'spent';
  amount: number;
  description: string;
}

/**
 * Terjemahkan delta menjadi baris `coin_transactions`.
 *
 * Pemberian memakai tipe `adjustment` (menambah), penarikan memakai `spent`
 * (mengurangi). Dua-duanya dengan `amount` POSITIF, sesuai CHECK di database.
 */
export function resolveAdjustmentRow(input: { delta: number; reason: string }): AdjustmentRow {
  return {
    type: input.delta > 0 ? 'adjustment' : 'spent',
    amount: Math.abs(input.delta),
    description: adjustmentDescription(input.delta, input.reason),
  };
}
