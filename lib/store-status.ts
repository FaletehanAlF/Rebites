'use client';
export function isOpenNow(openHours?: string | null): boolean {
    if (openHours == null || typeof openHours !== 'string')
        return true;
    const trimmed = openHours.trim();
    if (!trimmed)
        return true;
    const match = trimmed.match(/(\d{1,2})\.(\d{2})\s*[–-]\s*(\d{1,2})\.(\d{2})/);
    if (!match)
        return true;
    const open = Number(match[1]) * 60 + Number(match[2]);
    const close = Number(match[3]) * 60 + Number(match[4]);
    if (Number.isNaN(open) || Number.isNaN(close))
        return true;
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    if (open <= close) {
        return minutes >= open && minutes < close;
    }
    return minutes >= open || minutes < close;
}
export function isVendorReallyOpen(vendor: {
    isOpen: boolean;
    openHours?: string | null;
}): boolean {
    return vendor.isOpen && isOpenNow(vendor.openHours);
}
export interface HomeOrderableVendor {
    id: string;
    isOpen: boolean;
    openHours?: string | null;
}
export function orderVendorsOpenFirst<T extends HomeOrderableVendor>(vendors: T[], priorityVendorId?: string | null): T[] {
    return [...vendors].sort((a, b) => {
        const openDelta = Number(isVendorReallyOpen(b)) - Number(isVendorReallyOpen(a));
        if (openDelta !== 0)
            return openDelta;
        if (!priorityVendorId)
            return 0;
        return Number(b.id === priorityVendorId) - Number(a.id === priorityVendorId);
    });
}
