'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, RefreshCw } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  AdminProductsApiError,
  fetchAdminProducts,
  type AdminProductListItem,
} from '@/lib/admin-products';
import { useAdminRealtimeActivity } from '@/hooks/use-admin-realtime-activity';
import { useAdminPreferences } from '@/hooks/use-admin-preferences';
import { ProductDetailDrawer } from './product-detail-drawer';
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


  formatRupiah,
  formatTanggal,
  formatTanggalWaktu,
  labelStatusOperasional,
  labelVerifikasiProduk,
  varianVerifikasiProduk,
} from './admin-format';

import { redirectIfSessionExpired } from './admin-session';

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 400;

/**
 * Halaman admin "Produk".
 *
 * Menggantikan pola antrean-verifikasi lama. Karena produk baru langsung
 * `approved`, admin tidak lagi menunggu keputusan per produk; halaman ini
 * dipakai untuk MEMANTAU produk yang sudah live dan, bila ada masalah,
 * menunda / mengaktifkan kembali lewat drawer detail (yang menulis
 * moderation_logs sehingga pelaku, waktu, dan alasannya tercatat).
 *
 * Tidak ada status baru di sini: hanya membaca tiga nilai
 * verification_status yang sudah ada di database.
 */

const VERIFICATION_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua status moderasi' },
  { value: 'approved', label: 'Aktif (live)' },
  { value: 'rejected', label: 'Ditunda Admin' },
  { value: 'pending', label: 'Antrean lama' },
];

const OPERATIONAL_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua status operasional' },
  { value: 'available', label: 'Tersedia' },
  { value: 'sold_out', label: 'Stok habis' },
  { value: 'hidden', label: 'Disembunyikan' },
];

/**
 * Deep-link ke satu produk: `/dashboard/admin/produk?produk=<products.id>`.
 *
 * Dipakai lonceng notifikasi admin ketika ada produk baru / perubahan status.
 * Query string dibaca setelah mount lewat `window.location.search` (bukan
 * `useSearchParams()`) supaya halaman ini tetap bisa di-prerender saat build
 * tanpa perlu Suspense boundary.
 */
function readProductIdParam(): string {
  if (typeof window === 'undefined') return '';
  try {
    return new URLSearchParams(window.location.search).get('produk')?.trim() ?? '';
  } catch {
    return '';
  }
}

