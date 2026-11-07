export interface FlashPricingRow {
    surplus_price?: unknown;
    original_price?: unknown;
    flash_sale_price?: unknown;
    flash_sale_start?: unknown;
    flash_sale_end?: unknown;
}
function toFinitePrice(value: unknown): number | null {
    if (value == null)
        return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}
export function resolveEffectiveUnitPrice(row: FlashPricingRow, now: number = Date.now()): number {
    const base = toFinitePrice(row.surplus_price) ?? toFinitePrice(row.original_price) ?? 0;
    if (row.flash_sale_price != null && row.flash_sale_start && row.flash_sale_end) {
        const start = new Date(row.flash_sale_start as string | number).getTime();
        const end = new Date(row.flash_sale_end as string | number).getTime();
        if (Number.isFinite(start) && Number.isFinite(end) && now >= start && now < end) {
            const flash = toFinitePrice(row.flash_sale_price);
            if (flash != null)
                return flash;
        }
    }
    return base;
}
