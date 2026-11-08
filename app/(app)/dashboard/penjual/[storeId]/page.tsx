'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Crown } from 'lucide-react';
import { Reveal } from '@/app/components/shared/reveal';
import { SellerShell } from '@/app/components/seller/dashboard-penjual/SellerShell';
import { Skeleton } from '@/app/components/ui/skeleton';
import { DetailedReportCard, type StatsPeriod } from '@/app/components/seller/dashboard-penjual/DetailedReportCard';
import { StoreCard } from '@/app/components/seller/dashboard-penjual/StoreCard';
import { StoreRatingCard } from '@/app/components/seller/dashboard-penjual/StoreRatingCard';
import { useSellerPlan } from '@/lib/seller-plan';
import { useStoreRouteId } from '@/hooks/use-store-route-id';
import { sellerStorePath } from '@/lib/seller-store-path';
const SalesStatsCard = dynamic(() => import('@/app/components/seller/dashboard-penjual/SalesStatsCard').then((m) => m.SalesStatsCard), {
    ssr: false,
    loading: () => <Skeleton className="h-[300px] rounded-3xl"/>,
});
const StoreVisitorCard = dynamic(() => import('@/app/components/seller/dashboard-penjual/StoreVisitorCard').then((m) => m.StoreVisitorCard), {
    ssr: false,
    loading: () => <Skeleton className="h-[240px] rounded-3xl"/>,
});
export default function VendorDashboardPage() {
    const [period, setPeriod] = useState<StatsPeriod>('7-hari');
    const { plan } = useSellerPlan();
    const [firstName, setFirstName] = useState('');
    const storeId = useStoreRouteId();
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { supabase } = await import('@/lib/supabase');
            const { data: { session }, } = await supabase.auth.getSession();
            if (cancelled)
                return;
            const fullName = (session?.user.user_metadata?.full_name as string) ?? '';
            setFirstName(fullName.split(' ')[0] || '');
        })();
        return () => {
            cancelled = true;
        };
    }, []);
    return (<SellerShell>
      
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-[-0.01em] text-primary">
            Halo,{' '}
            <span className="font-extralight italic">{firstName || 'Penjual'}</span>
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Pantau penjualan dan pesanan masuk tokomu.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground">
            <Crown className="h-3.5 w-3.5 text-primary" aria-hidden/>
            Paket Aktif · {plan.label}
          </span>
          <Link href={sellerStorePath(storeId, 'langganan')} className="inline-flex items-center gap-1.5 rounded-full border border-primary px-3.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            Kelola Paket Langganan
          </Link>
        </div>
      </header>

      <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-12">
        
        <div className="order-1 space-y-6 lg:order-2 lg:col-span-4">
          <Reveal delay={0.05}>
            <StoreCard />
          </Reveal>
          <Reveal delay={0.1}>
            <StoreRatingCard />
          </Reveal>
        </div>

        
        <div className="order-2 space-y-6 lg:order-1 lg:col-span-8">
          <Reveal delay={0.05}>
            <SalesStatsCard period={period} onPeriodChange={setPeriod}/>
          </Reveal>

          <Reveal delay={0.1}>
            <StoreVisitorCard />
          </Reveal>

          <Reveal delay={0.1}>
            
            <DetailedReportCard />
          </Reveal>
        </div>
      </div>
    </SellerShell>);
}
