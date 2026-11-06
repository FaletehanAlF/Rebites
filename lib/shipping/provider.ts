/**
 * FONDASI penyedia pengiriman ReBites (kontrak internal, belum produksi).
 *
 * BATASAN PENTING:
 * - Tipe di file ini adalah kontrak internal ReBites, BUKAN salinan atau
 *   tiruan skema API Biteship. Pemetaan ke API resmi (endpoint, payload,
 *   nama field) wajib diverifikasi terhadap dokumentasi resmi sebelum
 *   dipakai untuk integrasi nyata.
 * - File ini hanya berisi tipe (tanpa kode runtime, tanpa jaringan).
 * - Implementasi yang tersedia saat ini hanyalah mock lokal:
 *   `lib/shipping/mock-provider.ts`. Integrasi Biteship server yang sudah
 *   ada (lib/server/biteship*.ts) berdiri sendiri dan tidak diubah.
 */

import type { ShippingRateOption } from '@/lib/types';

/** Jenis layanan pengiriman (internal; tidak diklaim sama dengan kode Biteship). */
export type ShippingServiceType = 'instant' | 'same_day' | 'reguler';

/** Siklus hidup shipment versi internal (bukan enum status API mana pun). */
export type ShippingLifecycleStatus =
  | 'assigned'
  | 'picking_up'
  | 'picked'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export interface ShippingGeoPoint {
  latitude: number;
  longitude: number;
}

export interface ShippingQuoteRequest {
  orderCode: string;
  origin: ShippingGeoPoint;
  destination: ShippingGeoPoint;
  quantity: number;
}

export interface ShippingQuote {
  provider: string;
  /** true = data simulasi lokal; tidak boleh dianggap tarif resmi. */
  isSimulation: boolean;
  referenceId: string;
  orderCode: string;
  quotedAt: string;
  /** Memakai bentuk ShippingRateOption internal yang sudah dipakai checkout. */
  options: ShippingRateOption[];
}

export interface ShippingShipmentRequest {
  orderCode: string;
  courierCode: string;
  serviceCode: string;
}

export interface ShippingShipment {
  provider: string;
  isSimulation: boolean;
  referenceId: string;
  orderCode: string;
  courierCode: string;
  serviceCode: string;
  status: ShippingLifecycleStatus;
  createdAt: string;
  updatedAt: string;
  /** Label manusiawi yang menegaskan ini bukan pengiriman nyata. */
  label: string;
}

export interface ShippingTrackingEntry {
  status: ShippingLifecycleStatus;
  at: string;
  note: string;
}

export interface ShippingTrackingInfo {
  provider: string;
  isSimulation: boolean;
  referenceId: string;
  status: ShippingLifecycleStatus;
  entries: ShippingTrackingEntry[];
}

/** Kontrak akses jaringan yang diizinkan untuk sebuah provider. */
export type ShippingNetworkAccess = 'none' | 'server-only';

export interface ShippingProvider {
  readonly name: string;
  readonly networkAccess: ShippingNetworkAccess;
  getQuote(request: ShippingQuoteRequest, nowIso: string): Promise<ShippingQuote>;
  createShipment(
    request: ShippingShipmentRequest,
    nowIso: string
  ): Promise<ShippingShipment>;
  getTracking(shipment: ShippingShipment): Promise<ShippingTrackingInfo>;
}
