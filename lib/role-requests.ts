'use client';

import { fetchAdminWithAuth } from './admin-auth';
import { AuthError } from './auth-token';

/**
 * Klien API permintaan perubahan role (Super Admin Approval System).
 *
 * Semua keputusan otorisasi berada di server; helper ini hanya transport
 * (pola sama dengan lib/admin-users.ts). Error server diteruskan apa adanya
 * lewat RoleRequestsApiError.status agar UI bisa membedakan 401/403/409.
 */

export type RoleRequestStatus = 'pending' | 'approved' | 'rejected';
export type RoleRequestRole = 'buyer' | 'umkm' | 'admin';

export interface RoleRequestParty {
  full_name: string | null;
  email: string | null;
}

export interface RoleRequestTarget extends RoleRequestParty {
  id: string | null;
}

export interface AdminRoleRequestItem {
  id: string | null;
  status: string | null;
  /** Role saat permintaan dibuat (rekaman). */
  current_role: string | null;
  requested_role: string | null;
  /** Role target saat ini (dibaca ulang server per response). */
  current_role_live: string | null;
  target_is_super_admin: boolean;
  /** Dihitung server dari token pemanggil (bukan dari client). */
  requested_by_me: boolean;
  reason: string | null;
  decision_note: string | null;
  created_at: string | null;
  decided_at: string | null;
  requested_by: RoleRequestParty | null;
  decided_by: RoleRequestParty | null;
  target: RoleRequestTarget | null;
}

export interface AdminRoleRequestListResult {
  requests: AdminRoleRequestItem[];
  total: number;
  limit: number;
  offset: number;
  /**
   * true bila tabel role_change_requests belum ada di server (migrasi
   * role_request_approval belum dijalankan). Bukan kegagalan: halaman harus
   * menampilkan "belum ada permintaan" beserta penjelasan, bukan error merah.
   */
  notProvisioned: boolean;
}

export class RoleRequestsApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'RoleRequestsApiError';
    this.status = status;
  }
}

/**
 * Satu refresh + satu retry saat 401 — kontrak yang sama dengan
 * `lib/admin-reports.ts`. Sebelumnya token hanya diambil sekali, sehingga 401
 * di tengah sesi langsung menjadi error tanpa percobaan refresh.
 */
async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetchAdminWithAuth(input, init);
  } catch (err) {
    if (err instanceof AuthError) {
      throw new RoleRequestsApiError(err.message, err.status);
    }
    throw err;
  }
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new RoleRequestsApiError(json?.error ?? fallback, res.status);
}

export async function fetchAdminRoleRequests(
  options: {
    status?: '' | RoleRequestStatus;
    mine?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<AdminRoleRequestListResult> {
  const { status = '', mine = false, limit = 20, offset = 0 } = options;
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (status) params.set('status', status);
  if (mine) params.set('mine', '1');
  const res = await adminFetch(`/api/admin/role-requests?${params.toString()}`);
  if (!res.ok) {
    await parseError(res, 'Gagal memuat permintaan role.');
  }
  const json = (await res.json().catch(() => null)) as
    | (Omit<AdminRoleRequestListResult, 'notProvisioned'> & { not_provisioned?: boolean })
    | null;
  if (!json || !Array.isArray(json.requests)) {
    throw new RoleRequestsApiError('Respons daftar permintaan tidak valid.', 500);
  }
  return {
    requests: json.requests,
    total: json.total ?? json.requests.length,
    limit: json.limit ?? limit,
    offset: json.offset ?? offset,
    notProvisioned: json.not_provisioned === true,
  };
}

export async function createRoleRequest(
  targetUserId: string,
  requestedRole: RoleRequestRole,
  reason: string
): Promise<{ id: string | null; status: string | null }> {
  const res = await adminFetch('/api/admin/role-requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      target_user_id: targetUserId,
      requested_role: requestedRole,
      reason,
    }),
  });
  if (!res.ok) {
    await parseError(res, 'Gagal mengirim permintaan role.');
  }
  const json = (await res.json().catch(() => null)) as {
    request?: { id?: string | null; status?: string | null };
  } | null;
  if (!json || !json.request) {
    throw new RoleRequestsApiError('Respons permintaan tidak valid.', 500);
  }
  return { id: json.request.id ?? null, status: json.request.status ?? null };
}

export async function decideRoleRequest(
  id: string,
  action: 'approve' | 'reject',
  note: string
): Promise<void> {
  const res = await adminFetch(
    `/api/admin/role-requests/${encodeURIComponent(id)}/${action === 'approve' ? 'approve' : 'reject'}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ note }),
    }
  );
  if (!res.ok) {
    await parseError(
      res,
      action === 'approve'
        ? 'Gagal menyetujui permintaan role.'
        : 'Gagal menolak permintaan role.'
    );
  }
}
