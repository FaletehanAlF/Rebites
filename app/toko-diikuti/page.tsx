'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Loader2,
  Star,
  Store,
  UserCheck,
  UserMinus,
  Search,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RequireAuth } from '@/app/components/auth/require-auth';
import { BuyerShell } from '@/app/components/shared/buyer-shell';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { Skeleton } from '@/app/components/ui/skeleton';
import {
  STORE_FOLLOW_UPDATED_EVENT,
  getFollowedStores,
  setFollowingStore,
  type FollowedStore,
} from '@/lib/store-follows';
import { useCatalog } from '@/lib/catalog';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white';

type LoadStatus = 'loading' | 'ready' | 'error';

function StoreAvatar({
  name,
  logoUrl,
  size = 'md',
}: {
  name: string;
  logoUrl: string | null;
  size?: 'md' | 'sm';
}) {
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted ring-1 ring-border',
        size === 'md' ? 'h-14 w-14' : 'h-12 w-12'
      )}
    >
      {logoUrl ? (
        <SmartImage src={logoUrl} alt={`Logo ${name}`} sizes="56px" />
      ) : (
        <span className="font-display text-lg font-semibold text-primary">
          {(name || '?').charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  const value = Number.isFinite(rating) ? rating : 0;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-foreground"
      aria-label={`Rating ${value.toFixed(1)} dari 5`}
    >
      <Star className="h-3 w-3 fill-primary text-primary" aria-hidden />
      {value.toFixed(1)}
    </span>
  );
}

function FollowedStoreCard({
  store,
  onUnfollow,
  unfollowingKey,
}: {
  store: FollowedStore;
  onUnfollow: (store: FollowedStore) => void;
  unfollowingKey: string | null;
}) {
  const key = store.slug ?? store.umkmId;
  const busy = unfollowingKey === key;

  return (
    <li className="h-full">
      <article className="flex h-full flex-col rounded-3xl border border-border bg-white p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-[0_12px_32px_-20px_rgba(30,42,34,0.35)]">
        <div className="flex items-start gap-4">
          <StoreAvatar name={store.name} logoUrl={store.logoUrl} />
          <div className="min-w-0 flex-1">
            <h2 className="break-words font-display text-base font-semibold leading-snug text-foreground">
              <Link
                href={`/detail/toko?id=${key}`}
                className={cn('transition-colors hover:text-primary', FOCUS_RING)}
              >
                {store.name}
              </Link>
            </h2>
            <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
              {store.category?.trim() || 'UMKM ReBites'}
            </p>
          </div>
          <RatingBadge rating={store.rating} />
        </div>

        <div className="mt-5 flex items-center gap-2">
          <Link
            href={`/detail/toko?id=${key}`}
            className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            Lihat Toko
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => onUnfollow(store)}
            disabled={busy}
            aria-label={`Berhenti mengikuti ${store.name}`}
            className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-border px-4 text-xs font-semibold text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <UserMinus className="h-3.5 w-3.5" aria-hidden />
            )}
            {busy ? 'Memproses' : 'Berhenti'}
          </button>
        </div>
      </article>
    </li>
  );
}

function RecommendationCard({
  vendor,
  onFollow,
  busy,
}: {
  vendor: { id: string; name: string; image: string; category: string; rating: number };
  onFollow: (id: string) => void;
  busy: boolean;
}) {
  return (
    <li className="h-full">
      <article className="flex h-full flex-col rounded-3xl border border-border bg-white p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-[0_12px_32px_-20px_rgba(30,42,34,0.35)]">
        <div className="flex items-start gap-4">
          <StoreAvatar name={vendor.name} logoUrl={vendor.image || null} size="sm" />
          <div className="min-w-0 flex-1">
            <h3 className="break-words font-display text-sm font-semibold leading-snug text-foreground">
              <Link
                href={`/detail/toko?id=${vendor.id}`}
                className={cn('transition-colors hover:text-primary', FOCUS_RING)}
              >
                {vendor.name}
              </Link>
            </h3>
            <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
              {vendor.category}
            </p>
          </div>
          <RatingBadge rating={vendor.rating} />
        </div>

        <button
          type="button"
          onClick={() => onFollow(vendor.id)}
          disabled={busy}
          aria-label={`Ikuti ${vendor.name}`}
          className="mt-5 inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-full border border-primary px-4 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <UserCheck className="h-3.5 w-3.5" aria-hidden />
          )}
          {busy ? 'Memproses' : 'Ikuti'}
        </button>
      </article>
    </li>
  );
}

