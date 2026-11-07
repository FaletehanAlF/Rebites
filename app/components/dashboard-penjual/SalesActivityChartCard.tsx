'use client';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from 'recharts';
import { BarChart2, LineChart as LineChartIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from './Card';
import { FilterDropdown } from './FilterDropdown';
import { useCountUp } from './useCountUp';
import { SalesEmptyState, CardLinesSkeleton } from './SalesEmptyState';
import { useSellerOrders } from '@/hooks/use-seller-orders';
import { PartnerScoreGauge } from './PartnerScoreGauge';
import { formatRupiah } from '@/lib/data';
type Period = '7-hari' | '14-hari' | '30-hari';
type ChartKind = 'bar' | 'line';
const PERIOD_OPTIONS = [
    { value: '7-hari', label: '7 Hari' },
    { value: '14-hari', label: '14 Hari' },
    { value: '30-hari', label: '30 Hari' },
] as const;
interface DailyPoint {
    day: string;
    terjual: number;
    revenue: number;
}
interface TooltipPayload {
    payload?: DailyPoint;
}
function SalesTooltip({ active, payload, }: {
    active?: boolean;
    payload?: readonly TooltipPayload[];
}) {
    if (!active || !payload || payload.length === 0)
        return null;
    const point = payload[0]?.payload;
    if (!point)
        return null;
    return (<div className="rounded-xl border border-border bg-white/95 px-3.5 py-2.5 text-xs shadow-lg backdrop-blur">
      <p className="font-semibold text-foreground">{point.day}</p>
      <div className="mt-1.5 flex items-center gap-1.5 text-foreground">
        <span className="h-2 w-2 rounded-full bg-primary"/>
        Terjual
        <span className="ml-auto pl-3 font-semibold">{point.terjual} porsi</span>
      </div>
      <p className="mt-2 border-t border-border pt-1.5 font-medium text-primary">
        Pendapatan hari itu {formatRupiah(point.revenue)}
      </p>
    </div>);
}
export function SalesActivityChartCard() {
    const [period, setPeriod] = useState<Period>('7-hari');
    const [kind, setKind] = useState<ChartKind>('bar');
    const { orders, hasOrders, hydrated } = useSellerOrders();
    const data = useMemo<DailyPoint[]>(() => {
        if (!hasOrders)
            return [];
        const days = period === '7-hari' ? 7 : period === '14-hari' ? 14 : 30;
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - (days - 1));
        const buckets = new Map<string, DailyPoint>();
        for (let i = 0; i < days; i += 1) {
            const day = new Date(start);
            day.setDate(start.getDate() + i);
            buckets.set(day.toDateString(), {
                day: day.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
                terjual: 0,
                revenue: 0,
            });
        }
        for (const order of orders) {
            const bucket = buckets.get(new Date(order.createdAt).toDateString());
            if (!bucket)
                continue;
            bucket.terjual += order.quantity ?? 0;
            bucket.revenue += order.total ?? 0;
        }
        return Array.from(buckets.values());
    }, [orders, hasOrders, period]);
    const totalTerjual = useMemo(() => data.reduce((sum, point) => sum + point.terjual, 0), [data]);
    const periodLabel = PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? '';
    const { ref, value } = useCountUp(totalTerjual);
    return (<Card>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span ref={ref} className="font-display text-[42px] font-medium leading-none tracking-tight text-primary">
              {value}
            </span>
            <span className="text-sm font-medium text-foreground">
              porsi terjual · {periodLabel}
            </span>
          </div>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Statistik penjualan
          </p>
        </div>

        {hasOrders && (<div className="flex items-center gap-2">
            <FilterDropdown value={period} onChange={(next) => setPeriod(next as Period)} options={PERIOD_OPTIONS} ariaLabel="Pilih rentang waktu penjualan"/>
            <div role="group" aria-label="Tipe grafik" className="flex rounded-full bg-muted p-1">
              <button type="button" aria-label="Tampilkan grafik batang" onClick={() => setKind('bar')} className={cn('flex h-7 w-7 items-center justify-center rounded-full transition-colors', kind === 'bar'
                ? 'bg-white text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground')}>
                <BarChart2 className="h-4 w-4"/>
              </button>
              <button type="button" aria-label="Tampilkan grafik garis" onClick={() => setKind('line')} className={cn('flex h-7 w-7 items-center justify-center rounded-full transition-colors', kind === 'line'
                ? 'bg-white text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground')}>
                <LineChartIcon className="h-4 w-4"/>
              </button>
            </div>
          </div>)}
      </div>

      {!hydrated ? (<div className="mt-4">
          <CardLinesSkeleton />
        </div>) : !hasOrders ? (<div className="mt-4">
          <SalesEmptyState title="Belum ada aktivitas penjualan" description="Grafik penjualan harian akan muncul otomatis begitu pesanan pertama masuk ke tokomu."/>
        </div>) : (<div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_232px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-4 text-xs font-medium text-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary"/>
                  Terjual
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Periode {periodLabel}</p>
            </div>

            <div className="mt-4 h-[230px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {kind === 'bar' ? (<BarChart data={data} margin={{ top: 6, right: 4, left: -14, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3"/>
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} dy={6}/>
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}/>
                    <Tooltip cursor={{ fill: 'hsl(var(--border))', opacity: 0.4 }} content={<SalesTooltip />}/>
                    <Bar dataKey="terjual" name="Terjual" fill="hsl(var(--primary))" radius={[6, 6, 2, 2]} maxBarSize={22} animationDuration={700}/>
                  </BarChart>) : (<LineChart data={data} margin={{ top: 6, right: 4, left: -14, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3"/>
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} dy={6}/>
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}/>
                    <Tooltip cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '3 3' }} content={<SalesTooltip />}/>
                    <Line type="monotone" dataKey="terjual" name="Terjual" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }} activeDot={{ r: 5 }} animationDuration={700}/>
                  </LineChart>)}
              </ResponsiveContainer>
            </div>

            <p className="sr-only">
              Statistik penjualan {periodLabel}: {totalTerjual} porsi terjual.
            </p>
          </div>

          <div className="lg:border-l lg:border-border lg:pl-6">
            <PartnerScoreGauge />
          </div>
        </div>)}
    </Card>);
}
