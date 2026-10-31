'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  CircleSlash,
  ClipboardList,
  Eye,
  Flag,
  Gavel,
  Inbox,
  Package,
  RefreshCw,
  ShieldAlert,
  Store,
  TriangleAlert,
  UserRound,
  Users,
} from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  ReportsApiError,
  fetchReports,
  type ReportItem,
  type ReportSeverity,
} from '@/lib/admin-reports';
import { AdminPageHeader, ADMIN_PAGE_WRAPPER } from './admin-page-header';
import { AdminErrorState, AdminForbiddenState, AdminLoadingState } from './admin-state';
import { waktuLalu } from './admin-format';
import { ADMIN_DETAIL_LABEL } from './admin-detail';
import { cn } from '@/lib/utils';

import { redirectIfSessionExpired } from './admin-session';



const LAPORAN_HREF = '/dashboard/admin/monitoring/laporan';

interface HubData {
  statusTotals: Record<'open' | 'reviewing' | 'resolved' | 'dismissed', number>;
  unassignedOpen: number;
  severityTotals: Record<ReportSeverity, number>;
  recent: ReportItem[];
}

function statusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case 'open':
      return 'Terbuka';
    case 'reviewing':
      return 'Ditinjau';
    case 'resolved':
      return 'Selesai';
    case 'dismissed':
      return 'Ditolak';
    default:
      return status || '-';
  }
}

function statusTone(status: string): 'warning' | 'default' | 'success' | 'secondary' | 'outline' {
  switch (status.toLowerCase()) {
    case 'open':
      return 'warning';
    case 'reviewing':
      return 'default';
    case 'resolved':
      return 'success';
    case 'dismissed':
      return 'secondary';
    default:
      return 'outline';
  }
}

type TileTone = 'warning' | 'default' | 'success' | 'secondary' | 'accent';

const TONE_ICON: Record<TileTone, string> = {
  warning: 'bg-warning/10 text-warning',
  success: 'bg-success/10 text-success',
  accent: 'bg-primary/10 text-primary',
  secondary: 'bg-sage-100 text-sage-600',
  // "Sedang ditinjau" memakai nada netral (abu) supaya berbeda jelas dari
  // tile biru-aksen "Belum ditugaskan". Versi lama keduanya memakai
  // `bg-primary/10 text-primary` sehingga dua tile bersebelahan tampak
  // identik dan admin tidak bisa membedakan mana yang bisa diklik.
  default: 'bg-charcoal-900/[0.06] text-charcoal-700',
};

/**
 * Satu petak statistik antrean: angka besar + label + ikon bernuansa status.
 *
 * Setiap tile adalah KARTUMANDIRI (bukan sel di dalam satu kartu besar yang
 * dipisah `divide-x`). Alasan: grid 3 kolom berisi 5 tile pasti membungkus,
 * dan `divide-x` pada grid yang membungkus menggambar garis vertikal
 * nyasar di tepi baris kedua. Kartu mandiri + `flex-wrap` dengan
 * `flex-1 basis-*` membuat baris terakhir selalu terisi penuh.
 */
function StatTile({
  icon: Icon,
  value,
  label,
  tone,
  href,
  hint,
}: {
  icon: typeof Flag;
  value: number;
  label: string;
  tone: TileTone;
  href?: string;
  hint?: string;
}) {
  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          TONE_ICON[tone]
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-semibold tabular-nums leading-none tracking-tight text-charcoal-900">
          {value}
        </p>
        <p className="mt-1.5 text-xs font-medium leading-snug text-sage-500" title={label}>
          {label}
        </p>
        {hint && <p className="mt-1 text-[11px] leading-snug text-sage-500">{hint}</p>}
      </div>
    </>
  );

  const className = cn(
    'group flex min-w-0 flex-1 basis-[13rem] items-center gap-3 rounded-[var(--radius)] border border-border bg-white px-4 py-3.5 text-left transition-all',
    href &&
      'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_24px_-16px_rgba(30,43,32,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
  );

  if (!href) {
    return <div className={className}>{body}</div>;
  }

  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

/**
 * Pusat Moderasi Terpadu.
 *
 * Hanya memakai endpoint laporan yang sudah ada (`/api/admin/reports`) untuk
 * menghitung ringkasan per status/severity (memakai `total` dari filter),
 * lalu menavigasi ke halaman kelola yang sudah tersedia. Tidak ada endpoint,
 * tabel, atau sistem moderasi kedua yang dibuat.
 */
