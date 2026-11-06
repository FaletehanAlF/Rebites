'use client';

import { fetchAdminWithAuth } from './admin-auth';
import { AuthError } from './auth-token';

/**
 * Client-side daftar produk untuk halaman admin "Produk".
 *
 * Takai file ini (bukan fetch langsung di komponen) supaya paginasi, filter,
 * dan penanganan error 401/403 konsisten dengan halaman admin lain yang
 * memakai `fetchAdminX` + `AdminXApiError`.
 */

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
  /** Status operasional: available | sold_out | hidden. */
  status: string | null;
  /** Status moderasi: approved (live) | rejected (ditunda) | pending (antrean lama). */
  verificationStatus: AdminVerificationStatus | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  /** Terisi = produk ditarik penjual (soft delete), tetap terlihat oleh admin. */
  deletedAt: string | null;
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

/**
 * Satu refresh + satu retry saat 401 — kontrak `fetchAdminWithAuth` yang sama
 * dengan `lib/admin-reports.ts`. Sebelumnya file ini hanya mengambil token
 * sekali: bila server menjawab 401, request gagal tanpa percobaan refresh,
 * sehingga admin harus menekan "muat ulang" padahal sesinya masih dapat
 * dipulihkan.
 */
async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetchAdminWithAuth(input, init);
  } catch (err) {
    if (err instanceof AuthError) {
      throw new AdminProductsApiError(err.message, err.status);
    }
    throw err;
  }
}

export async function fetchAdminProducts(
  limit = 20,
  offset = 0,
  filters?: AdminProductsFilters
): Promise<AdminProductsResult> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filters?.verificationStatus) params.set('verificationStatus', filters.verificationStatus);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.umkmId) params.set('umkmId', filters.umkmId);
  if (filters?.q?.trim()) params.set('q', filters.q.trim());

  const res = await adminFetch(`/api/admin/products?${params.toString()}`);
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new AdminProductsApiError(json?.error ?? 'Gagal memuat daftar produk.', res.status);
  }
  const json = (await res.json().catch(() => null)) as AdminProductsResult | null;
  if (!json || !Array.isArray(json.products)) {
    throw new AdminProductsApiError('Respons daftar produk tidak valid.', 500);
  }
  return json;
}