"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Heart,
  MapPin,
  Star,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Vendor } from "@/lib/types";
import { SmartImage } from "@/app/components/shared/SmartImage";
import { DotPattern, LeafSprig } from "@/app/components/dashboard-penjual/decor";
import {
  getStoreSettingsByStoreId,
  STORE_SETTINGS_UPDATED_EVENT,
} from "@/lib/store-settings-storage";
import {
  isFollowingStore,
  setFollowingStore,
} from "@/lib/store-follows";

interface StoreHeroCardProps {
  vendor: Vendor;
  openNow: boolean;
}

export function StoreHeroCard({ vendor, openNow }: StoreHeroCardProps) {
  const [following, setFollowing] = useState(false);
  const tagline = vendor.tagline ?? "Mitra surplus makanan ReBites.";
  const followers = vendor.followers ?? 0;

  useEffect(() => {
    let mounted = true;
    isFollowingStore(vendor.id).then((value) => {
      if (mounted) setFollowing(value);
    });
    return () => {
      mounted = false;
    };
  }, [vendor.id]);

  const handleToggleFollow = async () => {
    const next = !following;
    setFollowing(next);
    const ok = await setFollowingStore(vendor.id, next);
    if (!ok) setFollowing(!next);
  };

  const [storeName, setStoreName] = useState(vendor.name);
  const [storeDesc, setStoreDesc] = useState(vendor.description);
  const [storeAddress, setStoreAddress] = useState(vendor.address);
  const [storeImage, setStoreImage] = useState(vendor.image);

  useEffect(() => {
    setStoreName(vendor.name);
    setStoreDesc(vendor.description);
    setStoreAddress(vendor.address);
    setStoreImage(vendor.image);
  }, [vendor]);

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      getStoreSettingsByStoreId(vendor.id).then((s) => {
        if (!mounted || !s) return;
        setStoreName(s.storeName || vendor.name);
        setStoreDesc(s.description || vendor.description);
        setStoreAddress(s.address || vendor.address);
        if (s.image) setStoreImage(s.image);
      });
    };
    refresh();
    window.addEventListener(STORE_SETTINGS_UPDATED_EVENT, refresh);
    return () => {
      mounted = false;
      window.removeEventListener(STORE_SETTINGS_UPDATED_EVENT, refresh);
    };
  }, [vendor]);

  return (
    <section>
      <div className="relative h-44 overflow-hidden bg-gradient-to-br from-primary via-primary to-primary sm:h-56">
        <DotPattern className="right-0 top-0 h-56 w-56 text-cream-50/10" />
        <LeafSprig className="-bottom-10 -right-6 h-56 w-56 text-cream-50/15" />

        <div className="mx-auto max-w-[1200px] px-5 sm:px-8 pt-4">
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 rounded-full border border-sage-100/50 bg-white/10 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-cream-50 transition-colors hover:border-caramel hover:text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke Beranda
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative -mt-14 sm:-mt-16"
        >
          <div className="rounded-3xl border border-sage-100 bg-white p-6 shadow-xl shadow-primary/10 sm:p-8 pt-12 sm:pt-16">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                <div className="relative -mt-16 h-28 w-28 shrink-0 overflow-hidden rounded-full bg-sage-100 ring-4 ring-white shadow-lg sm:-mt-20 sm:h-32 sm:w-32">
                  <SmartImage
                    src={storeImage}
                    alt={`Foto ${storeName}`}
                  />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-2xl font-medium leading-tight tracking-tight text-primary sm:text-3xl">
                      {storeName}
                    </h1>
                    {vendor.isVerified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-caramel px-2.5 py-1 text-[10px] font-bold text-charcoal-900">
                        <BadgeCheck className="h-3 w-3" />
                        UMKM Terverifikasi
                      </span>
                    )}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold",
                        openNow
                          ? "bg-primary text-white"
                          : "bg-charcoal-500 text-white",
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          openNow ? "bg-white" : "bg-red-500",
                        )}
                      />
                      {openNow ? "Buka Sekarang" : "Tutup"}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-charcoal-500">
                    <span className="flex items-center gap-1 font-semibold text-charcoal-900">
                      <Star className="h-3.5 w-3.5 fill-caramel text-caramel" />
                      {vendor.rating.toFixed(1)}
                      {vendor.distanceKm != null && (
                        <span className="font-normal text-charcoal-500">
                          · {vendor.distanceKm} km dari kamu
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-sage-500" />
                      {followers + (following ? 1 : 0)} pengikut
                    </span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:underline"
                    >
                      <MapPin className="h-3.5 w-3.5 text-sage-500" />
                      {storeAddress}
                    </a>
                  </div>

                  <p className="mt-2 text-xs font-medium text-primary">
                    {tagline}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handleToggleFollow}
                  aria-pressed={following}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors duration-200",
                    following
                      ? "bg-primary text-white hover:bg-caramel"
                      : "border-2 border-primary text-primary hover:bg-caramel hover:text-white",
                  )}
                >
                  {following ? (
                    <Heart className="h-4 w-4 fill-current" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {following ? "Mengikuti" : "Ikuti Toko"}
                </button>
              </div>
            </div>

            <p className="mt-6 border-t border-sage-100 pt-5 text-sm leading-relaxed text-charcoal-500">
              {storeDesc}
            </p>

            {(() => {
              // Info trust dari database; hanya tampilkan field yang punya nilai.
              const stats: string[] = [];
              if (vendor.memberSince != null) stats.push(`Mitra sejak ${vendor.memberSince}`);
              if (vendor.responseTime) stats.push(`Respons ${vendor.responseTime}`);
              if (vendor.porsiTerselamatkan != null)
                stats.push(
                  `${vendor.porsiTerselamatkan.toLocaleString("id-ID")} porsi terselamatkan`
                );
              if (vendor.co2eSavedKg != null)
                stats.push(
                  `${vendor.co2eSavedKg.toLocaleString("id-ID")} kg CO₂e diselamatkan`
                );
              if (stats.length === 0) return null;
              return (
                <div className="mt-4 flex flex-wrap gap-2">
                  {stats.map((stat) => (
                    <span
                      key={stat}
                      className="inline-flex items-center rounded-full bg-cream-100 px-3 py-1.5 text-[11px] font-medium text-charcoal-600"
                    >
                      {stat}
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
