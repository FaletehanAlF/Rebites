'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  CircleAlert,
  Eye,
  Loader2,
  RefreshCw,
  RotateCcw,
  SearchX,
  ShoppingBag,
  TriangleAlert,
  Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  AdminPageHeader,
  ADMIN_PAGE_WRAPPER,
} from './admin-page-header';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminForbiddenState,
  AdminLoadingState,
} from './admin-state';
import {
  AdminPagination,
  AdminSearchInput,
  AdminSelect,
  AdminToolbar,
} from './admin-controls';
import {
  AdminTableCard,
  AdminTableHead,
  AdminTd,
  AdminTdActions,
  AdminTh,
  AdminTr,
} from './admin-table';
import {
  AdminDetailField,
  AdminDetailGrid,
  AdminDetailSection,
} from './admin-detail';
import { formatTanggal, formatTanggalWaktu, formatRupiah } from './admin-format';
import { SmartImage } from '@/app/components/shared/SmartImage';
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
import { orderNeedsAttention } from '@/lib/order-monitoring-flags';

import { refreshAdminSessionSafe } from '@/lib/admin-auth';

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 400;
/** Lama pesan "daftar diperbarui" tampil sebelum hilang sendiri. */
const REFRESH_NOTE_MS = 4000;

/**
 * Deep-link ke satu pesanan: `/dashboard/admin/pesanan?kode=RBT-XXXX`.
 *
 * Parameter dibaca dari `window.location.search` di dalam useEffect, bukan
 * lewat `useSearchParams()`. Alasannya: halaman admin ikut di-prerender saat
 * build, dan `useSearchParams()` pada halaman yang di-prerender memaksa
 * seluruh subtree masuk Client Component Boundary (kalau tidak, build gagal
 * dengan "missing suspense boundary"). Membaca query string setelah mount
 * menghilangkan kebutuhan itu tanpa mengubah struktur routing.
 *
 * Yang terjadi: pencarian diisi dengan kode pesanan, lalu detail pesanan dengan
 * kode yang PERSIS sama dibuka otomatis satu kali. Pencocokan memakai kode
 * lengkap dari metadata activity_logs, bukan LIKE parsial, supaya admin
 * selalu mendarat di pesanan yang dimaksud.
 */
function readOrderCodeParam(): string {
  if (typeof window === 'undefined') return '';
  try {
    const value = new URLSearchParams(window.location.search).get('kode');
    return value?.trim() ?? '';
  } catch {
    return '';
  }
}

const ORDER_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua pesanan' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'paid', label: 'Dibayar' },
  { value: 'processing', label: 'Diproses' },
  { value: 'ready_for_pickup', label: 'Siap diambil' },
  { value: 'out_for_delivery', label: 'Diantar' },
  { value: 'preparing', label: 'Disiapkan' },
  { value: 'ready', label: 'Siap' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
  { value: 'refunded', label: 'Dana dikembalikan' },
];

const PAYMENT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua pembayaran' },
  { value: 'unpaid', label: 'Belum dibayar' },
  { value: 'paid', label: 'Lunas' },
  { value: 'failed', label: 'Gagal / Kedaluwarsa' },
  { value: 'refunded', label: 'Dana dikembalikan' },
];

const DELIVERY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua pengiriman' },
  { value: 'delivery', label: 'Diantar' },
  { value: 'pickup', label: 'Ambil sendiri' },
];

const SHIPMENT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua pengiriman kurir' },
  { value: 'has_shipment', label: 'Ada pengiriman' },
  { value: 'no_shipment', label: 'Tanpa pengiriman' },
];

const LIFECYCLE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua siklus' },
  { value: 'ongoing', label: 'Berlangsung' },
  { value: 'completed', label: 'Selesai' },
];

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

const FILTER_KOSONG: Filters = {
  search: '',
  orderStatus: '',
  paymentStatus: '',
  deliveryOption: '',
  shipment: '',
  lifecycle: '',
};

function namaToko(order: AdminOrder): string {
  return order.umkm?.business_name?.trim() || order.vendor_name?.trim() || '-';
}

function namaProduk(order: AdminOrder): string {
  return order.product?.name?.trim() || order.product_name?.trim() || '-';
}

function namaPembeli(order: AdminOrder): string {
  return order.buyer?.full_name?.trim() || '';
}

