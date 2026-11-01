/**
 * Kontrak kesehatan sistem ReBites — modul MURNI.
 *
 * Modul ini sengaja tidak mengimpor Supabase, Next, atau provider apa pun
 * supaya aturan status dapat diuji langsung dengan `node --test`. Pemeriksaan
 * jaringan berada di `lib/server/health-probes.ts`; orkestrasinya berada di
 * `lib/server/health-service.ts`.
 *
 * Prinsip yang dipegang:
 * - `ok` hanya diberikan setelah pemeriksaan nyata berhasil.
 * - Provider yang dikonfigurasi tetapi belum punya probe aman tetap `unknown`.
 * - Konfigurasi yang hilang adalah `degraded`, bukan `ok`.
 * - Kegagalan satu layanan tidak membatalkan status layanan lain.
 */

export const HEALTH_SERVICE_KEYS = [
  'database',
  'auth',
  'storage',
  'payment',
  'shipping',
  'webhook',
] as const;

export type HealthServiceKey = (typeof HEALTH_SERVICE_KEYS)[number];

export const HEALTH_SERVICE_META: Record<
  HealthServiceKey,
  { label: string; description: string }
> = {
  database: {
    label: 'Database',
    description: 'Koneksi baca ke database utama ReBites melalui sesi admin.',
  },
  auth: {
    label: 'Autentikasi',
    description: 'Validasi sesi dan peran admin yang sedang digunakan.',
  },
  storage: {
    label: 'Penyimpanan',
    description: 'Operasi baca pada bucket gambar dan aset publik ReBites.',
  },
  payment: {
    label: 'Pembayaran',
    description: 'Integrasi pembayaran Xendit. Belum ada probe read-only yang aman.',
  },
  shipping: {
    label: 'Pengiriman',
    description:
      'Pembuatan shipment Biteship. Ongkir dihitung lokal; belum ada probe read-only yang aman.',
  },
  webhook: {
    label: 'Webhook',
    description:
      'Callback Xendit dan Biteship. Hanya keberadaan konfigurasi yang dapat diperiksa.',
  },
};

export type HealthStatus = 'ok' | 'degraded' | 'unknown';

export const HEALTH_CODES = [
  'not_configured',
  'no_safe_probe',
  'no_inbound_test',
  'timeout',
  'unreachable',
  'rejected',
  'invalid_response',
  'query_failed',
  'profile_missing',
  'storage_unavailable',
] as const;

export type HealthCode = (typeof HEALTH_CODES)[number];

export interface HealthServiceReport {
  key: HealthServiceKey;
  label: string;
  status: HealthStatus;
  latencyMs: number | null;
  checkedAt: string | null;
  code: HealthCode | null;
  message: string;
}

export interface AdminHealthReport {
  status: HealthStatus;
  generatedAt: string;
  services: HealthServiceReport[];
}

/** Hasil satu probe nyata; bukan hasil konfigurasi. */
export interface HealthProbeOutcome {
  status: 'ok' | 'degraded';
  latencyMs: number;
  code: HealthCode | null;
  message: string;
}

export type ConfigurationProbeReason = 'no_safe_probe' | 'no_inbound_test';

export type DeadlineResult<T> =
  | { status: 'completed'; value: T }
  | { status: 'timeout' };

export function isHealthStatus(value: unknown): value is HealthStatus {
  return value === 'ok' || value === 'degraded' || value === 'unknown';
}

export function isHealthServiceKey(value: unknown): value is HealthServiceKey {
  return (
    typeof value === 'string' &&
    (HEALTH_SERVICE_KEYS as readonly string[]).includes(value)
  );
}

export function isHealthCode(value: unknown): value is HealthCode {
  return (
    typeof value === 'string' && (HEALTH_CODES as readonly string[]).includes(value)
  );
}

/**
 * Aturan agregat yang konservatif:
 * - satu `degraded` selalu menang;
 * - jika tidak ada `degraded`, satu `unknown` membuat keseluruhan `unknown`;
 * - `ok` hanya jika semua layanan benar-benar `ok`;
 * - daftar kosong tidak boleh diklaim sehat.
 */
export function overallHealthStatus(services: readonly HealthServiceReport[]): HealthStatus {
  if (services.length === 0) return 'unknown';
  if (services.some((service) => service.status === 'degraded')) return 'degraded';
  if (services.some((service) => service.status === 'unknown')) return 'unknown';
  return 'ok';
}

