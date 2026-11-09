"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Camera,
  Check,
  Clock,
  Coins,
  Heart,
  Leaf,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  Receipt,
  Sparkles,
  Star,
  Store,
  User,
  Utensils,
  Edit3,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useSellerStatus } from "@/hooks/seller/use-seller-status";
import { useCurrentUser } from "@/lib/current-user";
import { useProfile, uploadAvatar, updateProfileName } from "@/hooks/use-profile";
import { getUserOrders } from "@/lib/order-storage";
import { useAddresses } from "@/hooks/buyer/use-addresses";
import { useRebitesCoins } from "@/hooks/buyer/use-rebites-coins";
import { useFollowedStores } from "@/hooks/buyer/use-followed-stores";
import { useLikedFoods } from "@/hooks/buyer/use-liked-foods";
import { useCatalog } from "@/lib/catalog";
import { formatOrderDateTime } from "@/lib/order-utils";
import { formatRupiah } from "@/lib/data";
import type { StoredOrder } from "@/lib/types";
import { SmartImage } from "./SmartImage";
import { BuyerShell } from "./buyer-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/app/components/ui/dialog";
import {
  DotPattern,
  FloatingLeaf,
  LeafSprig,
} from "@/app/components/shared/ornaments";

const BANNER_IMAGE =
  "https://images.pexels.com/photos/406152/pexels-photo-406152.jpeg?auto=compress&cs=tinysrgb&w=1600";

type OrderBadgeStatus = "Selesai" | "Diproses";

const STATUS_STYLE: Record<
  OrderBadgeStatus,
  { icon: LucideIcon; className: string }
> = {
  Selesai: { icon: Check, className: "bg-primary/10 text-primary" },
  Diproses: { icon: Clock, className: "bg-primary/15 text-primary" },
};

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE },
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const VIEWPORT = { once: true, amount: 0.15 } as const;

function StatusBadge({ order }: { order: StoredOrder }) {
  const status: OrderBadgeStatus =
    order.status === "completed" ? "Selesai" : "Diproses";
  const { icon: Icon, className } = STATUS_STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-secondary text-xs font-semibold",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {status}
    </span>
  );
}

function SectionSkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-4 w-full animate-pulse rounded-full bg-muted"
        />
      ))}
    </div>
  );
}

interface InfoRowProps {
  icon: LucideIcon;
  label: string;
  value: string;
  chip: string;
}

function InfoRow({ icon: Icon, label, value, chip }: InfoRowProps) {
  return (
    <li className="flex items-center gap-3.5">
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          chip,
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="font-secondary text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="truncate font-secondary text-sm font-medium text-primary">
          {value}
        </p>
      </div>
    </li>
  );
}

function ProfileSidebar() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [joinedAt, setJoinedAt] = useState("");
  const { isSeller } = useSellerStatus();
  const { avatarUrl: sidebarAvatarUrl } = useProfile();
  const {
    selectedAddress,
    addresses,
    loading: addressLoading,
  } = useAddresses();

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const user = data.session?.user;
      if (!user) return;
      setFullName(user.user_metadata?.full_name ?? "");
      setEmail(user.email ?? "");
      if (user.created_at) {
        setJoinedAt(
          new Date(user.created_at).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = fullName.trim() || "Akun ReBites";
  const initials = fullName.trim()
    ? fullName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("")
    : "";

  return (
    <aside className="space-y-5 lg:sticky lg:top-28 lg:h-fit">
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-white p-6 text-center shadow-sm">
        <FloatingLeaf
          className="right-5 top-5 hidden h-4 w-4 text-muted-foreground/50 lg:block"
          delay={0.8}
        />
        <div className="relative mx-auto h-24 w-24">
          <span className="absolute -inset-1.5 rounded-full border border-primary/30" />
          <span className="absolute -inset-3 rounded-full border border-dashed border-primary/30" />
          <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-primary font-display text-2xl font-semibold text-white ring-4 ring-primary-foreground">
            {sidebarAvatarUrl ? (
              <Image src={sidebarAvatarUrl} alt={displayName} fill className="object-cover" unoptimized />
            ) : initials ? (
              initials
            ) : (
              <User className="h-8 w-8" />
            )}
          </div>
        </div>

        <h2 className="mt-4 font-display text-xl font-semibold text-primary">
          {displayName}
        </h2>
        <p className="mt-1 flex items-center justify-center gap-1.5 font-secondary text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          {addressLoading
            ? "Memuat…"
            : selectedAddress?.city
              ? `${selectedAddress.city}, Indonesia`
              : "Depok, Jawa Barat"}
        </p>

        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-3.5 py-1 font-secondary text-xs font-semibold text-muted-foreground">
          {isSeller ? (
            <>
              <Store className="h-3.5 w-3.5" />
              Akun Penjual
            </>
          ) : (
            <>
              <User className="h-3.5 w-3.5" />
              Akun Pembeli
            </>
          )}
        </span>
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-white p-6 shadow-sm">
        <h3 className="relative font-display text-base font-semibold text-primary">
          Data Akun
        </h3>
        <ul className="relative mt-4 space-y-4">
          <InfoRow
            icon={Mail}
            label="Email"
            value={email || "-"}
            chip="bg-primary/10 text-primary"
          />
          <InfoRow
            icon={Phone}
            label="No. HP"
            value={addressLoading ? "Memuat…" : selectedAddress?.phone || "-"}
            chip="bg-muted text-muted-foreground"
          />
          <InfoRow
            icon={Package}
            label="Tanggal Bergabung"
            value={joinedAt || "-"}
            chip="bg-primary/15 text-primary"
          />
        </ul>
      </section>
    </aside>
  );
}

