'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion, MotionConfig } from 'framer-motion';
import { Crown } from 'lucide-react';
import { Reveal } from '@/app/components/shared/reveal';
import { Sidebar } from '@/app/components/seller/dashboard-penjual/Sidebar';
import { Topbar } from '@/app/components/seller/dashboard-penjual/Topbar';
import { MobileSellerNav } from '@/app/components/seller/dashboard-penjual/MobileSellerNav';
import { DetailedReportCard, type StatsPeriod } from '@/app/components/seller/dashboard-penjual/DetailedReportCard';
import { DemandAnalyticsCard } from '@/app/components/seller/dashboard-penjual/DemandAnalyticsCard';
import { FeaturedPromoCard } from '@/app/components/seller/dashboard-penjual/FeaturedPromoCard';
import { StoreCard } from '@/app/components/seller/dashboard-penjual/StoreCard';
import { StoreRatingCard } from '@/app/components/seller/dashboard-penjual/StoreRatingCard';
import { useSellerPlan } from '@/lib/seller-plan';
import { useRequireSeller } from '@/hooks/seller/use-require-seller';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [period, setPeriod] = useState<StatsPeriod>('7-hari');
  const { plan } = useSellerPlan();
  const { loading } = useRequireSeller();
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen bg-secondary font-sans text-foreground">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="relative z-10 lg:pl-[280px]">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />

          <main className="mx-auto max-w-[1400px] px-4 pb-20 pt-6 sm:px-6 lg:px-10">
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
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground">
                    <Crown className="h-3.5 w-3.5 text-primary" />
                    Paket Aktif · {plan.label}
                  </span>
                  { }
                  <Link
                    href="/dashboard/penjual/langganan"
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary px-3.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary-dark/10"
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
                  <DetailedReportCard period={period} />
                </Reveal>

                <Reveal delay={0.15}>
                  <DemandAnalyticsCard />
                </Reveal>

                <Reveal delay={0.2}>
                  <FeaturedPromoCard />
                </Reveal>
              </div>
            </div>
          </main>
        </div>

        <MobileSellerNav />
      </div>
    </MotionConfig>
  );
}
