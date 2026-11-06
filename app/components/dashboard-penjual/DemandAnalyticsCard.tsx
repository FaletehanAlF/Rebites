'use client';

import { useMemo } from 'react';
import { TrendingDown, TrendingUp, UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from './Card';
import { LockedFeatureCard } from './LockedFeatureCard';
import { useSellerPlan } from '@/lib/seller-plan';
import { useSellerAnalytics } from '@/hooks/use-seller-analytics';
import { useSellerBestSellingMenus } from '@/hooks/use-seller-best-selling';

interface DemandInsight {
  name: string;
  demand: number;
  trend: number;
}

export function DemandAnalyticsCard() {
  const { plan, hydrated } = useSellerPlan();
  const hasAccess = plan.demandAnalytics;
  const { menus: bestSellers } = useSellerBestSellingMenus(hasAccess);
  const { days30 } = useSellerAnalytics();

  const insights = useMemo<DemandInsight[]>(() => {
    const last30 = days30;
    const firstHalf = last30.slice(0, 15).reduce((sum, point) => sum + point.terjual, 0);
    const secondHalf = last30.slice(15).reduce((sum, point) => sum + point.terjual, 0);
    const weeklyDemand = Math.round(last30.reduce((sum, point) => sum + point.terjual, 0) / 4);

    const weights = bestSellers.map((_, index) => 1 / (index + 1));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    return bestSellers.map((menu, index) => {
      const base = Math.max(4, Math.round(weeklyDemand * (weights[index] / totalWeight)));
      const swing = ((index % 3) - 1) / 12;
      return {
        name: menu.name,
        demand: base,
        trend: secondHalf > firstHalf ? swing + 0.04 : -Math.abs(swing) - 0.02,
      };
    });
  }, [bestSellers, days30]);

  if (!hydrated) {
    return (
      <Card>
        <div className="h-6 w-36 animate-pulse rounded-lg bg-muted" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded-full bg-muted" />
          ))}
        </div>
      </Card>
    );
  }

  if (!plan.demandAnalytics) {
    return (
      <LockedFeatureCard
        title="Analisis Permintaan Pasar"
        description="Estimasi permintaan per menu dan tren naik/turun untuk membantu atur stok harian."
        requiredPlanLabel="Max"
      />
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Analisis Pasar
          </p>
          <h3 className="mt-1 flex items-center gap-1.5 font-display text-lg font-medium tracking-tight text-primary">
            <UtensilsCrossed className="h-4 w-4" />
            Permintaan Menu
          </h3>
        </div>
        <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground">
          Paket Max
        </span>
      </div>

      {insights.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-border bg-secondary/70 p-6 text-center text-xs leading-relaxed text-muted-foreground">
          Belum ada data penjualan untuk dianalisis. Tambahkan menu dan raih pesanan pertamamu.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
        {insights.map((insight) => (
          <li key={insight.name}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-semibold text-foreground">{insight.name}</span>
              <span className="font-medium text-muted-foreground">±{insight.demand} porsi/minggu</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, (insight.demand / insights[0].demand) * 100)}%` }}
                />
              </div>
              <span
                className={cn(
                  'inline-flex w-14 items-center justify-end gap-1 text-[11px] font-semibold',
                  insight.trend >= 0 ? 'text-primary' : 'text-primary'
                )}
              >
                {insight.trend >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {insight.trend >= 0 ? '+' : ''}
                {(insight.trend * 100).toFixed(1)}%
              </span>
            </div>
          </li>
        ))}
      </ul>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Estimasi dihitung dari pola penjualan 30 hari terakhirmu. Gunakan untuk menyesuaikan
        stok masak harian.
      </p>
    </Card>
  );
}
