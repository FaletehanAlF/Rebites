'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  CircleAlert,
  CircleDashed,
  Cloud,
  CreditCard,
  Database,
  RefreshCw,
  Server,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  AdminErrorState,
  AdminForbiddenState,
  AdminLoadingState,
} from './admin-state';
import {
  AdminPageHeader,
  ADMIN_PAGE_WRAPPER,
} from './admin-page-header';
import { formatTanggalWaktu } from './admin-format';
import { AdminHealthApiError, fetchAdminHealth } from '@/lib/admin-health';
import {
  HEALTH_SERVICE_KEYS,
  HEALTH_SERVICE_META,
  countCheckedServices,
  healthSourceLabel,
  healthStatusLabel,
  healthStatusVariant,
  overallHealthLabel,
  type AdminHealthReport,
  type HealthServiceKey,
} from '@/lib/health-status';

const SERVICE_ICONS: Record<HealthServiceKey, LucideIcon> = {
  database: Database,
  auth: Activity,
  storage: Cloud,
  payment: CreditCard,
  shipping: Truck,
  webhook: Server,
};

type ViewStatus = 'loading' | 'ready' | 'error' | 'forbidden';

const SUMMARY_COPY = {
  ok: {
    title: 'Semua pemeriksaan yang tersedia berhasil',
    description:
      'Layanan yang diperiksa langsung merespons normal. Provider tanpa probe aman tetap ditandai belum diperiksa.',
  },
  degraded: {
    title: 'Ada layanan yang perlu perhatian',
    description:
      'Satu atau beberapa pemeriksaan gagal, atau konfigurasi server belum lengkap. Layanan lain tetap ditampilkan.',
  },
  unknown: {
    title: 'Sebagian layanan belum dapat diperiksa',
    description:
      'Tidak ada kegagalan langsung, tetapi beberapa layanan belum memiliki probe aman dan tidak boleh dianggap sehat.',
  },
} as const;

function SummaryIcon({ status }: { status: AdminHealthReport['status'] }) {
  if (status === 'ok') return <ShieldCheck aria-hidden className="h-5 w-5" />;
  if (status === 'degraded') return <CircleAlert aria-hidden className="h-5 w-5" />;
  return <CircleDashed aria-hidden className="h-5 w-5" />;
}

