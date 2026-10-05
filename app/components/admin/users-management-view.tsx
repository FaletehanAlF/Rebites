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
  Users,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  AdminUsersApiError,
  fetchAdminUsers,
  type AdminSellerStatus,
  type AdminUserItem,
} from '@/lib/admin-users';

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 400;

const SELLER_FILTER_OPTIONS: { value: '' | AdminSellerStatus; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'active', label: 'Seller aktif' },
  { value: 'no_subscription', label: 'Langganan tidak aktif' },
  { value: 'no_store', label: 'Belum punya toko' },
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

function roleBadgeVariant(role: string | null): 'default' | 'secondary' | 'success' {
  if (role === 'admin') return 'default';
  if (role === 'umkm') return 'success';
  return 'secondary';
}

function roleLabel(role: string | null): string {
  if (role === 'admin') return 'Admin';
  if (role === 'umkm') return 'UMKM';
  if (role === 'buyer') return 'Buyer';
  return role ?? '-';
}

function sellerStatusBadgeVariant(
  status: AdminSellerStatus | null | undefined
): 'success' | 'warning' | 'secondary' {
  if (status === 'active') return 'success';
  if (status === 'no_subscription') return 'warning';
  return 'secondary';
}

function sellerStatusLabel(status: AdminSellerStatus | null | undefined): string {
  if (status === 'active') return 'Aktif';
  if (status === 'no_subscription') return 'Langganan tidak aktif';
  return 'Belum punya toko';
}

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

  const load = useCallback(
    async (nextOffset: number, nextSearch: string, nextSeller: '' | AdminSellerStatus) => {
      setStatus('loading');
      setErrorMsg('');
      try {
        const result = await fetchAdminUsers(PAGE_LIMIT, nextOffset, nextSearch, nextSeller);
        setItems(result.users);
        setTotal(result.total);
        setOffset(result.offset);
        setStatus('ready');
      } catch (err) {
        if (err instanceof AdminUsersApiError && err.status === 401) {
          router.replace('/auth/login');
          return;
        }
        if (err instanceof AdminUsersApiError && err.status === 403) {
          setStatus('forbidden');
          return;
        }
        setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat daftar pengguna.');
        setStatus('error');
      }
    },
    [router]
  );

  useEffect(() => {
    load(0, search, sellerFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sellerFilter]);

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
            Admin · Pengguna
          </p>
          <h1 className="mt-1 font-display text-[clamp(1.6rem,3.5vw,2.4rem)] font-semibold tracking-tight text-primary">
            Manajemen Pengguna
          </h1>
          <p className="mt-1 text-sm text-sage-500">
            Pantau pengguna terdaftar beserta peran dan status tokonya.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1.5 text-xs font-bold">
            {total} Pengguna
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => load(offset, search, sellerFilter)}
            disabled={status === 'loading'}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Muat ulang
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border/70 bg-white px-3 py-2 focus-within:border-primary">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSearch(searchInput.trim());
            }}
            placeholder="Cari email atau nama..."
            aria-label="Cari pengguna"
            className="w-full bg-transparent py-1 text-sm text-charcoal-900 outline-none placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={sellerFilter}
          onChange={(e) => setSellerFilter(e.target.value as '' | AdminSellerStatus)}
          aria-label="Filter status seller"
          className="appearance-none rounded-xl border border-border/70 bg-white px-3 py-2.5 text-sm font-medium text-charcoal-900 outline-none focus:border-primary"
        >
          {SELLER_FILTER_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
              Halaman ini hanya untuk admin. Akun kamu tidak memiliki hak mengelola pengguna.
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
            <h2 className="mt-4 font-display text-xl font-semibold text-primary">Gagal memuat pengguna</h2>
            <p className="mt-1 max-w-sm text-sm text-sage-500">{errorMsg}</p>
            <Button type="button" size="sm" className="mt-5" onClick={() => load(offset, search, sellerFilter)}>
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      )}

      {status === 'ready' && items.length === 0 && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <Users className="h-10 w-10 text-primary" />
            <h2 className="mt-4 font-display text-xl font-semibold text-primary">
              {search ? 'Pengguna tidak ditemukan' : 'Belum ada pengguna'}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-sage-500">
              {search
                ? `Tidak ada pengguna yang cocok dengan "${search}".`
                : 'Pengguna yang terdaftar akan muncul di sini.'}
            </p>
          </CardContent>
        </Card>
      )}

      {status === 'ready' && items.length > 0 && (
        <>
          <Card className="mt-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-cream-50 text-[11px] uppercase tracking-wider text-sage-500">
                    <th className="px-4 py-3 font-bold">Nama</th>
                    <th className="px-4 py-3 font-bold">Email</th>
                    <th className="px-4 py-3 font-bold">Role</th>
                    <th className="px-4 py-3 font-bold">Status Seller</th>
                    <th className="px-4 py-3 font-bold">Terdaftar</th>
                  </tr>
                </thead>
                <tbody>
            {items.map((item, index) => (
              <tr
                key={item.id ?? item.email ?? `user-row-${index}`}
                      className="border-b border-border/50 last:border-0 hover:bg-cream-50/60"
                    >
                      <td className="max-w-[180px] truncate px-4 py-3 font-semibold text-charcoal-900">
                        {item.id ? (
                          <Link
                            href={`/dashboard/admin/pengguna/${item.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {item.full_name?.trim() || item.email || '-'}
                          </Link>
                        ) : (
                          item.full_name?.trim() || '-'
                        )}
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-charcoal-900">
                        {item.email ?? '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge variant={roleBadgeVariant(item.role)}>
                          {roleLabel(item.role)}
                        </Badge>
                      </td>
                      <td className="max-w-[220px] px-4 py-3">
                        <Badge variant={sellerStatusBadgeVariant(item.seller_status)}>
                          {sellerStatusLabel(item.seller_status)}
                        </Badge>
                        {item.seller?.business_name && (
                          <span className="mt-1 block truncate text-xs font-medium text-charcoal-900">
                            {item.seller.business_name}
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
              Menampilkan {showingFrom}–{showingTo} dari {total} pengguna
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasPrev}
                onClick={() => load(Math.max(0, offset - PAGE_LIMIT), search, sellerFilter)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Sebelumnya
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => load(offset + PAGE_LIMIT, search, sellerFilter)}
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
