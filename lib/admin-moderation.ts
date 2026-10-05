'use client';

import { AdminAuthError, getAdminAuthHeader } from './admin-auth';

export interface PendingProductUmkm {
  id: string;
  business_name: string;
  is_verified: boolean;
  logo_url: string | null;
}

export interface PendingProduct {
  id: string;
  umkm_id: string;
  slug: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string;
  original_price: number;
  surplus_price: number;
  stock: number;
  status: string;
  verification_status: string;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  umkm: PendingProductUmkm | null;
}

export interface PendingListResult {
  products: PendingProduct[];
  total: number;
  limit: number;
  offset: number;
}

export interface ModerationHistoryItem {
  id: string;
  productId: string;
  productName: string;
  productImageUrl: string | null;
  businessName: string;
  businessLogoUrl: string | null;
  action: 'approve' | 'reject';
  reason: string | null;
  moderatorName: string;
  moderatorEmail: string | null;
  createdAt: string;
}

export interface ModerationHistoryResult {
  logs: ModerationHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

async function authHeader(): Promise<string> {
  try {
    return await getAdminAuthHeader();
  } catch (err) {
    if (err instanceof AdminAuthError) {
      throw new AdminApiError(err.message, 401);
    }
    throw err;
  }
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new AdminApiError(json?.error ?? fallback, res.status);
}

export async function fetchPendingProducts(
  limit = 20,
  offset = 0
): Promise<PendingListResult> {
  const res = await fetch(
    `/api/admin/products/pending?limit=${limit}&offset=${offset}`,
    { headers: { Authorization: await authHeader() } }
  );
  if (!res.ok) {
    await parseError(res, 'Gagal memuat antrean verifikasi.');
  }
  const json = (await res.json().catch(() => null)) as PendingListResult | null;
  if (!json || !Array.isArray(json.products)) {
    throw new AdminApiError('Respons antrean verifikasi tidak valid.', 500);
  }
  return {
    products: json.products,
    total: json.total ?? json.products.length,
    limit: json.limit ?? limit,
    offset: json.offset ?? offset,
  };
}

export async function approveProduct(id: string): Promise<void> {
  const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    headers: { Authorization: await authHeader() },
  });
  if (!res.ok) {
    await parseError(res, 'Gagal menyetujui produk.');
  }
}

export async function rejectProduct(id: string, reason: string): Promise<void> {
  const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    headers: {
      Authorization: await authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    await parseError(res, 'Gagal menolak produk.');
  }
}

export async function fetchModerationHistory(
  limit = 20,
  offset = 0
): Promise<ModerationHistoryResult> {
  const res = await fetch(
    `/api/admin/moderation-logs?limit=${limit}&offset=${offset}`,
    { headers: { Authorization: await authHeader() } }
  );
  if (!res.ok) {
    await parseError(res, 'Gagal memuat riwayat moderasi.');
  }
  const json = (await res.json().catch(() => null)) as ModerationHistoryResult | null;
  if (!json || !Array.isArray(json.logs)) {
    throw new AdminApiError('Respons riwayat moderasi tidak valid.', 500);
  }
  return {
    logs: json.logs,
    total: json.total ?? json.logs.length,
    limit: json.limit ?? limit,
    offset: json.offset ?? offset,
  };
}
