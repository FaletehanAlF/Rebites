"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Flame,
  Heart,
  Home,
  LayoutDashboard,
  LogOut,
  LogIn,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Settings,
  Store,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { scrollToId } from "@/lib/scroll";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/current-user";
import { useSellerStatus } from "@/hooks/seller/use-seller-status";

/**
 * Lebar sidebar pembeli adalah satu-satunya sumber kebenaran. Topbar dan area
 * konten memakai offset dari konstanta ini supaya tidak ada margin ganda atau
 * celah beberapa piksel antara sidebar dan konten.
 */
export const BUYER_SIDEBAR_WIDTH_CLASS = {
  collapsed: "w-[76px]",
  expanded: "w-[260px]",
} as const;

export const BUYER_TOPBAR_OFFSET_CLASS = {
  collapsed: "lg:left-[76px]",
  expanded: "lg:left-[260px]",
} as const;

export const BUYER_CONTENT_OFFSET_CLASS = {
  collapsed: "lg:pl-[76px]",
  expanded: "lg:pl-[260px]",
} as const;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white";

const SECTION_IDS = ["home", "rekomendasi", "flashSale", "umkm"] as const;

type SectionId = (typeof SECTION_IDS)[number];

/** Hash halaman profil yang menandai sub-menu akun di grup Lainnya. */
const ACCOUNT_SECTION_HASH = "sukai-makanan" as const;

interface BuyerSidebarNavProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

function isSectionId(value: string): value is SectionId {
  return (SECTION_IDS as readonly string[]).includes(value);
}

function SidebarLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/home"
      aria-label="ReBites — ke beranda"
      className={cn(
        "flex items-center gap-3 overflow-hidden rounded-xl transition-colors hover:bg-muted/50",
        collapsed ? "justify-center" : "px-1.5 py-1",
        FOCUS_RING,
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary">
        <Image
          src="/logo.avif"
          alt="ReBites"
          width={36}
          height={36}
          className="h-9 w-9 object-cover"
          priority
        />
      </div>
      <div
        className={cn(
          "flex min-w-0 flex-col transition-opacity duration-200",
          collapsed ? "hidden" : "flex",
        )}
      >
        <span className="font-display text-base font-bold leading-tight tracking-tight text-primary">
          ReBites
        </span>
        <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Food Rescue
        </span>
      </div>
    </Link>
  );
}

function GroupLabel({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "mb-2 px-2 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground",
        collapsed && "sr-only",
      )}
    >
      {children}
    </p>
  );
}

