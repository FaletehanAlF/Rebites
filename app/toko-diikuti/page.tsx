"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Store, UserCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { RequireAuth } from "@/app/components/auth/require-auth";
import { BuyerShell } from "@/app/components/shared/buyer-shell";
import { SmartImage } from "@/app/components/shared/SmartImage";
import {
  STORE_FOLLOW_UPDATED_EVENT,
  getFollowedStores,
  setFollowingStore,
  type FollowedStore,
} from "@/lib/store-follows";
import { useCatalog } from "@/lib/catalog";

/**
 * Halaman khusus daftar toko yang diikuti.
 *
 * Sumber data adalah fungsi follow/unfollow yang sudah ada (`lib/store-follows`)
 * — tidak ada data dummy. Rekomendasi toko (+ ikuti) hanya muncul ketika
 * *state kosong*, dan hanya jika daftar toko aktual memang bisa diambil dari
 * katalog (`useCatalog`), sama seperti halaman /toko.
 */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white";

type LoadStatus = "loading" | "ready" | "error";

function StoreRow({
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
    <li className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3 transition-colors hover:border-primary/30 sm:p-4">
      <Link
        href={`/detail/toko?id=${key}`}
        className={cn("flex min-w-0 flex-1 items-center gap-3", FOCUS_RING)}
        aria-label={`Buka detail ${store.name}`}
      >
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-border">
          {store.logoUrl ? (
            <SmartImage
              src={store.logoUrl}
              alt={`Logo ${store.name}`}
              sizes="44px"
            />
          ) : (
            <span className="font-display text-lg font-semibold text-primary">
              {(store.name || "?").charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-foreground">
            {store.name}
          </span>
          {store.category && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {store.category}
            </span>
          )}
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Diikuti ·{" "}
            <span className="font-semibold text-primary">
              {store.rating.toFixed(1)} rating
            </span>
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => onUnfollow(store)}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={`Berhenti mengikuti ${store.name}`}
      >
        {busy ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Memproses
          </>
        ) : (
          <>
            <X className="h-3.5 w-3.5" aria-hidden />
            Berhenti
          </>
        )}
      </button>
    </li>
  );
}