/** Jumlah layanan yang benar-benar menjalani pemeriksaan langsung. */
export function countCheckedServices(services: readonly HealthServiceReport[]): number {
  return services.filter((service) => service.checkedAt !== null).length;
}

export function buildHealthServiceReport(
  key: HealthServiceKey,
  outcome: HealthProbeOutcome,
  checkedAt: string
): HealthServiceReport {
  return {
    key,
    label: HEALTH_SERVICE_META[key].label,
    status: outcome.status,
    latencyMs: Math.max(0, Math.round(outcome.latencyMs)),
    checkedAt,
    code: outcome.code,
    message: outcome.message,
  };
}

/**
 * Status layanan yang hanya dapat diperiksa dari konfigurasi server.
 * Tidak ada tanggal centang karena tidak ada pemeriksaan koneksi/provider.
 */
export function buildConfigurationService(
  key: HealthServiceKey,
  configured: boolean,
  reason: ConfigurationProbeReason
): HealthServiceReport {
  const message = configured
    ? reason === 'no_inbound_test'
      ? 'Secret webhook terdeteksi, tetapi belum ada uji inbound yang aman.'
      : 'Konfigurasi server terdeteksi, tetapi belum ada probe read-only yang aman.'
    : 'Konfigurasi server belum lengkap.';

  return {
    key,
    label: HEALTH_SERVICE_META[key].label,
    status: configured ? 'unknown' : 'degraded',
    latencyMs: null,
    checkedAt: null,
    code: configured ? reason : 'not_configured',
    message,
  };
}

export function buildHealthReport(
  services: HealthServiceReport[],
  generatedAt: string
): AdminHealthReport {
  return {
    status: overallHealthStatus(services),
    generatedAt,
    services,
  };
}

/** Label yang tidak pernah menyamakan `unknown` dengan sehat. */
export function healthStatusLabel(
  status: HealthStatus,
  code: HealthCode | null = null
): string {
  if (status === 'ok') return 'Normal';
  if (status === 'unknown') return 'Belum diperiksa';
  if (code === 'not_configured') return 'Belum dikonfigurasi';
  return 'Perlu perhatian';
}

export function healthStatusVariant(
  status: HealthStatus
): 'success' | 'warning' | 'secondary' {
  if (status === 'ok') return 'success';
  if (status === 'degraded') return 'warning';
  return 'secondary';
}

/** Label agregat; `unknown` di sini berarti hanya sebagian yang diperiksa. */
export function overallHealthLabel(status: HealthStatus): string {
  if (status === 'ok') return 'Normal';
  if (status === 'degraded') return 'Perlu perhatian';
  return 'Sebagian belum diperiksa';
}

export function healthSourceLabel(service: HealthServiceReport): string {
  if (service.checkedAt !== null) return 'Pemeriksaan langsung';
  if (service.code === 'not_configured') return 'Konfigurasi server';
  return 'Belum diperiksa';
}

/**
 * Deadline yang tidak bergantung pada `Promise.race` agar rejection yang
 * datang setelah timeout tetap tertangani (tidak menjadi unhandled rejection).
 */
export function withDeadline<T>(
  operation: PromiseLike<T>,
  timeoutMs: number
): Promise<DeadlineResult<T>> {
  const timeout = Number.isFinite(timeoutMs) ? Math.max(1, Math.floor(timeoutMs)) : 1;

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ status: 'timeout' });
    }, timeout);

    Promise.resolve(operation).then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ status: 'completed', value });
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/* ------------------------------------------------------------------------- *
 * Orkestrasi yang dapat diuji tanpa Supabase/Next.
 *
 * Probe jaringan nyata disuntikkan oleh `lib/server/health-service.ts`.
 * ------------------------------------------------------------------------- */

export interface HealthRunnerConfiguration {
  payment: boolean;
  shipping: boolean;
  webhook: boolean;
}

export interface HealthRunnerDependencies {
  probeDatabase: () => Promise<HealthProbeOutcome>;
  probeStorage: () => Promise<HealthProbeOutcome>;
  readConfiguration: () => HealthRunnerConfiguration;
  now?: () => Date;
  onUnexpectedError?: (key: string, error: unknown) => void;
  /** Opsional agar modul murni tidak perlu mengimpor klasifikator server. */
  isUnavailable?: (error: unknown) => boolean;
}