/**
 * Flag peringatan yang stabil, supaya tabel dan dialog detail menyebut hal
 * yang sama dengan kalimat yang sama.
 */
function daftarFlag(order: AdminOrder): { label: string; variant: 'warning' | 'secondary' }[] {
  const hasil: { label: string; variant: 'warning' | 'secondary' }[] = [];
  if (order.flags.paid_without_shipment) {
    hasil.push({ label: 'Lunas tanpa pengiriman', variant: 'warning' });
  }
  if (order.flags.lifecycle_mismatch) {
    hasil.push({ label: 'Status tidak sinkron', variant: 'warning' });
  }
  if (order.flags.legacy_no_progress) {
    hasil.push({ label: 'Progres belum tersedia', variant: 'secondary' });
  }
  return hasil;
}

/**
 * Bongkar snapshot alamat menjadi baris label-nilai.
 *
 * Sebelumnya seluruh snapshot digabung menjadi satu kalimat berderet koma,
 * sehingga nama penerima, alamat, kota, dan kode pos menyatu jadi satu blok
 * teks panjang yang sulit dibaca. Sekarang tiap komponen punya barisnya
 * sendiri. Bila snapshot tidak berbentuk objek yang dikenal, tampilkan apa
 * adanya — tidak mengarang label.
 */
