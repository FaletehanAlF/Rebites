/**
 * Health check server: menghubungkan runner yang dapat diuji dengan probe
 * Supabase yang sesungguhnya. Tidak ada provider eksternal yang dipanggil.
 */

import {
  runHealthCheckPlan,
  type AdminHealthReport,
} from '@/lib/health-status';
import { isSupabaseUnavailable } from './supabase-errors';
import {
  probeDatabase,
  probeStorage,
  readHealthConfiguration,
} from './health-probes';

export interface RunHealthChecksInput {
  authHeader: string;
  adminId: string;
  /** Durasi gate admin (auth.getUser + profiles.role) yang sudah berhasil. */
  authLatencyMs: number;
}

export async function runHealthChecks(
  input: RunHealthChecksInput
): Promise<AdminHealthReport> {
  return runHealthCheckPlan(
    { authLatencyMs: input.authLatencyMs },
    {
      probeDatabase: () => probeDatabase(input.authHeader, input.adminId),
      probeStorage,
      readConfiguration: readHealthConfiguration,
      isUnavailable: isSupabaseUnavailable,
      onUnexpectedError: (key, error) => {
        console.error(
          '[admin/health] probe tidak terduga',
          key,
          error instanceof Error ? error.name : 'unknown'
        );
      },
    }
  );
}
