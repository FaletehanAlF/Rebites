'use client';

import { AdminAuthError, getAdminAuthHeader } from './admin-auth';

export type AdminOrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type AdminPaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded';

export type AdminDeliveryOption = 'delivery' | 'pickup';

export type AdminLifecycleStatus = 'ongoing' | 'completed';

export type AdminShipmentFilter = 'no_shipment' | 'has_shipment';

export interface AdminOrderBuyer {
  id: string | null;
  full_name: string | null;
  email: string | null;
}

export interface AdminOrderUmkm {
  id: string | null;
  business_name: string | null;
  slug: string | null;
  is_verified: boolean;
}

export interface AdminOrderProduct {
  id: string | null;
  name: string | null;
  image_url: string | null;
}

export interface AdminOrderFlags {
  has_shipment: boolean;
  paid_without_shipment: boolean;
  lifecycle_mismatch: boolean;
  legacy_no_progress: boolean;
}

export interface AdminOrder {
  id: string;
  order_code: string | null;
  created_at: string | null;
  buyer_id: string | null;
  umkm_id: string | null;
  product_id: string | null;
  product_slug: string | null;
  vendor_slug: string | null;
  vendor_name: string | null;
  product_name: string | null;
  quantity: number | null;
  unit_price: number | null;
  subtotal: number | null;
  discount: number | null;
  service_fee: number | null;
  delivery_fee: number | null;
  total_before_coin: number | null;
  coin_used: number | null;
  coin_earned: number | null;
  total_price: number | null;
  promo_code: string | null;
  payment_status: string | null;
  payment_method_id: string | null;
  xendit_invoice_id: string | null;
  order_status: string | null;
  lifecycle_status: string | null;
  progress_status: string | null;
  delivery_option: string | null;
  delivery_address: string | null;
  address_snapshot: Record<string, unknown> | null;
  shipping_snapshot: Record<string, unknown> | null;
  courier_code: string | null;
  courier_service_code: string | null;
  courier_service_name: string | null;
  shipping_rate: number | null;
  delivery_started_at: string | null;
  estimated_arrival_at: string | null;
  delivery_distance_km: number | null;
  estimated_delivery_minutes: number | null;
  biteship_order_id: string | null;
  biteship_tracking_id: string | null;
  biteship_waybill_id: string | null;
  shipment_status: string | null;
  shipment_created_at: string | null;
  shipment_error: string | null;
  completed_at: string | null;
  estimated_minutes: number | null;
  estimated_completion_at: string | null;
  buyer: AdminOrderBuyer | null;
  umkm: AdminOrderUmkm | null;
  product: AdminOrderProduct | null;
  flags: AdminOrderFlags;
}

export interface AdminOrderListResult {
  items: AdminOrder[];
  total: number;
  limit: number;
  offset: number;
}

export class AdminOrdersApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminOrdersApiError';
    this.status = status;
  }
}

async function authHeader(): Promise<string> {
  try {
    return await getAdminAuthHeader();
  } catch (err) {
    if (err instanceof AdminAuthError) {
      throw new AdminOrdersApiError(err.message, 401);
    }
    throw err;
  }
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new AdminOrdersApiError(json?.error ?? fallback, res.status);
}

/** Label presentasi apa adanya (tidak menggabungkan tri-status). */
export function orderStatusLabel(status: string | null | undefined): string {
  switch ((status ?? '').trim().toLowerCase()) {
    case 'pending':
      return 'Menunggu';
    case 'paid':
      return 'Dibayar';
    case 'processing':
      return 'Diproses';
    case 'ready_for_pickup':
      return 'Siap diambil';
    case 'out_for_delivery':
      return 'Diantar';
    case 'preparing':
      return 'Disiapkan';
    case 'ready':
      return 'Siap';
    case 'completed':
      return 'Selesai';
    case 'cancelled':
      return 'Dibatalkan';
    case 'refunded':
      return 'Dana dikembalikan';
    default:
      return status?.trim() ? String(status) : '-';
  }
}

export function paymentStatusLabel(status: string | null | undefined): string {
  switch ((status ?? '').trim().toLowerCase()) {
    case 'unpaid':
      return 'Belum dibayar';
    case 'paid':
      return 'Lunas';
    case 'failed':
      return 'Gagal / Kedaluwarsa';
    case 'refunded':
      return 'Dana dikembalikan';
    default:
      return status?.trim() ? String(status) : '-';
  }
}

export function lifecycleLabel(status: string | null | undefined): string {
  switch ((status ?? '').trim().toLowerCase()) {
    case 'ongoing':
      return 'Berlangsung';
    case 'completed':
      return 'Selesai';
    default:
      return status?.trim() ? String(status) : '-';
  }
}

export function progressLabel(status: string | null | undefined): string {
  if (status === null || status === undefined || String(status).trim() === '') {
    return 'Progres belum tersedia';
  }
  switch (String(status).trim().toLowerCase()) {
    case 'disiapkan':
      return 'Disiapkan';
    case 'siap-diambil':
      return 'Siap diambil';
    case 'diantar':
      return 'Diantar';
    default:
      return String(status);
  }
}

export function deliveryLabel(option: string | null | undefined): string {
  if (option === 'delivery') return 'Diantar';
  if (option === 'pickup') return 'Ambil sendiri';
  return option?.trim() ? String(option) : '-';
}

export interface AdminOrderFilters {
  limit?: number;
  offset?: number;
  search?: string;
  orderStatus?: '' | AdminOrderStatus;
  paymentStatus?: '' | AdminPaymentStatus;
  deliveryOption?: '' | AdminDeliveryOption;
  shipment?: '' | AdminShipmentFilter;
  lifecycle?: '' | AdminLifecycleStatus;
}

export async function fetchAdminOrders(filters: AdminOrderFilters = {}): Promise<AdminOrderListResult> {
  const {
    limit = 20,
    offset = 0,
    search = '',
    orderStatus = '',
    paymentStatus = '',
    deliveryOption = '',
    shipment = '',
    lifecycle = '',
  } = filters;
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (search.trim()) params.set('search', search.trim());
  if (orderStatus) params.set('order_status', orderStatus);
  if (paymentStatus) params.set('payment_status', paymentStatus);
  if (deliveryOption) params.set('delivery_option', deliveryOption);
  if (shipment) params.set('shipment', shipment);
  if (lifecycle) params.set('lifecycle', lifecycle);
  const res = await fetch(`/api/admin/orders?${params.toString()}`, {
    headers: { Authorization: await authHeader() },
  });
  if (!res.ok) {
    await parseError(res, 'Gagal memuat daftar pesanan.');
  }
  const json = (await res.json().catch(() => null)) as AdminOrderListResult | null;
  if (!json || !Array.isArray(json.items)) {
    throw new AdminOrdersApiError('Respons daftar pesanan tidak valid.', 500);
  }
  return {
    items: json.items,
    total: json.total ?? json.items.length,
    limit: json.limit ?? limit,
    offset: json.offset ?? offset,
  };
}