export interface HealthCheckPlanInput {
  /** Durasi gate admin yang sudah berhasil. */
  authLatencyMs: number;
}

function unexpectedOutcome(
  key: string,
  error: unknown,
  fallbackCode: HealthCode,
  fallbackMessage: string,
  deps: HealthRunnerDependencies
): HealthProbeOutcome {
  deps.onUnexpectedError?.(key, error);
  if (deps.isUnavailable?.(error)) {
    return {
      status: 'degraded',
      latencyMs: 0,
      code: 'unreachable',
      message: 'Tidak dapat menjangkau layanan data.',
    };
  }
  return {
    status: 'degraded',
    latencyMs: 0,
    code: fallbackCode,
    message: fallbackMessage,
  };
}

async function runProbe(
  key: string,
  probe: () => Promise<HealthProbeOutcome>,
  fallbackCode: HealthCode,
  fallbackMessage: string,
  deps: HealthRunnerDependencies
): Promise<HealthProbeOutcome> {
  try {
    return await probe();
  } catch (error) {
    return unexpectedOutcome(key, error, fallbackCode, fallbackMessage, deps);
  }
}

export async function runHealthCheckPlan(
  input: HealthCheckPlanInput,
  deps: HealthRunnerDependencies
): Promise<AdminHealthReport> {
  const now = deps.now ?? (() => new Date());

  const [database, storage] = await Promise.all([
    runProbe(
      'database',
      deps.probeDatabase,
      'query_failed',
      'Pemeriksaan database gagal dijalankan.',
      deps
    ),
    runProbe(
      'storage',
      deps.probeStorage,
      'storage_unavailable',
      'Pemeriksaan penyimpanan gagal dijalankan.',
      deps
    ),
  ]);

  // Satu timestamp untuk pemeriksaan yang selesai bersamaan; tidak ada
  // klaim waktu yang berbeda-beda untuk probe paralel.
  const checkedAt = now().toISOString();
  const generatedAt = now().toISOString();

  let config: HealthRunnerConfiguration;
  try {
    config = deps.readConfiguration();
  } catch (error) {
    deps.onUnexpectedError?.('configuration', error);
    config = { payment: false, shipping: false, webhook: false };
  }

  const services: HealthServiceReport[] = [
    buildHealthServiceReport('database', database, checkedAt),
    buildHealthServiceReport(
      'auth',
      {
        status: 'ok',
        latencyMs: Math.max(0, input.authLatencyMs),
        code: null,
        message: 'Sesi dan peran admin tervalidasi.',
      },
      checkedAt
    ),
    buildHealthServiceReport('storage', storage, checkedAt),
    buildConfigurationService('payment', config.payment, 'no_safe_probe'),
    buildConfigurationService('shipping', config.shipping, 'no_safe_probe'),
    buildConfigurationService('webhook', config.webhook, 'no_inbound_test'),
  ];

  return buildHealthReport(services, generatedAt);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isHealthServiceReport(value: unknown): value is HealthServiceReport {
  if (!isRecord(value)) return false;
  const latency = value.latencyMs;
  return (
    isHealthServiceKey(value.key) &&
    typeof value.label === 'string' &&
    isHealthStatus(value.status) &&
    (latency === null ||
      (typeof latency === 'number' && Number.isFinite(latency) && latency >= 0)) &&
    isNullableString(value.checkedAt) &&
    (value.code === null || isHealthCode(value.code)) &&
    typeof value.message === 'string'
  );
}

/**
 * Validasi respons server sebelum UI memakainya. Kontrak enam layanan
 * diwajibkan agar UI tidak diam-diam kehilangan satu pun.
 */
export function isAdminHealthReport(value: unknown): value is AdminHealthReport {
  if (!isRecord(value)) return false;
  if (!isHealthStatus(value.status)) return false;
  if (typeof value.generatedAt !== 'string' || value.generatedAt.length === 0) return false;
  if (!Array.isArray(value.services)) return false;
  if (value.services.length !== HEALTH_SERVICE_KEYS.length) return false;

  const seen = new Set<HealthServiceKey>();
  for (const service of value.services) {
    if (!isHealthServiceReport(service)) return false;
    if (seen.has(service.key)) return false;
    seen.add(service.key);
  }

  return HEALTH_SERVICE_KEYS.every((key) => seen.has(key));
}
