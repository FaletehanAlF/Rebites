/**
 * Logika idempotensi checkout MURNI (tanpa I/O, tanpa dependency).
 *
 * Dipakai route checkout/verify agar aturan klaim, transisi state, klasifikasi
 * error, danReplay dapat diuji lokal tanpa memanggil Xendit. Aturan keras:
 * - Kunci client TIDAK PERNAH menjadi identitas/otorisasi (buyer selalu dari
 *   JWT tervalidasi; kunci di-scope per buyer di query database).
 * - `xendit_invoice_id NULL` TIDAK berarti invoice belum terbit (lihat
 *   state `unknown`).
 * - Hasil pencarian nol BUKAN bukti ketiadaan invoice (di luar modul ini).
 */

export type InvoiceState =
  | 'not_started'
  | 'inflight'
  | 'unknown'
  | 'attached'
  | 'failed';

export const INVOICE_STATES: readonly InvoiceState[] = [
  'not_started',
  'inflight',
  'unknown',
  'attached',
  'failed',
];

/** Batas panjang kunci agar tidak menjadi vektor payload raksasa. */
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

/**
 * Normalisasi + validasi kunci dari header `Idempotency-Key`.
 * @returns kunci bersih, atau null bila tidak ada / tidak valid
 * (route memakai jalur legacy tanpa idempotensi pada kasus ini).
 */
export function normalizeIdempotencyKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim();
  if (key.length === 0 || key.length > IDEMPOTENCY_KEY_MAX_LENGTH) return null;
  return key;
}

/**
 * Transisi invoice_state yang diizinkan. `from` null = baris legacy
 * (tanpa state) — tidak boleh memasuki mesin tanpa klaim eksplisit.
 */
export function canTransitionInvoiceState(
  from: InvoiceState | null | undefined,
  to: InvoiceState
): boolean {
  switch (from ?? null) {
    case null:
      return false;
    case 'not_started':
      return to === 'inflight' || to === 'failed';
    case 'inflight':
      return to === 'unknown' || to === 'attached' || to === 'failed';
    case 'unknown':
      // Kembali hanya lewat klaim resume (unknown -> inflight), atau
      // ditutup manual/definitif (unknown -> failed). DILARANG langsung
      // unknown -> attached tanpa klaim + verifikasi.
      return to === 'inflight' || to === 'failed';
    case 'attached':
      // Kegagalan hilir (mis. webhook EXPIRED datang belakangan).
      return to === 'failed';
    case 'failed':
      return false;
    default:
      return false;
  }
}

/** Hasil klasifikasi error create invoice. */
export type InvoiceErrorClass =
  | 'unknown'
  | 'definitive';

/**
 * Baca status HTTP eksplisit dari error (bila klien Xendit melampirkannya).
 *
 * `lib/server/xendit.ts` menempelkan `.status` pada error respons non-ok
 * sehingga HTTP 4xx/5xx tidak lagi hilang di balik pesan JSON. Nilai hanya
 * dipakai bila berbentuk angka 3 digit yang masuk akal; selain itu null
 * (jangan pernah mengarang status).
 */
function getExplicitHttpStatus(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null;
  const candidate = err as { status?: unknown; statusCode?: unknown };
  for (const value of [candidate.status, candidate.statusCode]) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && /^\d{3}$/.test(value.trim())) {
      return Number(value.trim());
    }
  }
  return null;
}

/**
 * Klasifikasikan error createXenditInvoice.
 * Konservatif: segala yang tidak terbukti definitif = unknown.
 * - unknown: timeout/abort/jaringan, HTTP 429, HTTP 5xx, pesan tak dikenal.
 * - definitive: HTTP 4xx selain 429 (validasi ditolak Xendit).
 * Status HTTP eksplisit pada error (`.status`) adalah bukti paling kuat dan
 * diutamakan; bila tidak ada, heuristik pesan dipakai dengan word boundary
 * agar nominal (mis. 14000) atau referensi (mis. 4221) tidak salah dibaca
 * sebagai kode status HTTP.
 */
