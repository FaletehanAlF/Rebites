'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Card } from './Card';
import { FilterDropdown } from './FilterDropdown';
import { LockedFeatureCard } from './LockedFeatureCard';
import { SalesEmptyState } from './SalesEmptyState';
import { useCountUp } from './useCountUp';
import { formatRupiah } from '@/lib/data';
import { useSellerPlan } from '@/lib/seller-plan';
import { useSellerOrders } from '@/hooks/use-seller-orders';
import { useSellerAnalytics } from '@/hooks/use-seller-analytics';

const SEGMENT_COLORS = ['hsl(var(--primary))', 'hsl(var(--primary))', 'hsl(var(--primary))', 'hsl(var(--muted-foreground))', 'hsl(var(--border))', 'hsl(var(--primary) / 0.3)'];

function useLockedMonths(monthOptions: { value: string; label: string }[]): string[] {
  const { plan } = useSellerPlan();

  return useMemo(() => {
    if (plan.historyDays === null) return [];

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 1);
    cutoff.setDate(0);
    const limitMs = Date.now() - plan.historyDays * 24 * 60 * 60 * 1000;

    return monthOptions
      .filter((option) => {

        const [year, month] = option.value.split('-').map(Number);
        const monthStart = new Date(year, month - 1, 1).getTime();
        const isCurrentMonth =
          new Date().getFullYear() === year && new Date().getMonth() === month - 1;
        return !isCurrentMonth && monthStart < limitMs;
      })
      .map((option) => option.value);
  }, [plan.historyDays, monthOptions]);
}

export function TopCategoryCard() {
  const { plan, hydrated } = useSellerPlan();
  const { hasOrders } = useSellerOrders();
  const { months: topCategoriesByMonth, monthOptions } = useSellerAnalytics();
  const lockedMonths = useLockedMonths(monthOptions);
  const firstOpenMonth =
    monthOptions.find((option) => !lockedMonths.includes(option.value))?.value ??
    monthOptions[0]?.value ??
    '';
  const activeMonthData = topCategoriesByMonth[firstOpenMonth] ?? {
    label: '',
    total: 0,
    categories: [],
  };

  const [month, setMonth] = useState(firstOpenMonth);
  useEffect(() => {
    if (firstOpenMonth && !month) setMonth(firstOpenMonth);
  }, [firstOpenMonth, month]);
  const activeMonth = lockedMonths.includes(month) ? firstOpenMonth : month;
  const data = topCategoriesByMonth[activeMonth] ?? activeMonthData;
  const isLocked = lockedMonths.includes(month);
  const { ref, value } = useCountUp(data.total);

  if (!hydrated) {
    return (
      <Card>
        <div className="h-9 w-44 animate-pulse rounded-lg bg-muted" />
        <div className="mt-5 h-3 w-full animate-pulse rounded-full bg-muted" />
        <div className="mt-4 space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded-full bg-muted" />
          ))}
        </div>
      </Card>
    );
  }

  if (!plan.categoryPerformance) {
    return (
      <LockedFeatureCard
        title="Kategori Terlaris"
        description="Lihat rincian penjualan per kategori untuk menemukan menu andalan tokomu. Fitur ini terbuka setelah upgrade ke paket berbayar."
        requiredPlanLabel="Standar"
        ctaLabel="Upgrade Sekarang"
        ctaHref="/dashboard/penjual/langganan"
      />
    );
  }

  if (!hasOrders) {
    return (
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-display text-[28px] font-medium leading-none tracking-tight text-primary">
              Rp0
            </p>
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Kategori Terlaris
            </p>
          </div>
        </div>
        <div className="mt-4">
          <SalesEmptyState
            title="Belum ada data kategori"
            description="Rincian penjualan per kategori akan muncul otomatis setelah ada pesanan yang masuk ke tokomu."
          />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-[28px] font-medium leading-none tracking-tight text-primary">
            <span ref={ref}>{formatRupiah(value)}</span>
          </p>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Kategori Terlaris
          </p>
        </div>
        <FilterDropdown
          value={month}
          onChange={setMonth}
          options={monthOptions}
          ariaLabel="Pilih bulan untuk kategori terlaris"
        />
      </div>

      {isLocked ? (
        <div className="mt-5 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-secondary/70 p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Lock className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">
              Riwayat di luar 30 hari terkunci
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Paket {plan.label} menyimpan riwayat penjualan {plan.historyDays} hari.
              Upgrade ke ReBites Standar untuk riwayat tanpa batas.
            </p>
          </div>
          <Link
            href="/langganan/pembayaran?plan=standar&billing=monthly"
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-primary-dark"
          >
            Upgrade ke ReBites Standar
          </Link>
        </div>
      ) : (
        <>
          <div
            className="mt-5 flex h-3 w-full overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label="Persentase penjualan per kategori"
          >
            {data.categories.map((category, index) => (
              <div
                key={category.category}
                className="h-full"
                style={{
                  width: `${category.percent}%`,
                  backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
                }}
              />
            ))}
          </div>

          <ul className="mt-4 space-y-2">
            {data.categories.map((category, index) => (
              <li key={category.category} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
                  />
                  {category.category}
                </span>
                <span className="font-semibold text-foreground">{category.percent}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