function EcoImpactBanner({ savedPorsi }: { savedPorsi: number }) {
  return (
    <motion.section
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      className="relative overflow-hidden rounded-2xl border border-border/70 shadow-sm"
    >
      <Image
        src={BANNER_IMAGE}
        alt="Sayuran segar hasil penyelamatan makanan, tampilan dekat di atas meja krem"
        fill
        priority
        sizes="(min-width: 1024px) 70vw, 100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-primary" />

      <FloatingLeaf
        className="bottom-10 right-16 hidden h-5 w-5 text-primary/50 lg:block"
        delay={1.4}
      />
      <Leaf
        className="pointer-events-none absolute -bottom-8 -right-6 h-40 w-40 text-white/10"
        strokeWidth={1.2}
      />

      <div className="relative px-7 py-12 sm:px-10 sm:py-16 lg:px-14">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 font-secondary text-xs font-semibold tracking-wide text-primary-foreground">
          <Leaf className="h-3.5 w-3.5 text-primary" />
          Dampak Pribadimu
        </span>
        <h2 className="mt-5 max-w-2xl font-display text-[clamp(1.6rem,3vw,2.4rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-primary-foreground">
          &ldquo;Setiap porsi yang kamu selamatkan adalah napas baru bagi
          bumi.&rdquo;
        </h2>
        <p className="mt-4 max-w-xl font-secondary text-sm leading-relaxed text-primary-foreground/80 sm:text-[0.95rem]">
          {savedPorsi > 0
            ? `Sejauh ini kamu sudah menyelamatkan ${savedPorsi.toLocaleString("id-ID")} porsi makanan, berhemat sambil menjaga planet.`
            : "Belum ada porsi terselamatkan. Pesanan pertamamu adalah langkah kecil yang berarti bagi bumi."}
        </p>
      </div>
    </motion.section>
  );
}

interface ImpactStat {
  icon: LucideIcon;
  value: string;
  unit?: string;
  label: string;
  chip: string;
}

function ImpactStats({
  porsi,
  totalPesanan,
  co2eKg,
  loading,
}: {
  porsi: number;
  totalPesanan: number;
  co2eKg: number;
  loading: boolean;
}) {
  const stats: ImpactStat[] = [
    {
      icon: Utensils,
      value: loading ? "…" : porsi.toLocaleString("id-ID"),
      unit: "porsi",
      label: "Porsi Diselamatkan",
      chip: "bg-primary/15 text-primary",
    },
    {
      icon: Receipt,
      value: loading ? "…" : totalPesanan.toLocaleString("id-ID"),
      unit: "x",
      label: "Total Pesanan",
      chip: "bg-primary/20 text-muted-foreground",
    },
    {
      icon: Leaf,
      value: loading
        ? "…"
        : co2eKg.toLocaleString("id-ID", { maximumFractionDigits: 1 }),
      unit: "kg",
      label: "CO₂e Terselamatkan",
      chip: "bg-primary/15 text-primary",
    },
  ];

  return (
    <motion.section
      id="dampak"
      variants={stagger}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      className="relative scroll-mt-28 overflow-hidden rounded-2xl bg-primary p-6 shadow-sm sm:p-8"
    >
      <DotPattern className="right-8 top-8 hidden h-20 w-20 text-white/10 lg:block" />
      <FloatingLeaf className="left-6 top-6 hidden h-5 w-5 text-primary/60 lg:block" />

      <motion.div variants={fadeUp} className="relative">
        <p className="font-secondary text-xs font-semibold uppercase tracking-widest text-primary-foreground">
          Dampak Lingkungan
        </p>
        <h3 className="mt-2 font-display text-xl font-semibold text-primary-foreground sm:text-2xl">
          Dampakmu untuk Bumi
        </h3>
        <p className="mt-1 max-w-xl font-secondary text-sm leading-relaxed text-primary-foreground/70">
          Setiap pesanan mengurangi sisa pangan yang berakhir di tempat
          pembuangan akhir.
        </p>
      </motion.div>

      {loading ? (
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              aria-hidden
              className="h-36 animate-pulse rounded-2xl border border-white/10 bg-white/5"
            />
          ))}
        </div>
      ) : (
        <>
          <motion.div
            variants={stagger}
            className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            {stats.map((stat) => (
              <motion.div
                key={stat.label}
                variants={fadeUp}
                className="rounded-2xl border border-white/10 bg-white/10 p-5"
              >
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full",
                    stat.chip,
                  )}
                >
                  <stat.icon className="h-5 w-5" />
                </span>
                <p className="mt-4 font-display text-3xl font-semibold text-white">
                  {stat.value}
                  {stat.unit && (
                    <span className="ml-1 text-base font-medium text-white/60">
                      {stat.unit}
                    </span>
                  )}
                </p>
                <p className="mt-1 font-secondary text-sm text-primary-foreground/70">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </motion.div>
          {totalPesanan === 0 && (
            <p className="relative mt-4 font-secondary text-xs text-primary-foreground/60">
              Belum ada pesanan, statistik akan terisi otomatis begitu kamu
              memesan.
            </p>
          )}
        </>
      )}
    </motion.section>
  );
}