export function classifyInvoiceError(err: unknown): InvoiceErrorClass {
  // 1) Status HTTP eksplisit dari klien Xendit (paling dapat dipercaya).
  const explicitStatus = getExplicitHttpStatus(err);
  if (explicitStatus !== null) {
    if (explicitStatus === 429 || explicitStatus >= 500) return 'unknown';
    if (explicitStatus >= 400 && explicitStatus < 500) return 'definitive';
    // Status < 400 tidak wajar untuk error -> jatuh ke heuristik pesan.
  }

  // 2) Heuristik pesan (konservatif).
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/timeout|timed\s*out|abort|fetch\s*failed|network|ECONN|ETIMEDOUT|socket|EAI_AGAIN/i.test(msg)) {
    return 'unknown';
  }
  const statusMatch = msg.match(/Xendit error (\d{3})/);
  if (statusMatch) {
    const status = Number(statusMatch[1]);
    if (status === 429 || status >= 500) return 'unknown';
    if (status >= 400 && status < 500) return 'definitive';
  }
  if (/rate.?limit|RATE_LIMIT_EXCEEDED/i.test(msg)) return 'unknown';
  // Kode status eksplisit: "status 422", "statuscode 400", "HTTP 404", atau
  // "Xendit error 4xx" (sudah ditangani di atas). Bare digit tanpa konteks
  // status -> unknown (bisa jadi nominal/referensi).
  if (/(?:status(?:code)?|HTTP|error)\D{0,10}\b(40[01]|402|403|404|422)\b/i.test(msg)) {
    return 'definitive';
  }
  return 'unknown';
}

/**
 * Fase kegagalan jalur keyed, menentukan kompensasi yang aman.
 * - `pre_gate`: gate promo/koin BELUM berjalan (mis. baris tidak dapat
 *   ditulis / stok gagal dikunci) -> spend & klaim promo belum mungkin ada.
 * - `post_gate`: gate promo/koin SUDAH berhasil (mis. penandaan `paid` gagal)
 *   -> spend dan klaim promo mungkin sudah tercatat.
 */
export type KeyedFailurePhase = 'pre_gate' | 'post_gate';

export interface KeyedFailureCompensation {
  /** true bila snapshot koin harus dibersihkan (spend belum tercatat). */
  clearCoinSnapshot: boolean;
  /** true bila promo yang terklaim harus dirilis tepat sekali. */
  releasePromo: boolean;
}

/**
 * Rencana kompensasi untuk kegagalan jalur keyed (tanpa I/O).
 *
 * - `pre_gate`: spend/klaim promo belum terjadi -> bersihkan snapshot agar
 *   trigger terminal TIDAK mencetak refund tanpa spent (anti-mint), dan
 *   JANGAN pernah memanggil `release_promo` tanpa klaim (RPC tidak idempoten:
 *   memanggilnya tanpa klaim akan mengurangi `used_count` promo milik user lain).
 * - `post_gate`: spend mungkin tercatat -> pertahankan snapshot agar trigger
 *   me-refund tepat sekali; rilis promo hanya bila memang terklaim. Pemanggil
 *   `release_promo` adalah pemenang transisi terminal tunggal, sehingga tidak
 *   ada rilis ganda.
 */
export function planKeyedFailureCompensation(
  phase: KeyedFailurePhase,
  promoClaimed: boolean
): KeyedFailureCompensation {
  if (phase === 'pre_gate') {
    return { clearCoinSnapshot: true, releasePromo: false };
  }
  return { clearCoinSnapshot: false, releasePromo: promoClaimed };
}

export interface TerminalPromoReleasePlan {
  release: boolean;
  promoCode: string | null;
}

