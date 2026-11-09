'use client';
import Link from 'next/link';
import { Lock, MoreVertical, ShieldCheck } from 'lucide-react';
import { Card } from './Card';
import { Skeleton } from '@/app/components/ui/skeleton';
import { formatRupiah } from '@/lib/data';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { useSellerPlan } from '@/lib/seller-plan';
import { useSellerBestSellingMenus } from '@/hooks/use-seller-best-selling';
import { useStoreRouteId } from '@/hooks/use-store-route-id';
import { sellerStorePath } from '@/lib/seller-store-path';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/app/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { RefreshCw, List, Download } from 'lucide-react';
import { useState } from 'react';
const MAX_ITEMS = 5;
export function BestSellingMenuRow() {
    const { plan, hydrated } = useSellerPlan();
    const storeId = useStoreRouteId();
    const hasAccess = hydrated && plan.bestSellingMenus;
    const { menus } = useSellerBestSellingMenus(hasAccess);
    const topMenus = menus.slice(0, MAX_ITEMS);
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);
    const handleRefresh = () => {
        setRefreshing(true);
        router.refresh();
        setTimeout(() => setRefreshing(false), 1000);
    };
    const handleExport = () => {
        const csvContent = [
            ['Nama Menu', 'Harga', 'Terjual'],
            ...topMenus.map((menu) => [menu.name, menu.surplusPrice.toString(), menu.terjual.toString()]),
        ]
            .map((row) => row.join(','))
            .join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'menu-terlaris.csv';
        link.click();
    };
    return (<Card>

      <div className="flex items-center justify-between gap-2">

        <h2 className="text-sm font-bold text-foreground">Menu Terlaris</h2>

        {!hydrated ? null : !hasAccess ? (<span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground">

            <Lock className="h-3 w-3"/>

            Premium

          </span>) : (<DropdownMenu>

            <DropdownMenuTrigger asChild>

              <button type="button" aria-label="Menu lainnya" className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">

                <MoreVertical className="h-4 w-4"/>

              </button>

            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-48">

              <DropdownMenuItem onClick={handleRefresh} className="text-xs">

                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}/>

                Refresh Data

              </DropdownMenuItem>

              <DropdownMenuItem asChild className="text-xs">

                <Link href={sellerStorePath(storeId, 'menu')}>

                  <List className="mr-2 h-3.5 w-3.5"/>

                  Lihat Semua Menu

                </Link>

              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={handleExport} className="text-xs">

                <Download className="mr-2 h-3.5 w-3.5"/>

                Export ke CSV

              </DropdownMenuItem>

            </DropdownMenuContent>

          </DropdownMenu>)}

      </div>



      {!hydrated ? (<div className="mt-4 flex flex-wrap items-start gap-x-3 gap-y-4">

          {[0, 1, 2, 3].map((i) => (<div key={i} className="flex flex-col items-center gap-1.5">

              <Skeleton className="h-12 w-12 rounded-2xl"/>

              <Skeleton className="h-3 w-12 rounded-full"/>

            </div>))}

        </div>) : !hasAccess ? (<div className="mt-4 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-secondary/70 p-5 sm:flex-row sm:items-center">

          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">

            <Lock className="h-4 w-4"/>

          </span>

          <div className="min-w-0 flex-1">

            <p className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground">

              Fitur Premium

            </p>

            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">

              Lihat menu paling laris di tokomu untuk mengatur stok lebih tepat.

              Tersedia setelah upgrade ke paket berbayar.

            </p>

          </div>

          <Link href={sellerStorePath(storeId, 'langganan')} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-primary-dark">

            <ShieldCheck className="h-3.5 w-3.5"/>

            Upgrade Sekarang

          </Link>

        </div>) : topMenus.length === 0 ? (<p className="mt-4 rounded-2xl border border-dashed border-border bg-secondary/70 p-6 text-center text-xs leading-relaxed text-muted-foreground">

          Belum ada menu untuk diperingkat. Tambahkan menu di halaman Menu Saya.

        </p>) : (<div className="mt-4 flex flex-wrap items-start gap-x-3 gap-y-4">

          {topMenus.map((menu) => (<div key={menu.menuId} className="group relative flex flex-col items-center gap-1.5" aria-label={`${menu.name} · ${menu.terjual} terjual`}>

              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-primary-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100">

                {menu.name} · {menu.terjual} terjual

              </span>

              <span className="relative block h-12 w-12 overflow-hidden rounded-2xl ring-2 ring-border transition-transform duration-150 group-hover:scale-105">

                <SmartImage src={menu.image} alt={`Foto ${menu.name}`}/>

              </span>

              <span className="max-w-[64px] truncate text-[10px] font-semibold text-foreground">

                {formatRupiah(menu.surplusPrice)}

              </span>

            </div>))}

        </div>)}

    </Card>);
}
