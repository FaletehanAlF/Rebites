'use client';

import { AdminAuthError, getAdminAuthHeader } from './admin-auth';

export interface AdminProductDetail {
  id: string | null;
  umkm_id: string | null;
  slug: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  original_price: number | null;
  surplus_price: number | null;
  discount_percent: number | null;
  stock: number | null;
  status: string | null;
  verification_status: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  weight_gram: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  is_delivery: boolean | null;
  is_pickup: boolean | null;
  rating: number | null;
  created_at: string | null;
  /** Terisi = produk ditarik penjual (soft delete). Admin tetap dapat membuka detailnya. */
  deleted_at: string | null;
  updated_at?: string | null;
}

export interface AdminProductUmkm {
  id: string | null;
  user_id: string | null;
  business_name: string;
  slug: string | null;
  city: string | null;
  is_verified: boolean;
  logo_url: string | null;
  created_at: string | null;
}

export interface AdminModerationEntry {
  id: string | null;
  action: string | null;
  reason: string | null;
  created_at: string | null;
  moderator_name: string;
}

export interface AdminProductActivityEntry {
  id: string | null;
  activity_type: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string | null;
}

export interface AdminProductDetailResult {
  product: AdminProductDetail;
  umkm: AdminProductUmkm | null;
  moderation: AdminModerationEntry[];
  activity: AdminProductActivityEntry[];
}

export class AdminProductModerationApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminProductModerationApiError';
    this.status = status;
  }
}

async function authHeader(): Promise<string> {
  try {
    return await getAdminAuthHeader();
  } catch (err) {
    if (err instanceof AdminAuthError) {
      throw new AdminProductModerationApiError(err.message, 401);
    }
    throw err;
  }
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new AdminProductModerationApiError(json?.error ?? fallback, res.status);
}

export async function fetchAdminProductDetail(id: string): Promise<AdminProductDetailResult> {
  const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}`, {
    headers: { Authorization: await authHeader() },
  });
  if (!res.ok) await parseError(res, 'Gagal memuat detail produk.');
  const json = (await res.json().catch(() => null)) as AdminProductDetailResult | null;
  if (!json || !json.product) {
    throw new AdminProductModerationApiError('Respons detail produk tidak valid.', 500);
  }
  return {
    product: json.product,
    umkm: json.umkm ?? null,
    moderation: Array.isArray(json.moderation) ? json.moderation : [],
    activity: Array.isArray(json.activity) ? json.activity : [],
  };
}

export async function approveAdminProduct(id: string): Promise<void> {
  const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    headers: { Authorization: await authHeader() },
  });
  if (!res.ok) await parseError(res, 'Gagal menyetujui produk.');
}

export async function rejectAdminProduct(id: string, reason: string): Promise<void> {
  const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    headers: { Authorization: await authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) await parseError(res, 'Gagal menolak/menurunkan produk.');
}

export async function warnAdminProduct(
  id: string,
  input: { level: 1 | 2 | 3; category: string; reason: string }
): Promise<void> {
  const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}/warn`, {
    method: 'POST',
    headers: { Authorization: await authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, 'Gagal menerbitkan peringatan produk.');
}
