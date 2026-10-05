'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  AdminSubscriptionsApiError,
  effectiveLabel,
  fetchAdminSubscriptions,
  rawStatusLabel,
  type AdminSubscription,
  type AdminSubscriptionRawStatus,
} from '@/lib/admin-subscriptions';

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 400;

const STATUS_OPTIONS: { value: '' | AdminSubscriptionRawStatus; label: string }[] = [
  { value: '', label: 'Semua status' },
  { value: 'active', label: 'Aktif (DB)' },
  { value: 'pending', label: 'Menunggu pembayaran' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Dibatalkan' },
  { value: 'trial', label: 'Trial' },
];

const PLAN_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua paket' },
  { value: 'basic', label: 'Basic' },
  { value: 'standar', label: 'Standar' },
  { value: 'premium', label: 'Max' },
];

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatPrice = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `Rp${value.toLocaleString('id-ID')}`;
};

function billingLabel(billing: string | null | undefined): string {
  if (billing === 'yearly') return 'Tahunan';
  if (billing === 'monthly') return 'Bulanan';
  return billing?.trim() ? String(billing) : '-';
}

function effectiveBadgeVariant(
  effective: string | null | undefined
): 'success' | 'warning' | 'secondary' {
  const e = (effective ?? '').trim().toLowerCase();
  if (e === 'active') return 'success';
  if (e === 'lapsed' || e === 'pending') return 'warning';
  return 'secondary';
}

