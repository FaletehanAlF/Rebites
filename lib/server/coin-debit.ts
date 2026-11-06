/**
 * Klasifikasi hasil debit Coin pada settlement Xendit — logika MURNI
 * (tanpa I/O, tanpa database, tanpa dependensi baru).
 *
 * Latar:
 * - Order yang pembayarannya sudah dikonfirmasi Xendit WAJIB menjadi 'paid';
 *   itu fakta bahwa uang sudah diterima. Yang boleh gagal adalah debit
 *   Coin, dan kegagalan itu harus terekam sebagai UTANG yang dapat dikueri.
 * - `spend_order_coins` mengembalikan boolean, dan `false` TIDAK lagi berarti
 *   hanya "saldo kurang": dengan proteksi order terminal, `false` juga berarti
 *   "order sudah terminal" atau "order tidak ada". Pemanggil WAJIB memverifikasi
 *   ledger + status order sebelum menyimpulkan "insufficient".
 * - Bukti ledger ('spent') lebih kuat daripada respons RPC: respons bisa hilang
 *   SETELAH transaksi commit, sehingga debit sebenarnya sudah terjadi.
 * - `orders.coin_used` adalah NIAT (bukti diskon) dan bagian dari aritmetika
 *   order. Status utang TIDAK BOLEH mengubahnya.
 *
 * Batas bukti: modul ini hanya mengklasifikasikan. Penulisan status durable,
 * pembacaan ledger, dan pembacaan status order tetap di sisi server yang
 * memegang koneksi database.
 */

/** Hasil klasifikasi debit Coin. */
export type CoinDebitOutcome =
  /** RPC mengembalikan true: debit tercatat. */
  | 'debit_ok'
  /** Ledger sudah punya baris 'spent' (respons RPC hilang / sudah idempoten). */
  | 'already_debited'
  /** RPC false tanpa error, ledger tanpa 'spent', dan order DIKETAHUI belum terminal. */
  | 'insufficient'
  /** Order sudah terminal: tidak ada utang (order void, tidak ada yang dibayar). */
  | 'order_terminal'
  /** RPC error (atau verifikasi ledger gagal): hasil tidak dapat dipastikan. */
  | 'rpc_error'
  /**
   * RPC tidak error dan ledger tanpa 'spent', TETAPI status order tidak dapat
   * dibaca (order tidak ditemukan / query gagal). Kepemilikan/keadaan order
   * tidak diketahui => penyebab kegagalan TIDAK boleh disimpulkan "saldo
   * kurang" (R-2). Status durable: 'pending' (retryable).
   */
  | 'order_state_unknown';

/**
 * Status utang durable yang boleh ditulis ke `orders.coin_debit_status`.
 *
 * R-1: SELARAS dengan CHECK `orders_coin_debit_status_check`
 * (NULL / 'pending' / 'insufficient'). Ketiadaan utang dinyatakan sebagai
 * `null`, BUKAN sentinel string — nilai yang tidak dapat disimpan database
 * tidak boleh ada di tipe.
 */
export type CoinDebitStatus = 'pending' | 'insufficient';

/**
 * Alasan utang durable yang boleh ditulis ke `orders.coin_debit_reason`
 * (CHECK `orders_coin_debit_reason_check`).
 *
 * Catatan: 'rpc_error' juga dipakai saat status order tidak terbaca
 * ('order_state_unknown'), karena skema belum punya reason khusus untuk itu.
 * Menambah reason baru = perubahan skema (butuh persetujuan terpisah).
 */
export type CoinDebitReason = 'rpc_error' | 'insufficient_balance';

export interface CoinDebitVerdict {
  outcome: CoinDebitOutcome;
  /**
   * Utang yang harus ditulis, atau `null` bila tidak ada utang.
   * `null` adalah representasi ketiadaan yang sama dengan NULL di database.
   */
  status: CoinDebitStatus | null;
  /** null saat status null. */
  reason: CoinDebitReason | null;
  /** true => status durable WAJIB ditulis (utang ada). */
  debtRecorded: boolean;
  /** true => hasil tidak dapat dipastikan; wajib ditindaklanjuti (retryable). */
  uncertain: boolean;
}

/**
 * Predikat "order terminal" — SAMA dengan `v_is_bad` pada trigger
 * `refund_order_coins_on_terminal` (migrasi P1-A) dan dengan pemeriksaan
 * status di `spend_order_coins` (migrasi P1-C):
 *   order_status  IN ('cancelled','failed','refunded')
 *   ATAU payment_status IN ('failed','refunded')
 *
 * Penting: ini harus selalu sama dengan predikat di database, supaya
 * pemanggil tidak menyimpulkan "tidak terminal" untuk order yang sebenarnya
 * sudah void (atau sebaliknya).
 */
export function isTerminalOrderState(
  paymentStatus: string | null | undefined,
  orderStatus: string | null | undefined
): boolean {
  const payment = (paymentStatus ?? '').trim().toLowerCase();
  const order = (orderStatus ?? '').trim().toLowerCase();
  if (order === 'cancelled' || order === 'failed' || order === 'refunded') return true;
  if (payment === 'failed' || payment === 'refunded') return true;
  return false;
}

