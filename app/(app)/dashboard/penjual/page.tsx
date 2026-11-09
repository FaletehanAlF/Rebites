'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Reveal } from '@/app/components/shared/reveal';
import { SellerShell } from '@/app/components/seller/dashboard-penjual/SellerShell';
import { DetailedReportCard, type StatsPeriod } from '@/app/components/seller/dashboard-penjual/DetailedReportCard';
import { DemandAnalyticsCard } from '@/app/components/seller/dashboard-penjual/DemandAnalyticsCard';
import { FeaturedPromoCard } from '@/app/components/seller/dashboard-penjual/FeaturedPromoCard';
import { StoreCard } from '@/app/components/seller/dashboard-penjual/StoreCard';
import { StoreRatingCard } from '@/app/components/seller/dashboard-penjual/StoreRatingCard';
import { useSellerPlan } from '@/lib/seller-plan';

const SalesStatsCard = dynamic(
  () =>
    import('@/app/components/seller/dashboard-penjual/SalesStatsCard').then(
      (m) => m.SalesStatsCard
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
    ),
  }
);

export default function VendorDashboardPage() {
  const [period, setPeriod] = useState<StatsPeriod>('7-hari');
  const { plan } = useSellerPlan();
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      
      const { supabase } = await import('@/lib/supabase');
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      const fullName = (session?.user.user_metadata?.full_name as string) ?? '';
      setFirstName(fullName.split(' ')[0] || '');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SellerShell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="mt-1 font-display text-[clamp(1.8rem,4vw,2.6rem)] font-semibold leading-tight tracking-[-0.02em] text-primary">
                    Halo, <span className="font-normal">{firstName}</span>
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pantau penjualan dan pesanan masuk tokomu 
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Paket aktif: <span className="font-semibold text-foreground">{plan.label}</span>
                  </p>
                  <Link
                    href="/dashboard/penjual/langganan"
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-primary/40 px-3.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary-dark/10"
                  >
                    Kelola Paket Langganan
                  </Link>
                </div>
              </div>
            </motion.div>

            <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
              { }
              <div className="order-1 space-y-5 lg:order-2 lg:col-span-4 lg:space-y-6">
                <Reveal delay={0.05}>
                  <StoreCard />
                </Reveal>
                <Reveal delay={0.1}>
                  <StoreRatingCard />
                </Reveal>
              </div>

              { }
              <div className="order-2 space-y-5 lg:order-1 lg:col-span-8 lg:space-y-6">
                <Reveal delay={0.05}>
                  <SalesStatsCard period={period} onPeriodChange={setPeriod} />
                </Reveal>

                <Reveal delay={0.1}>
                  {/* Rentang laporan dipilih di dalam kartu (termasuk 'Semua'),
                      terpisah dari rentang grafik di kartu statistik. */}
                  <DetailedReportCard />
                </Reveal>

                <Reveal delay={0.15}>
                  <DemandAnalyticsCard />
                </Reveal>

                <Reveal delay={0.2}>
                  <FeaturedPromoCard />
                </Reveal>
              </div>
            </div>
    </SellerShell>
  );
}