export function ProductsManagementView() {
  const router = useRouter();
  const [items, setItems] = useState<AdminProductListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [operationalStatus, setOperationalStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  // Pencarian (debounce) + filter dapat memicu beberapa request sekaligus.
  // Hanya respons dari request terbaru yang boleh menulis state.
  const requestIdRef = useRef(0);

  // Buka detail produk yang dituju dari lonceng notifikasi (?produk=<id>).
  useEffect(() => {
    const id = readProductIdParam();
    if (id) setSelectedProductId(id);
  }, []);

  const { realtimeActivity } = useAdminPreferences();
  const { newCount, reset: resetRealtime } = useAdminRealtimeActivity(
    realtimeActivity && status === 'ready'
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    async (nextOffset: number) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setStatus('loading');
      setErrorMsg('');
      try {
        const result = await fetchAdminProducts(PAGE_LIMIT, nextOffset, {
          verificationStatus: verificationStatus || undefined,
          status: operationalStatus || undefined,
          q: debouncedSearch || undefined,
        });
        if (requestId !== requestIdRef.current) return;
        setItems(result.products);
        setTotal(result.total);
        setOffset(result.offset);
        setStatus('ready');
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        if (await redirectIfSessionExpired((err as { status?: number })?.status ?? 0, router, () => {
            setErrorMsg('Tidak dapat menghubungi server data. Coba lagi.');
            setStatus('error');
          })) return;
        // Refresh berhasil: request ini tetap gagal, jadi tampilkan error +
        // tombol coba lagi — jangan biarkan status 'loading' menggantung.
        if (requestId !== requestIdRef.current) return;
        if (err instanceof AdminProductsApiError && err.status === 403) {
          setStatus('forbidden');
          return;
        }
        setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat daftar produk.');
        setStatus('error');
      }
    },
    [router, verificationStatus, operationalStatus, debouncedSearch]
  );

  useEffect(() => {
    load(0);
  }, [load]);

  return (
    <div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader
        eyebrow="Admin · Kelola"
        title="Produk"
        description="Semua produk UMKM. Produk baru langsung aktif; admin dapat menunda atau mengaktifkan kembali."
        backHref="/dashboard/admin"
        backLabel="Dashboard Admin"
        actions={
          <>
            <Badge variant="secondary" className="px-3 py-1.5 text-xs font-bold">
              {total} produk
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                resetRealtime();
                load(offset);
              }}
              disabled={status === 'loading'}
            >
              <RefreshCw aria-hidden className="mr-1.5 h-3.5 w-3.5" />
              Muat ulang
            </Button>
          </>
        }
      />

      {newCount > 0 && status === 'ready' && (
        <button
          type="button"
          onClick={() => {
            resetRealtime();
            load(0);
          }}
          className="mb-4 inline-flex items-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {newCount} perubahan terbaru — muat untuk melihat
        </button>
      )}

      <AdminToolbar>
        <AdminSearchInput
          value={search}
          onChange={setSearch}
          label="Cari produk"
          placeholder="Cari nama atau kategori produk…"
        />
        <AdminSelect
          value={verificationStatus}
          onChange={setVerificationStatus}
          label="Status moderasi"
          options={VERIFICATION_OPTIONS}
        />
        <AdminSelect
          value={operationalStatus}
          onChange={setOperationalStatus}
          label="Status operasional"
          options={OPERATIONAL_OPTIONS}
        />
      </AdminToolbar>

      {status === 'loading' && <AdminLoadingState label="Memuat daftar produk" />}

      {status === 'forbidden' && (
        <AdminForbiddenState message="Halaman ini hanya untuk admin. Akun kamu tidak memiliki hak melihat daftar produk." />
      )}

      {status === 'error' && (
        <AdminErrorState
          title="Gagal memuat daftar produk"
          message={errorMsg}
          onRetry={() => load(offset)}
        />
      )}

      {status === 'ready' && items.length === 0 && (
        <AdminEmptyState
          icon={<Package aria-hidden className="h-10 w-10 text-primary" />}
          title="Tidak ada produk"
          description="Tidak ada produk yang cocok dengan filter saat ini."
        />
      )}

      {status === 'ready' && items.length > 0 && (
        <>
          <AdminTableCard label="Daftar produk" minWidth={820} className="hidden sm:block">
            <AdminTableHead>
              <AdminTh>Produk</AdminTh>
              <AdminTh>Harga</AdminTh>
              <AdminTh className="text-right">Stok</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Dibuat</AdminTh>
              <AdminTh className="text-right">Aksi</AdminTh>
            </AdminTableHead>
            <tbody>
              {items.map((item) => (
                <AdminTr key={item.id}>
                  <AdminTd className="max-w-[300px]">
                    <p className="break-words text-[13px] font-semibold leading-snug text-charcoal-900" title={item.name}>
                      {item.name}
                    </p>
                    {/* Toko + kategori dulu punya kolom sendiri. Digabung ke
                        sini karena keduanya ringkas dan kolom terpisah
                        membuat tabel melebar sampai harus digulir. */}
                    <p className="mt-0.5 break-words text-[11px] leading-snug text-sage-500">
                      {item.store?.businessName ?? 'Toko tidak diketahui'}
                      {item.category ? ` · ${item.category}` : ''}
                    </p>
                    {item.store?.city && (
                      <p className="mt-0.5 text-[11px] leading-snug text-sage-500">
                        {item.store.city}
                      </p>
                    )}
                  </AdminTd>
                  <AdminTd className="whitespace-nowrap">
                    <span className="block text-[13px] font-semibold tabular-nums text-charcoal-900">
                      {formatRupiah(item.surplusPrice)}
                    </span>
                    {item.originalPrice != null && (
                      <span className="block text-[11px] tabular-nums text-sage-500 line-through">
                        {formatRupiah(item.originalPrice)}
                      </span>
                    )}
                  </AdminTd>
                  <AdminTd className="whitespace-nowrap text-right text-[13px] font-medium tabular-nums text-charcoal-900">
                    {item.stock ?? '-'}
                  </AdminTd>
                  <AdminTd className="max-w-[220px]">
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant={varianVerifikasiProduk(item.verificationStatus)}>
                        {labelVerifikasiProduk(item.verificationStatus)}
                      </Badge>
                      <Badge variant="secondary">{labelStatusOperasional(item.status)}</Badge>
                    </div>
                    {item.verificationStatus === 'rejected' && item.rejectionReason && (
                      <p
                        className="mt-1 line-clamp-2 break-words text-[11px] leading-snug text-sage-500"
                        title={item.rejectionReason}
                      >
                        {item.rejectionReason}
                      </p>
                    )}
                  </AdminTd>
                  <AdminTd className="whitespace-nowrap text-xs text-sage-500">
                    {formatTanggal(item.createdAt)}
                  </AdminTd>
                  <AdminTdActions>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedProductId(item.id)}
                    >
                      Kelola
                    </Button>
                  </AdminTdActions>
                </AdminTr>
              ))}
            </tbody>
          </AdminTableCard>

          <div className="space-y-3 sm:hidden">
            {items.map((item) => (
              <Card key={item.id}>
                <CardContent className="px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-charcoal-900">{item.name}</p>
                      <p className="truncate text-xs text-sage-500">
                        {item.store?.businessName ?? '-'}
                      </p>
                    </div>
                    <Badge
                      variant={varianVerifikasiProduk(item.verificationStatus)}
                      className="shrink-0"
                    >
                      {labelVerifikasiProduk(item.verificationStatus)}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sage-500">
                    <span className="font-semibold text-primary">
                      {formatRupiah(item.surplusPrice)}
                    </span>
                    <span>Stok {item.stock ?? '-'}</span>
                    <span>{labelStatusOperasional(item.status)}</span>
                    <span>{formatTanggalWaktu(item.createdAt)}</span>
                  </div>
                  {item.verificationStatus === 'rejected' && item.rejectionReason && (
                    <p className="mt-2 break-words rounded-[var(--radius)] bg-destructive/5 px-3 py-2 text-xs text-charcoal-700">
                      <span className="font-bold">Alasan: </span>
                      {item.rejectionReason}
                    </p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => setSelectedProductId(item.id)}
                  >
                    Kelola produk
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <AdminPagination
            total={total}
            page={Math.floor(offset / PAGE_LIMIT) + 1}
            pageSize={PAGE_LIMIT}
            noun="produk"
            onPageChange={(next) => load((next - 1) * PAGE_LIMIT)}
          />
        </>
      )}

      <ProductDetailDrawer
        productId={selectedProductId}
        onClose={() => setSelectedProductId(null)}
        onChanged={() => load(offset)}
      />
    </div>
  );
}