function CoinsAndAddress() {
  const { balance, totalEarned } = useRebitesCoins();
  const { selectedAddress, addresses, loading } = useAddresses();

  return (
    <div className="relative">
      <motion.section
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        className="relative grid gap-4 md:grid-cols-2"
      >
        <motion.div
          variants={fadeUp}
          className="relative overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground shadow-sm"
        >
          <FloatingLeaf
            className="right-8 bottom-8 hidden h-5 w-5 text-primary/50 lg:block"
            delay={1.1}
          />
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary-foreground">
              <Coins className="h-5 w-5" />
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 font-secondary text-xs font-semibold text-primary-foreground">
              <Sparkles className="h-3 w-3" />
              ReBites Coins
            </span>
          </div>
          <p className="mt-4 font-display text-3xl font-semibold tabular-nums text-primary-foreground">
            {balance.toLocaleString("id-ID")}
          </p>
          <p className="mt-1 font-secondary text-sm text-primary-foreground/80">
            Total didapat:{" "}
            <span className="font-semibold text-primary-foreground">
              {totalEarned.toLocaleString("id-ID")} Coin
            </span>
          </p>
          <p className="mt-3 font-secondary text-xs leading-relaxed text-primary-foreground/60">
            Koin didapat dari tiap pesanan selesai dan bisa dipakai untuk
            memotong harga checkout berikutnya.
          </p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-border/70 bg-white p-6 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MapPin className="h-5 w-5" />
            </span>
            {selectedAddress && (
              <span className="rounded-full bg-muted px-3 py-1 font-secondary text-xs font-semibold text-muted-foreground capitalize">
                {selectedAddress.label}
              </span>
            )}
          </div>
          <h3 className="mt-4 font-display text-base font-semibold text-primary">
            Alamat Pengiriman Utama
          </h3>
          {loading ? (
            <div className="mt-3">
              <SectionSkeletonRows rows={2} />
            </div>
          ) : selectedAddress ? (
            <>
              <p className="mt-1.5 font-secondary text-sm font-medium text-foreground">
                {selectedAddress.receiverName}
                {selectedAddress.phone ? (
                  <span className="ml-2 font-normal text-muted-foreground">
                    · {selectedAddress.phone}
                  </span>
                ) : null}
              </p>
              <p className="mt-1 font-secondary text-sm leading-relaxed text-muted-foreground">
                {selectedAddress.fullAddress}
              </p>
              {addresses.length > 1 && (
                <p className="mt-2 font-secondary text-xs text-muted-foreground">
                  +{addresses.length - 1} alamat lainnya tersimpan
                </p>
              )}
            </>
          ) : (
            <p className="mt-1.5 font-secondary text-sm leading-relaxed text-muted-foreground">
              Belum ada alamat tersimpan. Alamat ditambahkan otomatis saat kamu
              melakukan checkout pengiriman pertama.
            </p>
          )}
        </motion.div>
      </motion.section>
    </div>
  );
}

