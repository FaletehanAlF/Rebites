/**
 * SIMULASI pengiriman ReBites (mode uji, tanpa kurir sungguhan).
 *
 * Batasan modul ini:
 * - TIDAK menyentuh Supabase. Seluruh state disimpan di localStorage browser.
 * - TIDAK memanggil Biteship / kurir / API eksternal apa pun.
 * - TIDAK mengubah order_status, payment_status, stok, atau data pesanan.
 * - TIDAK memakai timer otomatis; setiap transisi dijalankan eksplisit.
 * - Status di sini adalah status simulasi, bukan status pesanan asli.
 *
 * Modul ini sengaja berdiri sendiri (tanpa import) agar logika murni bisa
 * diuji langsung dengan `node --test` (lihat tests/shipping-simulation.test.ts).
 */

export type ShippingSimStatus =
  | 'menunggu_penjual'
  | 'siap_diambil'
  | 'kurir_ditugaskan'
  | 'menuju_penjemputan'
  | 'pesanan_diambil'
  | 'dalam_perjalanan'
  | 'tiba_di_tujuan'
  | 'selesai'
  | 'dibatalkan';

/** Urutan tahap normal (tanpa status terminal `dibatalkan`). */
export const SHIPPING_SIM_STATUS_ORDER: ShippingSimStatus[] = [
  'menunggu_penjual',
  'siap_diambil',
  'kurir_ditugaskan',
  'menuju_penjemputan',
  'pesanan_diambil',
  'dalam_perjalanan',
  'tiba_di_tujuan',
  'selesai',
];

export const SHIPPING_SIM_STATUS_LABEL: Record<ShippingSimStatus, string> = {
  menunggu_penjual: 'Menunggu penjual menyiapkan pesanan',
  siap_diambil: 'Pesanan siap diambil kurir',
  kurir_ditugaskan: 'Kurir simulasi ditugaskan',
  menuju_penjemputan: 'Kurir menuju lokasi penjemputan',
  pesanan_diambil: 'Kurir mengambil pesanan',
  dalam_perjalanan: 'Kurir dalam perjalanan',
  tiba_di_tujuan: 'Pesanan tiba di tujuan',
  selesai: 'Pengiriman selesai (simulasi)',
  dibatalkan: 'Simulasi dibatalkan',
};

const VALID_SIM_TRANSITIONS: Record<ShippingSimStatus, ShippingSimStatus[]> = {
  menunggu_penjual: ['siap_diambil', 'dibatalkan'],
  siap_diambil: ['kurir_ditugaskan', 'dibatalkan'],
  kurir_ditugaskan: ['menuju_penjemputan', 'dibatalkan'],
  menuju_penjemputan: ['pesanan_diambil', 'dibatalkan'],
  pesanan_diambil: ['dalam_perjalanan', 'dibatalkan'],
  dalam_perjalanan: ['tiba_di_tujuan', 'dibatalkan'],
  tiba_di_tujuan: ['selesai', 'dibatalkan'],
  selesai: [],
  dibatalkan: [],
};

export function isShippingSimStatus(value: unknown): value is ShippingSimStatus {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(SHIPPING_SIM_STATUS_LABEL, value)
  );
}

export function isValidShippingSimTransition(from: string, to: string): boolean {
  if (!isShippingSimStatus(from) || !isShippingSimStatus(to)) return false;
  return VALID_SIM_TRANSITIONS[from].includes(to);
}

/** Tahap normal berikutnya; null bila status terminal atau `dibatalkan`. */
export function nextShippingSimStatus(
  current: ShippingSimStatus
): ShippingSimStatus | null {
  const options = VALID_SIM_TRANSITIONS[current] ?? [];
  const forward = options.find((s) => s !== 'dibatalkan');
  return forward ?? null;
}

export interface ShippingSimNextAction {
  target: ShippingSimStatus;
  label: string;
}

const NEXT_ACTION_LABEL: Partial<Record<ShippingSimStatus, string>> = {
  menunggu_penjual: 'Pesanan Siap Diambil',
  siap_diambil: 'Tugaskan Kurir Simulasi',
  kurir_ditugaskan: 'Kurir Menuju Penjemputan',
  menuju_penjemputan: 'Tandai Pesanan Diambil',
  pesanan_diambil: 'Lanjutkan Perjalanan',
  dalam_perjalanan: 'Tandai Tiba di Tujuan',
  tiba_di_tujuan: 'Selesaikan Pengiriman',
};