/**
 * Rencana pelepasan promo saat order masuk keadaan terminal
 * (EXPIRED / FAILED / VOIDED) dari webhook ATAU verify.
 *
 * Dua syarat, keduanya wajib:
 * 1. `updateWon` — pemanggil MEMENANGKAN transisi atomik
 *    `payment_status: 'unpaid' -> 'failed'`. Webhook dan verify dapat
 *    memproses order yang sama; hanya pemenang yang boleh mengompensasi,
 *    sehingga `release_promo` (yang TIDAK idempoten: `GREATEST(0, used_count-1)`)
 *    tidak pernah dipanggil dua kali. Notifikasi terminal TERLAMBAT untuk
 *    order yang sudah `paid` juga tidak pernah menang (guard `unpaid`),
 *    jadi tidak melepas apa pun.
 * 2. `promoCode` non-kosong — bukti promo benar-benar diklaim. Invariant
 *    checkout: order `unpaid` dengan `promo_code` terisi selalu lolos gate
 *    `consume_promo` (kegagalan gate membatalkan/menghapus order, tidak
 *    menyisakan baris `unpaid`). Order tanpa promo -> tidak ada rilis.
 *
 * Status pembayaran ambigu / timeout tidak sampai ke sini: pemanggil hanya
 * membangun rencana untuk status terminal eksplisit, dan `updateWon` false
 * bila tidak ada transisi yang terjadi.
 */
export function planTerminalPromoRelease(opts: {
  updateWon: boolean;
  promoCode: unknown;
}): TerminalPromoReleasePlan {
  if (!opts.updateWon) return { release: false, promoCode: null };
  if (typeof opts.promoCode !== 'string') {
    return { release: false, promoCode: null };
  }
  const promoCode = opts.promoCode.trim().toUpperCase();
  if (promoCode.length === 0) return { release: false, promoCode: null };
  return { release: true, promoCode };
}

/** Klasifikasi baris order untuk respons replay. */
export type ReplayClass =
  | 'success'
  | 'attached_unpaid'
  | 'checking'
  | 'failed_final';

export interface ReplayRow {
  payment_status?: string | null;
  order_status?: string | null;
  invoice_state?: InvoiceState | null;
  xendit_invoice_id?: string | null;
}

/**
 * Petakan baris existing ke respons replay TANPA efek samping baru.
 * - success: payment paid -> kembalikan sukses (bahkan untuk jalur gratis).
 * - failed_final: payment failed/refunded atau order cancelled/refunded/failed.
 * - attached_unpaid: ada invoice ID tersimpan + belum lunas.
 * - checking: sisanya (not_started/inflight/unknown/legacy-tanpa-invoice)
 *   -> 409 retryable, JANGAN buat efek baru di jalur replay murni.
 */
export function classifyReplay(row: ReplayRow): ReplayClass {
  const payment = (row.payment_status ?? 'unpaid') as string;
  const order = (row.order_status ?? 'pending') as string;
  if (payment === 'paid') return 'success';
  if (
    payment === 'failed' ||
    payment === 'refunded' ||
    order === 'cancelled' ||
    order === 'refunded' ||
    order === 'failed'
  ) {
    return 'failed_final';
  }
  if (row.xendit_invoice_id) return 'attached_unpaid';
  if (row.invoice_state === 'attached' && !row.xendit_invoice_id) {
    // Inkonsisten: diklaim attached tanpa ID -> perlakukan sebagai checking,
    // JANGAN pernah mengarang invoice ID.
    return 'checking';
  }
  return 'checking';
}

/** Klasifikasi kegagalan tulis order (INSERT/UPDATE) untuk kompensasi stok. */
export type OrderWriteErrorClass = 'definitive' | 'unknown';

/**
 * Klasifikasi error tulis order dari supabase-js.
 *
 * HANYA penolakan sisi server yang definitif: PostgREST selalu menyertakan
 * `code` non-kosong (SQLSTATE / kode PGRST) pada respons error JSON. Error
 * jaringan/timeout/abort dari supabase-js TIDAK punya bukti bahwa pernyataan
 * database gagal (bisa saja COMMIT dengan respons hilang), jadi diklasifikasi
 * `unknown` — pemanggil WAJIB membaca ulang baris order sebelum melepas stok
 * mentah.
 *
 * Konservatif: bentuk yang tidak dikenal TIDAK pernah dianggap definitif.
 */
