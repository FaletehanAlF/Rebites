'use client';
import { fetchAdminWithAuth } from './admin-auth';
import { AuthError } from './auth-token';
export interface AdminUmkmOwner {
    id: string;
    full_name: string | null;
    email: string | null;
}
export interface AdminUmkmSubscription {
    id: string;
    status: string | null;
    billing: string | null;
    price_paid: number | null;
    current_period_start: string | null;
    current_period_end: string | null;
    plan: {
        id: string | null;
        slug: string | null;
        name: string | null;
    } | null;
}
export interface AdminUmkmItem {
    id: string;
    user_id: string | null;
    business_name: string;
    description: string | null;
    category: string | null;
    address: string | null;
    city: string | null;
    logo_url: string | null;
    slug: string | null;
    is_verified: boolean;
    rating: number | null;
    is_open: boolean | null;
    is_active: boolean;
    deleted_at: string | null;
    created_at: string | null;
    owner: AdminUmkmOwner | null;
    subscription: AdminUmkmSubscription | null;
    product_count: number;
}
export interface AdminUmkmListResult {
    umkm: AdminUmkmItem[];
    total: number;
    limit: number;
    offset: number;
}
export interface AdminUmkmDetailOwner extends AdminUmkmOwner {
    role: string | null;
    is_super_admin?: boolean;
}
export interface AdminUmkmDetailSubscription extends AdminUmkmSubscription {
    plan: {
        id: string | null;
        slug: string | null;
        name: string | null;
        max_products: number | null;
        features: string[] | null;
    } | null;
}
export interface AdminUmkmProductSummary {
    id: string | null;
    name: string;
    description: string | null;
    image_url: string | null;
    category: string | null;
    original_price: number | null;
    surplus_price: number | null;
    stock: number | null;
    status: string | null;
    verification_status: string | null;
    rejection_reason: string | null;
    reviewed_at: string | null;
    weight_gram: number | null;
    length_cm: number | null;
    width_cm: number | null;
    height_cm: number | null;
    is_delivery: boolean | null;
    is_pickup: boolean | null;
    created_at: string | null;
    updated_at: string | null;
}
export interface AdminUmkmDetail {
    id: string | null;
    user_id: string | null;
    business_name: string;
    description: string | null;
    category: string | null;
    address: string | null;
    city: string | null;
    postal_code?: string | null;
    phone?: string | null;
    latitude: number | null;
    longitude: number | null;
    logo_url: string | null;
    slug: string | null;
    is_verified: boolean;
    rating: number | null;
    is_open: boolean | null;
    is_active: boolean;
    deactivation_reason: string | null;
    deactivated_at: string | null;
    deleted_at: string | null;
    deletion_reason: string | null;
    open_hours: string | null;
    tagline: string | null;
    owner_name: string | null;
    partner_tier: string | null;
    followers: number | null;
    member_since: number | null;
    response_time: string | null;
    porsi_terselamatkan: number | null;
    co2e_saved_kg: number | null;
    created_at: string | null;
}
export interface AdminUmkmActivationRequest {
    id: string | null;
    message: string;
    status: 'pending' | 'approved' | 'rejected';
    decision_note: string | null;
    decided_at: string | null;
    created_at: string | null;
}
export interface AdminUmkmDetailResult {
    umkm: AdminUmkmDetail;
    owner: AdminUmkmDetailOwner | null;
    subscription: AdminUmkmDetailSubscription | null;
    products: AdminUmkmProductSummary[];
    product_total: number;
    activation_requests: AdminUmkmActivationRequest[];
}
export class AdminUmkmApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'AdminUmkmApiError';
        this.status = status;
    }
}
async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
        return await fetchAdminWithAuth(input, init);
    }
    catch (err) {
        if (err instanceof AuthError) {
            throw new AdminUmkmApiError(err.message, err.status);
        }
        throw err;
    }
}
async function parseError(res: Response, fallback: string): Promise<never> {
    const json = (await res.json().catch(() => null)) as {
        error?: string;
    } | null;
    throw new AdminUmkmApiError(json?.error ?? fallback, res.status);
}
export type AdminUmkmVerificationFilter = 'verified' | 'unverified';
export type AdminUmkmDeletedFilter = 'exclude' | 'include';
export async function fetchAdminUmkm(limit = 20, offset = 0, search = '', verification: '' | AdminUmkmVerificationFilter = '', deleted: AdminUmkmDeletedFilter = 'exclude'): Promise<AdminUmkmListResult> {
    const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
    });
    if (search.trim())
        params.set('search', search.trim());
    if (verification)
        params.set('verification', verification);
    if (deleted === 'include')
        params.set('deleted', 'include');
    const res = await adminFetch(`/api/admin/umkm?${params.toString()}`);
    if (!res.ok) {
        await parseError(res, 'Gagal memuat daftar UMKM.');
    }
    const json = (await res.json().catch(() => null)) as AdminUmkmListResult | null;
    if (!json || !Array.isArray(json.umkm)) {
        throw new AdminUmkmApiError('Respons daftar UMKM tidak valid.', 500);
    }
    return {
        umkm: json.umkm,
        total: json.total ?? json.umkm.length,
        limit: json.limit ?? limit,
        offset: json.offset ?? offset,
    };
}
export async function fetchAdminUmkmDetail(id: string): Promise<AdminUmkmDetailResult> {
    const res = await adminFetch(`/api/admin/umkm/${encodeURIComponent(id)}`);
    if (!res.ok) {
        await parseError(res, 'Gagal memuat detail UMKM.');
    }
    const json = (await res.json().catch(() => null)) as AdminUmkmDetailResult | null;
    if (!json || !json.umkm) {
        throw new AdminUmkmApiError('Respons detail UMKM tidak valid.', 500);
    }
    return json;
}
export async function toggleUmkmVerification(id: string): Promise<{
    is_verified: boolean;
}> {
    const res = await adminFetch(`/api/admin/umkm/${encodeURIComponent(id)}/verify`, {
        method: 'POST',
    });
    if (!res.ok) {
        await parseError(res, 'Gagal mengubah status verifikasi.');
    }
    const json = (await res.json().catch(() => null)) as {
        is_verified?: boolean;
    } | null;
    if (!json || typeof json.is_verified !== 'boolean') {
        throw new AdminUmkmApiError('Respons verifikasi UMKM tidak valid.', 500);
    }
    return { is_verified: json.is_verified };
}
export async function setUmkmActive(id: string, isActive: boolean, reason?: string): Promise<{
    is_active: boolean;
}> {
    const res = await adminFetch(`/api/admin/umkm/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isActive ? { is_active: true } : { is_active: false, reason: reason ?? '' }),
    });
    if (!res.ok) {
        await parseError(res, 'Gagal mengubah status toko.');
    }
    const json = (await res.json().catch(() => null)) as {
        is_active?: boolean;
    } | null;
    if (!json || typeof json.is_active !== 'boolean') {
        throw new AdminUmkmApiError('Respons status toko tidak valid.', 500);
    }
    return { is_active: json.is_active };
}
export async function setUmkmDeletion(id: string, deleted: boolean, reason?: string): Promise<{
    deleted_at: string | null;
    is_active: boolean;
}> {
    const res = await adminFetch(`/api/admin/umkm/${encodeURIComponent(id)}/deletion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deleted ? { deleted: true, reason: reason ?? '' } : { deleted: false }),
    });
    if (!res.ok) {
        await parseError(res, 'Gagal menyimpan status penghapusan toko.');
    }
    const json = (await res.json().catch(() => null)) as {
        deleted_at?: string | null;
        is_active?: boolean;
    } | null;
    if (!json || typeof json.is_active !== 'boolean') {
        throw new AdminUmkmApiError('Respons penghapusan toko tidak valid.', 500);
    }
    return { deleted_at: json.deleted_at ?? null, is_active: json.is_active };
}
export async function decideStoreActivationRequest(umkmId: string, requestId: string, action: 'approve' | 'reject', note?: string): Promise<{
    is_active: boolean;
}> {
    const res = await adminFetch(`/api/admin/umkm/${encodeURIComponent(umkmId)}/activation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, note: note ?? '' }),
    });
    if (!res.ok) {
        await parseError(res, 'Gagal menyimpan keputusan aktivasi.');
    }
    const json = (await res.json().catch(() => null)) as {
        is_active?: boolean;
    } | null;
    if (!json || typeof json.is_active !== 'boolean') {
        throw new AdminUmkmApiError('Respons keputusan aktivasi tidak valid.', 500);
    }
    return { is_active: json.is_active };
}
