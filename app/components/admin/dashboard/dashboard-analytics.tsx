'use client';

import { useEffect, useRef, useState } from 'react';
import { Flag, ShoppingBag, Wallet, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  ANALYTICS_RANGE_DAYS,
  type AdminAnalyticsData,
  type AnalyticsRangeDays,
} from '@/lib/admin-analytics';
import { fetchAdminAnalytics } from '@/lib/admin-dashboard';
import { AdminErrorState, AdminForbiddenState, AdminInlineError } from '../admin-state';
import { AdminFilterChip } from '../admin-controls';
import { formatRupiah, formatTanggal, formatTanggalWaktu } from '../admin-format';
import { DashboardCard } from './primitives';
import { DashboardTrends } from './dashboard-trends';

const RANGE_LABEL: Record<AnalyticsRangeDays, string> = {
  7: '7 hari',
  14: '14 hari',
  30: '30 hari',
  90: '90 hari',
};

function StatCard({
  icon: Icon,
  label,
  value,
  supporting,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  supporting: string;
}) {
  return (
    <DashboardCard className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-sage-500">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-charcoal-900">
            {value}
          </p>
          <p className="mt-1.5 text-xs text-sage-500">{supporting}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
          <Icon aria-hidden className="h-4 w-4" />
        </span>
      </div>
    </DashboardCard>
  );
}

