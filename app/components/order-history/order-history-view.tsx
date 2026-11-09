'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PackageSearch, SearchX, TriangleAlert, RefreshCw } from 'lucide-react';
import type { StoredOrder } from '@/lib/types';
import { getReviewFor } from '@/lib/review-storage';
import { useCurrentUser } from '@/lib/current-user';
import { useOrders } from '@/hooks/use-orders';
import { OrderToolbar, type StatusFilter, type FulfillmentFilter } from './order-toolbar';
import { OrderCard } from './order-card';
import { Skeleton } from '@/app/components/ui/skeleton';
const EMPTY_LIST: StoredOrder[] = [];
export function OrderHistoryView() {
    const { orders, activeOrders, completedOrders, cancelledOrders, loading, error, refetch, } = useOrders();
    const { userId } = useCurrentUser();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [query, setQuery] = useState('');
    const [fulfillment, setFulfillment] = useState<FulfillmentFilter>('all');
    const [highlightOrderId, setHighlightOrderId] = useState<string | null>(null);
    useEffect(() => {
        const param = searchParams.get('orderId');
        if (param)
            setHighlightOrderId(param);
    }, [searchParams]);
    useEffect(() => {
        if (!highlightOrderId)
            return;
        router.replace(`/riwayatPesanan/${encodeURIComponent(highlightOrderId)}`);
    }, [highlightOrderId, router]);
    const [reviewsTick, setReviewsTick] = useState(0);
    const [reviewedMap, setReviewedMap] = useState<Set<string>>(new Set());
    const reviewKey = useMemo(() => completedOrders.map((order) => order.orderId).join('|'), [completedOrders]);
    useEffect(() => {
        let mounted = true;
        if (!userId) {
            setReviewedMap(new Set());
            return;
        }
        const orderIds = reviewKey ? reviewKey.split('|') : [];
        (async () => {
            const map = new Set<string>();
            for (const orderId of orderIds) {
                const review = await getReviewFor(orderId, userId);
                if (review)
                    map.add(orderId);
            }
            if (mounted)
                setReviewedMap(map);
        })();
        return () => {
            mounted = false;
        };
    }, [reviewKey, reviewsTick, userId]);
    const baseList = useMemo<StoredOrder[]>(() => {
        if (statusFilter === 'ongoing')
            return activeOrders;
        if (statusFilter === 'delivered')
            return completedOrders;
        if (statusFilter === 'cancelled')
            return cancelledOrders;
        return orders;
    }, [statusFilter, activeOrders, completedOrders, cancelledOrders, orders]);
    const filteredList = useMemo(() => {
        const q = query.trim().toLowerCase();
        return baseList.filter((order) => {
            if (fulfillment !== 'all' && order.fulfillment !== fulfillment)
                return false;
            if (q) {
                const haystacks = [
                    order.orderId,
                    order.productName,
                    order.vendorName,
                    order.addressSnapshot?.receiverName ?? '',
                ];
                if (!haystacks.some((h) => h.toLowerCase().includes(q)))
                    return false;
            }
            return true;
        });
    }, [baseList, fulfillment, query]);
    const counts = {
        all: orders.length,
        ongoing: activeOrders.length,
        delivered: completedOrders.length,
        cancelled: cancelledOrders.length,
    };
    const clearFilters = () => {
        setQuery('');
        setFulfillment('all');
        setStatusFilter('all');
    };
    if (loading) {
        return (<div role="status" aria-label="Memuat pesanan" className="w-full space-y-4">

        <Skeleton className="h-[104px] rounded-2xl"/>

        {[0, 1, 2].map((i) => (<Skeleton key={i} className="h-[152px] rounded-2xl"/>))}

      </div>);
    }
    if (error) {
        return (<div role="alert" className="flex flex-col items-center rounded-2xl border border-caramel/30 bg-caramel/[0.07] px-6 py-10 text-center">

        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-caramel-700">

          <TriangleAlert className="h-5 w-5" aria-hidden/>

        </span>

        <h2 className="mt-3 font-display text-base font-semibold text-charcoal-900">

          Pesanan gagal dimuat

        </h2>

        <p className="mt-1 max-w-sm text-sm leading-relaxed text-charcoal-700">

          Data pesananmu tidak bisa diambil saat ini. Ini bukan berarti kamu belum punya

          pesanan — periksa koneksi lalu coba lagi.

        </p>

        <button type="button" onClick={() => refetch()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-caramel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">

          <RefreshCw className="h-4 w-4" aria-hidden/>

          Coba lagi

        </button>

      </div>);
    }
    const isFiltering = query.trim() !== '' || fulfillment !== 'all' || statusFilter !== 'all';
    return (<>

      <div className="w-full space-y-4">

        <div className="rounded-2xl border border-hairline bg-white p-3 shadow-sm sm:p-4">

          <OrderToolbar statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} counts={counts} query={query} onQueryChange={setQuery} fulfillment={fulfillment} onFulfillmentChange={setFulfillment}/>

        </div>



        {filteredList.length > 0 ? (<div className="space-y-3">

            {filteredList.map((order) => (<OrderCard key={order.orderId} order={order} reviewed={reviewedMap.has(order.orderId)} onViewDetail={(o) => router.push(`/riwayatPesanan/${encodeURIComponent(o.orderId)}`)} onTrack={(o) => router.push(`/riwayatPesanan/${encodeURIComponent(o.orderId)}#pengantaran`)} highlighted={order.orderId === highlightOrderId}/>))}

          </div>) : (<EmptyState variant={isFiltering ? 'no-result' : 'empty'} statusFilter={statusFilter} onClear={clearFilters}/>)}

      </div>

    </>);
}
function EmptyState({ variant, statusFilter, onClear, }: {
    variant: 'empty' | 'no-result';
    statusFilter: StatusFilter;
    onClear: () => void;
}) {
    if (variant === 'no-result') {
        return (<div className="flex flex-col items-center rounded-2xl border border-dashed border-hairline bg-white px-6 py-10 text-center">

        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-100 text-primary">

          <SearchX className="h-5 w-5" aria-hidden/>

        </span>

        <h2 className="mt-3 font-display text-base font-semibold text-charcoal-900">

          Tidak ada pesanan yang cocok

        </h2>

        <p className="mt-1 max-w-sm text-sm text-charcoal-500">

          {statusFilter === 'cancelled'
                ? 'Belum ada pesanan dibatalkan pada filter ini.'
                : 'Coba kata kunci lain atau hapus filter yang sedang aktif.'}

        </p>

        <button type="button" onClick={onClear} className="mt-4 inline-flex h-10 items-center rounded-full border border-hairline px-5 text-sm font-semibold text-charcoal-900 transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">

          Hapus filter

        </button>

      </div>);
    }
    return (<div className="flex flex-col items-center rounded-2xl border border-dashed border-hairline bg-white px-6 py-12 text-center">

      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-100 text-primary">

        <PackageSearch className="h-5 w-5" aria-hidden/>

      </span>

      <h2 className="mt-3 font-display text-base font-semibold text-charcoal-900">

        Belum ada pesanan

      </h2>

      <p className="mt-1 max-w-sm text-sm leading-relaxed text-charcoal-500">

        Pesanan yang kamu buat akan muncul di sini lengkap dengan status dan detail

        pengantarannya.

      </p>

      <Link href="/home" className="mt-4 inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-caramel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">

        Mulai belanja

      </Link>

    </div>);
}
