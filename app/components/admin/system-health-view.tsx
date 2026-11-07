'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Activity, CircleAlert, CircleDashed, Cloud, CreditCard, Database, RefreshCw, Server, ShieldCheck, Truck, } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { AdminErrorState, AdminForbiddenState, AdminLoadingState, } from './admin-state';
import { AdminPageHeader, ADMIN_PAGE_WRAPPER, } from './admin-page-header';
import { formatTanggalWaktu } from './admin-format';
import { AdminHealthApiError, fetchAdminHealth } from '@/lib/admin-health';
import { HEALTH_SERVICE_KEYS, HEALTH_SERVICE_META, countCheckedServices, healthSourceLabel, healthStatusLabel, healthStatusVariant, overallHealthLabel, type AdminHealthReport, type HealthServiceKey, } from '@/lib/health-status';
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
        description: 'Layanan yang diperiksa langsung merespons normal. Provider tanpa probe aman tetap ditandai belum diperiksa.',
    },
    degraded: {
        title: 'Ada layanan yang perlu perhatian',
        description: 'Satu atau beberapa pemeriksaan gagal, atau konfigurasi server belum lengkap. Layanan lain tetap ditampilkan.',
    },
    unknown: {
        title: 'Sebagian layanan belum dapat diperiksa',
        description: 'Tidak ada kegagalan langsung, tetapi beberapa layanan belum memiliki probe aman dan tidak boleh dianggap sehat.',
    },
} as const;
function SummaryIcon({ status }: {
    status: AdminHealthReport['status'];
}) {
    if (status === 'ok')
        return <ShieldCheck aria-hidden className="h-5 w-5"/>;
    if (status === 'degraded')
        return <CircleAlert aria-hidden className="h-5 w-5"/>;
    return <CircleDashed aria-hidden className="h-5 w-5"/>;
}
const POLL_MS = 30000;
export function SystemHealthView() {
    const [report, setReport] = useState<AdminHealthReport | null>(null);
    const [status, setStatus] = useState<ViewStatus>('loading');
    const [errorMessage, setErrorMessage] = useState('');
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const load = useCallback(async () => {
        setStatus('loading');
        setErrorMessage('');
        try {
            const next = await fetchAdminHealth();
            setReport(next);
            setStatus('ready');
            setLastSync(new Date());
        }
        catch (err) {
            if (err instanceof AdminHealthApiError && err.status === 403) {
                setErrorMessage(err.message);
                setStatus('forbidden');
                return;
            }
            setErrorMessage(err instanceof AdminHealthApiError
                ? err.message
                : 'Terjadi kesalahan saat memeriksa kesehatan sistem.');
            setStatus('error');
        }
    }, []);
    useEffect(() => {
        load();
    }, [load]);
    useEffect(() => {
        const intervalId = setInterval(() => void load(), POLL_MS);
        return () => clearInterval(intervalId);
    }, [load]);
    const checkedCount = useMemo(() => (report ? countCheckedServices(report.services) : 0), [report]);
    const statTiles = useMemo(() => {
        if (!report)
            return [];
        const counts = report.services.reduce((acc, service) => {
            acc[service.status] = (acc[service.status] ?? 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const latencies = report.services
            .map((s) => s.latencyMs)
            .filter((v): v is number => typeof v === 'number');
        const avgLatency = latencies.length > 0
            ? Math.round(latencies.reduce((sum, v) => sum + v, 0) / latencies.length)
            : null;
        return [
            { label: 'Normal', value: String(counts.ok ?? 0), tone: 'success' as const },
            { label: 'Perlu perhatian', value: String(counts.degraded ?? 0), tone: 'destructive' as const },
            { label: 'Belum diperiksa', value: String(counts.unknown ?? 0), tone: 'secondary' as const },
            { label: 'Rata-rata latensi', value: avgLatency !== null ? `${avgLatency} ms` : '—', tone: 'default' as const },
        ];
    }, [report]);
    return (<div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader title="Performa Sistem ReBites" actions={<div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
              {report
                ? `${checkedCount} dari ${report.services.length} diperiksa langsung`
                : `${HEALTH_SERVICE_KEYS.length} layanan`}
            </Badge>
            <Button type="button" size="sm" variant="outline" onClick={load} disabled={status === 'loading'} aria-label="Periksa ulang kesehatan sistem">
              <RefreshCw aria-hidden className={status === 'loading' ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}/>
              {status === 'loading' ? 'Memeriksa…' : 'Periksa ulang'}
            </Button>
          </div>}/>

      {status === 'loading' && <AdminLoadingState label="Memeriksa kesehatan sistem"/>}

      {status === 'forbidden' && <AdminForbiddenState message={errorMessage}/>}

      {status === 'error' && (<AdminErrorState title="Gagal memeriksa kesehatan sistem" message={errorMessage} onRetry={load}/>)}

      {status === 'ready' && report && (<>
          <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statTiles.map((tile) => (<Card key={tile.label}>
                <CardContent className="px-5 py-4">
                  <p className={'text-2xl font-semibold tabular-nums tracking-tight ' +
                    (tile.tone === 'success'
                        ? 'text-success'
                        : tile.tone === 'destructive'
                            ? 'text-destructive'
                            : 'text-charcoal-900')}>
                    {tile.value}
                  </p>
                  <p className="mt-1 text-xs font-medium text-sage-500">{tile.label}</p>
                </CardContent>
              </Card>))}
          </div>

          <div className="mb-3 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none"/>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"/>
            </span>
            <h2 className="font-display text-base font-semibold text-charcoal-900">
              Layanan &amp; integrasi
            </h2>
            <span className="ml-auto text-[11px] text-sage-500">
              {lastSync ? `Diperbarui ${lastSync.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {report.services.map((service) => {
                const Icon = SERVICE_ICONS[service.key];
                const meta = HEALTH_SERVICE_META[service.key];
                return (<Card key={service.key}>
                  <CardContent className="flex h-full flex-col px-5 py-5">
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
                        <Icon aria-hidden className="h-5 w-5"/>
                      </span>
                      <Badge variant={healthStatusVariant(service.status)}>
                        {healthStatusLabel(service.status, service.code)}
                      </Badge>
                    </div>
                    <h3 className="mt-4 font-display text-base font-semibold text-charcoal-900">
                      {meta.label}
                    </h3>
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
                </Card>);
            })}
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-sage-500">
            Database, autentikasi, dan penyimpanan diperiksa langsung; pembayaran, pengiriman,
            dan webhook hanya dicek konfigurasinya. Tidak ada invoice, shipment, atau event uji
            yang dibuat. Tekan “Periksa ulang” untuk kondisi terbaru.
          </p>
        </>)}
    </div>);
}