export function ModerationHub() {
  const router = useRouter();
  const [data, setData] = useState<HubData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  // Sepuluh query berjalan paralel dan tombol "Muat ulang" dapat ditekan
  // berkali-kali; hanya hasil dari pemuatan terbaru yang boleh diterapkan.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus('loading');
    setErrorMsg('');
    try {
      const [
        open,
        reviewing,
        resolved,
        dismissed,
        low,
        medium,
        high,
        critical,
        unassigned,
        recent,
      ] = await Promise.all([
        fetchReports(1, 0, 'open'),
        fetchReports(1, 0, 'reviewing'),
        fetchReports(1, 0, 'resolved'),
        fetchReports(1, 0, 'dismissed'),
        fetchReports(1, 0, undefined, { severity: 'low' }),
        fetchReports(1, 0, undefined, { severity: 'medium' }),
        fetchReports(1, 0, undefined, { severity: 'high' }),
        fetchReports(1, 0, undefined, { severity: 'critical' }),
        fetchReports(1, 0, 'open', { assigned: 'unassigned' }),
        fetchReports(8, 0),
      ]);
      if (requestId !== requestIdRef.current) return;
      setData({
        statusTotals: {
          open: open.total,
          reviewing: reviewing.total,
          resolved: resolved.total,
          dismissed: dismissed.total,
        },
        unassignedOpen: unassigned.total,
        severityTotals: {
          low: low.total,
          medium: medium.total,
          high: high.total,
          critical: critical.total,
        },
        recent: recent.reports,
      });
      setStatus('ready');
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (await redirectIfSessionExpired((err as { status?: number })?.status ?? 0, router, () => {
          setErrorMsg('Tidak dapat menghubungi server data. Coba lagi.');
          setStatus('error');
        })) return;
      // Refresh berhasil: tampilkan error + tombol coba lagi, bukan spinner
      // tanpa akhir.
      if (requestId !== requestIdRef.current) return;
      if (err instanceof ReportsApiError && err.status === 403) {
        setStatus('forbidden');
        return;
      }
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat pusat moderasi.');
      setStatus('error');
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const reportedUsers = useMemo(() => {
    if (!data) return [];
    const seen = new Map<string, { id: string; name: string; email: string | null }>();
    for (const r of data.recent) {
      if (!r.reportedUserId || seen.has(r.reportedUserId)) continue;
      seen.set(r.reportedUserId, {
        id: r.reportedUserId,
        name: r.reportedUserName,
        email: r.reportedUserEmail,
      });
    }
    return Array.from(seen.values()).slice(0, 6);
  }, [data]);

  const severityRows = useMemo(() => {
    if (!data) return [];
    const rows = [
      { key: 'critical' as const, label: 'Kritis', tone: 'destructive' as const },
      { key: 'high' as const, label: 'Tinggi', tone: 'destructive' as const },
      { key: 'medium' as const, label: 'Sedang', tone: 'warning' as const },
      { key: 'low' as const, label: 'Rendah', tone: 'secondary' as const },
    ];
    const total = rows.reduce((sum, r) => sum + data.severityTotals[r.key], 0);
    return rows.map((r) => ({
      ...r,
      value: data.severityTotals[r.key],
      // Persentase dipakai untuk batang proporsional. Total 0 → 0% (bukan NaN).
      percent: total > 0 ? Math.round((data.severityTotals[r.key] / total) * 100) : 0,
    }));
  }, [data]);

  if (status === 'loading') {
    return (
      <div className={ADMIN_PAGE_WRAPPER}>
        <AdminLoadingState label="Memuat pusat moderasi" />
      </div>
    );
  }

  if (status === 'forbidden') {
    return (
      <div className={ADMIN_PAGE_WRAPPER}>
        <AdminForbiddenState message="Pusat moderasi hanya dapat diakses oleh admin." />
      </div>
    );
  }

  if (status === 'error' || !data) {
    return (
      <div className={ADMIN_PAGE_WRAPPER}>
        <AdminErrorState
          title="Gagal memuat pusat moderasi"
          message={errorMsg || 'Terjadi kesalahan saat mengambil data laporan.'}
          onRetry={load}
        />
      </div>
    );
  }

  return (
    <div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader
        eyebrow="Admin · Moderasi"
        title="Moderasi"
        description="Pantau antrean laporan, sebaran tingkat, dan lompat ke halaman kelola."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={load}>
            <RefreshCw aria-hidden className="h-3.5 w-3.5" />
            Muat ulang
          </Button>
        }
      />

      {/* ====== Antrean status: lima kartu mandiri.
           `flex-wrap` + `flex-1 basis-[13rem]` membuat baris terakhir
           selalu terisi penuh (tidak ada sel kosong menggantung). ====== */}
      <div className="flex flex-wrap gap-3">
        <StatTile
          icon={Flag}
          value={data.statusTotals.open}
          label="Terbuka"
          tone="warning"
          href={`${LAPORAN_HREF}?status=open`}
        />
        <StatTile
          icon={Eye}
          value={data.statusTotals.reviewing}
          label="Sedang ditinjau"
          tone="default"
          href={`${LAPORAN_HREF}?status=reviewing`}
        />
        <StatTile
          icon={CheckCircle2}
          value={data.statusTotals.resolved}
          label="Selesai"
          tone="success"
          href={`${LAPORAN_HREF}?status=resolved`}
        />
        <StatTile
          icon={CircleSlash}
          value={data.statusTotals.dismissed}
          label="Ditolak"
          tone="secondary"
          href={`${LAPORAN_HREF}?status=dismissed`}
        />
        <StatTile
          icon={Inbox}
          value={data.unassignedOpen}
          label="Belum ditugaskan"
          tone="accent"
          href={`${LAPORAN_HREF}?status=open&assigned=unassigned`}
          hint="Laporan terbuka tanpa penanggung jawab"
        />
      </div>

      {/* ====== Sebaran tingkat: kartu dengan batang proporsional.
           Tiap tingkat bisa diklik dan menuju ke daftar laporan yang
           sudah difilter tingkat tersebut. ====== */}
      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-5 py-4">
          <h2 className="font-display text-[15px] font-semibold text-charcoal-900">
            Sebaran tingkat laporan
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href={LAPORAN_HREF}>
              Kelola laporan
              <ArrowRight aria-hidden className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {severityRows.map((row) => (
            <Link
              key={row.key}
              href={`${LAPORAN_HREF}?severity=${row.key}`}
              className="group rounded-[var(--radius)] border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-sage-100/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant={row.tone} className="text-xs">
                  {row.label}
                </Badge>
                <span className="text-sm font-semibold tabular-nums text-charcoal-900">
                  {row.value}
                </span>
              </div>
              <div
                aria-hidden
                className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-sage-100"
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-500',
                    row.key === 'critical' || row.key === 'high'
                      ? 'bg-destructive'
                      : row.key === 'medium'
                        ? 'bg-warning'
                        : 'bg-sage-500'
                  )}
                  style={{ width: `${row.percent}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-sage-500">{row.percent}% dari semua laporan</p>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* ====== Dua kolom: kasus terbaru + pengguna terlapor ====== */}
      <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-5 py-4">
            <h2 className="font-display text-[15px] font-semibold text-charcoal-900">
              Kasus terbaru
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href={LAPORAN_HREF}>
                Lihat semua
                <ArrowRight aria-hidden className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <CardContent className="grid gap-1.5 p-4">
            {data.recent.length === 0 ? (
              <p className="px-1 py-3 text-sm text-sage-500">Belum ada laporan.</p>
            ) : (
              data.recent.map((r) => (
                <Link
                  key={r.id}
                  href={`${LAPORAN_HREF}/${r.id}`}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-sage-100/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-medium text-charcoal-900"
                      title={r.reportedUserName}
                    >
                      {r.reportedUserName}
                    </p>
                    <p className="truncate text-xs text-sage-500">
                      {r.category || 'Tanpa kategori'} · #{r.id.slice(0, 8)}…
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={statusTone(r.status)} className="text-xs">
                      {statusLabel(r.status)}
                    </Badge>
                    <span className="hidden whitespace-nowrap text-xs text-sage-500 sm:block">
                      {waktuLalu(r.createdAt)}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-5 py-4">
            <h2 className="font-display text-[15px] font-semibold text-charcoal-900">
              Pengguna terlapor
            </h2>
          </div>
          <CardContent className="grid gap-1.5 p-4">
            {reportedUsers.length === 0 ? (
              <p className="px-1 py-3 text-sm text-sage-500">
                Belum ada pengguna terlapor pada kasus terbaru.
              </p>
            ) : (
              reportedUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-transparent px-3 py-2 transition-colors hover:border-border hover:bg-sage-100/40"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                    >
                      <UserRound className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-medium text-charcoal-900"
                        title={u.name}
                      >
                        {u.name}
                      </p>
                      {u.email && (
                        <p className="truncate text-xs text-sage-500" title={u.email}>
                          {u.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <Link href={`/dashboard/admin/pengguna/${u.id}`}>Profil</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ====== Akses cepat: baris tautan tile, termasuk kelola
           produk/UMKM/pengguna. `flex-wrap` + `flex-1` memastikan baris
           terakhir tidak meninggalkan sel kosong. ====== */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <p className={`${ADMIN_DETAIL_LABEL} mb-3`}>Akses cepat</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { href: LAPORAN_HREF, icon: Flag, label: 'Laporan' },
                { href: '/dashboard/admin/monitoring/peringatan', icon: TriangleAlert, label: 'Peringatan' },
                { href: '/dashboard/admin/monitoring/sanksi', icon: Gavel, label: 'Sanksi' },
                { href: '/dashboard/admin/monitoring/audit', icon: ClipboardList, label: 'Log Audit' },
                { href: '/dashboard/admin/produk', icon: Package, label: 'Produk' },
                { href: '/dashboard/admin/umkm', icon: Store, label: 'UMKM' },
                { href: '/dashboard/admin/pengguna', icon: Users, label: 'Pengguna' },
              ] as const
            ).map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className="group flex min-w-0 flex-1 basis-[8.5rem] flex-col items-center gap-2 rounded-[var(--radius)] border border-border bg-white px-3 py-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_24px_-16px_rgba(30,43,32,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <span
                  aria-hidden
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-sage-100 text-sage-600 transition-colors group-hover:bg-primary/10 group-hover:text-primary"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-xs font-semibold text-charcoal-900">{label}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-sage-500">
        <ShieldAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Moderasi produk &amp; UMKM dilakukan dari halaman masing-masing di atas.
        </span>
      </p>
    </div>
  );
}