export function classifyOrderWriteError(err: unknown): OrderWriteErrorClass {
  if (typeof err !== 'object' || err === null) return 'unknown';
  const { code } = err as { code?: unknown };
  if (typeof code === 'string' && code.trim().length > 0) return 'definitive';
  return 'unknown';
}

/** Hasil klasifikasi kegagalan reserve_stock_for_order. */
export type ReserveOutcome = 'reserved' | 'insufficient_stock' | 'technical_error';

/**
 * Klasifikasi hasil RPC reserve_stock_for_order + baca ulang marker.
 *
 * - `markerSet` true = `stock_reserved_at` tercatat di baris order: bukti
 *   commit reservasi (RPC menulis decrement + marker dalam satu transaksi)
 *   -> lanjutkan alur, apa pun hasil responsnya.
 * - Ada error RPC tanpa marker = kegagalan TEKNIS (fungsi belum ada, izin,
 *   jaringan) — BUKAN stok kurang; pesan ke pengguna tidak boleh mengklaim
 *   stok habis.
 * - `reserved === false` TANPA error = RPC menolak secara sadar (stok
 *   tidak mencukupi) sebelum menulis apa pun.
 * - Sisanya (data null/undefined tanpa error, hasil tak terduga) =
 *   kegagalan teknis (fail-safe).
 */
export function classifyReserveOutcome(opts: {
  reserved: unknown;
  error: unknown;
  markerSet: boolean;
}): ReserveOutcome {
  if (opts.markerSet) return 'reserved';
  if (opts.error) return 'technical_error';
  if (opts.reserved === false) return 'insufficient_stock';
  if (opts.reserved === true) return 'reserved';
  return 'technical_error';
}

// ---------------------------------------------------------------------------
// Keputusan "hapus vs pertahan" setelah upaya
// transisi terminal — murni, tanpa I/O, agar dapat diuji tanpa database.
// ---------------------------------------------------------------------------

/** Alasan baris order ditahan (TIDAK dihapus) saat rollback checkout. */
export type AbandonHoldReason =
  | 'transition_unconfirmed'
  | 'stock_not_released'
  | 'compensation_pending';

export interface AbandonDeletionPlan {
  /** true hanya bila transisi terminal terkonfirmasi (tepat 1 baris / reread terminal). */
  transitionConfirmed: boolean;
  /**
   * null = tidak diketahui (baris tak terbaca); true = tidak ada reservasi
   * tertahan (belum pernah reserved ATAU sudah released); false = reserved
   * tetapi belum released.
   */
  stockReleased: boolean | null;
  /** true bila baris AMAN dihapus setelah transisi terminal. */
  mayDelete: boolean;
  /** Alasan penahanan untuk rekonsiliasi; null bila tidak ditahan. */
  hold: AbandonHoldReason | null;
}

/**
 * Keputusan murni untuk `abandonCheckoutOrder` (route checkout).
 *
 * Aturan yang ditegakkan (lihat juga audit stok/kompensasi Tahap C):
 * - Transisi terminal yang TIDAK terkonfirmasi TIDAK dianggap pembatalan
 *   terkonfirmasi; status stok pun tidak diketahui (null).
 * - Status terminal SAJA bukan bukti stok sudah dilepas: wajib marker
 *   (`stock_released_at` terisi), atau memang belum pernah reserved
 *   (`stock_reserved_at` NULL — reservasi keyed belum berjalan).
 * - `stock_reserved_at` terisi + `stock_released_at` kosong → baris
 *   DIPERTAHANKAN untuk rekonsiliasi; pelepasan tetap tugas trigger P0-B
 *   (TIDAK ada rilis stok mentah di jalur ini).
 * - Kompensasi koin/promo yang belum sukses → baris dipertahankan agar
 *   jejak kompensasi tetap tersedia untuk rekonsiliasi.
 */