export function getNextShippingSimAction(
  current: ShippingSimStatus
): ShippingSimNextAction | null {
  const target = nextShippingSimStatus(current);
  if (!target) return null;
  const label = NEXT_ACTION_LABEL[current];
  if (!label) return null;
  return { target, label };
}

export interface SimGeoPoint {
  latitude: number;
  longitude: number;
  source: 'snapshot' | 'device' | 'manual' | 'simulated';
}

export interface SimCourier {
  id: string;
  name: string;
  vehicle: string;
  label: string;
}

export interface ShippingSimHistoryEntry {
  status: ShippingSimStatus;
  at: string;
  note?: string;
}

export interface ShippingSimRecord {
  version: 1;
  orderCode: string;
  status: ShippingSimStatus;
  history: ShippingSimHistoryEntry[];
  courier: SimCourier;
  originOverride: SimGeoPoint | null;
  destinationOverride: SimGeoPoint | null;
  startedAt: string;
  updatedAt: string;
}

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

const SIM_GEO_POINT_SOURCES: readonly SimGeoPoint['source'][] = [
  'snapshot',
  'device',
  'manual',
  'simulated',
];

export function isValidSimGeoPoint(value: unknown): value is SimGeoPoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.latitude === 'number' &&
    typeof point.longitude === 'number' &&
    isValidLatitude(point.latitude) &&
    isValidLongitude(point.longitude) &&
    typeof point.source === 'string' &&
    (SIM_GEO_POINT_SOURCES as string[]).includes(point.source)
  );
}

/**
 * Titik rute simulasi yang dipakai panel: override penguji (manual/GPS)
 * menang atas snapshot pesanan; snapshot hanya dipakai bila pasangan angka
 * valid. Nilai tidak sah tidak pernah dipakai mentah-mentah (tanpa
 * mengarang titik) — invalid -> fallback snapshot, keduanya tak ada -> null.
 */
export function resolveShippingSimPoint(
  override: SimGeoPoint | null | undefined,
  latitude: unknown,
  longitude: unknown
): SimGeoPoint | null {
  if (isValidSimGeoPoint(override)) return override;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null;
  }
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null;
  return { latitude, longitude, source: 'snapshot' };
}

/** Parse input string menjadi koordinat; null bila tidak valid. Tidak mengarang nilai. */
export function parseCoordinate(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const normalized = trimmed.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

const SIM_COURIER_NAMES = [
  'Andi Pratama',
  'Bayu Saputra',
  'Citra Lestari',
  'Dewi Anggraini',
  'Eko Nugroho',
];

function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Identitas kurir simulasi deterministik per order. Bukan data kurir nyata. */
export function getSimulatedCourier(orderCode: string): SimCourier {
  const hash = stableHash(orderCode || 'tanpa-order');
  const name = SIM_COURIER_NAMES[hash % SIM_COURIER_NAMES.length];
  return {
    id: `SIM-${(hash % 9000) + 1000}`,
    name,
    vehicle: 'Motor (unit simulasi)',
    label: 'Kurir Simulasi',
  };
}

export function createShippingSimRecord(
  orderCode: string,
  nowIso: string
): ShippingSimRecord {
  return {
    version: 1,
    orderCode,
    status: 'menunggu_penjual',
    history: [
      {
        status: 'menunggu_penjual',
        at: nowIso,
        note: 'Simulasi dimulai oleh penguji (bukan pesanan kurir sungguhan)',
      },
    ],
    courier: getSimulatedCourier(orderCode),
    originOverride: null,
    destinationOverride: null,
    startedAt: nowIso,
    updatedAt: nowIso,
  };
}

/** Transisi tervalidasi. Mengembalikan record baru, atau null bila tidak valid. */
export function applyShippingSimTransition(
  record: ShippingSimRecord,
  target: ShippingSimStatus,
  nowIso: string,
  note?: string
): ShippingSimRecord | null {
  if (!isValidShippingSimTransition(record.status, target)) return null;
  const entry: ShippingSimHistoryEntry = { status: target, at: nowIso };
  if (note) entry.note = note;
  return {
    ...record,
    status: target,
    history: [...record.history, entry],
    updatedAt: nowIso,
  };
}

export function advanceShippingSimRecord(
  record: ShippingSimRecord,
  nowIso: string
): ShippingSimRecord | null {
  const next = nextShippingSimStatus(record.status);
  if (!next) return null;
  return applyShippingSimTransition(record, next, nowIso);
}

export const SHIPPING_SIM_STORAGE_PREFIX = 'rebites-shipping-sim-v1:';
export const SHIPPING_SIM_MODE_STORAGE_KEY = 'rebites-shipping-sim-mode-v1';
export const SHIPPING_SIM_FLAG_PARAM = 'shipping-sim';

export function shippingSimStorageKey(orderCode: string): string {
  return `${SHIPPING_SIM_STORAGE_PREFIX}${orderCode}`;
}

function getBrowserStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function isValidShippingSimHistoryEntry(
  value: unknown
): value is ShippingSimHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    isShippingSimStatus(entry.status) &&
    typeof entry.at === 'string' &&
    entry.at.length > 0 &&
    (entry.note === undefined || typeof entry.note === 'string')
  );
}