function TokoDiikutiView() {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [stores, setStores] = useState<FollowedStore[]>([]);
  const [query, setQuery] = useState('');
  const [loadError, setLoadError] = useState('');
  const [unfollowingKey, setUnfollowingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const { vendors, loading: vendorsLoading } = useCatalog();

  const load = useCallback(async () => {
    setStatus('loading');
    setLoadError('');
    try {
      const list = await getFollowedStores();
      setStores(list);
      setStatus('ready');
    } catch (err) {
      setLoadError(
        err instanceof Error && err.message
          ? err.message
          : 'Tidak dapat memuat daftar toko. Periksa koneksi lalu coba lagi.'
      );
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onFollowUpdate = () => void load();
    window.addEventListener(STORE_FOLLOW_UPDATED_EVENT, onFollowUpdate);
    return () => {
      window.removeEventListener(STORE_FOLLOW_UPDATED_EVENT, onFollowUpdate);
    };
  }, [load]);

  const handleUnfollow = async (store: FollowedStore) => {
    const key = store.slug ?? store.umkmId;
    setUnfollowingKey(key);
    setActionError('');
    try {
      const ok = await setFollowingStore(key, false);
      if (!ok) {
        setActionError('Gagal berhenti mengikuti toko. Coba lagi.');
      } else {
        setStores((prev) => prev.filter((s) => s !== store));
      }
    } catch {
      setActionError('Gagal berhenti mengikuti toko. Coba lagi.');
    } finally {
      setUnfollowingKey(null);
    }
  };

  const handleFollow = async (storeId: string) => {
    setUnfollowingKey(storeId);
    setActionError('');
    try {
      const ok = await setFollowingStore(storeId, true);
      if (!ok) {
        setActionError('Gagal mengikuti toko. Coba lagi.');
      } else {
        await load();
      }
    } catch {
      setActionError('Gagal mengikuti toko. Coba lagi.');
    } finally {
      setUnfollowingKey(null);
    }
  };

  const storeKeys = useMemo(
    () => new Set(stores.map((s) => s.slug ?? s.umkmId)),
    [stores]
  );

  const recommendations = useMemo(
    () =>
      stores.length === 0
        ? vendors.filter((vendor) => !storeKeys.has(vendor.id)).slice(0, 6)
        : [],
    [stores.length, vendors, storeKeys]
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredStores = useMemo(
    () =>
      normalizedQuery
        ? stores.filter((store) =>
            [store.name, store.category ?? '']
              .join(' ')
              .toLowerCase()
              .includes(normalizedQuery)
          )
        : stores,
    [stores, normalizedQuery]
  );
  const filteredRecommendations = useMemo(
    () =>
      normalizedQuery
        ? recommendations.filter((vendor) =>
            [vendor.name, vendor.category]
              .join(' ')
              .toLowerCase()
              .includes(normalizedQuery)
          )
        : recommendations,
    [recommendations, normalizedQuery]
  );

  return (
    <BuyerShell>
      <main className="min-h-screen bg-white pb-24 lg:pb-12">
        <section className="border-b border-border/70 bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <h1 className="font-display text-2xl font-semibold tracking-tight text-primary">
                  Toko Diikuti
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Toko yang kamu ikuti lewat tombol &quot;Ikuti Toko&quot; di halaman
                  detail toko. Pantau menu dan promo terbarunya dari sini.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className="inline-flex items-center rounded-full border border-border bg-white px-3.5 py-1.5 text-xs font-semibold text-muted-foreground"
                  aria-live="polite"
                >
                  {status === 'loading' ? 'Memuat…' : `${stores.length} toko diikuti`}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {actionError && (
            <p
              role="alert"
              className="mb-5 rounded-2xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-xs font-medium text-destructive"
            >
              {actionError}
            </p>
          )}

          {status === 'ready' && (
            <div className="mb-5">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari toko yang diikuti..."
                  aria-label="Cari toko yang diikuti"
                  className="min-h-[44px] w-full rounded-full border border-border bg-white pl-11 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Hapus pencarian"
                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
              {normalizedQuery && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {stores.length > 0
                    ? `${filteredStores.length} hasil dari ${stores.length} toko`
                    : `${filteredRecommendations.length} hasil dari ${recommendations.length} rekomendasi`}
                </p>
              )}
            </div>
          )}

          {status === 'loading' && (
            <div
              role="status"
              aria-label="Memuat daftar toko"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3"
            >
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="rounded-3xl border border-border bg-white p-5"
                >
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-14 w-14 rounded-2xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-36 rounded-full" />
                      <Skeleton className="h-3 w-24 rounded-full" />
                    </div>
                  </div>
                  <div className="mt-5 flex gap-2">
                    <Skeleton className="h-[42px] flex-1 rounded-full" />
                    <Skeleton className="h-[42px] w-28 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {status === 'error' && (
            <div
              role="alert"
              className="flex flex-col gap-4 rounded-3xl border border-destructive/30 bg-destructive/[0.05] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7"
            >
              <div className="flex items-start gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                  <Store className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Gagal memuat daftar toko
                  </p>
                  <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">
                    {loadError}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-full bg-primary px-5 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                Coba lagi
              </button>
            </div>
          )}

          {status === 'ready' && stores.length === 0 && (
            <div className="space-y-8">
              <p className="text-sm text-muted-foreground">
                Belum ada toko yang diikuti.
              </p>

              {!vendorsLoading && filteredRecommendations.length > 0 && (
                <div>
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-foreground">
                        Rekomendasi toko untuk diikuti
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        UMKM pilihan yang bisa kamu ikuti sekarang.
                      </p>
                    </div>
                  </div>

                  <ul className="mt-4 grid list-none grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
                    {filteredRecommendations.map((vendor) => (
                      <RecommendationCard
                        key={vendor.id}
                        vendor={vendor}
                        onFollow={(id) => void handleFollow(id)}
                        busy={unfollowingKey === vendor.id}
                      />
                    ))}
                  </ul>
                </div>
              )}

              {!vendorsLoading &&
                normalizedQuery &&
                filteredRecommendations.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Tidak ada toko yang cocok dengan pencarian.
                  </p>
                )}
            </div>
          )}

          {status === 'ready' && stores.length > 0 && (
            <div>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-semibold text-foreground">
                    Daftar toko
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Toko yang kamu ikuti, terbaru di urutan pertama.
                  </p>
                </div>
              </div>

              <ul className="mt-4 grid list-none grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
                {filteredStores.map((store) => (
                  <FollowedStoreCard
                    key={store.umkmId || store.slug || store.name}
                    store={store}
                    onUnfollow={(s) => void handleUnfollow(s)}
                    unfollowingKey={unfollowingKey}
                  />
                ))}
              </ul>

              {normalizedQuery && filteredStores.length === 0 && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Tidak ada toko yang cocok dengan pencarian.
                </p>
              )}
            </div>
          )}
        </section>
      </main>
    </BuyerShell>
  );
}

export default function TokoDiikutiPage() {
  return (
    <RequireAuth>
      <TokoDiikutiView />
    </RequireAuth>
  );
}
