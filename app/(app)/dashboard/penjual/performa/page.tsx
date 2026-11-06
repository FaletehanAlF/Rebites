'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Crown, TrendingUp } from 'lucide-react';
import { SellerShell } from '@/app/components/dashboard-penjual/SellerShell';
import { TopCategoryCard } from '@/app/components/dashboard-penjual/TopCategoryCard';
import { BestSellingMenuRow } from '@/app/components/dashboard-penjual/BestSellingMenuRow';
import { StoreRatingCard } from '@/app/components/dashboard-penjual/StoreRatingCard';

const SalesActivityChartCard = dynamic(
  () =>
    import('@/app/components/dashboard-penjual/SalesActivityChartCard').then(
      (m) => m.SalesActivityChartCard
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[340px] animate-pulse rounded-3xl border border-border/60 bg-muted/40" />
    ),
  }
);

export default function PerformaTokoPage() {
  return (
    <SellerShell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mt-1 font-display text-[clamp(1.8rem,4vw,2.6rem)] font-medium leading-tight tracking-[-0.02em] text-primary">
              Performa Toko
            </h1>
          </div>

          <Link
            href="/dashboard/penjual/langganan"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary-dark/10"
          >
            <Crown className="h-3.5 w-3.5 text-primary" />
            Kelola Paket Langganan
          </Link>
        </div>
      </motion.div>

      <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="space-y-5 lg:col-span-8 lg:space-y-6">
          <SalesActivityChartCard />
          <TopCategoryCard />
        </div>

        <div className="space-y-5 lg:col-span-4 lg:space-y-6">
          <StoreRatingCard />
          <BestSellingMenuRow />
        </div>
      </div>
    </SellerShell>
  );
}