export function SubscriptionsManagementView() {
  const router = useRouter();
  const [items, setItems] = useState<AdminSubscription[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | AdminSubscriptionRawStatus>('');
  const [planFilter, setPlanFilter] = useState('');

  const load = useCallback(
    async (
      nextOffset: number,
      nextSearch: string,
      nextStatus: '' | AdminSubscriptionRawStatus,
      nextPlan: string
    ) => {
      setStatus('loading');
      setErrorMsg('');
      try {
        const result = await fetchAdminSubscriptions(
          PAGE_LIMIT,
          nextOffset,
          nextSearch,
          nextStatus,
          nextPlan
        );
        setItems(result.items);
        setTotal(result.total);
        setOffset(result.offset);
        setStatus('ready');
      } catch (err) {
        if (err instanceof AdminSubscriptionsApiError && err.status === 401) {
          router.replace('/auth/login');
          return;
        }
        if (err instanceof AdminSubscriptionsApiError && err.status === 403) {
          setStatus('forbidden');
          return;
        }
        setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat daftar langganan.');
        setStatus('error');
      }
    },
    [router]
  );

  useEffect(() => {
    load(0, search, statusFilter, planFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, planFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch((prev) => (prev === searchInput.trim() ? prev : searchInput.trim()));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE_LIMIT, total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_LIMIT < total;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/admin"
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-semibold text-charcoal-500 transition-colors hover:bg-white hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard Admin
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-caramel">
            Admin · Langganan
          </p>
          <h1 className="mt-1 font-display text-[clamp(1.6rem,3.5vw,2.4rem)] font-semibold tracking-tight text-primary">
            Manajemen Langganan
          </h1>
          <p className="mt-1 max-w-xl text-sm text-sage-500">
            Halaman ini digunakan Admin untuk memantau subscription UMKM (read-only, satu baris =
            satu subscription).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1.5 text-xs font-bold">
            {total} Langganan
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => load(offset, search, statusFilter, planFilter)}
            disabled={status === 'loading'}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Muat ulang
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border/70 bg-white px-3 py-2 focus-within:border-primary">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSearch(searchInput.trim());
            }}
            placeholder="Cari toko, slug, atau ID invoice..."
            aria-label="Cari langganan"
            className="w-full bg-transparent py-1 text-sm text-charcoal-900 outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | AdminSubscriptionRawStatus)}
            aria-label="Filter status"
            className="appearance-none rounded-xl border border-border/70 bg-white px-3 py-2.5 text-sm font-medium text-charcoal-900 outline-none focus:border-primary"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            aria-label="Filter paket"
            className="appearance-none rounded-xl border border-border/70 bg-white px-3 py-2.5 text-sm font-medium text-charcoal-900 outline-none focus:border-primary"
          >
            {PLAN_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {status === 'loading' && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {status === 'forbidden' && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <ShieldAlert className="h-10 w-10 text-caramel" />
            <h2 className="mt-4 font-display text-xl font-semibold text-primary">Akses ditolak</h2>
            <p className="mt-1 max-w-sm text-sm text-sage-500">
              Halaman ini hanya untuk admin. Akun kamu tidak memiliki hak memantau langganan.
            </p>
            <Link href="/" className="mt-5">
              <Button type="button" variant="outline" size="sm">
                Kembali ke Beranda
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {status === 'error' && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <ShieldAlert className="h-10 w-10 text-caramel" />
            <h2 className="mt-4 font-display text-xl font-semibold text-primary">
              Gagal memuat langganan
            </h2>
            <p className="mt-1 max-w-sm text-sm text-sage-500">{errorMsg}</p>
            <Button
              type="button"
              size="sm"
              className="mt-5"
              onClick={() => load(offset, search, statusFilter, planFilter)}
            >
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      )}

      {status === 'ready' && items.length === 0 && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <CreditCard className="h-10 w-10 text-primary" />
            <h2 className="mt-4 font-display text-xl font-semibold text-primary">
              {search || statusFilter || planFilter
                ? 'Langganan tidak ditemukan'
                : 'Belum ada langganan'}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-sage-500">
              {search || statusFilter || planFilter
                ? 'Tidak ada subscription yang cocok dengan filter saat ini.'
                : 'Subscription UMKM yang tercatat akan muncul di sini.'}
            </p>
          </CardContent>
        </Card>
      )}

      {status === 'ready' && items.length > 0 && (
        <>
          <Card className="mt-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-cream-50 text-[11px] uppercase tracking-wider text-sage-500">
                    <th className="px-4 py-3 font-bold">Toko</th>
                    <th className="px-4 py-3 font-bold">Pemilik</th>
                    <th className="px-4 py-3 font-bold">Paket</th>
                    <th className="px-4 py-3 font-bold">Billing</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold">Harga</th>
                    <th className="px-4 py-3 font-bold">Periode berakhir</th>
                    <th className="px-4 py-3 font-bold">Invoice</th>
                    <th className="px-4 py-3 font-bold">Dibuat</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border/50 align-top last:border-0 hover:bg-cream-50/60"
                    >
                      <td className="max-w-[200px] px-4 py-3">
                        <span className="block truncate font-semibold text-charcoal-900">
                          {item.umkm?.business_name ?? '-'}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-sage-500">
                          {item.umkm?.slug ?? '-'}
                        </span>
                      </td>
                      <td className="max-w-[200px] px-4 py-3">
                        <span className="block truncate font-medium text-charcoal-900">
                          {item.owner?.full_name?.trim() || '-'}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-sage-500">
                          {item.owner?.email ?? '-'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-charcoal-900">
                        {item.plan?.name ?? '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-charcoal-900">
                        {billingLabel(item.billing)}
                      </td>
                      <td className="min-w-[190px] px-4 py-3">
                        <Badge variant={effectiveBadgeVariant(item.effective)}>
                          {effectiveLabel(item.effective)}
                        </Badge>
                        <span className="mt-1 block text-xs text-sage-500">
                          DB: {rawStatusLabel(item.status)}
                        </span>
                        {item.status === 'active' && item.effective === 'lapsed' && (
                          <span className="mt-0.5 block text-xs font-medium text-sage-500">
                            Efektif: Periode habis
                          </span>
                        )}
                        {item.status === 'active' && item.effective === 'active' && (
                          <span className="mt-0.5 block text-xs font-medium text-sage-500">
                            Efektif: Aktif
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-charcoal-900">
                        {formatPrice(item.price_paid)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-sage-500">
                        {formatDate(item.current_period_end)}
                      </td>
                      <td className="max-w-[200px] px-4 py-3">
                        <span className="block break-all text-xs text-charcoal-900">
                          {item.xendit_invoice_id ?? '-'}
                        </span>
                        {item.xendit_status && (
                          <span className="mt-0.5 block text-[11px] text-sage-500">
                            {item.xendit_status}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-sage-500">
                        {formatDate(item.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-8 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-sage-500">
              Menampilkan {showingFrom}–{showingTo} dari {total} langganan
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasPrev}
                onClick={() =>
                  load(Math.max(0, offset - PAGE_LIMIT), search, statusFilter, planFilter)
                }
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Sebelumnya
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => load(offset + PAGE_LIMIT, search, statusFilter, planFilter)}
              >
                Berikutnya
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