function BreakdownRows({
  rows,
}: {
  rows: { label: string; value: number; tone: string }[];
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <ul className="grid gap-2.5">
      {rows.map((row) => {
        const percent = total > 0 ? Math.round((row.value / total) * 100) : 0;
        return (
          <li key={row.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-charcoal-700">{row.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-charcoal-900">
                {row.value.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sage-100">
              <span
                aria-hidden
                className={`block h-full rounded-full ${row.tone}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function AnalyticsRangePicker({
  rangeDays,
  onChange,
}: {
  rangeDays: AnalyticsRangeDays;
  onChange: (days: AnalyticsRangeDays) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Pilih rentang analytics"
      className="flex flex-wrap items-center gap-1.5"
    >
      {ANALYTICS_RANGE_DAYS.map((days) => (
        <AdminFilterChip
          key={days}
          active={rangeDays === days}
          onClick={() => onChange(days)}
        >
          {RANGE_LABEL[days]}
        </AdminFilterChip>
      ))}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Memuat analytics periode"
      className="animate-pulse motion-reduce:animate-none"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 rounded-[var(--radius)] bg-sage-100/60" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="h-64 rounded-[var(--radius)] bg-sage-100/60" />
        <div className="h-64 rounded-[var(--radius)] bg-sage-100/60" />
      </div>
    </div>
  );
}

export function DashboardAnalytics() {
  const [rangeDays, setRangeDays] = useState<AnalyticsRangeDays>(14);
  const [data, setData] = useState<AdminAnalyticsData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const hasData = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const initial = !hasData.current;
    if (initial) setStatus('loading');
    else setRefreshing(true);
    setErrorMsg('');

    (async () => {
      try {
        const result = await fetchAdminAnalytics(rangeDays);
        if (cancelled) return;
        setData(result);
        hasData.current = true;
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        if ((err as { status?: number })?.status === 403) {
          setStatus('forbidden');
          return;
        }
        if (hasData.current) {
          setErrorMsg(err instanceof Error ? err.message : 'Gagal memperbarui analytics.');
          setStatus('ready');
        } else {
          setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat analytics.');
          setStatus('error');
        }
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rangeDays, reloadToken]);

  if (status === 'loading') return <AnalyticsSkeleton />;

  if (status === 'forbidden') {
    return <AdminForbiddenState message="Analitik periode hanya untuk admin." />;
  }

  if (status === 'error' || !data) {
    return (
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-charcoal-900">Rentang analytics</p>
          <AnalyticsRangePicker rangeDays={rangeDays} onChange={setRangeDays} />
        </div>
        <p className="mb-3 text-xs text-sage-500">
          Bila periode ini terlalu besar, pilih rentang yang lebih pendek lalu coba lagi.
        </p>
        <AdminErrorState
          title="Gagal memuat analytics"
          message={errorMsg || 'Terjadi kesalahan saat menghitung data periode.'}
          onRetry={() => setReloadToken((value) => value + 1)}
        />
      </div>
    );
  }

  const hasAnyData = data.orders.total > 0 || data.reports.total > 0;

  return (
    <div aria-busy={refreshing} className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-charcoal-900">
            {formatTanggal(data.from)} – {formatTanggal(data.to)}
          </p>
          <p className="mt-0.5 text-xs text-sage-500">
            Zona waktu WIB · diperbarui {formatTanggalWaktu(data.generatedAt)}
            {refreshing ? ' · memuat periode…' : ''}
          </p>
        </div>
        <AnalyticsRangePicker rangeDays={rangeDays} onChange={setRangeDays} />
      </div>

      {errorMsg && (
        <div className="mt-3">
          <AdminInlineError message={errorMsg} />
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ShoppingBag}
          label="Pesanan dibuat"
          value={data.orders.total.toLocaleString('id-ID')}
          supporting={`${data.orders.paid.toLocaleString('id-ID')} sudah dibayar`}
        />
        <StatCard
          icon={Wallet}
          label="Pendapatan bruto pesanan dibayar"
          value={formatRupiah(data.orders.revenue)}
          supporting="Jumlah total_price pesanan paid; bukan laba bersih."
        />
        <StatCard
          icon={Flag}
          label="Laporan baru"
          value={data.reports.total.toLocaleString('id-ID')}
          supporting={`${(
            data.reports.byStatus.open + data.reports.byStatus.reviewing
          ).toLocaleString('id-ID')} masih terbuka/ditinjau`}
        />
        <StatCard
          icon={XCircle}
          label="Pembayaran gagal"
          value={data.orders.failed.toLocaleString('id-ID')}
          supporting="Status pembayaran failed pada periode"
        />
      </div>

      {!hasAnyData && (
        <p className="mt-4 rounded-[var(--radius)] border border-border bg-white px-4 py-3 text-sm text-sage-500">
          Belum ada pesanan atau laporan pada periode ini. Angka nol di atas berasal dari data
          yang berhasil dimuat, bukan kegagalan query.
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <DashboardCard>
          <h3 className="font-display text-sm font-semibold text-charcoal-900">
            Status saat ini — laporan dibuat pada periode
          </h3>
          <div className="mt-3">
            <BreakdownRows
              rows={[
                {
                  label: 'Terbuka',
                  value: data.reports.byStatus.open,
                  tone: 'bg-warning',
                },
                {
                  label: 'Ditinjau',
                  value: data.reports.byStatus.reviewing,
                  tone: 'bg-primary',
                },
                {
                  label: 'Selesai',
                  value: data.reports.byStatus.resolved,
                  tone: 'bg-success',
                },
                {
                  label: 'Ditolak',
                  value: data.reports.byStatus.dismissed,
                  tone: 'bg-sage-500',
                },
              ]}
            />
          </div>
        </DashboardCard>

        <DashboardCard>
          <h3 className="font-display text-sm font-semibold text-charcoal-900">
            Tingkat saat ini — laporan dibuat pada periode
          </h3>
          <div className="mt-3">
            <BreakdownRows
              rows={[
                {
                  label: 'Kritis',
                  value: data.reports.bySeverity.critical,
                  tone: 'bg-destructive',
                },
                {
                  label: 'Tinggi',
                  value: data.reports.bySeverity.high,
                  tone: 'bg-destructive/70',
                },
                {
                  label: 'Sedang',
                  value: data.reports.bySeverity.medium,
                  tone: 'bg-warning',
                },
                {
                  label: 'Rendah',
                  value: data.reports.bySeverity.low,
                  tone: 'bg-primary/60',
                },
                {
                  label: 'Tanpa tingkat',
                  value: data.reports.bySeverity.unknown,
                  tone: 'bg-sage-500',
                },
              ]}
            />
          </div>
        </DashboardCard>
      </div>

      <div className="mt-4">
        <DashboardTrends points={data.orders.byDay} rangeDays={data.rangeDays} />
      </div>
    </div>
  );
}
