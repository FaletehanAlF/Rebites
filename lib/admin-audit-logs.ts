'use client';

import { fetchAdminWithAuth } from './admin-auth';
import { AuthError } from './auth-token';

export interface AuditLogItem {
  id: string;
  adminId: string | null;
  adminName: string;
  adminEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogsResult {
  logs: AuditLogItem[];
  total: number;
  limit: number;
  offset: number;
}

export class AuditLogsApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuditLogsApiError';
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
      throw new AuditLogsApiError(err.message, err.status);
    }
    throw err;
  }
}

export async function fetchAuditLogs(
  limit = 20,
  offset = 0,
  filters?: {
    action?: string;
    targetType?: string;
    adminId?: string;
    targetId?: string;
    from?: string;
    to?: string;
  }
): Promise<AuditLogsResult> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filters?.action) params.set('action', filters.action);
  if (filters?.targetType) params.set('targetType', filters.targetType);
  if (filters?.adminId) params.set('adminId', filters.adminId);
  if (filters?.targetId) params.set('targetId', filters.targetId);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  const res = await adminFetch(`/api/admin/audit-logs?${params.toString()}`);
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new AuditLogsApiError(json?.error ?? 'Gagal memuat audit log.', res.status);
  }
  const json = (await res.json().catch(() => null)) as AuditLogsResult | null;
  if (!json || !Array.isArray(json.logs)) {
    throw new AuditLogsApiError('Respons audit log tidak valid.', 500);
  }
  return json;
}