function alamatFields(value: unknown): { label: string; value: string }[] {
  if (value === null || value === undefined) return [];

  if (typeof value === 'string') {
    const teks = value.trim();
    return teks ? [{ label: 'Alamat', value: teks }] : [];
  }

  const obj = value as Record<string, unknown>;
  const ambil = (...kunci: string[]): string => {
    for (const k of kunci) {
      const v = obj[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    }
    return '';
  };

  const rows = [
    { label: 'Penerima', value: ambil('receiver_name', 'receiverName') },
    { label: 'Telepon', value: ambil('phone', 'receiver_phone', 'receiverPhone') },
    { label: 'Alamat', value: ambil('full_address', 'fullAddress', 'address') },
    { label: 'Kecamatan', value: ambil('district', 'subdistrict') },
    { label: 'Kota / Kabupaten', value: ambil('city') },
    { label: 'Provinsi', value: ambil('province') },
    { label: 'Kode pos', value: ambil('postal_code', 'postalCode') },
    { label: 'Catatan', value: ambil('note', 'notes') },
  ].filter((row) => row.value);

  if (rows.length > 0) return rows;

  try {
    const raw = JSON.stringify(value);
    if (!raw || raw === '{}' || raw === 'null') return [];
    return [{ label: 'Data alamat', value: raw }];
  } catch {
    return [];
  }
}

/** Satu baris biaya: label di kiri, nominal rata kanan dengan angka tabular. */
function BiayaRow({
  label,
  nominal,
  muted,
  strong,
}: {
  label: string;
  nominal: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={cn('text-[13px]', strong ? 'font-semibold text-charcoal-900' : 'text-sage-500')}>
        {label}
      </span>
      <span
        className={cn(
          'shrink-0 text-right tabular-nums',
          strong
            ? 'text-[15px] font-bold text-charcoal-900'
            : muted
              ? 'text-[13px] text-sage-500'
              : 'text-[13px] font-medium text-charcoal-900'
        )}
      >
        {nominal}
      </span>
    </div>
  );
}

export function OrdersManagementView() {
  const router = useRouter();
  const [items, setItems] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<Filters>(FILTER_KOSONG);
  const [detail, setDetail] = useState<AdminOrder | null>(null);
  // Kode pesanan dari ?kode= (deep-link dari notifikasi/baris aktivitas).
  const [focusOrderCode, setFocusOrderCode] = useState('');
  const [focusConsumed, setFocusConsumed] = useState(false);
  /**
   * True saat memuat ulang SETELAH tabel pernah tampil. Tabel dibiarkan
   * terlihat (diredupkan) alih-alih diganti spinner, supaya mengganti filter
   * atau pindah halaman tidak membuat seluruh daftar berkedip hilang.
   */
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const sudahPernahMemuat = useRef(false);

  useEffect(() => {
    const code = readOrderCodeParam();
    if (!code) return;
    setFocusOrderCode(code);
    setSearchInput(code);
    setFilters((prev) => (prev.search === code ? prev : { ...prev, search: code }));
  }, []);

  type LoadOutcome = 'ok' | 'error' | 'forbidden' | 'unauthorized';

  const load = useCallback(
    async (nextOffset: number, f: Filters): Promise<LoadOutcome> => {
      setErrorMsg('');
      if (sudahPernahMemuat.current) setRefreshing(true);
      else setStatus('loading');

      const terapkan = (result: Awaited<ReturnType<typeof fetchAdminOrders>>) => {
        setItems(result.items);
        setTotal(result.total);
        setOffset(result.offset);
        sudahPernahMemuat.current = true;
        setStatus('ready');
      };

      // Kegagalan SETELAH tabel tampil tidak mengosongkan halaman.
      const gagal = (message: string): LoadOutcome => {
        setErrorMsg(message);
        if (sudahPernahMemuat.current) setStatus('ready');
        else setStatus('error');
        return 'error';
      };

      const ambil = () =>
        fetchAdminOrders({
          limit: PAGE_LIMIT,
          offset: nextOffset,
          search: f.search,
          orderStatus: f.orderStatus,
          paymentStatus: f.paymentStatus,
          deliveryOption: f.deliveryOption,
          shipment: f.shipment,
          lifecycle: f.lifecycle,
        });

      try {
        try {
          terapkan(await ambil());
          return 'ok';
        } catch (err) {
          // 401 belum tentu sesi benar-benar habis: bisa access_token masuk
          // refresh window saat request dikirim. Refresh aman satu kali lalu
          // retry satu kali; TANPA signOut otomatis, TANPA loop.
          if (!(err instanceof AdminOrdersApiError && err.status === 401)) throw err;
          const refreshed = await refreshAdminSessionSafe();
          if (!refreshed) {
            router.replace('/auth/login');
            return 'unauthorized';
          }
          terapkan(await ambil());
          return 'ok';
        }
      } catch (err) {
        const errStatus = (err as { status?: number })?.status ?? 0;
        // 503: Supabase tidak terjangkau. Sesi masih ada, jadi jangan lempar
        // admin ke halaman login — cukup minta coba lagi.
        if (errStatus === 503) {
          return gagal('Tidak dapat menghubungi server data. Periksa koneksi lalu coba lagi.');
        }
        if (err instanceof AdminOrdersApiError && err.status === 403) {
          setStatus('forbidden');
          return 'forbidden';
        }
        if (err instanceof AdminOrdersApiError && err.status === 401) {
          router.replace('/auth/login');
          return 'unauthorized';
        }
        return gagal(err instanceof Error ? err.message : 'Gagal memuat daftar pesanan.');
      } finally {
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    void load(0, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Buka detail pesanan yang dituju deep-link, hanya sekali, dan hanya bila
  // kode di URL cocok PERSIS dengan order_code pada hasil pencarian.
  useEffect(() => {
    if (!focusOrderCode || focusConsumed) return;
    if (status !== 'ready') return;
    const match = items.find((item) => item.order_code === focusOrderCode);
    if (!match) return;
    setFocusConsumed(true);
    setDetail(match);
  }, [focusOrderCode, focusConsumed, status, items]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => (prev.search === searchInput.trim() ? prev : { ...prev, search: searchInput.trim() }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!refreshNote) return;
    const timer = setTimeout(() => setRefreshNote(null), REFRESH_NOTE_MS);
    return () => clearTimeout(timer);
  }, [refreshNote]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const resetFilters = () => {
    setSearchInput('');
    setFilters(FILTER_KOSONG);
  };

  const hasActiveFilter =
    filters.search !== '' ||
    filters.orderStatus !== '' ||
    filters.paymentStatus !== '' ||
    filters.deliveryOption !== '' ||
    filters.shipment !== '' ||
    filters.lifecycle !== '';

  const jumlahFilterAktif = [
    filters.orderStatus,
    filters.paymentStatus,
    filters.deliveryOption,
    filters.shipment,
    filters.lifecycle,
  ].filter(Boolean).length;

  const page = Math.floor(offset / PAGE_LIMIT) + 1;

  const handleReload = async () => {
    setRefreshNote(null);
    const outcome = await load(offset, filters);
    if (outcome === 'ok') setRefreshNote('Daftar pesanan diperbarui.');
  };

  const onRowKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
    order: AdminOrder
  ) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setDetail(order);
  };

  return (
    <div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader
        eyebrow="Admin · Pesanan"
        title="Manajemen Pesanan"
        description="Pembayaran, status, dan pengiriman setiap pesanan."
        actions={
          <>
            <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
              {total} pesanan
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleReload()}
              disabled={status === 'loading' || refreshing}
            >
              <RefreshCw aria-hidden className="h-3.5 w-3.5" />
              Muat ulang
            </Button>
          </>
        }
      />

      {/* Baris 1: pencarian + reset. */}
      <AdminToolbar className="mb-3">
        <AdminSearchInput
          value={searchInput}
          onChange={setSearchInput}
          label="Cari pesanan"
          labelVisible
          placeholder="Cari nomor pesanan, pembeli, toko, atau produk…"
        />
        <Button
          type="button"
          variant="outline"
          onClick={resetFilters}
          disabled={!hasActiveFilter}
          className="self-start sm:self-end"
        >
          <RotateCcw aria-hidden className="h-4 w-4" />
          Reset filter
          {jumlahFilterAktif > 0 && (
            <span className="ml-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-primary">
              {jumlahFilterAktif}
            </span>
          )}
        </Button>
      </AdminToolbar>

      {/*
        Baris 2: lima filter dalam GRID, bukan flex-wrap.

        Sebelumnya memakai `AdminToolbar` (flex-wrap) dengan lebar tiap
        select dihitung dari teks terpanjang (`ch`). Lima select dengan
        lebar berbeda membuat "Siklus pesanan" tidak kebagian tempat di
        baris pertama dan jatuh SENDIRIAN ke baris kedua — terlihat
        berantakan dan menyisakan ruang kosong lebar di kiri.

        Grid memberi tiap select lebar yang sama dan membaginya merata:
        1 kolom di HP, 2 di tablet kecil, 3 di tablet, 5 di desktop lebar.
        `sm:w-full` menimpa lebar `ch` bawaan AdminSelect supaya tiap
        select mengikuti lebar sel grid.
      */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <AdminSelect
          value={filters.orderStatus}
          onChange={(value) => setFilter('orderStatus', value as Filters['orderStatus'])}
          label="Status pesanan"
          options={ORDER_STATUS_OPTIONS}
          className="sm:w-full"
        />
        <AdminSelect
          value={filters.paymentStatus}
          onChange={(value) => setFilter('paymentStatus', value as Filters['paymentStatus'])}
          label="Pembayaran"
          options={PAYMENT_OPTIONS}
          className="sm:w-full"
        />
        <AdminSelect
          value={filters.deliveryOption}
          onChange={(value) => setFilter('deliveryOption', value as Filters['deliveryOption'])}
          label="Opsi kirim"
          options={DELIVERY_OPTIONS}
          className="sm:w-full"
        />
        <AdminSelect
          value={filters.shipment}
          onChange={(value) => setFilter('shipment', value as Filters['shipment'])}
          label="Data kurir"
          options={SHIPMENT_OPTIONS}
          className="sm:w-full"
        />
        <AdminSelect
          value={filters.lifecycle}
          onChange={(value) => setFilter('lifecycle', value as Filters['lifecycle'])}
          label="Siklus pesanan"
          options={LIFECYCLE_OPTIONS}
          className="sm:w-full"
        />
      </div>

      {refreshNote && (
        <p
          role="status"
          className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-success"
        >
          <Check aria-hidden className="h-4 w-4 shrink-0" />
          {refreshNote}
        </p>
      )}

      {status === 'loading' && <AdminLoadingState label="Memuat daftar pesanan" />}

      {status === 'forbidden' && (
        <AdminForbiddenState message="Halaman ini hanya untuk admin. Akun kamu tidak memiliki hak memantau pesanan." />
      )}

      {status === 'error' && (
        <AdminErrorState
          title="Gagal memuat pesanan"
          message={errorMsg}
          onRetry={() => void load(offset, filters)}
        />
      )}

      {status === 'ready' && items.length === 0 && (
        <AdminEmptyState
          icon={
            hasActiveFilter ? (
              <SearchX aria-hidden className="h-10 w-10 text-primary" />
            ) : (
              <ShoppingBag aria-hidden className="h-10 w-10 text-primary" />
            )
          }
          title={hasActiveFilter ? 'Pesanan tidak ditemukan' : 'Belum ada pesanan'}
          description={
            hasActiveFilter
              ? 'Tidak ada pesanan yang cocok dengan pencarian atau filter yang dipilih. Coba atur ulang filter.'
              : 'Pesanan yang tercatat akan muncul di sini.'
          }
          action={
            hasActiveFilter ? (
              <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                <RotateCcw aria-hidden className="h-4 w-4" />
                Atur ulang filter
              </Button>
            ) : undefined
          }
        />
      )}

      {status === 'ready' && items.length > 0 && (
        <>
          {/* Kegagalan saat memuat ulang tidak mengosongkan tabel. */}
          {errorMsg && (
            <div
              role="alert"
              className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-destructive/25 bg-destructive/[0.06] px-3 py-2 text-sm text-charcoal-900"
            >
              <span className="min-w-0">{errorMsg}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void load(offset, filters)}
              >
                Coba lagi
              </Button>
            </div>
          )}

          {refreshing && (
            <p
              role="status"
              className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-sage-500"
            >
              <Loader2
                aria-hidden
                className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
              />
              Memperbarui daftar…
            </p>
          )}

          <div
            aria-busy={refreshing}
            className={cn('transition-opacity', refreshing && 'pointer-events-none opacity-60')}
          >
            {/* 7 kolom (sebelumnya 11 pada minWidth 1360). Lebar minimum
                diturunkan supaya tabel tidak lagi menggulir horizontal di
                laptop 1280px, dan tiap sel cukup lebar untuk teksnya. */}
            <AdminTableCard label="Daftar pesanan" minWidth={920} className="hidden md:block">
              <AdminTableHead>
                <AdminTh>Pesanan</AdminTh>
                <AdminTh>Pembeli</AdminTh>
                <AdminTh>Produk &amp; Toko</AdminTh>
                <AdminTh className="text-right">Total</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh>Pengiriman</AdminTh>
                <AdminTh className="text-right">Aksi</AdminTh>
              </AdminTableHead>
              <tbody>
                {items.map((item) => (
                  <AdminTr
                    key={item.id}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                    onClick={() => setDetail(item)}
                    tabIndex={0}
                    onKeyDown={(event) => onRowKeyDown(event, item)}
                    aria-label={`Buka detail pesanan ${item.order_code ?? ''}`}
                  >
                    <AdminTd className="whitespace-nowrap">
                      <span className="block font-mono text-[13px] font-semibold text-charcoal-900">
                        {item.order_code ?? '-'}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-sage-500">
                        {formatTanggal(item.created_at)}
                      </span>
                    </AdminTd>

                    <AdminTd className="max-w-[170px]">
                      <span
                        className="block break-words text-[13px] font-medium leading-snug text-charcoal-900"
                        title={namaPembeli(item) || undefined}
                      >
                        {namaPembeli(item) || '-'}
                      </span>
                      {item.buyer?.email && (
                        <span
                          className="mt-0.5 block truncate text-[11px] leading-snug text-sage-500"
                          title={item.buyer.email}
                        >
                          {item.buyer.email}
                        </span>
                      )}
                    </AdminTd>

                    <AdminTd className="max-w-[210px]">
                      <span
                        className="block break-words text-[13px] font-medium leading-snug text-charcoal-900"
                        title={namaProduk(item)}
                      >
                        {namaProduk(item)}
                      </span>
                      <span className="mt-0.5 block break-words text-[11px] leading-snug text-sage-500">
                        {item.quantity !== null ? `${item.quantity}× · ` : ''}
                        {namaToko(item)}
                      </span>
                    </AdminTd>

                    <AdminTd className="whitespace-nowrap text-right">
                      <span className="block text-[13px] font-semibold tabular-nums text-charcoal-900">
                        {formatRupiah(item.total_price)}
                      </span>
                      <Badge
                        variant={paymentBadgeVariant(item.payment_status)}
                        className="mt-1 whitespace-nowrap"
                      >
                        {paymentStatusLabel(item.payment_status)}
                      </Badge>
                    </AdminTd>

                    <AdminTd>
                      <Badge
                        variant={orderBadgeVariant(item.order_status)}
                        className="whitespace-nowrap"
                      >
                        {orderStatusLabel(item.order_status)}
                      </Badge>
                      <span className="mt-1 block break-words text-[11px] leading-snug text-sage-500">
                        {/* Hanya tampil bila berbeda dari badge status di atasnya.
                            Status 'out_for_delivery' juga berlabel "Diantar", jadi
                            menampilkannya lagi hanya mengulang kata yang sama. */}
                        {progressLabel(item.progress_status) === orderStatusLabel(item.order_status)
                          ? null
                          : progressLabel(item.progress_status)}
                      </span>
                      {orderNeedsAttention(item.flags) && (
                        <Badge variant="warning" className="mt-1 whitespace-nowrap">
                          Perlu dicek
                        </Badge>
                      )}
                    </AdminTd>

                    <AdminTd className="max-w-[170px]">
                      <span className="flex items-center gap-1.5 break-words text-[13px] font-medium leading-snug text-charcoal-900">
                        {item.delivery_option === 'delivery' ? (
                          <Truck aria-hidden className="h-3.5 w-3.5 shrink-0 text-sage-500" />
                        ) : null}
                        {deliveryLabel(item.delivery_option)}
                      </span>
                      <span className="mt-0.5 block break-words text-[11px] leading-snug text-sage-500">
                        {item.delivery_option === 'delivery' && item.courier_service_name
                          ? item.courier_service_name
                          : item.flags.has_shipment
                            ? (item.shipment_status ?? 'Pengiriman dibuat')
                            : 'Tanpa kurir'}
                      </span>
                    </AdminTd>

                    <AdminTdActions>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDetail(item);
                        }}
                        aria-label={`Lihat detail pesanan ${item.order_code ?? ''}`}
                      >
                        <Eye aria-hidden className="h-3.5 w-3.5" />
                        Detail
                      </Button>
                    </AdminTdActions>
                  </AdminTr>
                ))}
              </tbody>
            </AdminTableCard>

            {/* Kartu untuk layar kecil. */}
            <div className="space-y-3 md:hidden">
              {items.map((item) => (
                <Card key={`order-card-${item.id}`}>
                  <CardContent className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={orderBadgeVariant(item.order_status)}>
                        {orderStatusLabel(item.order_status)}
                      </Badge>
                      <Badge variant={paymentBadgeVariant(item.payment_status)}>
                        {paymentStatusLabel(item.payment_status)}
                      </Badge>
                      {orderNeedsAttention(item.flags) && <Badge variant="warning">Perlu dicek</Badge>}
                    </div>

                    <p className="mt-2 break-all font-mono text-xs font-semibold text-charcoal-900">
                      {item.order_code ?? '-'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-sage-500">
                      {formatTanggalWaktu(item.created_at)}
                    </p>

                    <p className="mt-2 break-words text-sm font-semibold leading-snug text-charcoal-900">
                      {namaProduk(item)}
                    </p>
                    <p className="mt-0.5 break-words text-xs text-sage-500">
                      {item.quantity !== null ? `${item.quantity}× · ` : ''}
                      {namaToko(item)}
                    </p>
                    <p className="mt-1 break-words text-xs text-sage-500">
                      Pembeli: {namaPembeli(item) || '-'}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-2 border-t border-border/70 pt-2.5">
                      <span className="text-sm font-bold tabular-nums text-charcoal-900">
                        {formatRupiah(item.total_price)}
                      </span>
                      <span className="text-xs text-sage-500">
                        {deliveryLabel(item.delivery_option)}
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => setDetail(item)}
                    >
                      <Eye aria-hidden className="h-3.5 w-3.5" />
                      Lihat detail
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <AdminPagination
            total={total}
            page={page}
            pageSize={PAGE_LIMIT}
            noun="pesanan"
            busy={refreshing}
            onPageChange={(next) => void load((next - 1) * PAGE_LIMIT, filters)}
          />
        </>
      )}

      <Dialog
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        {detail && (
          <DialogContent className="max-h-[90dvh] overflow-y-auto p-5 sm:max-w-2xl sm:p-6">
            <DialogHeader className="space-y-1 pr-10 text-left">
              <DialogDescription className="text-xs font-bold uppercase tracking-[0.16em] text-sage-500">
                Detail pesanan
              </DialogDescription>
              <DialogTitle className="mt-1 break-all font-mono text-base font-bold text-charcoal-900">
                {detail.order_code ?? '-'}
              </DialogTitle>
              <p className="text-xs text-sage-500">
                Dibuat {formatTanggalWaktu(detail.created_at)}
              </p>
            </DialogHeader>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge variant={paymentBadgeVariant(detail.payment_status)}>
                {paymentStatusLabel(detail.payment_status)}
              </Badge>
              <Badge variant={orderBadgeVariant(detail.order_status)}>
                {orderStatusLabel(detail.order_status)}
              </Badge>
              <Badge variant="secondary" className="font-medium">
                {lifecycleLabel(detail.lifecycle_status)}
              </Badge>
              {daftarFlag(detail).map((flag) => (
                <Badge key={flag.label} variant={flag.variant}>
                  {flag.label}
                </Badge>
              ))}
            </div>

            <div className="mt-5 space-y-5">
              <AdminDetailSection title="Produk">
                <div className="flex items-start gap-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius)] border border-border bg-sage-100/60">
                    <SmartImage
                      src={detail.product?.image_url ?? ''}
                      alt={namaProduk(detail)}
                      sizes="64px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold leading-snug text-charcoal-900">
                      {namaProduk(detail)}
                    </p>
                    <p className="mt-0.5 break-words text-xs text-sage-500">{namaToko(detail)}</p>
                    <p className="mt-1 text-xs text-charcoal-700">
                      {detail.quantity !== null ? `${detail.quantity} unit` : 'Jumlah tidak tercatat'}
                      {detail.unit_price !== null && (
                        <> · {formatRupiah(detail.unit_price)} / unit</>
                      )}
                    </p>
                  </div>
                </div>
              </AdminDetailSection>

              <AdminDetailSection title="Pembeli & toko">
                <AdminDetailGrid>
                  <AdminDetailField label="Nama pembeli">
                    {namaPembeli(detail) || '-'}
                  </AdminDetailField>
                  <AdminDetailField label="Email pembeli">
                    {detail.buyer?.email ?? '-'}
                  </AdminDetailField>
                  <AdminDetailField label="Toko">{namaToko(detail)}</AdminDetailField>
                  <AdminDetailField label="Slug toko" mono>
                    {detail.umkm?.slug ?? detail.vendor_slug ?? '-'}
                  </AdminDetailField>
                </AdminDetailGrid>
              </AdminDetailSection>

              {/* Rincian biaya: nominal rata kanan & angka tabular supaya
                  mudah dijumlahkan mata; total dipisah garis dan dipertebal. */}
              <AdminDetailSection
                title="Rincian biaya"
                description="Total = subtotal − diskon + biaya layanan + ongkir − koin."
              >
                <div className="space-y-1.5 rounded-[var(--radius)] bg-sage-100/40 p-3.5">
                  <BiayaRow label="Subtotal" nominal={formatRupiah(detail.subtotal)} />
                  {(detail.discount ?? 0) > 0 && (
                    <BiayaRow
                      label={detail.promo_code ? `Diskon (${detail.promo_code})` : 'Diskon'}
                      nominal={`−${formatRupiah(detail.discount)}`}
                    />
                  )}
                  <BiayaRow label="Biaya layanan" nominal={formatRupiah(detail.service_fee)} />
                  <BiayaRow
                    label={detail.delivery_option === 'delivery' ? 'Ongkos kirim' : 'Ongkos kirim (ambil sendiri)'}
                    nominal={formatRupiah(detail.delivery_fee)}
                  />
                  {(detail.coin_used ?? 0) > 0 && (
                    <BiayaRow label="Koin dipakai" nominal={`−${formatRupiah(detail.coin_used)}`} />
                  )}
                  <div className="mt-1.5 border-t border-border pt-2">
                    <BiayaRow label="Total dibayar" nominal={formatRupiah(detail.total_price)} strong />
                  </div>
                  {(detail.coin_earned ?? 0) > 0 && (
                    <BiayaRow
                      label="Koin didapat pembeli"
                      nominal={formatRupiah(detail.coin_earned)}
                      muted
                    />
                  )}
                </div>
              </AdminDetailSection>

              <AdminDetailSection title="Pembayaran">
                <AdminDetailGrid>
                  <AdminDetailField label="Status">
                    {paymentStatusLabel(detail.payment_status)}
                  </AdminDetailField>
                  <AdminDetailField label="Metode" mono>
                    {detail.payment_method_id ?? '-'}
                  </AdminDetailField>
                  <AdminDetailField label="ID invoice" mono className="sm:col-span-2">
                    {detail.xendit_invoice_id ?? '-'}
                  </AdminDetailField>
                </AdminDetailGrid>
              </AdminDetailSection>

              <AdminDetailSection title="Pengiriman">
                <AdminDetailGrid>
                  <AdminDetailField label="Opsi">
                    {deliveryLabel(detail.delivery_option)}
                  </AdminDetailField>
                  <AdminDetailField label="Status kirim">
                    {detail.shipment_status ??
                      (detail.flags.has_shipment ? 'Pengiriman dibuat' : 'Tanpa pengiriman')}
                  </AdminDetailField>
                  <AdminDetailField label="Kurir" mono>
                    {detail.courier_code ?? '-'}
                  </AdminDetailField>
                  <AdminDetailField label="Layanan">
                    {detail.courier_service_name ?? detail.courier_service_code ?? '-'}
                  </AdminDetailField>
                  <AdminDetailField label="Nomor tracking" mono>
                    {detail.biteship_tracking_id ?? '-'}
                  </AdminDetailField>
                  <AdminDetailField label="Nomor resi" mono>
                    {detail.biteship_waybill_id ?? '-'}
                  </AdminDetailField>
                  <AdminDetailField label="Jarak">
                    {detail.delivery_distance_km !== null
                      ? `${detail.delivery_distance_km} km`
                      : '-'}
                  </AdminDetailField>
                  <AdminDetailField label="Estimasi tiba">
                    {formatTanggalWaktu(detail.estimated_arrival_at)}
                  </AdminDetailField>
                </AdminDetailGrid>
                {detail.shipment_error && (
                  <p className="mt-3 flex items-start gap-2 rounded-[var(--radius)] border border-destructive/25 bg-destructive/[0.06] px-3 py-2 text-[13px] leading-relaxed text-charcoal-900">
                    <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <span className="min-w-0 break-words">
                      <span className="font-semibold">Galat pengiriman: </span>
                      {detail.shipment_error}
                    </span>
                  </p>
                )}
              </AdminDetailSection>

              <AdminDetailSection title="Alamat pengiriman">
                {(() => {
                  const baris = alamatFields(detail.address_snapshot ?? detail.delivery_address);
                  if (baris.length === 0) {
                    return (
                      <p className="text-sm text-sage-500">
                        Alamat tidak tercatat pada pesanan ini.
                      </p>
                    );
                  }
                  return (
                    <AdminDetailGrid>
                      {baris.map((row) => (
                        <AdminDetailField
                          key={row.label}
                          label={row.label}
                          className={row.label === 'Alamat' ? 'sm:col-span-2' : undefined}
                        >
                          {row.value}
                        </AdminDetailField>
                      ))}
                    </AdminDetailGrid>
                  );
                })()}
              </AdminDetailSection>

              <AdminDetailSection title="Waktu">
                <AdminDetailGrid>
                  <AdminDetailField label="Dibuat">
                    {formatTanggalWaktu(detail.created_at)}
                  </AdminDetailField>
                  <AdminDetailField label="Pengiriman dibuat">
                    {formatTanggalWaktu(detail.shipment_created_at)}
                  </AdminDetailField>
                  <AdminDetailField label="Mulai diantar">
                    {formatTanggalWaktu(detail.delivery_started_at)}
                  </AdminDetailField>
                  <AdminDetailField label="Selesai">
                    {formatTanggalWaktu(detail.completed_at)}
                  </AdminDetailField>
                </AdminDetailGrid>
              </AdminDetailSection>
            </div>

            {detail.order_status !== 'completed' && detail.order_status !== 'cancelled' ? (
              <p className="mt-4 flex items-start gap-2 rounded-[var(--radius)] bg-sage-100/50 px-3 py-2 text-xs leading-relaxed text-sage-500">
                <TriangleAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0">
                  Pesanan ini belum selesai. Halaman admin hanya menampilkan data; perubahan status
                  dilakukan oleh penjual atau lewat proses otomatis.
                </span>
              </p>
            ) : null}

            <p className="mt-3 text-center text-[11px] text-sage-500">
              Riwayat status dan transaksi dana tidak ditampilkan di sini karena akses admin ke tabel
              riwayat belum dibuka (menunggu audit keamanan lanjutan).
            </p>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setDetail(null)}>
                Tutup
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
