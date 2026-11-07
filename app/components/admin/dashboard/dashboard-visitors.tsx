'use client';
import { useEffect, useState } from 'react';
import { Eye, UserRound, UserRoundCheck, UsersRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { fetchAdminVisitorStats, type AdminVisitorStats, } from '@/lib/admin-visitors';
import { AdminErrorState, AdminForbiddenState, AdminInlineError } from '../admin-state';
import { AdminFilterChip } from '../admin-controls';
import { DashboardCard } from './primitives';
import { VisitorChart, VisitorChartSelector, dayLabel, type VisitorChartType, } from './visitor-chart';
const RANGE_OPTIONS = [7, 14, 30, 90] as const;
type RangeDays = (typeof RANGE_OPTIONS)[number];
const RANGE_LABEL: Record<RangeDays, string> = {
    7: '7 hari',
    14: '14 hari',
    30: '30 hari',
    90: '90 hari',
};
function VisitorStatCard({ icon: Icon, label, value, supporting, }: {
    icon: LucideIcon;
    label: string;
    value: string;
    supporting: string;
}) {
    return (<DashboardCard className="h-full">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-sage-500">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-charcoal-900">
            {value}
          </p>
          <p className="mt-1.5 text-xs text-sage-500">{supporting}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon aria-hidden className="h-4 w-4"/>
        </span>
      </div>
    </DashboardCard>);
}
function VisitorSkeleton() {
    return (<div role="status" aria-label="Memuat data pengunjung" className="animate-pulse motion-reduce:animate-none">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (<div key={index} className="h-24 rounded-[var(--radius)] bg-sage-100/60"/>))}
      </div>
      <div className="mt-4 h-56 rounded-[var(--radius)] bg-sage-100/60"/>
    </div>);
}
export function DashboardVisitors() {
    const [rangeDays, setRangeDays] = useState<RangeDays>(14);
    const [chartType, setChartType] = useState<VisitorChartType>('bar');
    const [data, setData] = useState<AdminVisitorStats | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [reloadToken, setReloadToken] = useState(0);
    useEffect(() => {
        let cancelled = false;
        setStatus('loading');
        setErrorMsg('');
        (async () => {
            try {
                const result = await fetchAdminVisitorStats(rangeDays);
                if (cancelled)
                    return;
                setData(result);
                setStatus('ready');
            }
            catch (err) {
                if (cancelled)
                    return;
                if ((err as {
                    status?: number;
                })?.status === 403) {
                    setStatus('forbidden');
                    return;
                }
                setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat data pengunjung.');
                setStatus('error');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [rangeDays, reloadToken]);
    if (status === 'loading')
        return <VisitorSkeleton />;
    if (status === 'forbidden') {
        return <AdminForbiddenState message="Data pengunjung hanya untuk admin."/>;
    }
    if (status === 'error' || !data) {
        return (<AdminErrorState title="Gagal memuat data pengunjung" message={errorMsg || 'Terjadi kesalahan saat menghitung pengunjung.'} onRetry={() => setReloadToken((value) => value + 1)}/>);
    }
    if (data.notProvisioned) {
        return (<p className="rounded-[var(--radius)] border border-border bg-white px-4 py-3 text-sm text-sage-500">
        Fitur pengunjung belum aktif di server ini (fungsi rekap belum tersedia). Hubungi
        pengelola teknis untuk menerapkan migrasi terbaru.
      </p>);
    }
    const adaData = data.totalVisitors > 0;
    const points = data.daily.map((point) => ({
        day: point.day,
        label: dayLabel(point.day),
        visitors: point.visitors,
        visits: point.visits,
    }));
    return (<div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-charcoal-900">
            {data.rangeVisitors.toLocaleString('id-ID')} pengunjung unik dalam {data.rangeDays} hari
          </p>
          <p className="mt-0.5 text-xs text-sage-500">
            Satu orang dihitung sekali; kunjungan berulang tidak menambah angka. Kunjungan admin
            tidak dihitung.
          </p>
        </div>
        <div role="group" aria-label="Pilih rentang pengunjung" className="flex flex-wrap items-center gap-1.5">
          {RANGE_OPTIONS.map((days) => (<AdminFilterChip key={days} active={rangeDays === days} onClick={() => setRangeDays(days)}>
              {RANGE_LABEL[days]}
            </AdminFilterChip>))}
        </div>
      </div>

      {errorMsg && (<div className="mt-3">
          <AdminInlineError message={errorMsg}/>
        </div>)}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <VisitorStatCard icon={Eye} label="Hari ini" value={data.today.toLocaleString('id-ID')} supporting={`Kemarin ${data.yesterday.toLocaleString('id-ID')} pengunjung unik`}/>
        <VisitorStatCard icon={UsersRound} label="Total pengunjung unik" value={data.totalVisitors.toLocaleString('id-ID')} supporting={`${data.totalVisits.toLocaleString('id-ID')} kunjungan tercatat`}/>
        <VisitorStatCard icon={UserRound} label="Pengunjung anonim" value={data.anonymousVisitors.toLocaleString('id-ID')} supporting="Belum/tidak pernah login di peramban ini"/>
        <VisitorStatCard icon={UserRoundCheck} label="Pengunjung terdaftar" value={data.registeredVisitors.toLocaleString('id-ID')} supporting="Dikenali lewat akun yang login"/>
      </div>

      <DashboardCard className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-charcoal-900">
              Pengunjung unik {data.rangeDays} hari terakhir
            </p>
            <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-sage-500">
              Angkanya sama di ketiga diagram; yang berubah hanya cara membacanya. Rentang
              mengikuti filter di atas.
            </p>
          </div>
          <VisitorChartSelector value={chartType} onChange={setChartType}/>
        </div>

        {points.length > 0 ? (<VisitorChart points={points} type={chartType} className="mt-4"/>) : (<p className="mt-4 rounded-[var(--radius)] bg-sage-100/30 px-4 py-8 text-center text-sm text-sage-500">
            {adaData
                ? 'Belum ada kunjungan pada rentang ini.'
                : 'Belum ada data kunjungan. Pencatatan mulai berjalan sejak fitur ini aktif; angka akan terisi saat ada pengunjung baru.'}
          </p>)}
      </DashboardCard>
    </div>);
}
