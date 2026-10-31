'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChevronRight, RefreshCw, Store, Users } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  AdminPageHeader,
  ADMIN_PAGE_WRAPPER,
  ADMIN_BACK_LABEL,
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
  AdminTh,
  AdminTr,
} from './admin-table';
import {
  formatTanggal,
  labelPeran,
  labelStatusPenjual,
  varianPeran,
  varianStatusPenjual,
} from './admin-format';
import {
  AdminUsersApiError,
  fetchAdminUsers,
  type AdminSellerStatus,
  type AdminUserItem,
} from '@/lib/admin-users';

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 400;
/** Lama pesan "daftar diperbarui" tampil sebelum hilang sendiri. */
const REFRESH_NOTE_MS = 4000;

/** Hasil satu putaran pemuatan; dipakai untuk feedback tombol Muat ulang. */
type LoadOutcome = 'ok' | 'error' | 'forbidden' | 'unauthorized' | 'stale';

const SELLER_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua status' },
  { value: 'active', label: 'Seller aktif' },
  { value: 'no_subscription', label: 'Langganan tidak aktif' },
  { value: 'no_store', label: 'Belum punya toko' },
];

export function UsersManagementView() {
  const router = useRouter();
  const [items, setItems] = useState<AdminUserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sellerFilter, setSellerFilter] = useState<'' | AdminSellerStatus>('');
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  // Pencarian (debounce) + filter memicu beberapa request sekaligus. Hanya
  // respons dari request terbaru yang boleh menulis state; respons lama yang
  // datang terlambat tidak boleh menimpa hasil yang sudah tampil.
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (
      nextOffset: number,
      nextSearch: string,
      nextSeller: '' | AdminSellerStatus
    ): Promise<LoadOutcome> => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setStatus('loading');
      setErrorMsg('');
      try {
        const result = await fetchAdminUsers(PAGE_LIMIT, nextOffset, nextSearch, nextSeller);
        if (requestId !== requestIdRef.current) return 'stale';
        setItems(result.users);
        setTotal(result.total);
        setOffset(result.offset);
        setStatus('ready');
        return 'ok';
      } catch (err) {
        if (requestId !== requestIdRef.current) return 'stale';
        if (err instanceof AdminUsersApiError && err.status === 401) {
          router.replace('/auth/login');
          return 'unauthorized';
        }
        if (err instanceof AdminUsersApiError && err.status === 403) {
          setStatus('forbidden');
          return 'forbidden';
        }
        setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat daftar pengguna.');
        setStatus('error');
        return 'error';
      }
    },
    [router]
  );

  useEffect(() => {
    setRefreshNote(null);
    void load(0, search, sellerFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sellerFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch((prev) => (prev === searchInput.trim() ? prev : searchInput.trim()));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Feedback tombol Muat ulang: hanya muncul bila pemuatan benar-benar sukses.
  useEffect(() => {
    if (!refreshNote) return;
    const timer = setTimeout(() => setRefreshNote(null), REFRESH_NOTE_MS);
    return () => clearTimeout(timer);
  }, [refreshNote]);

  const handleReload = useCallback(async () => {
    setRefreshNote(null);
    const outcome = await load(offset, search, sellerFilter);
    if (outcome === 'ok') setRefreshNote('Daftar pengguna diperbarui.');
  }, [load, offset, search, sellerFilter]);

  const resetFilters = useCallback(() => {
    setSearchInput('');
    setSearch('');
    setSellerFilter('');
  }, []);

  const page = Math.floor(offset / PAGE_LIMIT) + 1;
  const hasActiveFilter = search.trim() !== '' || sellerFilter !== '';

  return (
    <div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader
        eyebrow="Admin · Pengguna"
        title="Manajemen Pengguna"
        description="Pantau pengguna terdaftar beserta peran dan status tokonya."
        backHref="/dashboard/admin"
        backLabel={ADMIN_BACK_LABEL}
        actions={
          <>
            <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
              {total} pengguna
            </Badge>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleReload()}
              disabled={status === 'loading'}
            >
              <RefreshCw aria-hidden className="h-4 w-4" />
              Muat ulang
            </Button>
          </>
        }
      />

      <AdminToolbar className="mb-6">
        <AdminSearchInput
          value={searchInput}
          onChange={setSearchInput}
          label="Cari pengguna"
          labelVisible
          placeholder="Cari nama atau email…"
        />
        <AdminSelect
          value={sellerFilter}
          onChange={(value) => setSellerFilter(value as '' | AdminSellerStatus)}
          label="Status penjual"
          options={SELLER_FILTER_OPTIONS}
        />
      </AdminToolbar>

      {refreshNote && (
        <p
          role="status"
          className="mb-6 flex items-center gap-1.5 text-xs font-semibold text-success"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0" />
          {refreshNote}
        </p>
      )}

      {status === 'loading' && <AdminLoadingState label="Memuat daftar pengguna" />}

      {status === 'forbidden' && (
        <AdminForbiddenState message="Akun kamu tidak memiliki hak mengelola pengguna." />
      )}

      {status === 'error' && (
        <AdminErrorState
          title="Gagal memuat pengguna"
          message={errorMsg}
          onRetry={() => void load(offset, search, sellerFilter)}
        />
      )}

      {status === 'ready' && items.length === 0 && (
        <AdminEmptyState
          icon={<Users aria-hidden className="h-10 w-10 text-primary" />}
          title={hasActiveFilter ? 'Tidak ada pengguna yang cocok' : 'Belum ada pengguna'}
          description={
            hasActiveFilter
              ? 'Tidak ada pengguna yang cocok dengan pencarian atau status penjual yang dipilih.'
              : 'Pengguna yang terdaftar akan muncul di sini.'
          }
          action={
            hasActiveFilter ? (
              <Button type="button" variant="outline" onClick={resetFilters}>
                <RefreshCw aria-hidden className="h-4 w-4" />
                Atur ulang filter
              </Button>
            ) : undefined
          }
        />
      )}

      {status === 'ready' && items.length > 0 && (
        <>
          <AdminTableCard label="Daftar pengguna" minWidth={720} className="hidden md:block">
            <AdminTableHead>
              <AdminTh>Nama</AdminTh>
              <AdminTh>Email</AdminTh>
              <AdminTh>Peran</AdminTh>
              <AdminTh>Status Penjual</AdminTh>
              <AdminTh>Terdaftar</AdminTh>
            </AdminTableHead>
            <tbody>
              {items.map((item, index) => {
                const nama = item.full_name?.trim() || item.email || '-';
                const href = item.id ? `/dashboard/admin/pengguna/${item.id}` : null;
                return (
                  <AdminTr
                    key={item.id ?? item.email ?? `user-row-${index}`}
                    className={cn(
                      href &&
                        'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40'
                    )}
                    {...(href
                      ? {
                          tabIndex: 0,
                          role: 'link' as const,
                          'aria-label': `Buka detail pengguna ${nama}`,
                          onClick: () => router.push(href),
                          onKeyDown: (e: React.KeyboardEvent<HTMLTableRowElement>) => {
                            if (e.target !== e.currentTarget) return;
                            if (e.key !== 'Enter' && e.key !== ' ') return;
                            e.preventDefault();
                            router.push(href);
                          },
                        }
                      : {})}
                  >
                    {/* Nama tampil sebagai teks biasa, bukan <Link>: seluruh
                        baris sudah menjadi tautan. Tautan di dalam baris
                        yang juga bertautan membuat klik ganda dan fokus
                        keyboard yang membingungkan. */}
                    <AdminTd className="max-w-[200px] font-medium text-charcoal-900">
                      <span className="block truncate" title={nama}>
                        {nama}
                      </span>
                    </AdminTd>
                    <AdminTd
                      className="max-w-[220px] truncate"
                      title={item.email ?? undefined}
                    >
                      {item.email ?? '-'}
                    </AdminTd>
                    <AdminTd className="whitespace-nowrap">
                      {/* Super Admin memakai SATU badge, bukan dua.
                          Sebelumnya akun Super Admin menampilkan badge "Admin"
                          DAN badge kuning "Super Admin" berdampingan —
                          informasi yang sama dua kali dengan warna berbeda,
                          sehingga tidak jelas mana yang mengikat. Kini satu
                          badge hijau bertuliskan "Super Admin". */}
                      {item.is_super_admin ? (
                        <Badge variant="success">Super Admin</Badge>
                      ) : (
                        <Badge variant={varianPeran(item.role)}>{labelPeran(item.role)}</Badge>
                      )}
                    </AdminTd>
                    <AdminTd className="max-w-[220px]">
                      <Badge variant={varianStatusPenjual(item.seller_status)}>
                        {labelStatusPenjual(item.seller_status)}
                      </Badge>
                      {item.seller?.business_name && (
                        <span
                          className="mt-1 block truncate text-xs font-medium text-charcoal-900"
                          title={item.seller.business_name}
                        >
                          {item.seller.business_name}
                        </span>
                      )}
                    </AdminTd>
                    <AdminTd className="whitespace-nowrap text-xs text-sage-500">
                      {formatTanggal(item.created_at)}
                    </AdminTd>
                  </AdminTr>
                );
              })}
            </tbody>
          </AdminTableCard>

          <div className="space-y-3 md:hidden">
            {items.map((item, index) => {
              const nama = item.full_name?.trim() || item.email || '-';
              const href = item.id ? `/dashboard/admin/pengguna/${item.id}` : null;
              const body = (
                <CardContent className="px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Satu badge untuk Super Admin (hijau), sama seperti
                        tabel desktop — bukan dua badge bersebelahan. */}
                    {item.is_super_admin ? (
                      <Badge variant="success">Super Admin</Badge>
                    ) : (
                      <Badge variant={varianPeran(item.role)}>{labelPeran(item.role)}</Badge>
                    )}
                    <Badge variant={varianStatusPenjual(item.seller_status)}>
                      {labelStatusPenjual(item.seller_status)}
                    </Badge>
                  </div>
                  {/* Nama jadi teks biasa karena SELURUH kartu sekarang
                      tautan — sebelumnya hanya nama yang bisa diketuk,
                      sehingga area ketuk sangat kecil di layar sentuh. */}
                  <p className="mt-2 truncate text-sm font-semibold text-charcoal-900" title={nama}>
                    {nama}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-sage-500" title={item.email ?? undefined}>
                    {item.email ?? '-'}
                  </p>
                  {item.seller?.business_name && (
                    <p className="mt-1 flex items-center gap-1.5 truncate text-xs font-medium text-charcoal-700">
                      <Store aria-hidden className="h-3.5 w-3.5 shrink-0 text-sage-500" />
                      {item.seller.business_name}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="text-xs text-sage-500">
                      Terdaftar {formatTanggal(item.created_at)}
                    </p>
                    {href && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                        Detail
                        <ChevronRight aria-hidden className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                </CardContent>
              );

              return href ? (
                <Link
                  key={item.id ?? `user-card-${index}`}
                  href={href}
                  aria-label={`Buka detail pengguna ${nama}`}
                  className="block rounded-xl transition-shadow hover:shadow-admin-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                >
                  <Card>{body}</Card>
                </Link>
              ) : (
                <Card key={item.email ?? `user-card-${index}`}>{body}</Card>
              );
            })}
          </div>

          <AdminPagination
            total={total}
            page={page}
            pageSize={PAGE_LIMIT}
            noun="pengguna"
            className="mt-6"
            onPageChange={(next) => void load((next - 1) * PAGE_LIMIT, search, sellerFilter)}
          />
        </>
      )}
    </div>
  );
}