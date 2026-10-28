/**
 * Probe kesehatan yang benar-benar aman — server-only.
 *
 * Batasan yang dipegang di sini:
 * - Database: satu SELECT head-count pada `profiles`, memakai JWT admin.
 * - Storage: operasi `list` (read-only) pada bucket publik.
 * - Provider pembayaran/pengiriman/webhook: TIDAK dipanggil. Hanya keberadaan
 *   konfigurasi yang dibaca; tidak ada invoice, shipment, rates, atau event.
 *
 * Tidak ada nilai env, token, nama object storage, atau body provider yang
 * dikembalikan ke client. Pesan di modul ini adalah pesan publik yang aman.
 */

import {
  createAnonServerClient,
  createAuthedServerClient,
} from '@/lib/server/supabase';
import { isSupabaseUnavailable } from '@/lib/server/supabase-errors';
import {
  withDeadline,
  type HealthCode,
  type HealthProbeOutcome,
} from '@/lib/health-status';

/** Batas waktu setiap probe Supabase. Total route masih dibatasi auth gate. */
export const HEALTH_PROBE_TIMEOUT_MS = 3_000;

/**
 * Bucket yang dipakai aplikasi berdasarkan migration storage. Semuanya publik
 * untuk baca; probe hanya memastikan bucket dapat di-list tanpa mengambil nama
 * object ke client.
 */
export const HEALTH_STORAGE_BUCKETS = [
  'product-images',
  'avatars',
  'umkm-logos',
  'article-images',
] as const;

export interface HealthConfigurationPresence {
  payment: boolean;
  shipping: boolean;
  webhook: boolean;
}

function elapsedSince(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

function isMissingConfigError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('Missing env:');
}

function errorOutcome(
  error: unknown,
  latencyMs: number,
  fallbackCode: HealthCode,
  fallbackMessage: string
): HealthProbeOutcome {
  if (isMissingConfigError(error)) {
    return {
      status: 'degraded',
      latencyMs,
      code: 'not_configured',
      message: 'Konfigurasi Supabase server belum lengkap.',
    };
  }
  if (isSupabaseUnavailable(error)) {
    return {
      status: 'degraded',
      latencyMs,
      code: 'unreachable',
      message: 'Tidak dapat menjangkau layanan data.',
    };
  }
  return {
    status: 'degraded',
    latencyMs,
    code: fallbackCode,
    message: fallbackMessage,
  };
}

/**
 * Membaca count profil admin melalui client yang meneruskan JWT. RLS tetap
 * aktif; service role tidak dipakai agar probe tidak melewati kebijakan akses.
 */
export async function probeDatabase(
  authHeader: string,
  adminId: string
): Promise<HealthProbeOutcome> {
  const startedAt = Date.now();

  try {
    const db = createAuthedServerClient(authHeader, HEALTH_PROBE_TIMEOUT_MS);
    const result = await withDeadline(
      Promise.resolve(
        db
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('id', adminId)
      ),
      HEALTH_PROBE_TIMEOUT_MS
    );
    const latencyMs = elapsedSince(startedAt);

    if (result.status === 'timeout') {
      return {
        status: 'degraded',
        latencyMs,
        code: 'timeout',
        message: 'Pemeriksaan database melewati batas waktu.',
      };
    }

    const { error, count } = result.value;
    if (error) {
      return errorOutcome(error, latencyMs, 'query_failed', 'Query pemeriksaan database ditolak.');
    }
    if (count !== 1) {
      return {
        status: 'degraded',
        latencyMs,
        code: 'profile_missing',
        message: 'Database merespons, tetapi profil admin tidak dapat diverifikasi.',
      };
    }

    return {
      status: 'ok',
      latencyMs,
      code: null,
      message: 'Database merespons query baca admin.',
    };
  } catch (error) {
    return errorOutcome(
      error,
      elapsedSince(startedAt),
      'query_failed',
      'Pemeriksaan database gagal dijalankan.'
    );
  }
}

/**
 * Memeriksa bucket dengan `list` (bukan upload/remove/signed URL). Hasil hanya
 * berupa status; nama object dan respons Supabase tidak pernah diteruskan.
 */
export async function probeStorage(): Promise<HealthProbeOutcome> {
  const startedAt = Date.now();

  try {
    const client = createAnonServerClient(HEALTH_PROBE_TIMEOUT_MS);
    const checks = await Promise.all(
      HEALTH_STORAGE_BUCKETS.map(async (bucket) => {
        const result = await withDeadline(
          Promise.resolve(client.storage.from(bucket).list('', { limit: 1 })),
          HEALTH_PROBE_TIMEOUT_MS
        );
        if (result.status === 'timeout') return { kind: 'timeout' as const, error: null };
        if (result.value.error) {
          return { kind: 'error' as const, error: result.value.error };
        }
        return { kind: 'ok' as const, error: null };
      })
    );
    const latencyMs = elapsedSince(startedAt);

    if (checks.some((check) => check.kind === 'timeout')) {
      return {
        status: 'degraded',
        latencyMs,
        code: 'timeout',
        message: 'Pemeriksaan penyimpanan melewati batas waktu.',
      };
    }

    const failed = checks.find((check) => check.kind === 'error');
    if (failed) {
      if (isSupabaseUnavailable(failed.error)) {
        return {
          status: 'degraded',
          latencyMs,
          code: 'unreachable',
          message: 'Tidak dapat menjangkau layanan penyimpanan.',
        };
      }
      return {
        status: 'degraded',
        latencyMs,
        code: 'storage_unavailable',
        message: 'Sebagian penyimpanan gambar dan aset tidak dapat dibaca.',
      };
    }

    return {
      status: 'ok',
      latencyMs,
      code: null,
      message: 'Penyimpanan gambar dan aset dapat dibaca.',
    };
  } catch (error) {
    return errorOutcome(
      error,
      elapsedSince(startedAt),
      'storage_unavailable',
      'Pemeriksaan penyimpanan gagal dijalankan.'
    );
  }
}

/**
 * Hanya membaca keberadaan konfigurasi. Fungsi ini tidak melakukan panggilan
 * jaringan dan tidak pernah mengembalikan nilai env.
 */
export function readHealthConfiguration(): HealthConfigurationPresence {
  const xenditWebhook = Boolean(
    process.env.XENDIT_CALLBACK_TOKEN?.trim() ||
      process.env.XENDIT_WEBHOOK_TOKEN?.trim()
  );
  const biteshipWebhook = Boolean(process.env.BITESHIP_WEBHOOK_SECRET?.trim());

  return {
    payment: Boolean(process.env.XENDIT_SECRET_KEY?.trim()),
    shipping: Boolean(process.env.BITESHIP_API_KEY?.trim()),
    webhook: xenditWebhook && biteshipWebhook,
  };
}