export function SystemHealthView() {
  const [report, setReport] = useState<AdminHealthReport | null>(null);
  const [status, setStatus] = useState<ViewStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMessage('');
    try {
      const next = await fetchAdminHealth();
      setReport(next);
      setStatus('ready');
    } catch (err) {
      if (err instanceof AdminHealthApiError && err.status === 403) {
        setErrorMessage(err.message);
        setStatus('forbidden');
        return;
      }
      setErrorMessage(
        err instanceof AdminHealthApiError
          ? err.message
          : 'Terjadi kesalahan saat memeriksa kesehatan sistem.'
      );
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const checkedCount = useMemo(
    () => (report ? countCheckedServices(report.services) : 0),
    [report]
  );
  const summary = report ? SUMMARY_COPY[report.status] : null;

  return (
    <div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader
        eyebrow="Admin · Sistem"
        title="Kesehatan Sistem"
        description="Pemeriksaan langsung untuk layanan dan integrasi utama ReBites."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
              {report
                ? `${checkedCount} dari ${report.services.length} diperiksa langsung`
                : `${HEALTH_SERVICE_KEYS.length} layanan`}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={load}
              disabled={status === 'loading'}
              aria-label="Periksa ulang kesehatan sistem"
            >
              <RefreshCw
                aria-hidden
                className={status === 'loading' ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
              />
              {status === 'loading' ? 'Memeriksa…' : 'Periksa ulang'}
            </Button>
          </div>
        }
      />

      {status === 'loading' && <AdminLoadingState label="Memeriksa kesehatan sistem" />}

      {status === 'forbidden' && <AdminForbiddenState message={errorMessage} />}

      {status === 'error' && (
        <AdminErrorState
          title="Gagal memeriksa kesehatan sistem"
          message={errorMessage}
          onRetry={load}
        />
      )}

      {status === 'ready' && report && summary && (
        <>
          <Card className="mb-5">
            <CardContent
              className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:justify-between"
              role="status"
              aria-live="polite"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={
                    report.status === 'ok'
                      ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-success/[0.15] text-success'
                      : report.status === 'degraded'
                        ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-warning/[0.15] text-warning-strong'
                        : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-sage-100/60 text-sage-500'
                  }
                >
                  <SummaryIcon status={report.status} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base font-semibold text-charcoal-900">
                      {summary.title}
                    </h2>
                    <Badge variant={healthStatusVariant(report.status)}>
                      {overallHealthLabel(report.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-sage-500">
                    {summary.description}
                  </p>
                </div>
              </div>
              <div className="shrink-0 rounded-[var(--radius)] bg-sage-100/50 px-4 py-3 text-left sm:text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sage-500">
                  Waktu pemeriksaan
                </p>
                <p className="mt-0.5 text-sm font-semibold text-charcoal-900">
                  {formatTanggalWaktu(report.generatedAt)}
                </p>
                <p className="mt-1 text-[11px] text-sage-500">
                  {checkedCount} pemeriksaan langsung
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-charcoal-900">
                Layanan &amp; integrasi
              </h2>
              <p className="mt-0.5 text-xs text-sage-500">
                Status hanya diambil dari pemeriksaan yang benar-benar dijalankan.
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              {report.services.length} layanan
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.services.map((service) => {
              const Icon = SERVICE_ICONS[service.key];
              const meta = HEALTH_SERVICE_META[service.key];
              return (
                <Card key={service.key}>
                  <CardContent className="flex h-full flex-col px-5 py-5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
                        <Icon aria-hidden className="h-5 w-5" />
                      </span>
                      <Badge variant={healthStatusVariant(service.status)}>
                        {healthStatusLabel(service.status, service.code)}
                      </Badge>
                    </div>
                    <h3 className="mt-4 font-display text-base font-semibold text-charcoal-900">
                      {meta.label}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-sage-500">
                      {meta.description}
                    </p>
                    <p className="mt-2 flex-1 text-xs leading-relaxed text-charcoal-700">
                      {service.message}
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-xs">
                      <div>
                        <dt className="text-sage-500">Sumber status</dt>
                        <dd className="mt-0.5 font-medium text-charcoal-900">
                          {healthSourceLabel(service)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sage-500">Terakhir diperiksa</dt>
                        <dd className="mt-0.5 font-medium text-charcoal-900">
                          {service.checkedAt ? formatTanggalWaktu(service.checkedAt) : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sage-500">Latensi</dt>
                        <dd className="mt-0.5 font-medium tabular-nums text-charcoal-900">
                          {service.latencyMs === null ? '—' : `${service.latencyMs} ms`}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sage-500">Kode</dt>
                        <dd className="mt-0.5 break-all font-mono text-[11px] font-medium text-charcoal-900">
                          {service.code ?? '—'}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="px-5 py-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-sage-100/60 text-sage-500">
                    <CircleAlert aria-hidden className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-base font-semibold text-charcoal-900">
                      Cakupan pemeriksaan
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-sage-500">
                      Database, autentikasi, dan penyimpanan diperiksa langsung. Pembayaran,
                      pengiriman, dan webhook hanya dicek konfigurasinya karena belum ada probe
                      read-only yang aman. Tidak ada invoice, shipment, atau event uji yang
                      dibuat.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="px-5 py-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-sage-100/60 text-sage-500">
                    <RefreshCw aria-hidden className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-base font-semibold text-charcoal-900">
                      Diperbarui manual
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-sage-500">
                      Halaman ini tidak melakukan refresh otomatis. Tekan “Periksa ulang” untuk
                      mengambil kondisi terbaru. Status “Belum diperiksa” bukan berarti sehat dan
                      bukan berarti gangguan.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
