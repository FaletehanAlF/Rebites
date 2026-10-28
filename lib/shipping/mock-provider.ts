/**
 * Implementasi MOCK/LOCAL penyedia pengiriman ReBites.
 *
 * - 100% lokal: tanpa jaringan, tanpa fetch/HTTP, tanpa Supabase.
 * - Tarif/ETA/referensi/status hanyalah data dummy deterministik untuk
 *   pengujian UI dan kontrak internal; TIDAK boleh dipakai sebagai tarif,
 *   resi, atau status pengiriman resmi.
 * - Bentuk data mengikuti kontrak internal lib/shipping/provider, bukan
 *   skema API Biteship. Pemetaan ke API nyata harus diverifikasi terpisah.
 */

import type {
  ShippingGeoPoint,
  ShippingLifecycleStatus,
  ShippingProvider,
  ShippingQuote,
  ShippingQuoteRequest,
  ShippingShipment,
  ShippingShipmentRequest,
  ShippingTrackingEntry,
  ShippingTrackingInfo,
} from './provider';

export const MOCK_SHIPPING_PROVIDER_NAME = 'mock-local';
export const MOCK_SHIPPING_SHIPMENT_LABEL =
  'Simulasi lokal - bukan pengiriman nyata';

interface MockServiceTemplate {
  courierCode: string;
  serviceCode: string;
  courierName: string;
  serviceName: string;
  serviceType: 'instant' | 'same_day' | 'reguler';
  etaMinMinutes: number;
  etaMaxMinutes: number;
  baseFeeIdr: number;
  perKmFeeIdr: number;
}

/** Katalog layanan dummy. Nama sengaja berlabel "(Simulasi)". */
const MOCK_SERVICE_CATALOG: readonly MockServiceTemplate[] = [
  {
    courierCode: 'sim_instant',
    serviceCode: 'sim_instant_food',
    courierName: 'Kurir Instan (Simulasi)',
    serviceName: 'Instan Makanan (Simulasi)',
    serviceType: 'instant',
    etaMinMinutes: 25,
    etaMaxMinutes: 40,
    baseFeeIdr: 12000,
    perKmFeeIdr: 2800,
  },
  {
    courierCode: 'sim_same_day',
    serviceCode: 'sim_same_day_food',
    courierName: 'Kurir Same Day (Simulasi)',
    serviceName: 'Same Day Makanan (Simulasi)',
    serviceType: 'same_day',
    etaMinMinutes: 120,
    etaMaxMinutes: 240,
    baseFeeIdr: 9000,
    perKmFeeIdr: 1900,
  },
  {
    courierCode: 'sim_reguler',
    serviceCode: 'sim_reguler_food',
    courierName: 'Kurir Reguler (Simulasi)',
    serviceName: 'Reguler Makanan (Simulasi)',
    serviceType: 'reguler',
    etaMinMinutes: 360,
    etaMaxMinutes: 720,
    baseFeeIdr: 7000,
    perKmFeeIdr: 1200,
  },
];

const LIFECYCLE_ORDER: readonly ShippingLifecycleStatus[] = [
  'assigned',
  'picking_up',
  'picked',
  'in_transit',
  'delivered',
];