function NavRow({
  collapsed,
  active,
  href,
  title,
  onClick,
  children,
  icon: Icon,
  badge,
}: {
  collapsed: boolean;
  active: boolean;
  href: string;
  title?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  children: React.ReactNode;
  icon: LucideIcon;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? title : undefined}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "group flex min-h-10 items-center gap-3 rounded-xl text-[13px] font-medium transition-colors duration-150",
        collapsed ? "justify-center px-0" : "px-3",
        active
          ? "bg-emerald-50 font-semibold text-emerald-900 shadow-[inset_3px_0_0_0_#1b4d32]"
          : "text-charcoal-900 hover:bg-emerald-50/60 hover:text-emerald-900",
        FOCUS_RING,
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-[0_1px_2px_0_rgba(27,77,50,0.06)] transition-colors",
          active
            ? "text-emerald-900"
            : "text-muted-foreground group-hover:text-emerald-800",
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className={cn("flex-1 truncate", collapsed && "sr-only")}>
        {children}
      </span>
      {typeof badge === "number" && badge > 0 && (
        <span
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-none text-white",
            collapsed && "sr-only",
          )}
          aria-label={`${badge} belum dibaca`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

function SectionLink({
  href,
  sectionId,
  active,
  collapsed,
  onNavigate,
  children,
  icon: Icon,
}: {
  href: string;
  sectionId: string;
  active: boolean;
  collapsed: boolean;
  onNavigate: (id: string) => void;
  children: React.ReactNode;
  icon: LucideIcon;
}) {
  const pathname = usePathname();

  return (
    <NavRow
      href={href}
      title={String(children)}
      active={active}
      collapsed={collapsed}
      icon={Icon}
      onClick={(event) => {
        if (pathname !== "/home") return;
        event.preventDefault();
        scrollToId(sectionId);
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", `#${sectionId}`);
        }
        onNavigate(sectionId);
      }}
    >
      {children}
    </NavRow>
  );
}

export function BuyerSidebarNav({
  collapsed,
  onToggleCollapsed,
}: BuyerSidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useCurrentUser();
  const { isSeller, loading: sellerStatusLoading } = useSellerStatus();
  const [activeSection, setActiveSection] = useState<SectionId>("home");
  const [hash, setHash] = useState("");

  useEffect(() => {
    if (pathname !== "/home") {
      setActiveSection("home");
      return;
    }

    const sections = SECTION_IDS.map((id) =>
      document.getElementById(id)
    ).filter(
      (element): element is HTMLElement => element !== null
    );

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && isSectionId(entry.target.id)) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-28% 0px -60% 0px" },
    );

    sections.forEach((element) => observer.observe(element));

    const syncFromHash = () => {
      const id = window.location.hash.replace(/^#/, "");
      if (isSectionId(id)) setActiveSection(id);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);

    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", syncFromHash);
    };
  }, [pathname]);

  // Hash dipakai agar sub-menu akun (/profile#alamat, dst.) punya active state
  // yang jelas tanpa membuat route baru.
  useEffect(() => {
    const syncHash = () => setHash(window.location.hash.replace(/^#/, ""));
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const onHomeSectionNavigate = (id: string) => {
    if (isSectionId(id)) setActiveSection(id);
  };

  const handleBerandaClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname !== "/home") return;
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.history.replaceState(null, "", "/home");
    setActiveSection("home");
  };

  const isHome = pathname === "/home";
  const isMakananRoute = Boolean(pathname?.startsWith("/makanan"));
  const isPesananRoute = Boolean(pathname?.startsWith("/riwayatPesanan"));
  const isTokoRoute =
    pathname === "/toko" || Boolean(pathname?.startsWith("/detail/toko"));
  const isProfileRoute = pathname === "/profile";
  const isTokoDiikutiRoute = pathname === "/toko-diikuti";
  const isPengaturanRoute = pathname === "/pengaturan";
  const isSellerDashboardRoute = Boolean(
    pathname?.startsWith("/dashboard/penjual"),
  );
  const isAccountHash = hash === ACCOUNT_SECTION_HASH;

  const makananActive =
    isMakananRoute || (isHome && activeSection === "rekomendasi");
  const flashSaleActive = isHome && activeSection === "flashSale";
  const berandaActive = isHome && activeSection === "home";
  const umkmActive =
    isTokoRoute || (isHome && activeSection === "umkm");
  const accountHashActive = (id: string) =>
    isProfileRoute && hash === id;

  return (
    <aside
      aria-label="Navigasi utama pembeli"
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden border-r border-border bg-white transition-[width] duration-200 ease-out lg:flex lg:flex-col",
        collapsed
          ? BUYER_SIDEBAR_WIDTH_CLASS.collapsed
          : BUYER_SIDEBAR_WIDTH_CLASS.expanded,
      )}
    >
      {/* Satu-satunya logo pada navigasi buyer (topbar tidak menduplikasinya) */}
      <div className="flex h-16 shrink-0 items-center border-b border-border px-4">
        <SidebarLogo collapsed={collapsed} />
      </div>

      <nav
        aria-label="Menu pembeli"
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4"
      >
        <GroupLabel collapsed={collapsed}>Menu Utama</GroupLabel>

        <div className="space-y-1">
          <NavRow
            href="/home"
            title="Beranda"
            active={berandaActive}
            collapsed={collapsed}
            icon={Home}
            onClick={handleBerandaClick}
          >
            Beranda
          </NavRow>

          {/*
            Menu "Makanan" adalah satu tautan langsung ke katalog (/makanan),
            tanpa chevron dan tanpa sub-menu.

            Dulu ini sebuah tombol buka-tutup: di beranda ia menggulir ke
            bagian rekomendasi, dan daftar kategori baru terbuka setelah
            diketuk. Akibatnya menekan "Makanan" di beranda TIDAK membawa
            pengguna ke halaman lain — padahal bagi pembaca, mengklik menu
            samping artinya pindah halaman. Karena itu sekarang perilakunya
            sama dengan menu lain: beranda tetap di Beranda selama halaman
            belum berpindah, dan menekan Makanan membuka katalog.
          */}
          <NavRow
            href="/makanan"
            title="Makanan"
            active={makananActive}
            collapsed={collapsed}
            icon={UtensilsCrossed}
          >
            Makanan
          </NavRow>

          <SectionLink
            href="/home#flashSale"
            sectionId="flashSale"
            active={flashSaleActive}
            collapsed={collapsed}
            onNavigate={onHomeSectionNavigate}
            icon={Flame}
          >
            Diskon Kilat
          </SectionLink>

          {!sellerStatusLoading && (
            <NavRow
              href={isSeller ? "/dashboard/penjual" : "/auth/register/penjual"}
              title={isSeller ? "Toko Saya" : "Mulai Jualan"}
              active={isSeller ? isSellerDashboardRoute : false}
              collapsed={collapsed}
              icon={isSeller ? LayoutDashboard : Store}
            >
              {isSeller ? "Toko Saya" : "Mulai Jualan"}
            </NavRow>
          )}

          <NavRow
            href="/toko"
            title="UMKM"
            active={umkmActive}
            collapsed={collapsed}
            icon={Store}
          >
            UMKM
          </NavRow>

          <NavRow
            href="/riwayatPesanan"
            title="Pesanan"
            active={isPesananRoute}
            collapsed={collapsed}
            icon={ReceiptText}
          >
            Pesanan
          </NavRow>
        </div>

        <div className="my-4 h-px bg-border" />

        <GroupLabel collapsed={collapsed}>Lainnya</GroupLabel>

        <div className="space-y-1">
          <NavRow
            href="/profile#sukai-makanan"
            title="Makanan Disukai"
            active={accountHashActive("sukai-makanan")}
            collapsed={collapsed}
            icon={Heart}
          >
            Makanan Disukai
          </NavRow>

          <NavRow
            href="/toko-diikuti"
            title="Toko Diikuti"
            active={isTokoDiikutiRoute}
            collapsed={collapsed}
            icon={Store}
          >
            Toko Diikuti
          </NavRow>

          <NavRow
            href="/pengaturan"
            title="Pengaturan"
            active={isPengaturanRoute}
            collapsed={collapsed}
            icon={Settings}
          >
            Pengaturan
          </NavRow>
        </div>
      </nav>

      {/* Aksi akun + collapse. "Toko Saya"/"Mulai Jualan" sengaja TIDAK di
          sini: menu itu sudah dipindah ke kelompok Menu Utama agar menyatu
          dengan aktivitas toko (UMKM, Pesanan) dan tidak terisolasi di dasar
          sidebar. */}
      <div className="shrink-0 border-t border-border px-3 py-3">
        <div className="space-y-1">
          {user ? (
            <button
              type="button"
              title={collapsed ? "Keluar Akun" : undefined}
              onClick={handleLogout}
              className={cn(
                "group flex min-h-10 w-full items-center gap-3 rounded-xl text-[13px] font-medium text-charcoal-700 transition-colors duration-150 hover:bg-destructive/5 hover:text-destructive",
                collapsed ? "justify-center px-0" : "px-3",
                FOCUS_RING,
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-muted-foreground shadow-[0_1px_2px_0_rgba(27,77,50,0.06)] transition-colors group-hover:text-destructive">
                <LogOut className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className={cn("truncate", collapsed && "sr-only")}>
                Keluar Akun
              </span>
            </button>
          ) : (
            <NavRow
              href="/auth/login"
              title="Masuk / Daftar"
              active={false}
              collapsed={collapsed}
              icon={LogIn}
            >
              Masuk / Daftar
            </NavRow>
          )}
        </div>

        <div className="mt-2 border-t border-border pt-2">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Perbesar navigasi" : "Perkecil navigasi"}
            className={cn(
              "flex min-h-10 w-full items-center gap-3 rounded-xl text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-primary",
              collapsed ? "justify-center px-0" : "px-3",
              FOCUS_RING,
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground">
              {collapsed ? (
                <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden />
              ) : (
                <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden />
              )}
            </span>
            <span className={cn("truncate", collapsed && "sr-only")}>
              {collapsed ? "Perbesar" : "Perkecil navigasi"}
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
