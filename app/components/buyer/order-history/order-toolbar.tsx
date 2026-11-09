'use client';
import { Search } from 'lucide-react';
export type StatusFilter = 'all' | 'ongoing' | 'delivered' | 'cancelled';
export type OrderTab = 'active' | 'completed';
export type FulfillmentFilter = 'all' | 'delivery' | 'pickup';
export function OrderToolbar({ statusFilter, onStatusFilterChange, counts, query, onQueryChange, fulfillment, onFulfillmentChange, }: {
    statusFilter: StatusFilter;
    onStatusFilterChange: (f: StatusFilter) => void;
    counts: {
        all: number;
        ongoing: number;
        delivered: number;
        cancelled: number;
    };
    query: string;
    onQueryChange: (q: string) => void;
    fulfillment: FulfillmentFilter;
    onFulfillmentChange: (f: FulfillmentFilter) => void;
}) {
    const pills: {
        key: StatusFilter;
        label: string;
    }[] = [
        { key: 'all', label: 'Semua' },
        { key: 'ongoing', label: 'Dalam Proses' },
        { key: 'delivered', label: 'Selesai' },
        { key: 'cancelled', label: 'Dibatalkan' },
    ];
    const fulfillmentOptions: {
        key: FulfillmentFilter;
        label: string;
    }[] = [
        { key: 'all', label: 'Semua metode' },
        { key: 'delivery', label: 'Diantar' },
        { key: 'pickup', label: 'Ambil sendiri' },
    ];
    return (<div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative w-full sm:max-w-[320px]">
          <span className="sr-only">Cari pesanan</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden/>
          <input type="search" value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="Cari kode pesanan, produk, atau toko" className="h-10 w-full rounded-full border border-border bg-white pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/25"/>
        </label>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2">
            <span className="sr-only">Filter status pesanan</span>
            <select value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)} className="h-10 w-full rounded-full border border-border bg-white px-4 pr-9 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 sm:w-auto">
              {pills.map((p) => (<option key={p.key} value={p.key}>
                  {p.label} ({counts[p.key]})
                </option>))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="sr-only">Filter metode pengiriman</span>
            <select value={fulfillment} onChange={(e) => onFulfillmentChange(e.target.value as FulfillmentFilter)} className="h-10 w-full rounded-full border border-border bg-white px-4 pr-9 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 sm:w-auto">
              {fulfillmentOptions.map((f) => (<option key={f.key} value={f.key}>
                  {f.label}
                </option>))}
            </select>
          </label>
        </div>
      </div>
    </div>);
}
