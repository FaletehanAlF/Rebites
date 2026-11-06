'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { fetchAdminDashboard } from '@/lib/admin-dashboard';
import { fetchActivityLogs } from '@/lib/admin-activity-logs';
import { useAdminPreferences } from '@/hooks/use-admin-preferences';
import { useAdminRealtimeActivity } from '@/hooks/use-admin-realtime-activity';
import { AdminErrorState, AdminLoadingState } from './admin-state';
import { formatTanggalWaktu, labelAktivitas } from './admin-format';

interface OverviewState {
  openReports: number;
  reviewingReports: number;
  totalWarnings: number;
  warningThreeUsers: number;
  activeSanctions: number;
  recentActivity: {
    id: string;
    description: string;
    activityType: string;
    createdAt: string;
  }[];
}

export function MonitoringOverview() {
  const [state, setState] = useState<OverviewState | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const { realtimeActivity } = useAdminPreferences();

  const {
    newCount,
    reset: resetRealtime,
    connection: realtimeConnection,
  } = useAdminRealtimeActivity(realtimeActivity && status === 'ready');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Satu endpoint agregat: angka laporan/peringatan/sanksi dihitung server
        // dari seluruh data, bukan dari 200 baris pertama seperti versi lama.
        const dashboard = await fetchAdminDashboard();
        if (!mounted) return;
        setState({
          openReports: dashboard.reports.open,
          reviewingReports: dashboard.reports.reviewing,
          totalWarnings:
            dashboard.warnings.level1 +
            dashboard.warnings.level2 +
            dashboard.warnings.level3,
          warningThreeUsers: dashboard.warnings.usersAtThree,
          activeSanctions: dashboard.sanctions.active,
          recentActivity: dashboard.activity.slice(0, 5).map((item) => ({
            id: item.id,
            description: item.description,
            activityType: item.activityType,
            createdAt: item.createdAt,
          })),
        });
        setStatus('ready');
      } catch {
        if (mounted) setStatus('error');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Aktivitas terbaru diperbarui otomatis via Realtime (debounce 1.5 detik)
  // tanpa reload halaman manual. Kegagalan fetch diabaikan diam-diam agar
  // tidak merusak ringkasan yang sudah tampil.
  useEffect(() => {
    if (status !== 'ready' || newCount === 0) return;
    const t = setTimeout(async () => {
      try {
        const activityRes = await fetchActivityLogs(5, 0);
        setState((s) => (s ? { ...s, recentActivity: activityRes.logs ?? [] } : s));
        resetRealtime();
      } catch {}
    }, 1500);
    return () => clearTimeout(t);
  }, [newCount, status, resetRealtime]);

  const cards = useMemo(
    () =>
      state
        ? [
            { label: 'Laporan terbuka', value: state.openReports, href: '/dashboard/admin/monitoring/laporan' },
            { label: 'Sedang ditinjau', value: state.reviewingReports, href: '/dashboard/admin/monitoring/laporan' },
            { label: 'Total peringatan', value: state.totalWarnings, href: '/dashboard/admin/monitoring/peringatan' },
            { label: 'Peringatan pengguna 3/3', value: state.warningThreeUsers, href: '/dashboard/admin/monitoring/peringatan' },
            { label: 'Sanksi aktif', value: state.activeSanctions, href: '/dashboard/admin/monitoring/sanksi' },
          ]
        : [],
    [state]
  );

  if (status === 'loading') {
    return <AdminLoadingState label="Memuat ringkasan monitoring" />;
  }

  if (status === 'error' || !state) {
    return (
      <AdminErrorState
        title="Gagal memuat ringkasan monitoring"
        message="Terjadi kesalahan saat mengambil data monitoring."
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {realtimeConnection === 'connected' && (
          <Badge variant="success" className="px-3 py-1 text-xs font-semibold">
            <span
              aria-hidden
              className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-success motion-reduce:animate-none"
            />
            Pemantauan langsung
          </Badge>
        )}
        {realtimeConnection === 'connecting' && (
          <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
            Menghubungkan realtime…
          </Badge>
        )}
        {realtimeConnection === 'error' && (
          <Badge variant="warning" className="px-3 py-1 text-xs font-semibold">
            Realtime terputus
          </Badge>
        )}
        {newCount > 0 && (
          <span className="rounded-[var(--radius)] bg-primary px-3 py-1 text-xs font-semibold text-white">
            {newCount} aktivitas produk baru — daftar di bawah diperbarui otomatis
          </span>
        )}
      </div>
      {/* `flex-wrap` + `flex-1 basis-*`: lima kartu pada tiga kolom
          menyisakan satu sel kosong di baris kedua bila memakai grid.
          Dengan flex, baris terakhir selalu terisi penuh. */}
      <div className="mt-3 flex flex-wrap gap-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="flex min-w-0 flex-1 basis-[10rem] rounded-[var(--radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Card className="h-full w-full transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_24px_-16px_rgba(30,43,32,0.45)]">
              <CardContent className="px-4 py-4">
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-charcoal-900">
                  {card.value}
                </p>
                <p className="mt-1 text-xs font-medium text-sage-500">{card.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader className="p-5 pb-0">
          <CardTitle className="font-display text-base font-semibold text-charcoal-900">
            Aktivitas terbaru
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 p-5">
          {state.recentActivity.length === 0 ? (
            <p className="text-sm text-sage-500">Belum ada aktivitas tercatat.</p>
          ) : (
            state.recentActivity.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius)] bg-sage-100/40 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-charcoal-900">
                    {item.description}
                  </p>
                  <p className="text-xs text-sage-500">{labelAktivitas(item.activityType)}</p>
                </div>
                <p className="shrink-0 whitespace-nowrap text-xs text-sage-500">
                  {formatTanggalWaktu(item.createdAt)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/dashboard/admin/monitoring/aktivitas">
          <Button type="button" variant="outline" size="sm">Aktivitas</Button>
        </Link>
        <Link href="/dashboard/admin/monitoring/laporan">
          <Button type="button" variant="outline" size="sm">Laporan</Button>
        </Link>
        <Link href="/dashboard/admin/monitoring/peringatan">
          <Button type="button" variant="outline" size="sm">Peringatan</Button>
        </Link>
        <Link href="/dashboard/admin/monitoring/sanksi">
          <Button type="button" variant="outline" size="sm">Sanksi</Button>
        </Link>
        <Link href="/dashboard/admin/monitoring/audit">
          <Button type="button" variant="outline" size="sm">Audit</Button>
        </Link>
      </div>
    </>
  );
}
