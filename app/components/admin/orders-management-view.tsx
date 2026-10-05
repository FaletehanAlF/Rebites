'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldAlert,
  ShoppingBag,
  X,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  AdminOrdersApiError,
  deliveryLabel,
  fetchAdminOrders,
  lifecycleLabel,
  orderStatusLabel,
  paymentStatusLabel,
  progressLabel,
  type AdminDeliveryOption,
  type AdminLifecycleStatus,
  type AdminOrder,
  type AdminOrderStatus,
  type AdminPaymentStatus,
  type AdminShipmentFilter,
} from '@/lib/admin-orders';

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 400;

const ORDER_STATUS_OPTIONS: { value: '' | AdminOrderStatus; label: string }[] = [
  { value: '', label: 'Semua order' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Dibayar' },
  { value: 'processing', label: 'Diproses' },
  { value: 'ready_for_pickup', label: 'Siap diambil' },
  { value: 'out_for_delivery', label: 'Diantar' },
  { value: 'preparing', label: 'Disiapkan' },
  { value: 'ready', label: 'Siap' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
  { value: 'refunded', label: 'Refund' },
];

const PAYMENT_OPTIONS: { value: '' | AdminPaymentStatus; label: string }[] = [
  { value: '', label: 'Semua pembayaran' },
  { value: 'unpaid', label: 'Belum dibayar' },
  { value: 'paid', label: 'Lunas' },
  { value: 'failed', label: 'Gagal / Kadaluarsa' },
  { value: 'refunded', label: 'Refund' },
];

const DELIVERY_OPTIONS: { value: '' | AdminDeliveryOption; label: string }[] = [
  { value: '', label: 'Semua pengiriman' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'pickup', label: 'Pickup' },
];

const SHIPMENT_OPTIONS: { value: '' | AdminShipmentFilter; label: string }[] = [
  { value: '', label: 'Semua shipment' },
  { value: 'has_shipment', label: 'Ada shipment' },
  { value: 'no_shipment', label: 'Tanpa shipment' },
];

const LIFECYCLE_OPTIONS: { value: '' | AdminLifecycleStatus; label: string }[] = [
  { value: '', label: 'Semua lifecycle' },
  { value: 'ongoing', label: 'Berlangsung' },
  { value: 'completed', label: 'Selesai' },
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

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatPrice = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `Rp${value.toLocaleString('id-ID')}`;
};

function paymentBadgeVariant(status: string | null | undefined): 'success' | 'warning' | 'secondary' {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'paid') return 'success';
  if (s === 'unpaid') return 'warning';
  return 'secondary';
}

function orderBadgeVariant(status: string | null | undefined): 'success' | 'warning' | 'secondary' {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'completed') return 'success';
  if (s === 'cancelled' || s === 'refunded' || s === 'failed') return 'secondary';
  return 'warning';
}

interface Filters {
  search: string;
  orderStatus: '' | AdminOrderStatus;
  paymentStatus: '' | AdminPaymentStatus;
  deliveryOption: '' | AdminDeliveryOption;
  shipment: '' | AdminShipmentFilter;
  lifecycle: '' | AdminLifecycleStatus;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-cream-50/60 p-4">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-sage-500">{title}</h3>
      <div className="mt-2 space-y-1.5 text-sm text-charcoal-900">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-sage-500">{label}</span>
      <span className={`text-right text-[13px] font-medium ${mono ? 'break-all font-mono text-[12px]' : 'break-words'}`}>
        {value}
      </span>
    </div>
  );
}

function snapshotText(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value.trim() ? value : '-';
  try {
    const obj = value as Record<string, unknown>;
    const parts: string[] = [];
    const push = (v: unknown) => {
      if (typeof v === 'string' && v.trim()) parts.push(v.trim());
      else if (typeof v === 'number' && Number.isFinite(v)) parts.push(String(v));
    };
    push(obj.receiver_name ?? obj.receiverName);
    push(obj.phone);
    push(obj.full_address ?? obj.fullAddress ?? obj.address);
    push(obj.district ?? obj.subdistrict);
    push(obj.city);
    push(obj.province);
    push(obj.postal_code ?? obj.postalCode);
    push(obj.note);
    if (parts.length === 0) {
      const raw = JSON.stringify(value);
      return raw.length > 300 ? `${raw.slice(0, 300)}…` : raw;
    }
    return parts.join(', ');
  } catch {
    return '-';
  }
}

