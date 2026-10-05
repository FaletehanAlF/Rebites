'use client';

import { AdminAuthError, getAdminAuthHeader } from './admin-auth';

export type AdminSubscriptionRawStatus =
  | 'active'
  | 'pending'
  | 'expired'
  | 'cancelled'
  | 'trial';

export type AdminSubscriptionEffective =
  | 'active'
  | 'lapsed'
  | 'pending'
  | 'expired'
  | 'trial';

export interface AdminSubscriptionPlan {
  id: string | null;
  name: string | null;
  slug: string | null;
}

export interface AdminSubscriptionUmkm {
  id: string | null;
  business_name: string | null;
  slug: string | null;
  is_verified: boolean;
}

export interface AdminSubscriptionOwner {
  id: string | null;
  full_name: string | null;
  email: string | null;
}

export interface AdminSubscription {
  id: string;
  umkm: AdminSubscriptionUmkm | null;
  owner: AdminSubscriptionOwner | null;
  plan: AdminSubscriptionPlan | null;
  status: string | null;
  effective: AdminSubscriptionEffective;
  billing: string | null;
  price_paid: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  xendit_invoice_id: string | null;
  xendit_status: string | null;
  created_at: string | null;
}

export interface AdminSubscriptionListResult {
  items: AdminSubscription[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminSubscriptionFilterParams {
  limit?: number;
  offset?: number;
  search?: string;
  status?: '' | AdminSubscriptionRawStatus;
  plan?: string;
}

export class AdminSubscriptionsApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminSubscriptionsApiError';
    this.status = status;
  }
}

async function authHeader(): Promise<string> {
  try {
    return await getAdminAuthHeader();
  } catch (err) {
    if (err instanceof AdminAuthError) {
      throw new AdminSubscriptionsApiError(err.message, 401);
    }
    throw err;
  }
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new AdminSubscriptionsApiError(json?.error ?? fallback, res.status);
}

/** Label presentasi raw status database (tidak menentukan keaktifan). */
export function rawStatusLabel(status: string | null | undefined): string {
  switch ((status ?? '').trim().toLowerCase()) {
    case 'active':
      return 'Aktif';
    case 'pending':
      return 'Menunggu pembayaran';
    case 'expired':
      return 'Expired';
    case 'cancelled':
      return 'Dibatalkan';
    case 'trial':
      return 'Trial';
    default:
      return status?.trim() ? status : '-';
  }
}

/** Label presentasi effective status (hasil perhitungan server). */
export function effectiveLabel(
  effective: AdminSubscriptionEffective | string | null | undefined
): string {
  switch ((effective ?? '').trim().toLowerCase()) {
    case 'active':
      return 'Aktif';
    case 'lapsed':
      return 'Periode habis';
    case 'pending':
      return 'Menunggu pembayaran';
    case 'expired':
      return 'Expired';
    case 'trial':
      return 'Trial';
    default:
      return effective?.trim() ? String(effective) : '-';
  }
}

export async function fetchAdminSubscriptions(
  limit = 20,
  offset = 0,
  search = '',
  status: '' | AdminSubscriptionRawStatus = '',
  plan = ''
): Promise<AdminSubscriptionListResult> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (search.trim()) params.set('search', search.trim());
  if (status) params.set('status', status);
  if (plan.trim()) params.set('plan', plan.trim());
  const res = await fetch(`/api/admin/subscriptions?${params.toString()}`, {
    headers: { Authorization: await authHeader() },
  });
  if (!res.ok) {
    await parseError(res, 'Gagal memuat daftar langganan.');
  }
  const json = (await res.json().catch(() => null)) as AdminSubscriptionListResult | null;
  if (!json || !Array.isArray(json.items)) {
    throw new AdminSubscriptionsApiError('Respons daftar langganan tidak valid.', 500);
  }
  return {
    items: json.items,
    total: json.total ?? json.items.length,
    limit: json.limit ?? limit,
    offset: json.offset ?? offset,
  };
}