export function planAbandonDeletion(opts: {
  transitionConfirmed: boolean;
  stockReservedAt?: string | null;
  stockReleasedAt?: string | null;
  compensationSettled: boolean;
}): AbandonDeletionPlan {
  if (!opts.transitionConfirmed) {
    return {
      transitionConfirmed: false,
      stockReleased: null,
      mayDelete: false,
      hold: 'transition_unconfirmed',
    };
  }
  const stockReservedAt = opts.stockReservedAt ?? null;
  const stockReleasedAt = opts.stockReleasedAt ?? null;
  // Belum reserved (marker kosong) = tidak ada yang tertahan; sudah reserved
  // HANYA dianggap selesai bila marker pelepasan juga terisi.
  const stockReleased = stockReservedAt == null || stockReleasedAt != null;
  if (!stockReleased) {
    return {
      transitionConfirmed: true,
      stockReleased: false,
      mayDelete: false,
      hold: 'stock_not_released',
    };
  }
  if (!opts.compensationSettled) {
    return {
      transitionConfirmed: true,
      stockReleased: true,
      mayDelete: false,
      hold: 'compensation_pending',
    };
  }
  return { transitionConfirmed: true, stockReleased: true, mayDelete: true, hold: null };
}

/**
 * Fallback kolom `invoice_state` HANYA untuk error skema yang benar-benar
 * menunjukkan kolom tersebut tidak ada (migration 20261008000000 belum
 * diterapkan pada database).
 *
 * - `42703` (undefined column) dan `PGRST204` (schema-cache miss) yang
 *   menyebut `invoice_state` = bukti skema → true. Pesan kosong pada kode
 *   tersebut tetap true (kolom baru satu-satunya pada payload terminal).
 * - Error jaringan/timeout (tanpa kode; pesan seperti "fetch failed") →
 *   false → JANGAN mengulang update tanpa `invoice_state`.
 * - Kode database lain — termasuk pelanggaran CHECK yang kebetulan bernama
 *   `..._invoice_state_...` (23514) — BUKAN bukti kolom hilang → false.
 * - Tanpa kode: hanya bila pesan SENDIRI menyebut kolom/skema tak dikenal
 *   terkait `invoice_state` (error terbungkus tanpa konteks PostgREST).
 */
export function isInvoiceStateColumnMissingError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const { code, message } = err as { code?: unknown; message?: unknown };
  const msg = typeof message === 'string' ? message : '';
  const mentionsColumn = /invoice_state/i.test(msg);
  if (code === '42703' || code === 'PGRST204') {
    return mentionsColumn || msg.trim() === '';
  }
  if (typeof code !== 'string' || code.trim() === '') {
    return mentionsColumn && /column|schema/i.test(msg);
  }
  return false;
}

export type CompensationRpcVerdict = {
  ok: boolean;
  reason: 'ok' | 'rpc_error' | 'data_not_true';
};

/**
 * Kontrak hasil RPC kompensasi (semua bergaya service_role, RETURNS boolean).
 *
 * - `error` ada → gagal (`rpc_error`). supabase-js resolve dengan
 *   `{ data, error }` dan TIDAK melempar untuk kegagalan RPC.
 * - `requireSuccessData` aktif (mis. release_stock): `data !== true` → gagal
 *   (`data_not_true`). release_stock mengembalikan false saat TIDAK ada
 *   stok yang dilepas (slug produk tidak ditemukan / qty tidak valid) —
 *   kegagalan keras, bukan sukses.
 * - `requireSuccessData` tidak aktif (refund_order_coins, release_promo):
 *   false BENIGN — refund tanpa hold koin (order tanpa koin / belum
 *   dipotong) atau release tanpa baris promo (UPDATE 0 baris, no-op);
 *   bukan kegagalan.
 * - Tanpa error dan kontrak sukses terpenuhi → sukses (`ok`).
 */
export function classifyCompensationRpcResult(opts: {
  data: unknown;
  error: { message?: string | null } | null | undefined;
  requireSuccessData: boolean;
}): CompensationRpcVerdict {
  if (opts.error) return { ok: false, reason: 'rpc_error' };
  if (opts.requireSuccessData && opts.data !== true) {
    return { ok: false, reason: 'data_not_true' };
  }
  return { ok: true, reason: 'ok' };
}
