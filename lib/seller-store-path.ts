export const SELLER_DASHBOARD_ROOT = '/dashboard/penjual';
export const SELLER_SUB_PAGES = [
    'pesanan',
    'ulasan',
    'menu',
    'tambahMenu',
    'performa',
    'langganan',
    'notifikasi',
    'pengaturan',
] as const;
export type SellerSubPage = (typeof SELLER_SUB_PAGES)[number];
export function isSellerSubPage(value: unknown): value is SellerSubPage {
    return (typeof value === 'string' &&
        (SELLER_SUB_PAGES as readonly string[]).includes(value));
}
export function sellerStorePath(storeId: string | null | undefined, sub?: SellerSubPage | null): string {
    const id = typeof storeId === 'string' ? storeId.trim() : '';
    const safeId = /[/\\]/.test(id) || id === '.' || id === '..' ? '' : id;
    if (!safeId) {
        return sub ? `${SELLER_DASHBOARD_ROOT}/${sub}` : SELLER_DASHBOARD_ROOT;
    }
    const base = `${SELLER_DASHBOARD_ROOT}/${encodeURIComponent(safeId)}`;
    return sub ? `${base}/${sub}` : base;
}
export interface ParsedSellerStorePath {
    storeId: string;
    sub: SellerSubPage | null;
}
export function parseSellerStorePath(pathname: string | null | undefined): ParsedSellerStorePath | null {
    if (typeof pathname !== 'string' || pathname.length === 0)
        return null;
    const pathOnly = pathname.split('?')[0].split('#')[0];
    const segments = pathOnly.split('/').filter((segment) => segment.length > 0);
    if (segments.length < 3)
        return null;
    if (segments[0] !== 'dashboard' || segments[1] !== 'penjual')
        return null;
    const rawId = segments[2];
    if (!rawId)
        return null;
    if (segments.length === 3 && isSellerSubPage(rawId))
        return null;
    let storeId: string;
    try {
        storeId = decodeURIComponent(rawId);
    }
    catch {
        return null;
    }
    if (!storeId)
        return null;
    if (segments.length === 3)
        return { storeId, sub: null };
    if (segments.length === 4 && isSellerSubPage(segments[3])) {
        return { storeId, sub: segments[3] };
    }
    return null;
}
export function sellerPathForCurrentPage(storeId: string | null | undefined, pathname: string | null | undefined): string {
    const parsed = parseSellerStorePath(pathname);
    return sellerStorePath(storeId, parsed?.sub ?? null);
}