function TokoDiikutiView() {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [stores, setStores] = useState<FollowedStore[]>([]);
  const [loadError, setLoadError] = useState("");
  const [unfollowingKey, setUnfollowingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const { vendors, loading: vendorsLoading } = useCatalog();

  const load = useCallback(async () => {
    setStatus("loading");
    setLoadError("");
    try {
      const list = await getFollowedStores();
      setStores(list);
      setStatus("ready");
    } catch (err) {
      setLoadError(
        err instanceof Error && err.message
          ? err.message
          : "Tidak dapat memuat daftar toko. Periksa koneksi lalu coba lagi.",
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Sinkron jika follow/unfollow terjadi dari halaman lain (tab/tab lain)
  useEffect(() => {
    const onFollowUpdate = () => void load();
    window.addEventListener(STORE_FOLLOW_UPDATED_EVENT, onFollowUpdate);
    return () => {
      window.removeEventListener(
        STORE_FOLLOW_UPDATED_EVENT,
        onFollowUpdate,
      );
    };
  }, [load]);

  const handleUnfollow = async (store: FollowedStore) => {
    const key = store.slug ?? store.umkmId;
    setUnfollowingKey(key);
    setActionError("");
    try {
      const ok = await setFollowingStore(key, false);
      if (!ok) {
        setActionError("Gagal berhenti mengikuti toko. Coba lagi.");
      } else {
        setStores((prev) => prev.filter((s) => s !== store));
      }
    } catch {
      setActionError("Gagal berhenti mengikuti toko. Coba lagi.");
    } finally {
      setUnfollowingKey(null);
    }
  };

  const handleFollow = async (storeId: string) => {
    setUnfollowingKey(storeId);
    setActionError("");
    try {
      const ok = await setFollowingStore(storeId, true);
      if (!ok) {
        setActionError("Gagal mengikuti toko. Coba lagi.");
      } else {
        await load();
      }
    } catch {
      setActionError("Gagal mengikuti toko. Coba lagi.");
    } finally {
      setUnfollowingKey(null);
    }
  };

  const storeKeys = useMemo(
    () => new Set(stores.map((s) => (s.slug ?? s.umkmId))),
    [stores],
  );
  // Rekomendasi hanya dari data katalog aktual, bukan angka karangan.
  const recommendations = useMemo(
    () =>
      stores.length === 0
        ? vendors.filter((vendor) => !storeKeys.has(vendor.id)).slice(0, 4)
        : [],
    [stores.length, vendors, storeKeys],
  );

  return (
    <BuyerShell>
      <main className="pb-28 pt-4 sm:pt-6 lg:pb-12 lg:pt-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Aktivitas Akun
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            Toko Diikuti
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Toko yang kamu ikuti lewat tombol &quot;Ikuti Toko&quot; di halaman
            detail toko.
          </p>

          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              {status === "loading" ? "Memuat…" : `${stores.length} toko`}
            </span>
            <Link
              href="/toko"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Jelajahi toko lain
            </Link>
          </div>

          {status === "loading" ? (
            <div className="mt-4 space-y-3" aria-label="Memuat daftar toko">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  aria-hidden
                  className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4"
                >
                  <div className="h-11 w-11 animate-pulse rounded-xl bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 rounded-full bg-muted" />
                    <div className="h-3 w-24 rounded-full bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : status === "error" ? (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-border bg-white px-6 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Store className="h-5 w-5" />
              </span>
              <p className="text-sm font-bold text-foreground">
                Gagal memuat daftar toko
              </p>
              <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                {loadError}
              </p>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                Coba lagi
              </button>
            </div>
          ) : stores.length === 0 ? (
            <div className="mt-6">
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-white px-6 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Store className="h-5 w-5" />
                </span>
                <p className="text-sm font-bold text-foreground">
                  Kamu belum mengikuti toko
                </p>
                <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                  Ikuti toko favoritmu supaya mudah kembali, tahu menu dan promo
                  terbaru dari tokonya, serta mendukung produktivitas UMKM.
                </p>
                <Link
                  href="/toko"
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark"
                >
                  Jelajahi Toko
                </Link>
              </div>

              {!vendorsLoading && recommendations.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-sm font-bold text-foreground">
                    Rekomendasi toko untuk diikuti
                  </h2>
                  <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {recommendations.map((vendor) => {
                      const busy = unfollowingKey === vendor.id;
                      return (
                        <li
                          key={vendor.id}
                          className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3"
                        >
                          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-border">
                            {vendor.image ? (
                              <SmartImage
                                src={vendor.image}
                                alt={`Logo ${vendor.name}`}
                                sizes="44px"
                              />
                            ) : (
                              <span className="font-display text-lg font-semibold text-primary">
                                {(vendor.name || "?").charAt(0).toUpperCase()}
                              </span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <Link
                              href={`/detail/toko?id=${vendor.id}`}
                              className="block truncate text-sm font-bold text-foreground hover:text-primary"
                            >
                              {vendor.name}
                            </Link>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {vendor.category}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleFollow(vendor.id)}
                            disabled={busy}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={`Ikuti ${vendor.name}`}
                          >
                            {busy ? (
                              <>
                                <Loader2
                                  className="h-3.5 w-3.5 animate-spin"
                                  aria-hidden
                                />
                                Memproses
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3.5 w-3.5" aria-hidden />
                                Ikuti
                              </>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {stores.map((store) => (
                <StoreRow
                  key={store.umkmId || store.slug || store.name}
                  store={store}
                  onUnfollow={(s) => void handleUnfollow(s)}
                  unfollowingKey={unfollowingKey}
                />
              ))}
            </ul>
          )}

          {actionError && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive"
            >
              {actionError}
            </p>
          )}
        </div>
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