function OrderHistory({
  orders,
  loading,
}: {
  orders: StoredOrder[] | null;
  loading: boolean;
}) {
  return (
    <div className="relative">
      <LeafSprig className="-right-6 -top-8 hidden h-36 w-36 rotate-12 text-muted-foreground/25 lg:block" />
      <motion.section
        id="riwayat"
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.12 }}
        className="relative scroll-mt-28 rounded-2xl border border-border/70 bg-white shadow-sm"
      >
        <div className="flex items-center justify-between px-6 pt-6">
          <h3 className="font-display text-lg font-semibold text-primary">
            Riwayat Pesanan
          </h3>
          {!loading && orders && orders.length > 0 && (
            <Link
              href="/riwayatPesanan"
              className="inline-flex items-center gap-1.5 font-secondary text-sm font-semibold text-primary hover:text-primary"
            >
              Lihat Semua
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="px-6 pb-6 pt-4">
            <SectionSkeletonRows rows={4} />
          </div>
        ) : !orders || orders.length === 0 ? (
          <div className="mx-6 mb-6 mt-4 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-secondary/70 px-6 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Receipt className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">
                Belum ada pesanan
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                Riwayat pesananmu akan tampil di sini setelah checkout pertama.
              </p>
            </div>
            <Link
              href="/home#umkm"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark"
            >
              Jelajahi Toko
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto px-6 pb-6 md:block">
              <table className="mt-3 w-full text-left">
                <thead>
                  <tr className="border-b border-border font-secondary text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-4">No. Pesanan</th>
                    <th className="pb-3 pr-4">Toko &amp; Paket</th>
                    <th className="pb-3 pr-4">Tanggal</th>
                    <th className="pb-3 pr-4">Harga</th>
                    <th className="pb-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.orderId}
                      className="border-b border-border/60 transition-colors duration-200 last:border-b-0 hover:bg-muted/60"
                    >
                      <td className="py-4 pr-4 font-secondary text-sm font-semibold text-primary">
                        {order.orderId}
                      </td>
                      <td className="py-4 pr-4">
                        <p className="font-secondary text-sm font-medium text-primary">
                          {order.vendorName}
                        </p>
                        <p className="font-secondary text-xs text-muted-foreground">
                          {order.productName}
                        </p>
                      </td>
                      <td className="py-4 pr-4 font-secondary text-sm text-muted-foreground">
                        {formatOrderDateTime(order.createdAt)}
                      </td>
                      <td className="py-4 pr-4 font-secondary text-sm font-semibold text-primary">
                        {formatRupiah(order.total)}
                      </td>
                      <td className="py-4 text-right">
                        <StatusBadge order={order} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-border/60 px-6 pb-6 md:hidden">
              {orders.map((order) => (
                <li
                  key={order.orderId}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-secondary text-sm font-semibold text-primary">
                      {order.orderId}
                    </p>
                    <p className="truncate font-secondary text-sm text-primary">
                      {order.vendorName}
                    </p>
                    <p className="font-secondary text-xs text-muted-foreground">
                      {order.productName} ·{" "}
                      {formatOrderDateTime(order.createdAt)}
                    </p>
                    <p className="mt-1 font-secondary text-sm font-semibold text-primary">
                      {formatRupiah(order.total)}
                    </p>
                  </div>
                  <StatusBadge order={order} />
                </li>
              ))}
            </ul>
          </>
        )}
      </motion.section>
    </div>
  );
}

