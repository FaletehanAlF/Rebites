'use client';

import { useMemo } from 'react';
import { FileText } from 'lucide-react';
import { Card } from './Card';
import { LockedFeatureCard } from './LockedFeatureCard';
import { SalesEmptyState, CardLinesSkeleton } from './SalesEmptyState';
import { useSellerPlan } from '@/lib/seller-plan';
import { useSellerOrders } from '@/hooks/use-seller-orders';
import { useSellerAnalytics } from '@/hooks/use-seller-analytics';
import { formatRupiah } from '@/lib/data';

export type StatsPeriod = '7-hari' | '14-hari' | '30-hari';

interface ReportRow {
  day: string;
  terjual: number;
  tersisa: number;
  revenue: number;
}

export function DetailedReportCard({ period }: { period: StatsPeriod }) {
  const { plan, hydrated } = useSellerPlan();
  const { hasOrders } = useSellerOrders();
  const { days30 } = useSellerAnalytics();

  const rows = useMemo<ReportRow[]>(() => {
    const count = period === '7-hari' ? 7 : period === '14-hari' ? 14 : 30;
    return [...days30.slice(-count)]
      .map((point) => ({
        day: point.day,
        terjual: point.terjual,
        tersisa: point.tersisa,
        revenue: point.revenue,
      }))
      .reverse();
  }, [period, days30]);

  if (!hydrated) {
    return (
      <Card>
        <div className="h-6 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="mt-4">
          <CardLinesSkeleton />
        </div>
      </Card>
    );
  }

  if (!plan.detailedReport) {
    return (
      <LockedFeatureCard
        title="Laporan Rinci Penjualan"
        description="Laporan harian per porsi beserta estimasi pendapatan per hari."
        requiredPlanLabel="Standar"
      />
    );
  }

  if (!hasOrders) {
    return (
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Laporan Rinci · {period.replace('-', ' ')}
            </p>
            <h3 className="mt-1 flex items-center gap-1.5 font-display text-lg font-medium tracking-tight text-primary">
              <FileText className="h-4 w-4" />
              Penjualan Harian
            </h3>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground">
            Paket {plan.label}
          </span>
        </div>
        <div className="mt-4">
          <SalesEmptyState
            title="Laporan belum tersedia"
            description="Rincian penjualan harian akan terisi otomatis setelah ada pesanan yang masuk ke tokomu."
          />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Laporan Rinci · {period.replace('-', ' ')}
          </p>
          <h3 className="mt-1 flex items-center gap-1.5 font-display text-lg font-medium tracking-tight text-primary">
            <FileText className="h-4 w-4" />
            Penjualan Harian
          </h3>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground">
          Paket {plan.label}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[420px] text-left text-xs">
          <thead className="bg-secondary text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5">Hari</th>
              <th scope="col" className="px-4 py-2.5 text-right">Terjual</th>
              <th scope="col" className="px-4 py-2.5 text-right">Tersisa</th>
              <th scope="col" className="px-4 py-2.5 text-right">Pendapatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-100">
            {rows.map((row) => (
              <tr key={`${period}-${row.day}`} className="text-foreground">
                <th scope="row" className="px-4 py-2.5 font-semibold">{row.day}</th>
                <td className="px-4 py-2.5 text-right tabular-nums">{row.terjual}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{row.tersisa}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                  {formatRupiah(row.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
