'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldAlert,
  Store,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import { SmartImage } from '@/app/components/shared/SmartImage';
import {
  AdminUmkmApiError,
  fetchAdminUmkm,
  type AdminUmkmItem,
} from '@/lib/admin-umkm';

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 400;

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

export function UmkmManagementView() {
  const router = useRouter();
  const [items, setItems] = useState<AdminUmkmItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(
    async (nextOffset: number, nextSearch: string) => {
      setStatus('loading');
      setErrorMsg('');
      try {
        const result = await fetchAdminUmkm(PAGE_LIMIT, nextOffset, nextSearch);
        setItems(result.umkm);
        setTotal(result.total);
        setOffset(result.offset);
        setStatus('ready');
      } catch (err) {
        if (err instanceof AdminUmkmApiError && err.status === 401) {
          router.replace('/auth/login');
          return;
        }
        if (err instanceof AdminUmkmApiError && err.status === 403) {
          setStatus('forbidden');
          return;
        }
        setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat daftar UMKM.');
        setStatus('error');
      }
    },
    [router]
  );

  useEffect(() => {
    load(0, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

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
            Admin · UMKM
          </p>
          <h1 className="mt-1 font-display text-[clamp(1.6rem,3.5vw,2.4rem)] font-semibold tracking-tight text-primary">
            Manajemen UMKM
          </h1>
          <p className="mt-1 text-sm text-sage-500">
            Kelola dan pantau toko UMKM yang terdaftar di ReBites.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1.5 text-xs font-bold">
            {total} UMKM
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => load(offset, search)}
            disabled={status === 'loading'}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Muat ulang
          </Button>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-xl border border-border/70 bg-white px-3 py-2 focus-within:border-primary">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setSearch(searchInput.trim());
          }}
          placeholder="Search UMKM..."
          aria-label="Search UMKM"
          className="w-full bg-transparent py-1 text-sm text-charcoal-900 outline-none placeholder:text-muted-foreground"
        />
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
              Halaman ini hanya untuk admin. Akun kamu tidak memiliki hak mengelola UMKM.
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
            <h2 className="mt-4 font-display text-xl font-semibold text-primary">Gagal memuat UMKM</h2>
            <p className="mt-1 max-w-sm text-sm text-sage-500">{errorMsg}</p>
            <Button type="button" size="sm" className="mt-5" onClick={() => load(offset, search)}>
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      )}

      {status === 'ready' && items.length === 0 && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <Store className="h-10 w-10 text-primary" />
            <h2 className="mt-4 font-display text-xl font-semibold text-primary">
              {search ? 'UMKM tidak ditemukan' : 'Belum ada UMKM'}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-sage-500">
              {search
                ? `Tidak ada UMKM yang cocok dengan "${search}".`
                : 'Toko UMKM yang terdaftar akan muncul di sini.'}
            </p>
          </CardContent>
        </Card>
      )}

      {status === 'ready' && items.length > 0 && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
                  <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl bg-cream-100 sm:h-20 sm:w-20">
                    <SmartImage
                      src={item.logo_url ?? ''}
                      alt={item.business_name}
                      sizes="(max-width: 640px) 100vw, 80px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={item.is_verified ? 'success' : 'secondary'}>
                        {item.is_verified ? (
                          <BadgeCheck className="h-3 w-3" />
                        ) : null}
                        {item.is_verified ? 'Terverifikasi' : 'Belum Terverifikasi'}
                      </Badge>
                      {item.is_open !== null && (
                        <Badge variant="outline">
                          {item.is_open ? 'Buka' : 'Tutup'}
                        </Badge>
                      )}
                      {item.category && (
                        <span className="text-[11px] text-sage-500">{item.category}</span>
                      )}
                    </div>
                    <h2 className="mt-2 break-words font-sans text-base font-bold leading-snug text-charcoal-900">
                      {item.business_name}
                    </h2>
                    <p className="mt-1 truncate text-[12px] text-sage-500">
                      {item.city ?? 'Kota belum tersedia'} · Pemilik:{' '}
                      {item.owner?.full_name ?? item.owner?.email ?? 'Tidak diketahui'}
                    </p>
                    <p className="mt-1 text-[12px] text-sage-500">
                      Paket: {item.subscription?.plan?.name ?? 'Belum ada'} ·{' '}
                      {item.product_count} produk · Bergabung {formatDate(item.created_at)}
                    </p>
                  </div>
                  <div className="shrink-0 sm:self-center">
                    <Link href={`/dashboard/admin/umkm/${item.id}`}>
                      <Button type="button" variant="outline" size="sm">
                        Detail
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-sage-500">
              Menampilkan {showingFrom}–{showingTo} dari {total} UMKM
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasPrev}
                onClick={() => load(Math.max(0, offset - PAGE_LIMIT), search)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Sebelumnya
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => load(offset + PAGE_LIMIT, search)}
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
