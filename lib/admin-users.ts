'use client';

import { fetchAdminWithAuth } from './admin-auth';
import { AuthError } from './auth-token';

export interface AdminUserUmkm {
  id: string | null;
  business_name: string | null;
  slug: string | null;
  is_verified: boolean;
}

export type AdminSellerStatus = 'active' | 'no_subscription' | 'no_store';

export interface AdminUserSubscription {
  plan_name: string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
}

export interface AdminUserSeller {
  umkm_id: string | null;
  business_name: string | null;
  slug: string | null;
  is_verified: boolean;
  subscription: AdminUserSubscription | null;
}

export interface AdminUserItem {
  id: string | null;
  email: string | null;
  full_name: string | null;
  role: string | null;
  /** Boolean dari server: user ini = Super Admin terkonfigurasi (tanpa UUID). */
  is_super_admin: boolean;
  is_verified: boolean;
  created_at: string | null;
  /** Ditentukan dari keberadaan umkm_profiles, BUKAN dari role. */
  has_umkm: boolean;
  umkm: AdminUserUmkm | null;
  /** Ditentukan dari toko + subscription aktif-periode, BUKAN dari role. */
  seller_status: AdminSellerStatus;
  seller: AdminUserSeller | null;
}

export interface AdminUserListResult {
  users: AdminUserItem[];
  total: number;
  limit: number;
  offset: number;
}

export class AdminUsersApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminUsersApiError';
    this.status = status;
  }
}

/**
 * Satu refresh + satu retry saat 401 — kontrak `fetchAdminWithAuth` yang sama
 * dengan lib admin lain. Inilah penyebab "gagal mengubah role": sebelumnya
 * token diambil sekali, sehingga sesi yang masuk refresh window langsung
 * dijawab 401 dan perubahan role gagal tanpa pernah dicoba ulang.
 */
async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetchAdminWithAuth(input, init);
  } catch (err) {
    if (err instanceof AuthError) {
      throw new AdminUsersApiError(err.message, err.status);
    }
    throw err;
  }
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new AdminUsersApiError(json?.error ?? fallback, res.status);
}

export interface AdminUserDetailUmkm {
  id: string | null;
  business_name: string | null;
  slug: string | null;
  is_verified: boolean;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  phone: string | null;
}

export interface AdminUserDetail {
  id: string | null;
  email: string | null;
  full_name: string | null;
  role: string | null;
  /** Boolean dari server: target = Super Admin terkonfigurasi (tanpa UUID). */
  is_super_admin: boolean;
  phone: string | null;
  is_verified: boolean;
  created_at: string | null;
  /** Ditentukan dari keberadaan umkm_profiles, BUKAN dari role. */
  has_umkm: boolean;
  umkm: AdminUserDetailUmkm | null;
  /** Ditentukan dari toko + subscription aktif-periode, BUKAN dari role. */
  seller_status: AdminSellerStatus;
  seller: AdminUserDetailSeller | null;
}

export interface AdminUserDetailSeller extends AdminUserSeller {
  description: string | null;
  category: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  phone: string | null;
}

export async function fetchAdminUserDetail(id: string): Promise<AdminUserDetail> {
  const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}`);
  if (!res.ok) {
    await parseError(res, 'Gagal memuat detail pengguna.');
  }
  const json = (await res.json().catch(() => null)) as {
    user?: AdminUserDetail;
  } | null;
  if (!json || !json.user) {
    throw new AdminUsersApiError('Respons detail pengguna tidak valid.', 500);
  }
  return json.user;
}

export type AllowedUserRole = 'buyer' | 'umkm' | 'admin';

export async function updateAdminUserRole(
  id: string,
  role: AllowedUserRole
): Promise<{ id: string | null; old_role: string | null; role: string | null }> {
  const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/role`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    await parseError(res, 'Gagal mengubah role.');
  }
  const json = (await res.json().catch(() => null)) as {
    user?: { id: string | null; old_role: string | null; role: string | null };
  } | null;
  if (!json || !json.user) {
    throw new AdminUsersApiError('Respons ubah role tidak valid.', 500);
  }
  return json.user;
}
export async function fetchAdminUsers(
  limit = 20,
  offset = 0,
  search = '',
  sellerStatus: '' | AdminSellerStatus = ''
): Promise<AdminUserListResult> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (search.trim()) params.set('search', search.trim());
  if (sellerStatus) params.set('sellerStatus', sellerStatus);
  const res = await adminFetch(`/api/admin/users?${params.toString()}`);
  if (!res.ok) {
    await parseError(res, 'Gagal memuat daftar pengguna.');
  }
  const json = (await res.json().catch(() => null)) as AdminUserListResult | null;
  if (!json || !Array.isArray(json.users)) {
    throw new AdminUsersApiError('Respons daftar pengguna tidak valid.', 500);
  }
  return {
    users: json.users,
    total: json.total ?? json.users.length,
    limit: json.limit ?? limit,
    offset: json.offset ?? offset,
  };
}

export interface AdminRoleHistoryActor {
  id: string | null;
  full_name: string | null;
  email: string | null;
}

export interface AdminRoleHistoryItem {
  id: string | null;
  old_role: string | null;
  new_role: string | null;
  created_at: string | null;
  actor: AdminRoleHistoryActor | null;
}

export interface AdminRoleHistoryResult {
  logs: AdminRoleHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchAdminRoleHistory(
  id: string,
  limit = 20,
  offset = 0
): Promise<AdminRoleHistoryResult> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const res = await adminFetch(
    `/api/admin/users/${encodeURIComponent(id)}/role-history?${params.toString()}`
  );
  if (!res.ok) {
    await parseError(res, 'Gagal memuat riwayat role.');
  }
  const json = (await res.json().catch(() => null)) as AdminRoleHistoryResult | null;
  if (!json || !Array.isArray(json.logs)) {
    throw new AdminUsersApiError('Respons riwayat role tidak valid.', 500);
  }
  return {
    logs: json.logs,
    total: json.total ?? json.logs.length,
    limit: json.limit ?? limit,
    offset: json.offset ?? offset,
  };
}
