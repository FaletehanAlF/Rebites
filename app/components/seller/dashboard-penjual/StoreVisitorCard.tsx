'use client';
import { useCallback, useEffect, useState } from 'react';
import { Eye, UsersRound } from 'lucide-react';
import { Card } from './Card';
import { Skeleton } from '@/app/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { fetchStoreVisitorStats, type StoreVisitorStats, } from '@/lib/store-visitors';
const RANGE_OPTIONS = [7, 14, 30] as const;
type RangeDays = (typeof RANGE_OPTIONS)[number];
const RANGE_LABEL: Record<RangeDays, string> = {
    7: '7 hari',
    14: '14 hari',
    30: '30 hari',
};
const POLL_MS = 30000;
function dayLabel(day: string): string {
    try {
        const [year, month, d] = day.split('-').map(Number);
        const dt = new Date(year, (month ?? 1) - 1, d ?? 1);
        return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    }
    catch {
        return day;
    }
}
export function StoreVisitorCard() {
    const [rangeDays, setRangeDays] = useState<RangeDays>(14);
    const [data, setData] = useState<StoreVisitorStats | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const load = useCallback(async () => {
        try {
            const result = await fetchStoreVisitorStats(rangeDays);
            setData(result);
            setStatus('ready');
            setLastSync(new Date());
        }
        catch {
            setStatus((prev) => (prev === 'ready' ? prev : 'error'));
        }
    }, [rangeDays]);
    useEffect(() => {
        setStatus('loading');
        void load();
    }, [load]);
    useEffect(() => {
        const intervalId = setInterval(() => void load(), POLL_MS);
        return () => clearInterval(intervalId);
    }, [load]);
    const maxVisitors = Math.max(1, ...((data?.daily ?? []).map((d) => d.visitors)));
    return (<Card>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none"/>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"/>
            </span>
            Pengunjung toko · Langsung
          </p>
          <h3 className="mt-1 font-display text-lg font-medium tracking-tight text-primary">
            {status === 'loading' || !data
            ? 'Memuat…'
            : `${data.today.toLocaleString('id-ID')} pengunjung hari ini`}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {status === 'loading' || !data
            ? 'Menghitung orang yang membuka halaman toko Anda.'
            : status === 'error'
                ? 'Gagal memuat. Coba lagi beberapa saat.'
                : `${data.totalVisitors.toLocaleString('id-ID')} orang berbeda pernah membuka toko Anda.${lastSync ? ` · diperbarui ${lastSync.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
          </p>
        </div>

        <div role="group" aria-label="Pilih rentang pengunjung" className="flex items-center gap-1 rounded-full bg-muted p-1">
          {RANGE_OPTIONS.map((days) => (<button key={days} type="button" onClick={() => setRangeDays(days)} aria-pressed={rangeDays === days} className={cn('rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', rangeDays === days
                ? 'bg-white text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground')}>
              {RANGE_LABEL[days]}
            </button>))}
        </div>
      </div>

      {status === 'loading' && !data ? (<div role="status" aria-label="Memuat pengunjung toko" className="mt-4 space-y-3">
          <Skeleton className="h-16 rounded-2xl"/>
          <Skeleton className="h-32 rounded-2xl"/>
        </div>) : data?.notProvisioned ? (<p className="mt-4 rounded-2xl border border-border bg-white px-4 py-3 text-xs leading-relaxed text-sage-500">
          Pencatatan pengunjung toko belum aktif di server ini (migrasi belum diterapkan).
          Jaringan akan terisi otomatis setelah migrasi berjalan.
        </p>) : data && data.daily.length > 0 ? (<div className="mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-secondary p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <Eye aria-hidden className="h-3.5 w-3.5"/>
                Hari ini
              </p>
              <p className="mt-1 font-display text-xl font-semibold tabular-nums text-primary">
                {data.today.toLocaleString('id-ID')}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Kemarin {data.yesterday.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="rounded-2xl bg-secondary p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <UsersRound aria-hidden className="h-3.5 w-3.5"/>
                {data.rangeDays} hari
              </p>
              <p className="mt-1 font-display text-xl font-semibold tabular-nums text-primary">
                {data.rangeVisitors.toLocaleString('id-ID')}
              </p>
              <p className="text-[11px] text-muted-foreground">orang berbeda</p>
            </div>
          </div>

          <div className="mt-4 flex h-24 items-end gap-1" aria-hidden>
            {data.daily.map((point) => (<div key={point.day} title={`${dayLabel(point.day)}: ${point.visitors} pengunjung`} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {point.visitors > 0 ? point.visitors : ''}
                </span>
                <span className="w-full max-w-[28px] rounded-t-md bg-primary" style={{ height: `${Math.max(4, (point.visitors / maxVisitors) * 56)}px` }}/>
              </div>))}
          </div>
          <div className="mt-1 flex gap-1 text-[10px] text-muted-foreground" aria-hidden>
            {data.daily.map((point) => (<span key={point.day} className="flex-1 text-center">
                {dayLabel(point.day)}
              </span>))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Satu orang dihitung sekali per hari. Kartu ini diperbarui otomatis tiap 30 detik;
            kunjungan admin tidak dihitung.
          </p>
        </div>) : (<p className="mt-4 rounded-2xl border border-dashed border-border bg-secondary/60 px-4 py-6 text-center text-xs leading-relaxed text-muted-foreground">
          Belum ada pengunjung toko pada rentang ini. Bagikan tautan toko Anda; angkanya akan
          terisi saat ada yang membuka halamannya.
        </p>)}
    </Card>);
}