function FollowedStoresSection() {
  const { stores, hydrated } = useFollowedStores();

  return (
    <motion.section
      id="toko-diikuti"
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.12 }}
      className="relative scroll-mt-28 rounded-2xl border border-border/70 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-primary">
            Toko Diikuti
          </h3>
          <p className="mt-0.5 font-secondary text-xs text-muted-foreground">
            Toko yang kamu ikuti lewat tombol &quot;Ikuti Toko&quot; di halaman detail
            toko.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-3 py-1 font-secondary text-xs font-semibold text-muted-foreground">
          {hydrated ? stores.length : "…"} toko
        </span>
      </div>

      {!hydrated ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-1">
          {[0, 1, 2].map((i) => (
            <div key={i} aria-hidden className="h-16 rounded-xl bg-muted" />
          ))}
        </div>
      ) : stores.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-secondary/70 px-4 py-6 text-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Store className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-medium text-foreground">
              Belum ada toko yang diikuti
            </p>
            <p className="mt-1 max-w-sm text-[10px] leading-relaxed text-muted-foreground">
              Tekan tombol &quot;Ikuti Toko&quot; pada halaman detail toko favoritmu agar
              tampil di sini.
            </p>
          </div>
          <Link
            href="/home#umkm"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary-dark hover:text-white"
          >
            Jelajahi Toko
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-1">
          {stores.map((store) => (
            <li key={store.umkmId || store.slug || store.name}>
              <Link
                href={`/detail/toko?id=${store.slug ?? store.umkmId}`}
                className="group flex items-center gap-2.5 rounded-xl border border-border bg-white p-2 transition-colors duration-150 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-border">
                  {store.logoUrl ? (
                    <SmartImage
                      src={store.logoUrl}
                      alt={`Logo ${store.name}`}
                      sizes="40px"
                    />
                  ) : (
                    <span className="font-display text-lg font-semibold text-primary">
                      {(store.name || "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-secondary text-xs font-medium text-foreground">
                    {store.name}
                  </span>
                  {store.category && (
                    <span className="mt-0.5 block truncate font-secondary text-[10px] text-muted-foreground">
                      {store.category}
                    </span>
                  )}
                  <span className="mt-1 flex items-center gap-1 font-secondary text-[9px] font-semibold text-foreground">
                    <Star className="h-2 w-2 fill-primary text-primary" />
                    {store.rating.toFixed(1)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}

function LikedFoodsSection() {
  const { foods, hydrated } = useLikedFoods();
  const { foodItems } = useCatalog();
  // catalog id bisa slug atau uuid -> index semua kunci agar foto tidak hilang (bug slug vs uuid)
  const catalogMap = new Map<string, any>();
  for (const f of (foodItems || []) as any[]) {
    if (f.id) catalogMap.set(String(f.id), f);
    if (f.slug) catalogMap.set(String(f.slug), f);
    if (f.rawId) catalogMap.set(String(f.rawId), f);
  }

  return (
    <motion.section
      id="sukai-makanan"
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.12 }}
      className="relative scroll-mt-28 rounded-2xl border border-border/70 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-primary">
            Makanan Disukai
          </h3>
          <p className="mt-0.5 font-secondary text-xs text-muted-foreground">
            Makanan yang kamu sukai lewat tombol ❤️ di card produk.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-3 py-1 font-secondary text-xs font-semibold text-muted-foreground">
          {hydrated ? foods.length : "…"} makanan
        </span>
      </div>

      {!hydrated ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-1">
          {[0, 1, 2].map((i) => (
            <div key={i} aria-hidden className="h-16 rounded-xl bg-muted" />
          ))}
        </div>
      ) : foods.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-secondary/70 px-4 py-6 text-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Heart className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-bold text-foreground">
              Belum ada makanan disukai
            </p>
            <p className="mt-1 max-w-sm text-[10px] leading-relaxed text-muted-foreground">
              Tekan ikon ❤️ pada card produk di Beranda, Flash Sale, atau
              halaman detail untuk menambah ke sini.
            </p>
          </div>
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary-dark hover:text-white"
          >
            Jelajahi Makanan
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-1">
          {foods.map((fav) => {
            const detail: any =
              catalogMap.get(fav.productId) || catalogMap.get(fav.id) || null;
            const name = fav.name || detail?.name || "Makanan";
            const image = fav.image || detail?.image || null;
            const vendor = detail?.vendorName || "";
            const price = detail
              ? (detail.discountedPrice ?? detail.originalPrice)
              : fav.price;
            const href = detail
              ? `/detail/product?id=${detail.id}`
              : fav.productId
                ? `/detail/product?id=${fav.productId}`
                : "/home";
            return (
              <li key={fav.id || fav.productId}>
                <Link
                  href={href}
                  className="group flex items-center gap-2.5 rounded-xl border border-border bg-white p-2 transition-colors duration-150 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-border">
                    {image ? (
                      <SmartImage src={image} alt={name} sizes="40px" />
                    ) : (
                      <span className="font-display text-lg font-semibold text-primary">
                        {(name || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-secondary text-xs font-medium text-foreground">
                      {name}
                    </span>
                    {vendor && (
                      <span className="mt-0.5 block truncate font-secondary text-[10px] text-muted-foreground">
                        {vendor}
                      </span>
                    )}
                    {price != null && (
                      <span className="mt-1 block font-secondary text-[9px] font-medium text-primary">
                        Rp{Number(price).toLocaleString("id-ID")}
                      </span>
                    )}
                  </span>
                  <Heart className="h-3 w-3 shrink-0 fill-sale text-sale" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </motion.section>
  );
}

export function UserProfile() {
  const { userId } = useCurrentUser();
  const router = useRouter();
  const [orders, setOrders] = useState<StoredOrder[] | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [joinedAt, setJoinedAt] = useState("");
  const { isSeller } = useSellerStatus();
  const {
    selectedAddress,
    loading: addressLoading,
    updateAddress,
    addAddress,
  } = useAddresses();
  const { stores, hydrated: storesHydrated } = useFollowedStores();
  const { count: likedCount, hydrated: likedHydrated } = useLikedFoods();
  const { balance } = useRebitesCoins();
  const { profile: globalProfile, avatarUrl: globalAvatarUrl, refresh: refreshProfile } = useProfile();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editFullAddress, setEditFullAddress] = useState("");
  const [savingPersonal, setSavingPersonal] = useState(false);
  
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [isSukaiMakananDialogOpen, setIsSukaiMakananDialogOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const user = data.session?.user;
      if (!user) return;
      setFullName(user.user_metadata?.full_name ?? "");
      setEmail(user.email ?? "");
      if (user.created_at) {
        setJoinedAt(
          new Date(user.created_at).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getUserOrders(userId).then((list) => {
      if (!cancelled) setOrders(list);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash === "sukai-makanan") {
        router.push("/sukai");
      } else if (hash === "toko-diikuti") {
        router.replace("/toko-diikuti");
      } else if (hash) {
        document.getElementById(hash)?.scrollIntoView({ block: "start" });
      }
    };

    const timer = window.setTimeout(syncHash, 0);
    window.addEventListener("hashchange", syncHash);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", syncHash);
    };
    // router stabil di App Router, efek cukup berjalan sekali saat mount.
  }, [router]);

  const { savedPorsi, totalPesanan, co2eKg } = useMemo(() => {
    if (!orders) return { savedPorsi: 0, totalPesanan: 0, co2eKg: 0 };
    return {
      savedPorsi: orders.reduce((sum, o) => sum + (o.quantity ?? 0), 0),
      totalPesanan: orders.length,
      co2eKg: orders.reduce((sum, o) => sum + Number(o.co2eSavedKg ?? 0), 0),
    };
  }, [orders]);

  const displayName = fullName.trim() || "Akun ReBites";
  const initials = fullName.trim()
    ? fullName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p.charAt(0).toUpperCase())
        .join("")
    : "";
  const cityLabel = addressLoading
    ? "Memuat…"
    : selectedAddress?.city
      ? `${selectedAddress.city}, Indonesia`
      : "Depok, Indonesia";
  const phoneLabel = addressLoading ? "Memuat…" : selectedAddress?.phone || "-";

  return (
    <BuyerShell>
        <main className="relative mx-auto w-full max-w-7xl px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-12 lg:pt-8">
          {}
          <div className="hidden lg:block">
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-primary">
              Profil
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Kelola akun dan lihat aktivitasmu di ReBites
            </p>
          </div>

          {}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="mt-4 flex flex-col gap-4 rounded-2xl border border-border bg-white p-4 shadow-sm sm:mt-6 sm:gap-6 sm:p-6 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="flex items-center gap-5">
              <div className="relative h-20 w-20 shrink-0 sm:h-24 sm:w-24 group/avatar">
                <span className="absolute -inset-1 rounded-full border border-border/70" />
                <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary text-xl font-semibold text-white ring-4 ring-primary-foreground sm:h-24 sm:w-24 sm:text-2xl">
                  {globalAvatarUrl ? (
                    <Image
                      src={globalAvatarUrl}
                      alt={displayName}
                      fill
                      sizes="96px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : initials ? (
                    initials
                  ) : (
                    <User className="h-8 w-8 sm:h-9 sm:w-9" />
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Ubah foto profil"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-white text-primary shadow-sm ring-1 ring-border transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-8 sm:w-8"
                >
                  <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
                    if (!allowed.includes(file.type)) {
                      setAvatarError("Format file harus JPG, JPEG, PNG, atau WebP.");
                      setIsAvatarDialogOpen(true);
                      return;
                    }
                    if (file.size > 2 * 1024 * 1024) {
                      setAvatarError("Ukuran file maksimal 2MB.");
                      setIsAvatarDialogOpen(true);
                      return;
                    }
                    setAvatarError(null);
                    setAvatarFile(file);
                    const reader = new FileReader();
                    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
                    reader.readAsDataURL(file);
                    setIsAvatarDialogOpen(true);
                    e.target.value = "";
                  }}
                />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold leading-tight text-primary sm:text-xl">
                  {displayName}
                </h2>
                <p className="mt-0.5 font-secondary text-sm text-muted-foreground">
                  {email || "-"}
                </p>
                <p className="mt-1 flex items-center gap-1.5 font-secondary text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {cityLabel}
                </p>
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-secondary text-xs font-semibold text-muted-foreground">
                  {isSeller ? (
                    <Store className="h-3.5 w-3.5" />
                  ) : (
                    <User className="h-3.5 w-3.5" />
                  )}
                  {isSeller ? "Akun Penjual" : "Akun Pembeli"}
                </span>
              </div>
            </div>

            {}
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:w-auto lg:min-w-[520px] lg:max-w-[600px]">
              <Link
                href="/toko-diikuti"
                className="group flex flex-col items-start gap-2 rounded-2xl border border-zinc-100 bg-secondary p-4 text-left transition-colors hover:border-border hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary shadow-sm ring-1 ring-border group-hover:bg-primary-dark group-hover:text-white">
                  <Store className="h-4 w-4" />
                </span>
                <span className="font-secondary text-sm font-semibold text-primary">
                  Ikuti Toko
                </span>
                <span className="font-secondary text-xs text-muted-foreground">
                  {storesHydrated ? `${stores.length} toko` : "… toko"}
                </span>
                <span className="mt-1 inline-flex items-center gap-1 font-secondary text-xs font-semibold text-primary">
                  Lihat <ArrowRight className="h-3 w-3" />
                </span>
              </Link>

              <button
                type="button"
                onClick={() => setIsSukaiMakananDialogOpen(true)}
                className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-secondary p-4 text-left transition-colors hover:border-border hover:bg-white"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sale shadow-sm ring-1 ring-border group-hover:bg-sale group-hover:text-white">
                  <Heart className="h-4 w-4" />
                </span>
                <span className="font-secondary text-sm font-semibold text-primary">
                  Sukai Makanan
                </span>
                <span className="font-secondary text-xs text-muted-foreground">
                  {likedHydrated ? `${likedCount} makanan` : "… makanan"}
                </span>
                <span className="mt-1 inline-flex items-center gap-1 font-secondary text-xs font-semibold text-primary">
                  Lihat <ArrowRight className="h-3 w-3" />
                </span>
              </button>

              <div
                id="rebites-coin"
                className="col-span-2 flex scroll-mt-24 flex-col items-start gap-2 rounded-2xl border border-warning/50 bg-primary/15 p-4 sm:col-span-1"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary shadow-sm ring-1 ring-warning/50">
                  <Coins className="h-4 w-4" />
                </span>
                <span className="font-secondary text-sm font-semibold text-primary">
                  ReBites Coins
                </span>
                <span className="font-secondary text-xs font-bold text-primary">
                  {balance.toLocaleString("id-ID")} Coin
                </span>
                <span className="font-secondary text-[11px] text-muted-foreground">
                  Tersedia
                </span>
              </div>
            </div>
            </motion.section>

            {}
            <Dialog
              open={isAvatarDialogOpen}
              onOpenChange={(open) => {
                setIsAvatarDialogOpen(open);
                if (!open) {
                  setAvatarPreview(null);
                  setAvatarFile(null);
                  setAvatarError(null);
                  setUploadingAvatar(false);
                }
              }}
            >
              <DialogContent className="max-w-sm bg-white p-6 sm:p-7">
                <DialogHeader>
                  <DialogTitle className="font-display text-lg font-semibold text-primary">
                    Ubah Foto Profil
                  </DialogTitle>
                  <DialogDescription className="font-secondary text-sm text-muted-foreground">
                    Pilih foto JPG, JPEG, PNG, atau WebP maksimal 2MB. Preview akan tampil di bawah sebelum disimpan.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4 flex flex-col items-center gap-4">
                  <div className="relative h-28 w-28 overflow-hidden rounded-full bg-primary ring-4 ring-primary-foreground sm:h-32 sm:w-32">
                    {avatarPreview ? (
                      <Image src={avatarPreview} alt="Preview foto profil" fill className="object-cover" unoptimized />
                    ) : globalAvatarUrl ? (
                      <Image src={globalAvatarUrl} alt={displayName} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-white">
                        {initials || <User className="h-8 w-8" />}
                      </div>
                    )}
                  </div>

                  <div className="flex w-full flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
                    >
                      <Camera className="h-4 w-4" />
                      {avatarFile ? "Ganti Foto" : "Pilih Foto"}
                    </button>
                    <p className="text-center font-secondary text-[11px] text-muted-foreground">JPG, JPEG, PNG, WebP · Maks 2MB</p>
                  </div>

                  {avatarError && (
                    <p role="alert" className="w-full rounded-xl bg-destructive/10 px-3 py-2 text-center font-secondary text-xs font-medium text-destructive">
                      {avatarError}
                    </p>
                  )}
                </div>

                <DialogFooter className="mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAvatarDialogOpen(false);
                      setAvatarPreview(null);
                      setAvatarFile(null);
                      setAvatarError(null);
                    }}
                    disabled={uploadingAvatar}
                    className="rounded-full border border-border bg-white px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={!avatarFile || uploadingAvatar || !!avatarError}
                    onClick={async () => {
                      if (!avatarFile) return;
                      setUploadingAvatar(true);
                      setAvatarError(null);
                      try {
                        const { publicUrl, error } = await uploadAvatar(avatarFile);
                        if (error) throw new Error(error);
                        if (publicUrl) {
                          
                          refreshProfile();
                        }
                        setIsAvatarDialogOpen(false);
                        setAvatarPreview(null);
                        setAvatarFile(null);
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : "Gagal menyimpan foto.";
                        setAvatarError(msg);
                      } finally {
                        setUploadingAvatar(false);
                      }
                    }}
                    className="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploadingAvatar ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Menyimpan…
                      </>
                    ) : (
                      "Simpan"
                    )}
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog
            open={isSukaiMakananDialogOpen}
            onOpenChange={setIsSukaiMakananDialogOpen}
          >
            <DialogContent className="bg-white p-6 sm:p-7">
              <DialogHeader>
                <DialogTitle className="font-display text-lg font-semibold text-primary">
                  Makanan Disukai
                </DialogTitle>
                <DialogDescription className="font-secondary text-sm text-muted-foreground">
                  Makanan yang kamu sukai lewat tombol ❤️ di card produk.
                </DialogDescription>
              </DialogHeader>
              <LikedFoodsSection />
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setIsSukaiMakananDialogOpen(false)}
                  className="rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
                >
                  Tutup
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>


          {}
          <motion.section
            id="alamat"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={VIEWPORT}
            className="mt-6 scroll-mt-24 rounded-[20px] border border-zinc-100 bg-white p-6 shadow-sm sm:p-7"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-base font-semibold text-primary">
                Personal Information
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditName(fullName);
                  setEditPhone(selectedAddress?.phone || "");
                  setEditCity(selectedAddress?.city || "");
                  setEditFullAddress(selectedAddress?.fullAddress || "");
                  setIsEditDialogOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-dark"
              >
                Edit <Edit3 className="h-3 w-3" />
              </button>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              <div>
                <p className="font-secondary text-xs text-muted-foreground">Nama Lengkap</p>
                <p className="mt-1 font-secondary text-sm font-semibold text-foreground">
                  {displayName}
                </p>
              </div>
              <div>
                <p className="font-secondary text-xs text-muted-foreground">Email Address</p>
                <p className="mt-1 break-all font-secondary text-sm font-semibold text-foreground">
                  {email || "-"}
                </p>
              </div>
              <div>
                <p className="font-secondary text-xs text-muted-foreground">
                  Tanggal Bergabung
                </p>
                <p className="mt-1 font-secondary text-sm font-semibold text-foreground">
                  {joinedAt || "-"}
                </p>
              </div>
              <div>
                <p className="font-secondary text-xs text-muted-foreground">Phone Number</p>
                <p className="mt-1 font-secondary text-sm font-semibold text-foreground">
                  {phoneLabel}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="font-secondary text-xs text-muted-foreground">Alamat Lengkap</p>
                <p className="mt-1 font-secondary text-sm font-semibold leading-relaxed text-foreground">
                  {addressLoading
                    ? "Memuat…"
                    : selectedAddress?.fullAddress || "-"}
                </p>
                {!addressLoading && selectedAddress?.city && (
                  <p className="mt-1 font-secondary text-xs text-muted-foreground">
                    {selectedAddress.city}
                    {selectedAddress.province ? `, ${selectedAddress.province}` : ""} · Indonesia
                  </p>
                )}
              </div>
            </div>
          </motion.section>

          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-lg bg-white p-6 sm:p-7">
              <DialogHeader>
                <DialogTitle className="font-display text-lg font-semibold text-primary">
                  Edit Personal Information
                </DialogTitle>
                <DialogDescription className="font-secondary text-sm text-muted-foreground">
                  Perbarui informasi yang dapat diubah. Email, tanggal
                  bergabung, dan role tidak dapat diubah.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="font-secondary text-xs font-medium text-muted-foreground">
                    Nama Lengkap
                  </label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nama lengkap"
                    className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5 font-secondary text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="font-secondary text-xs font-medium text-muted-foreground">
                    Phone Number
                  </label>
                  <input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    inputMode="numeric"
                    className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5 font-secondary text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="font-secondary text-xs font-medium text-muted-foreground">
                    Alamat Lengkap
                  </label>
                  <textarea
                    value={editFullAddress}
                    onChange={(e) => setEditFullAddress(e.target.value)}
                    placeholder="Jl. Contoh No. 123, RT/RW, Kelurahan..."
                    rows={3}
                    className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5 font-secondary text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <DialogFooter className="mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={savingPersonal}
                  className="rounded-full border border-border bg-white px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={savingPersonal || !editName.trim()}
                  onClick={async () => {
                    setSavingPersonal(true);
                    try {
                      if (
                        editName.trim() &&
                        editName.trim() !== fullName.trim()
                      ) {
                        // Persist ke profiles via backend API + sinkron metadata sesi
                        const { error: nameError } = await updateProfileName(editName.trim());
                        if (nameError) throw new Error(nameError);
                        setFullName(editName.trim());
                      }
                      const newPhone = editPhone.trim();
                      const newCity = editCity.trim();
                      const newFullAddress = editFullAddress.trim();
                      const phoneChanged = newPhone !== (selectedAddress?.phone || "");
                      const cityChanged = newCity !== (selectedAddress?.city || "");
                      const addressChanged = newFullAddress !== (selectedAddress?.fullAddress || "");
                      if (phoneChanged || cityChanged || addressChanged) {
                        if (selectedAddress) {
                          await updateAddress(selectedAddress.id, {
                            label: selectedAddress.label,
                            receiverName: selectedAddress.receiverName,
                            phone: newPhone,
                            province: selectedAddress.province,
                            city: newCity || selectedAddress.city || "Depok",
                            district: selectedAddress.district,
                            fullAddress: newFullAddress,
                            note: selectedAddress.note,
                          });
                        } else if (newPhone || newCity || newFullAddress) {
                          await addAddress({
                            label: "Rumah",
                            receiverName: editName.trim() || fullName,
                            phone: newPhone,
                            province: "Jawa Barat",
                            city: newCity || "Depok",
                            district: "",
                            fullAddress: newFullAddress,
                          });
                        }
                      }
                      setIsEditDialogOpen(false);
                    } catch (e) {
                      console.error("[profile] gagal simpan:", e);
                      alert("Gagal menyimpan perubahan. Coba lagi.");
                    } finally {
                      setSavingPersonal(false);
                    }
                  }}
                  className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
                >
                  {savingPersonal ? "Menyimpan…" : "Simpan Perubahan"}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="mt-6 space-y-6"></div>
        </main>
    </BuyerShell>
  );
}
