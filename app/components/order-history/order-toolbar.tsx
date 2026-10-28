'use client';

import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatusFilter = 'all' | 'ongoing' | 'delivered' | 'cancelled';
export type OrderTab = 'active' | 'completed';
export type FulfillmentFilter = 'all' | 'delivery' | 'pickup';

/**
 * Toolbar daftar pesanan.
 *
 * Setiap filter di sini benar-benar menyaring data (lihat order-history-view):
 * - `all`       = semua pesanan
 * - `ongoing`   = belum terminal (bukan completed/cancelled/refunded)
 * - `delivered` = selesai
 * - `cancelled` = dibatalkan/refunded
 * Tombol tanpa isi (mis. Dibatalkan yang selalu 0) tidak boleh ditampilkan
 * sebagai janji yang tidak pernah terpenuhi.
 */
export function OrderToolbar({
  statusFilter,
  onStatusFilterChange,
  counts,
  query,
  onQueryChange,
  fulfillment,
  onFulfillmentChange,
}: {
  statusFilter: StatusFilter;
  onStatusFilterChange: (f: StatusFilter) => void;
  counts: { all: number; ongoing: number; delivered: number; cancelled: number };
  query: string;
  onQueryChange: (q: string) => void;
  fulfillment: FulfillmentFilter;
  onFulfillmentChange: (f: FulfillmentFilter) => void;
}) {
  const pills: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'ongoing', label: 'Dalam Proses' },
    { key: 'delivered', label: 'Selesai' },
    { key: 'cancelled', label: 'Dibatalkan' },
  ];

  const fulfillmentOptions: { key: FulfillmentFilter; label: string }[] = [
    { key: 'all', label: 'Semua metode' },
    { key: 'delivery', label: 'Diantar' },
    { key: 'pickup', label: 'Ambil sendiri' },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Filter status: bisa digulir horizontal di layar sempit, tanpa memotong label. */}
      <div
        role="tablist"
        aria-label="Filter status pesanan"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pills.map((p) => {
          const active = statusFilter === p.key;
          const count = counts[p.key];
          return (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onStatusFilterChange(p.key)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                active
                  ? 'border-primary bg-primary text-white'
                  : 'border-hairline bg-white text-charcoal-700 hover:border-sage-500/50 hover:text-primary'
              )}
            >
              {p.label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                  active ? 'bg-white/20 text-white' : 'bg-cream-100 text-charcoal-500'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative w-full sm:max-w-[320px]">
          <span className="sr-only">Cari pesanan</span>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-500"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Cari kode pesanan, produk, atau toko"
            className="h-10 w-full rounded-full border border-hairline bg-white pl-10 pr-4 text-sm text-charcoal-900 outline-none placeholder:text-charcoal-500/70 focus:border-primary focus:ring-2 focus:ring-primary/25"
          />
        </label>

        <div
          role="group"
          aria-label="Filter metode pengiriman"
          className="flex gap-1.5 rounded-full bg-cream-100 p-1"
        >
          {fulfillmentOptions.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={fulfillment === f.key}
              onClick={() => onFulfillmentChange(f.key)}
              className={cn(
                'flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:flex-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                fulfillment === f.key
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-charcoal-500 hover:text-charcoal-900'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
