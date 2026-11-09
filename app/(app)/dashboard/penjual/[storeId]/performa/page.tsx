'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Crown, TrendingUp } from 'lucide-react';
import { SellerShell } from '@/app/components/dashboard-penjual/SellerShell';
import { Skeleton } from '@/app/components/ui/skeleton';
import { TopCategoryCard } from '@/app/components/dashboard-penjual/TopCategoryCard';
import { BestSellingMenuRow } from '@/app/components/dashboard-penjual/BestSellingMenuRow';
import { StoreRatingCard } from '@/app/components/dashboard-penjual/StoreRatingCard';
import { useStoreRouteId } from '@/hooks/use-store-route-id';
import { sellerStorePath } from '@/lib/seller-store-path';
const SalesActivityChartCard = dynamic(() => import('@/app/components/dashboard-penjual/SalesActivityChartCard').then((m) => m.SalesActivityChartCard), {
    ssr: false,
    loading: () => <Skeleton className="h-[340px] rounded-3xl"/>,
});
export default function PerformaTokoPage() {
    const storeId = useStoreRouteId();
    return (<SellerShell>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>

        <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">

          <div className="min-w-0">

            <h1 className="font-display text-2xl font-semibold leading-tight tracking-[-0.01em] text-primary">

              Performa Toko

            </h1>

            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">

              Lihat tren penjualan, kategori terlaris, dan penilaian toko dalam satu tempat.

            </p>

          </div>



          <Link href={sellerStorePath(storeId, 'langganan')} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">

            <Crown className="h-3.5 w-3.5" aria-hidden/>

            Kelola Paket Langganan

          </Link>

        </header>



        <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-12">

          <div className="space-y-6 lg:col-span-8">

            <SalesActivityChartCard />

            <TopCategoryCard />

          </div>



          <div className="space-y-6 lg:col-span-4">

            <StoreRatingCard />

            <BestSellingMenuRow />

          </div>

        </div>

      </motion.div>

    </SellerShell>);
}