/**
 * Parse + sanitasi record dari localStorage.
 *
 * Data yang rusak tidak pernah dipakai mentah-mentah: entri history tidak
 * valid dibuang, override koordinat tidak valid di-null-kan (tidak mengarang
 * lokasi), dan record yang tidak konsisten (status != entri terakhir, beda
 * orderCode) ditolak total agar tidak tampil tercampur antar pesanan.
 */
export function parseShippingSimRecord(
  raw: string,
  orderCode: string
): ShippingSimRecord | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== 1) return null;
    if (parsed.orderCode !== orderCode) return null;
    if (!isShippingSimStatus(parsed.status)) return null;
    if (!Array.isArray(parsed.history)) return null;

    const history: ShippingSimHistoryEntry[] = parsed.history
      .filter(isValidShippingSimHistoryEntry)
      .map((entry) => {
        const clean: ShippingSimHistoryEntry = {
          status: entry.status,
          at: entry.at,
        };
        if (entry.note) clean.note = entry.note;
        return clean;
      });
    if (history.length === 0) return null;
    // Status harus sama dengan entri terakhir; selain itu riwayat menyesatkan.
    if (history[history.length - 1].status !== parsed.status) return null;

    const courierRaw = parsed.courier as Record<string, unknown> | undefined;
    if (
      !courierRaw ||
      typeof courierRaw.id !== 'string' ||
      courierRaw.id.length === 0 ||
      typeof courierRaw.name !== 'string' ||
      courierRaw.name.length === 0
    ) {
      return null;
    }

    const startedAt =
      typeof parsed.startedAt === 'string' && parsed.startedAt.length > 0
        ? parsed.startedAt
        : history[0].at;
    const updatedAt =
      typeof parsed.updatedAt === 'string' && parsed.updatedAt.length > 0
        ? parsed.updatedAt
        : history[history.length - 1].at;

    return {
      version: 1,
      orderCode,
      status: parsed.status,
      history,
      courier: {
        id: courierRaw.id,
        name: courierRaw.name,
        vehicle:
          typeof courierRaw.vehicle === 'string' && courierRaw.vehicle.length > 0
            ? courierRaw.vehicle
            : 'Motor (unit simulasi)',
        label:
          typeof courierRaw.label === 'string' && courierRaw.label.length > 0
            ? courierRaw.label
            : 'Kurir Simulasi',
      },
      originOverride: isValidSimGeoPoint(parsed.originOverride)
        ? parsed.originOverride
        : null,
      destinationOverride: isValidSimGeoPoint(parsed.destinationOverride)
        ? parsed.destinationOverride
        : null,
      startedAt,
      updatedAt,
    };
  } catch {
    return null;
  }
}

export function loadShippingSimRecord(
  orderCode: string
): ShippingSimRecord | null {
  const storage = getBrowserStorage();
  if (!storage) return null;
  const raw = storage.getItem(shippingSimStorageKey(orderCode));
  if (!raw) return null;
  return parseShippingSimRecord(raw, orderCode);
}

export function saveShippingSimRecord(record: ShippingSimRecord): void {
  const storage = getBrowserStorage();
  if (!storage) return;
  try {
    storage.setItem(
      shippingSimStorageKey(record.orderCode),
      JSON.stringify(record)
    );
  } catch {
    // localStorage penuh/private mode: simulasi tetap jalan di memori UI.
  }
}

export function removeShippingSimRecord(orderCode: string): void {
  const storage = getBrowserStorage();
  if (!storage) return;
  try {
    storage.removeItem(shippingSimStorageKey(orderCode));
  } catch {
    // noop
  }
}

export function isShippingSimFlagInSearch(search: string): boolean {
  const normalized = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(normalized);
  return params.get(SHIPPING_SIM_FLAG_PARAM) === '1';
}