/**
 * Klasifikasikan hasil percobaan debit Coin.
 *
 * Urutan prioritas (penting):
 * 1. `data === true` -> debit sudah tercatat (RPC memastikan).
 * 2. `spentExistsInLedger` -> debit sebenarnya SUDAH terjadi meskipun
 *    respons RPC error/hilang. Tidak boleh dibuat utang palsu.
 * 3. Order DIKETAHUI terminal -> tidak ada utang: order void, tidak ada yang
 *    harus dibayar oleh pembeli.
 * 4. Ketidakpastian (RPC error ATAU verifikasi ledger gagal) -> 'pending'
 *    (retryable). TIDAK boleh disimpulkan "tidak terjadi" dan TIDAK boleh
 *    disimpulkan "insufficient".
 * 5. Status order TIDAK DIKETAHUI (null/undefined: query gagal ATAU order
 *    tidak ditemukan) -> 'order_state_unknown' + 'pending' (R-2). Tanpa
 *    bukti bahwa order masih hidup, "saldo kurang" hanyalah tebakan.
 * 6. HANYA bila order DIKETAHUI belum terminal + ledger dipastikan tanpa
 *    'spent' + RPC false tanpa error -> 'insufficient' (fakta bisnis).
 */
export function classifyCoinDebitOutcome(opts: {
  /** Nilai balik RPC spend_order_coins. */
  data: unknown;
  /** Error RPC (supabase-js me-resolve dengan { data, error }). */
  error?: { message?: string | null } | null | undefined;
  /** Ledger sudah punya baris 'spent' untuk order tsb. */
  spentExistsInLedger: boolean;
  /** Verifikasi ledger GAGAL -> status 'spent' tidak diketahui. */
  ledgerCheckFailed?: boolean;
  /**
   * Order sudah terminal? `null`/`undefined` = TIDAK diketahui (gagal
   * dibaca, order tidak ditemukan, atau pemanggil tidak menyediakannya).
   * Hanya `false` yang berarti "diketahui masih hidup".
   */
  orderIsTerminal?: boolean | null;
}): CoinDebitVerdict {
  const hasRpcError = !!opts.error;

  // 1. RPC true: debit tercatat.
  if (opts.data === true) {
    return { outcome: 'debit_ok', status: null, reason: null, debtRecorded: false, uncertain: false };
  }

  // 2. Ledger adalah bukti terkuat: debit sudah terjadi.
  if (opts.spentExistsInLedger) {
    return {
      outcome: 'already_debited',
      status: null,
      reason: null,
      debtRecorded: false,
      uncertain: false,
    };
  }

  // 3. Order void: tidak ada utang.
  if (opts.orderIsTerminal === true) {
    return {
      outcome: 'order_terminal',
      status: null,
      reason: null,
      debtRecorded: false,
      uncertain: false,
    };
  }

  // 4. Ketidakpastian: retryable, BUKAN 'insufficient'.
  if (opts.ledgerCheckFailed === true || hasRpcError) {
    return {
      outcome: 'rpc_error',
      status: 'pending',
      reason: 'rpc_error',
      debtRecorded: true,
      uncertain: true,
    };
  }

  // 5. R-2: status order tidak terbaca => bukan bukti saldo kurang.
  // Reason tetap 'rpc_error' karena itu satu-satunya reason non-insufficient
  // yang diizinkan CHECK constraint saat ini.
  if (opts.orderIsTerminal !== false) {
    return {
      outcome: 'order_state_unknown',
      status: 'pending',
      reason: 'rpc_error',
      debtRecorded: true,
      uncertain: true,
    };
  }

  // 6. RPC false tanpa error + ledger dipastikan tanpa 'spent' + order
  //    diketahui belum terminal -> saldo kurang.
  return {
    outcome: 'insufficient',
    status: 'insufficient',
    reason: 'insufficient_balance',
    debtRecorded: true,
    uncertain: false,
  };
}

/**
 * S-2: evaluasi hasil UPDATE pencatatan utang (`writeCoinDebitDebt`).
 *
 * PostgREST hanya mengembalikan baris yang terpengaruh bila statement
 * memakai `.select(...)`. Tanpa baris hasil, "tidak ada error" TIDAK berarti
 * utang tercatat (mis. filter tidak cocok / order tidak ditemukan). Kontrak:
 * sukses HANYA bila tepat satu baris dikembalikan.
 *
 * Murni: tanpa I/O, supaya hasil nol/lebih dari satu baris dapat diuji tanpa
 * database.
 */
export function interpretDebtWriteResult(opts: {
  /** Jumlah baris hasil `.select(...)`; null = tidak ada daftar baris. */
  rowCount: number | null;
  /** Error dari supabase-js (`{ data, error }`). */
  error?: { message?: string | null } | null | undefined;
}): { ok: boolean; detail: string | null } {
  if (opts.error) {
    return { ok: false, detail: opts.error.message ?? 'unknown error' };
  }
  if (opts.rowCount == null) {
    return { ok: false, detail: 'no rows returned (missing .select() or unreadable result)' };
  }
  if (opts.rowCount !== 1) {
    return { ok: false, detail: `expected exactly 1 updated row, got ${opts.rowCount}` };
  }
  return { ok: true, detail: null };
}
