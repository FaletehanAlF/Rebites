/**
 * Aturan harga efektif per unit untuk DISPLAY
 * di klien. Fungsi ini WAJIB mencerminkan aturan server di
 * `app/api/checkout/xendit/route.ts` (unitPrice = surplus_price ??
 * original_price, ditimpa flash_sale_price bila sekarang berada di dalam
 * rentang flash sale: now >= start && now < end). Server tetap sumber
 * kebenaran saat pesanan dibuat; helper ini hanya menyamakan tampilan
 * (detail produk & checkout) dengan nominal yang akan ditagih server.
 */

export interface FlashPricingRow {
  surplus_price?: unknown;
  original_price?: unknown;
  flash_sale_price?: unknown;
  flash_sale_start?: unknown;
  flash_sale_end?: unknown;
}

function toFinitePrice(value: unknown): number | null {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function resolveEffectiveUnitPrice(
  row: FlashPricingRow,
  now: number = Date.now()
): number {
  const base =
    toFinitePrice(row.surplus_price) ?? toFinitePrice(row.original_price) ?? 0;

  if (row.flash_sale_price != null && row.flash_sale_start && row.flash_sale_end) {
    const start = new Date(row.flash_sale_start as string | number).getTime();
    const end = new Date(row.flash_sale_end as string | number).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && now >= start && now < end) {
      const flash = toFinitePrice(row.flash_sale_price);
      if (flash != null) return flash;
    }
  }

  return base;
}
