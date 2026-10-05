'use client';

import { AdminAuthError, getAdminAuthHeader } from './admin-auth';

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
  image_url: string | null;
  category: string | null;
  original_price: number | null;
  surplus_price: number | null;
  stock: number | null;
  verification_status: string | null;
  created_at: string | null;
}

export interface AdminUmkmDetail {
  id: string | null;
  user_id: string | null;
  business_name: string;
  description: string | null;
  category: string | null;
  address: string | null;
  city: string | null;
  /** 7B-1: origin foundation, NULL untuk data legacy. */
  postal_code?: string | null;
  /** 7B-1: telepon toko, NULL jika belum diisi. */
  phone?: string | null;
  latitude: number | null;
  longitude: number | null;
  logo_url: string | null;
  slug: string | null;
  is_verified: boolean;
  rating: number | null;
  is_open: boolean | null;
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

export interface AdminUmkmDetailResult {
  umkm: AdminUmkmDetail;
  owner: AdminUmkmDetailOwner | null;
  subscription: AdminUmkmDetailSubscription | null;
  products: AdminUmkmProductSummary[];
  product_total: number;
}

export class AdminUmkmApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminUmkmApiError';
    this.status = status;
  }
}

async function authHeader(): Promise<string> {
  try {
    return await getAdminAuthHeader();
  } catch (err) {
    if (err instanceof AdminAuthError) {
      throw new AdminUmkmApiError(err.message, 401);
    }
    throw err;
  }
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new AdminUmkmApiError(json?.error ?? fallback, res.status);
}

export async function fetchAdminUmkm(
  limit = 20,
  offset = 0,
  search = ''
): Promise<AdminUmkmListResult> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (search.trim()) params.set('search', search.trim());
  const res = await fetch(`/api/admin/umkm?${params.toString()}`, {
    headers: { Authorization: await authHeader() },
  });
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
  const res = await fetch(`/api/admin/umkm/${encodeURIComponent(id)}`, {
    headers: { Authorization: await authHeader() },
  });
  if (!res.ok) {
    await parseError(res, 'Gagal memuat detail UMKM.');
  }
  const json = (await res.json().catch(() => null)) as AdminUmkmDetailResult | null;
  if (!json || !json.umkm) {
    throw new AdminUmkmApiError('Respons detail UMKM tidak valid.', 500);
  }
  return json;
}

export async function toggleUmkmVerification(id: string): Promise<{ is_verified: boolean }> {
  const res = await fetch(`/api/admin/umkm/${encodeURIComponent(id)}/verify`, {
    method: 'POST',
    headers: { Authorization: await authHeader() },
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