function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function isValidPoint(value: ShippingGeoPoint): boolean {
  return (
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}

function assertValidPoint(value: ShippingGeoPoint, label: string): void {
  if (!isValidPoint(value)) {
    throw new RangeError(
      `Koordinat ${label} tidak valid untuk simulasi (lat -90..90, lng -180..180).`
    );
  }
}

function haversineKm(a: ShippingGeoPoint, b: ShippingGeoPoint): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function roundToHundreds(value: number): number {
  return Math.max(0, Math.round(value / 100) * 100);
}

/** Referensi shipment dummy deterministik per order (bukan resi nyata). */
export function buildMockReferenceId(orderCode: string): string {
  const hash = stableHash(orderCode || 'tanpa-order');
  return `SIMREF-${String(hash % 1_000_000).padStart(6, '0')}`;
}

function assertRequest(request: ShippingQuoteRequest): void {
  if (!request.orderCode || request.orderCode.trim() === '') {
    throw new Error('orderCode wajib diisi untuk simulasi tarif.');
  }
  if (!Number.isFinite(request.quantity) || request.quantity < 1) {
    throw new RangeError('quantity harus angka minimal 1.');
  }
  assertValidPoint(request.origin, 'toko');
  assertValidPoint(request.destination, 'tujuan');
}

function buildTrackingEntries(
  shipment: ShippingShipment
): ShippingTrackingEntry[] {
  const base = Date.parse(shipment.createdAt);
  if (Number.isNaN(base)) {
    throw new Error('createdAt shipment simulasi tidak valid.');
  }
  const at = (offsetMinutes: number) =>
    new Date(base + offsetMinutes * 60_000).toISOString();

  if (shipment.status === 'cancelled') {
    return [
      {
        status: 'assigned',
        at: at(0),
        note: 'Kurir simulasi ditugaskan (dummy).',
      },
      {
        status: 'cancelled',
        at: at(3),
        note: 'Pengiriman simulasi dibatalkan (dummy).',
      },
    ];
  }

  const notes: Record<Exclude<ShippingLifecycleStatus, 'cancelled'>, number> = {
    assigned: 0,
    picking_up: 6,
    picked: 14,
    in_transit: 20,
    delivered: 45,
  };
  const targetIndex = LIFECYCLE_ORDER.indexOf(shipment.status);
  const upto = targetIndex >= 0 ? targetIndex : 0;
  return LIFECYCLE_ORDER.slice(0, upto + 1).map((status) => ({
    status,
    at: at(notes[status as Exclude<ShippingLifecycleStatus, 'cancelled'>]),
    note: `Tahap ${status} (simulasi lokal, tanpa kurir nyata).`,
  }));
}

async function getQuote(
  request: ShippingQuoteRequest,
  nowIso: string
): Promise<ShippingQuote> {
  assertRequest(request);
  const distanceKm = haversineKm(request.origin, request.destination);
  const hash = stableHash(
    `${request.orderCode}:${request.origin.latitude}:${request.destination.longitude}`
  );

  const options = MOCK_SERVICE_CATALOG.map((service, index) => {
    const jitterIdr = ((hash >> (index * 3)) % 5) * 100;
    const raw =
      service.baseFeeIdr + service.perKmFeeIdr * distanceKm * (1 + index * 0.08);
    return {
      courierCode: service.courierCode,
      serviceCode: service.serviceCode,
      courierName: service.courierName,
      serviceName: service.serviceName,
      serviceType: service.serviceType,
      price: Math.max(service.baseFeeIdr, roundToHundreds(raw + jitterIdr)),
      duration: `+/- ${service.etaMinMinutes}-${service.etaMaxMinutes} menit`,
    };
  }).sort((a, b) => a.price - b.price);

  return {
    provider: MOCK_SHIPPING_PROVIDER_NAME,
    isSimulation: true,
    referenceId: buildMockReferenceId(request.orderCode),
    orderCode: request.orderCode,
    quotedAt: nowIso,
    options,
  };
}

async function createShipment(
  request: ShippingShipmentRequest,
  nowIso: string
): Promise<ShippingShipment> {
  if (!request.orderCode || request.orderCode.trim() === '') {
    throw new Error('orderCode wajib diisi untuk membuat shipment simulasi.');
  }
  const known = MOCK_SERVICE_CATALOG.some(
    (service) =>
      service.courierCode === request.courierCode &&
      service.serviceCode === request.serviceCode
  );
  if (!known) {
    throw new Error(
      'Layanan simulasi tidak dikenal. Gunakan layanan dari getQuote mock.'
    );
  }
  return {
    provider: MOCK_SHIPPING_PROVIDER_NAME,
    isSimulation: true,
    referenceId: buildMockReferenceId(request.orderCode),
    orderCode: request.orderCode,
    courierCode: request.courierCode,
    serviceCode: request.serviceCode,
    status: 'assigned',
    createdAt: nowIso,
    updatedAt: nowIso,
    label: MOCK_SHIPPING_SHIPMENT_LABEL,
  };
}

async function getTracking(
  shipment: ShippingShipment
): Promise<ShippingTrackingInfo> {
  if (!shipment.isSimulation) {
    throw new Error(
      'Mock provider hanya melayani shipment simulasi (isSimulation=false ditolak).'
    );
  }
  const entries = buildTrackingEntries(shipment);
  const last = entries[entries.length - 1];
  return {
    provider: MOCK_SHIPPING_PROVIDER_NAME,
    isSimulation: true,
    referenceId: shipment.referenceId,
    status: last ? last.status : shipment.status,
    entries,
  };
}

/**
 * Provider simulasi lokal. `networkAccess: 'none'` adalah janji kontrak:
 * tidak ada operasi yang boleh menyentuh jaringan.
 */
export const mockShippingProvider: ShippingProvider = {
  name: MOCK_SHIPPING_PROVIDER_NAME,
  networkAccess: 'none',
  getQuote,
  createShipment,
  getTracking,
};
