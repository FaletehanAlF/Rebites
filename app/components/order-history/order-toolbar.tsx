'use client';

import { Search, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatusFilter = 'all' | 'ongoing' | 'delivered' | 'cancelled';
export type OrderTab = 'active' | 'completed'; 
export type FulfillmentFilter = 'all' | 'delivery' | 'pickup';

export function OrderToolbar({
  statusFilter,
  onStatusFilterChange,
  counts,
  query,
  onQueryChange,
  fulfillment,
  onFulfillmentChange,
  dateRange,
  onDateRangeChange,
}: {
  statusFilter: StatusFilter;
  onStatusFilterChange: (f: StatusFilter) => void;
  counts: { all: number; ongoing: number; delivered: number; cancelled: number };
  query: string;
  onQueryChange: (q: string) => void;
  fulfillment: FulfillmentFilter;
  onFulfillmentChange: (f: FulfillmentFilter) => void;
  dateRange: string;
  onDateRangeChange: (v: string) => void;
}) {
  const pills: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'ongoing', label: 'Dalam Proses' },
    { key: 'delivered', label: 'Diantar' },
    { key: 'cancelled', label: 'Dibatalkan' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {pills.map((p) => {
            const active = statusFilter === p.key;
            const count = counts[p.key];
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => onStatusFilterChange(p.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? 'border-primary bg-white text-primary shadow-sm'
                    : 'border-zinc-200 bg-white text-muted-foreground hover:border-border hover:text-primary'
                )}
              >
                {p.label}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                    active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => onDateRangeChange(e.target.value)}
              className="h-8 appearance-none rounded-full bg-zinc-100 px-4 pr-7 text-xs font-medium text-foreground outline-none"
            >
              <option value="all">Pilih rentang tanggal</option>
              <option value="7d">7 hari terakhir</option>
              <option value="30d">30 hari terakhir</option>
              <option value="90d">90 hari terakhir</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
      </div>

      {}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { key: 'all', label: 'Semua' },
              { key: 'delivery', label: 'Diantar' },
              { key: 'pickup', label: 'Ambil Sendiri' },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => onFulfillmentChange(f.key)}
              className={cn(
                'h-8 rounded-full px-3.5 text-xs font-semibold transition-all',
                fulfillment === f.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-muted-foreground ring-1 ring-border hover:text-primary'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="relative w-full lg:ml-auto lg:max-w-[320px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Cari Order ID / produk..."
            className="h-9 w-full rounded-full border border-border bg-white pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary"
          />
        </label>
      </div>
    </div>
  );
}