export function OrdersManagementView() {
  const router = useRouter();
  const [items, setItems] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<Filters>({
    search: '',
    orderStatus: '',
    paymentStatus: '',
    deliveryOption: '',
    shipment: '',
    lifecycle: '',
  });
  const [detail, setDetail] = useState<AdminOrder | null>(null);

  const load = useCallback(
    async (nextOffset: number, f: Filters) => {
      setStatus('loading');
      setErrorMsg('');
      try {
        const result = await fetchAdminOrders({
          limit: PAGE_LIMIT,
          offset: nextOffset,
          search: f.search,
          orderStatus: f.orderStatus,
          paymentStatus: f.paymentStatus,
          deliveryOption: f.deliveryOption,
          shipment: f.shipment,
          lifecycle: f.lifecycle,
        });
        setItems(result.items);
        setTotal(result.total);
        setOffset(result.offset);
        setStatus('ready');
      } catch (err) {
        if (err instanceof AdminOrdersApiError && err.status === 401) {
          router.replace('/auth/login');
          return;
        }
        if (err instanceof AdminOrdersApiError && err.status === 403) {
          setStatus('forbidden');
          return;
        }
        setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat daftar pesanan.');
        setStatus('error');
      }
    },
    [router]
  );

  useEffect(() => {
    load(0, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => (prev.search === searchInput.trim() ? prev : { ...prev, search: searchInput.trim() }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const hasActiveFilter =
    filters.search !== '' ||
    filters.orderStatus !== '' ||
    filters.paymentStatus !== '' ||
    filters.deliveryOption !== '' ||
    filters.shipment !== '' ||
    filters.lifecycle !== '';

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
            Admin · Pesanan
          </p>
          <h1 className="mt-1 font-display text-[clamp(1.6rem,3.5vw,2.4rem)] font-semibold tracking-tight text-primary">
            Manajemen Pesanan
          </h1>
          <p className="mt-1 max-w-xl text-sm text-sage-500">
            Pantau pesanan, pembayaran, status operasional, dan pengiriman.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1.5 text-xs font-bold">
            {total} Pesanan
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => load(offset, filters)}
            disabled={status === 'loading'}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Muat ulang
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border/70 bg-white px-3 py-2 focus-within:border-primary">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setFilters((prev) => ({ ...prev, search: searchInput.trim() }));
            }}
            placeholder="Cari order code, invoice, toko, produk, buyer..."
            aria-label="Cari pesanan"
            className="w-full bg-transparent py-1 text-sm text-charcoal-900 outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <select
            value={filters.orderStatus}
            onChange={(e) => setFilter('orderStatus', e.target.value as Filters['orderStatus'])}
            aria-label="Filter order status"
            className="appearance-none rounded-xl border border-border/70 bg-white px-3 py-2.5 text-sm font-medium text-charcoal-900 outline-none focus:border-primary"
          >
            {ORDER_STATUS_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={filters.paymentStatus}
            onChange={(e) => setFilter('paymentStatus', e.target.value as Filters['paymentStatus'])}
            aria-label="Filter payment status"
            className="appearance-none rounded-xl border border-border/70 bg-white px-3 py-2.5 text-sm font-medium text-charcoal-900 outline-none focus:border-primary"
          >
            {PAYMENT_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={filters.deliveryOption}
            onChange={(e) => setFilter('deliveryOption', e.target.value as Filters['deliveryOption'])}
            aria-label="Filter delivery"
            className="appearance-none rounded-xl border border-border/70 bg-white px-3 py-2.5 text-sm font-medium text-charcoal-900 outline-none focus:border-primary"
          >
            {DELIVERY_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={filters.shipment}
            onChange={(e) => setFilter('shipment', e.target.value as Filters['shipment'])}
            aria-label="Filter shipment"
            className="appearance-none rounded-xl border border-border/70 bg-white px-3 py-2.5 text-sm font-medium text-charcoal-900 outline-none focus:border-primary"
          >
            {SHIPMENT_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={filters.lifecycle}
            onChange={(e) => setFilter('lifecycle', e.target.value as Filters['lifecycle'])}
            aria-label="Filter lifecycle"
            className="appearance-none rounded-xl border border-border/70 bg-white px-3 py-2.5 text-sm font-medium text-charcoal-900 outline-none focus:border-primary"
          >
            {LIFECYCLE_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value}>
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
              Halaman ini hanya untuk admin. Akun kamu tidak memiliki hak memantau pesanan.
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
            <h2 className="mt-4 font-display text-xl font-semibold text-primary">Gagal memuat pesanan</h2>
            <p className="mt-1 max-w-sm text-sm text-sage-500">{errorMsg}</p>
            <Button type="button" size="sm" className="mt-5" onClick={() => load(offset, filters)}>
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      )}

      {status === 'ready' && items.length === 0 && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <ShoppingBag className="h-10 w-10 text-primary" />
            <h2 className="mt-4 font-display text-xl font-semibold text-primary">
              {hasActiveFilter ? 'Pesanan tidak ditemukan' : 'Belum ada pesanan'}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-sage-500">
              {hasActiveFilter
                ? 'Tidak ada pesanan yang cocok dengan filter saat ini.'
                : 'Pesanan yang tercatat akan muncul di sini.'}
            </p>
          </CardContent>
        </Card>
      )}

      {status === 'ready' && items.length > 0 && (
        <>
          <Card className="mt-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1280px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-cream-50 text-[11px] uppercase tracking-wider text-sage-500">
                    <th className="px-4 py-3 font-bold">Order</th>
                    <th className="px-4 py-3 font-bold">Buyer</th>
                    <th className="px-4 py-3 font-bold">Toko</th>
                    <th className="px-4 py-3 font-bold">Produk</th>
                    <th className="px-4 py-3 font-bold">Total</th>
                    <th className="px-4 py-3 font-bold">Pembayaran</th>
                    <th className="px-4 py-3 font-bold">Order Status</th>
                    <th className="px-4 py-3 font-bold">Lifecycle</th>
                    <th className="px-4 py-3 font-bold">Progress</th>
                    <th className="px-4 py-3 font-bold">Delivery</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="cursor-pointer border-b border-border/50 align-top last:border-0 hover:bg-cream-50/60"
                      onClick={() => setDetail(item)}
                    >
                      <td className="max-w-[190px] px-4 py-3">
                        <span className="block break-all font-mono text-xs font-semibold text-charcoal-900">
                          {item.order_code ?? '-'}
                        </span>
                        <span className="mt-0.5 block text-xs text-sage-500">
                          {formatDate(item.created_at)}
                        </span>
                      </td>
                      <td className="max-w-[180px] px-4 py-3">
                        <span className="block truncate font-medium text-charcoal-900">
                          {item.buyer?.full_name?.trim() || '-'}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-sage-500">
                          {item.buyer?.email ?? '-'}
                        </span>
                      </td>
                      <td className="max-w-[180px] px-4 py-3">
                        <span className="block truncate font-medium text-charcoal-900">
                          {item.umkm?.business_name ?? item.vendor_name ?? '-'}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-sage-500">
                          {item.umkm?.slug ?? item.vendor_slug ?? '-'}
                        </span>
                      </td>
                      <td className="max-w-[180px] px-4 py-3">
                        <span className="block truncate text-charcoal-900">
                          {item.product?.name ?? item.product_name ?? '-'}
                        </span>
                        <span className="mt-0.5 block text-xs text-sage-500">
                          Qty {item.quantity ?? '-'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-charcoal-900">
                        {formatPrice(item.total_price)}
                      </td>
                      <td className="min-w-[170px] px-4 py-3">
                        <Badge variant={paymentBadgeVariant(item.payment_status)}>
                          {paymentStatusLabel(item.payment_status)}
                        </Badge>
                        <span className="mt-1 block max-w-[170px] break-all text-[11px] text-sage-500">
                          {item.xendit_invoice_id ?? '-'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge variant={orderBadgeVariant(item.order_status)}>
                          {orderStatusLabel(item.order_status)}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-charcoal-900">
                        {lifecycleLabel(item.lifecycle_status)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-charcoal-900">
                        {progressLabel(item.progress_status)}
                      </td>
                      <td className="min-w-[170px] px-4 py-3">
                        <span className="block text-xs font-medium text-charcoal-900">
                          {deliveryLabel(item.delivery_option)}
                          {item.delivery_option === 'delivery' && item.courier_service_name
                            ? ` · ${item.courier_service_name}`
                            : ''}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-sage-500">
                          {item.flags.has_shipment
                            ? (item.shipment_status ?? 'Shipment dibuat')
                            : 'Tanpa shipment'}
                        </span>
                        {item.flags.paid_without_shipment && (
                          <Badge variant="warning" className="mt-1">
                            Paid tanpa shipment
                          </Badge>
                        )}
                        {item.flags.lifecycle_mismatch && (
                          <Badge variant="warning" className="mt-1">
                            Status tidak sinkron
                          </Badge>
                        )}
                        {item.flags.legacy_no_progress && (
                          <Badge variant="secondary" className="mt-1">
                            Progress belum tersedia
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-8 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-sage-500">
              Menampilkan {showingFrom}–{showingTo} dari {total} pesanan
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasPrev}
                onClick={() => load(Math.max(0, offset - PAGE_LIMIT), filters)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Sebelumnya
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => load(offset + PAGE_LIMIT, filters)}
              >
                Berikutnya
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
          onClick={() => setDetail(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Detail pesanan ${detail.order_code ?? ''}`}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-caramel">
                  Detail Pesanan
                </p>
                <h2 className="mt-1 break-all font-mono text-base font-bold text-charcoal-900">
                  {detail.order_code ?? '-'}
                </h2>
                <p className="mt-0.5 text-xs text-sage-500">{formatDateTime(detail.created_at)}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setDetail(null)} aria-label="Tutup detail">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {(detail.flags.paid_without_shipment ||
              detail.flags.lifecycle_mismatch ||
              detail.flags.legacy_no_progress) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {detail.flags.paid_without_shipment && (
                  <Badge variant="warning">Paid tanpa shipment</Badge>
                )}
                {detail.flags.lifecycle_mismatch && (
                  <Badge variant="warning">Status tidak sinkron</Badge>
                )}
                {detail.flags.legacy_no_progress && (
                  <Badge variant="secondary">Progress belum tersedia</Badge>
                )}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Section title="Buyer">
                <Row label="Nama" value={detail.buyer?.full_name?.trim() || '-'} />
                <Row label="Email" value={detail.buyer?.email ?? '-'} />
              </Section>
              <Section title="Toko">
                <Row label="Nama" value={detail.umkm?.business_name ?? detail.vendor_name ?? '-'} />
                <Row label="Slug" value={detail.umkm?.slug ?? detail.vendor_slug ?? '-'} mono />
              </Section>
              <Section title="Produk">
                <Row label="Nama" value={detail.product?.name ?? detail.product_name ?? '-'} />
                <Row label="Qty" value={detail.quantity !== null ? String(detail.quantity) : '-'} />
                <Row label="Harga satuan" value={formatPrice(detail.unit_price)} />
              </Section>
              <Section title="Status">
                <Row label="Order" value={orderStatusLabel(detail.order_status)} />
                <Row label="Lifecycle" value={lifecycleLabel(detail.lifecycle_status)} />
                <Row label="Progress" value={progressLabel(detail.progress_status)} />
              </Section>
              <Section title="Pembayaran">
                <Row label="Status" value={paymentStatusLabel(detail.payment_status)} />
                <Row label="Metode" value={detail.payment_method_id ?? '-'} mono />
                <Row label="Invoice" value={detail.xendit_invoice_id ?? '-'} mono />
                <Row label="Subtotal" value={formatPrice(detail.subtotal)} />
                <Row label="Diskon" value={formatPrice(detail.discount)} />
                <Row label="Service fee" value={formatPrice(detail.service_fee)} />
                <Row label="Delivery fee" value={formatPrice(detail.delivery_fee)} />
                <Row label="Koin dipakai" value={formatPrice(detail.coin_used)} />
                <Row label="Total" value={formatPrice(detail.total_price)} />
                {detail.promo_code && <Row label="Promo" value={detail.promo_code} mono />}
              </Section>
              <Section title="Pengiriman">
                <Row label="Opsi" value={deliveryLabel(detail.delivery_option)} />
                <Row label="Kurir" value={detail.courier_code ?? '-'} mono />
                <Row label="Layanan" value={detail.courier_service_name ?? detail.courier_service_code ?? '-'} />
                <Row label="Ongkir" value={formatPrice(detail.shipping_rate)} />
                <Row label="Shipment" value={detail.shipment_status ?? (detail.flags.has_shipment ? 'Dibuat' : 'Tanpa shipment')} />
                <Row label="Tracking" value={detail.biteship_tracking_id ?? '-'} mono />
                <Row label="Waybill" value={detail.biteship_waybill_id ?? '-'} mono />
                <Row label="Estimasi tiba" value={formatDateTime(detail.estimated_arrival_at)} />
                <Row label="Jarak" value={detail.delivery_distance_km !== null ? `${detail.delivery_distance_km} km` : '-'} />
                <Row
                  label="Estimasi antar"
                  value={detail.estimated_delivery_minutes !== null ? `${detail.estimated_delivery_minutes} mnt` : '-'}
                />
                {detail.shipment_error && <Row label="Shipment error" value={detail.shipment_error} />}
              </Section>
            </div>

            <div className="mt-3">
              <Section title="Snapshot Alamat">
                <p className="text-[13px] leading-relaxed">{snapshotText(detail.address_snapshot ?? detail.delivery_address)}</p>
              </Section>
            </div>

            <p className="mt-4 text-center text-[11px] text-sage-500">
              Riwayat status dan transaksi dana tidak ditampilkan di sini karena akses admin ke tabel
              riwayat belum dibuka (menunggu audit keamanan lanjutan).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