/**
 * Mode simulasi:
 * - `?shipping-sim=1` menyalakan dan menyimpan flag di localStorage.
 * - `?shipping-sim=0` mematikan dan menyimpan opt-out.
 * - Dev build: aktif default agar bisa diuji tanpa query param.
 * - Production build: hanya aktif lewat flag eksplisit (tersimpan).
 */
export function syncShippingSimModeFromSearch(search: string): boolean {
  const storage = getBrowserStorage();
  const normalized = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(normalized);
  if (params.get(SHIPPING_SIM_FLAG_PARAM) === '1') {
    try {
      storage?.setItem(SHIPPING_SIM_MODE_STORAGE_KEY, '1');
    } catch {
      // noop
    }
    return true;
  }
  if (params.get(SHIPPING_SIM_FLAG_PARAM) === '0') {
    try {
      storage?.setItem(SHIPPING_SIM_MODE_STORAGE_KEY, '0');
    } catch {
      // noop
    }
    return false;
  }
  return isShippingSimModeEnabled();
}

export function setShippingSimModeEnabled(enabled: boolean): void {
  const storage = getBrowserStorage();
  if (!storage) return;
  try {
    storage.setItem(SHIPPING_SIM_MODE_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // noop
  }
}

export function isShippingSimModeEnabled(): boolean {
  const storage = getBrowserStorage();
  if (storage) {
    const stored = storage.getItem(SHIPPING_SIM_MODE_STORAGE_KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;
  }
  return process.env.NODE_ENV !== 'production';
}

/**
 * Fraksi perjalanan kurir simulasi pada rute sketsa:
 * 0 = titik awal kurir (depot simulasi), 0.5 = toko, 1 = tujuan.
 * null = kurir belum ditugaskan; status tidak pernah melompat.
 */
export function getSimCourierTravelFraction(
  status: ShippingSimStatus
): number | null {
  switch (status) {
    case 'menunggu_penjual':
    case 'siap_diambil':
    case 'dibatalkan':
      return null;
    case 'kurir_ditugaskan':
      return 0;
    case 'menuju_penjemputan':
      return 0.3;
    case 'pesanan_diambil':
      return 0.5;
    case 'dalam_perjalanan':
      return 0.8;
    case 'tiba_di_tujuan':
    case 'selesai':
      return 1;
    default:
      return null;
  }
}

export interface SimRouteGeometry {
  depot: SimGeoPoint;
  origin: SimGeoPoint;
  destination: SimGeoPoint;
}

const DEPOT_OFFSET = { latitude: 0.012, longitude: -0.012 };

/** Titik awal kurir simulasi: offset deterministik dari toko (bukan lokasi nyata). */
export function buildSimRouteGeometry(
  origin: SimGeoPoint,
  destination: SimGeoPoint
): SimRouteGeometry {
  return {
    depot: {
      latitude: origin.latitude + DEPOT_OFFSET.latitude,
      longitude: origin.longitude + DEPOT_OFFSET.longitude,
      source: 'simulated',
    },
    origin,
    destination,
  };
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Interpolasi linear sederhana untuk rute sketsa (bukan geodesik presisi). */
export function interpolateSimPosition(
  geometry: SimRouteGeometry,
  fraction: number
): SimGeoPoint {
  const f = Math.min(1, Math.max(0, fraction));
  if (f <= 0.5) {
    const t = f * 2;
    return {
      latitude: lerp(geometry.depot.latitude, geometry.origin.latitude, t),
      longitude: lerp(geometry.depot.longitude, geometry.origin.longitude, t),
      source: 'simulated',
    };
  }
  const t = (f - 0.5) * 2;
  return {
    latitude: lerp(geometry.origin.latitude, geometry.destination.latitude, t),
    longitude: lerp(geometry.origin.longitude, geometry.destination.longitude, t),
    source: 'simulated',
  };
}

export function getSimCourierPosition(
  status: ShippingSimStatus,
  origin: SimGeoPoint,
  destination: SimGeoPoint
): SimGeoPoint | null {
  const fraction = getSimCourierTravelFraction(status);
  if (fraction === null) return null;
  return interpolateSimPosition(buildSimRouteGeometry(origin, destination), fraction);
}

/** Haversine (mirror lib/delivery-estimate.ts) untuk label jarak sketsa simulasi. */
export function distanceBetweenKm(a: SimGeoPoint, b: SimGeoPoint): number {
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
