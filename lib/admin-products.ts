'use client';
import { fetchAdminWithAuth } from './admin-auth';
import { AuthError } from './auth-token';
export type AdminVerificationStatus = 'pending' | 'approved' | 'rejected';
export interface AdminProductStore {
    id: string | null;
    businessName: string;
    city: string | null;
    isVerified: boolean;
}
export interface AdminProductListItem {
    id: string;
    umkmId: string | null;
    slug: string | null;
    name: string;
    category: string | null;
    imageUrl: string | null;
    originalPrice: number | null;
    surplusPrice: number | null;
    stock: number | null;
    status: string | null;
    verificationStatus: AdminVerificationStatus | null;
    rejectionReason: string | null;
    reviewedAt: string | null;
    createdAt: string;
    deletedAt: string | null;
    deletedBy: string | null;
    updatedAt: string | null;
    store: AdminProductStore | null;
}
export interface AdminProductsResult {
    products: AdminProductListItem[];
    total: number;
    limit: number;
    offset: number;
}
export interface AdminProductsFilters {
    verificationStatus?: string;
    status?: string;
    umkmId?: string;
    q?: string;
}
export class AdminProductsApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'AdminProductsApiError';
        this.status = status;
    }
}
async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
        return await fetchAdminWithAuth(input, init);
    }
    catch (err) {
        if (err instanceof AuthError) {
            throw new AdminProductsApiError(err.message, err.status);
        }
        throw err;
    }
}
export async function fetchAdminProducts(limit = 20, offset = 0, filters?: AdminProductsFilters): Promise<AdminProductsResult> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (filters?.verificationStatus)
        params.set('verificationStatus', filters.verificationStatus);
    if (filters?.status)
        params.set('status', filters.status);
    if (filters?.umkmId)
        params.set('umkmId', filters.umkmId);
    if (filters?.q?.trim())
        params.set('q', filters.q.trim());
    const res = await adminFetch(`/api/admin/products?${params.toString()}`);
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new AdminProductsApiError(json?.error ?? 'Gagal memuat daftar produk.', res.status);
    }
    const json = (await res.json().catch(() => null)) as AdminProductsResult | null;
    if (!json || !Array.isArray(json.products)) {
        throw new AdminProductsApiError('Respons daftar produk tidak valid.', 500);
    }
    return json;
}
