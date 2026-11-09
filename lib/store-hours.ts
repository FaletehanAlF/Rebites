export function isStoreOpen(availableFrom: string, availableTo: string, now = new Date()): boolean {
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;
    const from = parseClock(availableFrom);
    const to = parseClock(availableTo);
    if (from === null || to === null)
        return true;
    return currentTimeInMinutes >= from && currentTimeInMinutes <= to;
}

function parseClock(value: string): number | null {
    const [h, m] = value.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m))
        return null;
    return h * 60 + m;
}

export interface VendorStoreStatus {
    openHours: string | null | undefined;
    isOpen?: boolean | null;
    isActive?: boolean | null;
}

// "09.00-21.00" (juga en-dash) -> { from: "09:00", to: "21:00" }
export function parseVendorHours(openHours: string | null | undefined): { from: string; to: string } | null {
    if (typeof openHours !== 'string')
        return null;
    const match = openHours.trim().match(/(\d{1,2})\.(\d{2})\s*[–-]\s*(\d{1,2})\.(\d{2})/);
    if (!match)
        return null;
    const fmt = (h: string, m: string) => `${Math.min(23, Math.max(0, Number(h))).toString().padStart(2, '0')}:${m}`;
    return { from: fmt(match[1], match[2]), to: fmt(match[3], match[4]) };
}

export interface VendorPurchaseWindow {
    closed: boolean;
    from: string;
    to: string;
}

// Sumber kebenaran sama dengan app/api/checkout/xendit: toko nonaktif,
// keluaran manual (is_open), atau di luar jam operasional => tidak bisa dilakukan sekarang.
export function vendorPurchaseWindowState(vendor: VendorStoreStatus, fallbackFrom: string, fallbackTo: string, now = new Date()): VendorPurchaseWindow {
    const window = parseVendorHours(vendor.openHours) ?? { from: fallbackFrom, to: fallbackTo };
    const closed = vendor.isActive === false
        || vendor.isOpen === false
        || !isStoreOpen(window.from, window.to, now);
    return { closed, from: window.from, to: window.to };
}
