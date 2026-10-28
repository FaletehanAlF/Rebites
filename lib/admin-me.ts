'use client';

import { fetchAdminWithAuth } from './admin-auth';
import { AuthError } from './auth-token';

/**
 * Status akses admin dari GET /api/admin/me.
 * Hanya dua boolean — tidak ada UUID/rahasia yang dibawa ke client.
 */
export interface AdminMe {
  isSuperAdmin: boolean;
  superAdminConfigured: boolean;
}

export class AdminMeApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminMeApiError';
    this.status = status;
  }
}

/**
 * Memakai `fetchAdminWithAuth` (SATU refresh serial + SATU retry saat 401),
 * sama seperti lib admin lain. Tanpa retry itu, token yang masuk refresh window
 * menghasilkan 401 dan `useAdminMe` akan menyimpulkan "bukan Super Admin" untuk
 * sesi yang sebenarnya masih dapat dipulihkan.
 */
export async function fetchAdminMe(): Promise<AdminMe> {
  let res: Response;
  try {
    res = await fetchAdminWithAuth('/api/admin/me', { cache: 'no-store' });
  } catch (err) {
    // Tidak ada sesi valid sejak awal (refresh juga gagal) → 401, bukan 5xx.
    if (err instanceof AuthError) {
      throw new AdminMeApiError(err.message, err.status);
    }
    throw err;
  }

  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new AdminMeApiError(
      json?.error ?? 'Gagal memuat status akses admin.',
      res.status
    );
  }
  const json = (await res.json().catch(() => null)) as {
    is_super_admin?: unknown;
    super_admin_configured?: unknown;
  } | null;
  if (
    !json ||
    typeof json.is_super_admin !== 'boolean' ||
    typeof json.super_admin_configured !== 'boolean'
  ) {
    throw new AdminMeApiError('Respons status akses admin tidak valid.', 500);
  }
  return {
    isSuperAdmin: json.is_super_admin,
    superAdminConfigured: json.super_admin_configured,
  };
}
