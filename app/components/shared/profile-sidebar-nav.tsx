"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Crown, Home, LayoutDashboard, LogOut, LogIn, MapPin, Megaphone, PanelLeftClose, PanelLeftOpen, ReceiptText, Settings, Store, Truck, type LucideIcon, } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/current-user";
import { useSellerStatus } from "@/hooks/seller/use-seller-status";
import { useIsCourier } from "@/hooks/use-is-courier";
import { IconTooltip } from "./icon-tooltip";
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
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white";
interface BuyerSidebarNavProps {
    collapsed: boolean;
    onToggleCollapsed: () => void;
}
function SidebarLogo({ collapsed }: {
    collapsed: boolean;
}) {
    return (<Link href="/home" aria-label="ReBites — ke beranda" className={cn("flex items-center gap-3 overflow-hidden rounded-xl transition-colors hover:bg-muted/50", collapsed ? "justify-center" : "px-1.5 py-1", FOCUS_RING)}>

      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary">

        <Image src="/logo.avif" alt="ReBites" width={36} height={36} className="h-9 w-9 object-cover" priority/>

      </div>

      <div className={cn("flex min-w-0 flex-col transition-opacity duration-200", collapsed ? "hidden" : "flex")}>

        <span className="font-display text-base font-bold leading-tight tracking-tight text-primary">

          ReBites

        </span>

        <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">

          Food Rescue

        </span>

      </div>

    </Link>);
}
function GroupLabel({ collapsed, children, }: {
    collapsed: boolean;
    children: React.ReactNode;
}) {
    return (<p className={cn("mb-2 px-2 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground", collapsed && "sr-only")}>

      {children}

    </p>);
}
function NavRow({ collapsed, active, href, title, onClick, children, icon: Icon, badge, }: {
    collapsed: boolean;
    active: boolean;
    href: string;
    title?: string;
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
    children: React.ReactNode;
    icon: LucideIcon;
    badge?: number;
}) {
    const label = title ?? (typeof children === "string" ? children : "");
    return (<IconTooltip label={label} side="right" enabled={collapsed} className="flex w-full">

      <Link href={href} aria-current={active ? "page" : undefined} onClick={onClick} className={cn("group flex min-h-[44px] w-full items-center gap-3 rounded-xl text-[13px] font-medium transition-colors duration-150", collapsed ? "justify-center px-0" : "px-3", active
            ? "bg-emerald-50 font-semibold text-emerald-900 shadow-[inset_3px_0_0_0_#1b4d32]"
            : "text-charcoal-900 hover:bg-emerald-50/60 hover:text-emerald-900", FOCUS_RING)}>

        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-[0_1px_2px_0_rgba(27,77,50,0.06)] transition-colors", active
            ? "text-emerald-900"
            : "text-muted-foreground group-hover:text-emerald-800")}>

          <Icon className="h-[18px] w-[18px]" aria-hidden/>

        </span>

        <span className={cn("flex-1 truncate", collapsed && "sr-only")}>

          {children}

        </span>

        {typeof badge === "number" && badge > 0 && (<span className={cn("flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-none text-white", collapsed && "sr-only")} aria-label={`${badge} belum dibaca`}>

            {badge > 99 ? "99+" : badge}

          </span>)}

      </Link>

    </IconTooltip>);
}
export function BuyerSidebarNav({ collapsed, onToggleCollapsed, }: BuyerSidebarNavProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useCurrentUser();
    const { isSeller, loading: sellerStatusLoading } = useSellerStatus();
    const { isCourier } = useIsCourier();
    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/auth/login");
    };
    const handleBerandaClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (pathname !== "/home")
            return;
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        window.history.replaceState(null, "", "/home");
    };
    const isHome = pathname === "/home";
    const isPesananRoute = Boolean(pathname?.startsWith("/riwayatPesanan"));
    const isTokoDiikutiRoute = pathname === "/toko-diikuti";
    const isAlamatRoute = pathname === "/alamat";
    const isPengaturanRoute = pathname === "/pengaturan";
    const isSellerDashboardRoute = Boolean(pathname?.startsWith("/dashboard/penjual"));
    const isCourierDashboardRoute = Boolean(pathname?.startsWith("/dashboard/kurir"));
    const berandaActive = isHome;
    const isLanggananRoute = pathname === "/langganan";
    return (<aside aria-label="Navigasi utama pembeli" className={cn("fixed inset-y-0 left-0 z-40 hidden border-r border-border bg-white transition-[width] duration-200 ease-out lg:flex lg:flex-col", collapsed
            ? BUYER_SIDEBAR_WIDTH_CLASS.collapsed
            : BUYER_SIDEBAR_WIDTH_CLASS.expanded)}>

      

      <div className="flex h-16 shrink-0 items-center border-b border-border px-4">

        <SidebarLogo collapsed={collapsed}/>

      </div>



      <nav aria-label="Menu pembeli" className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">

        <GroupLabel collapsed={collapsed}>Menu Utama</GroupLabel>



        <div className="space-y-1">

          <NavRow href="/home" title="Beranda" active={berandaActive} collapsed={collapsed} icon={Home} onClick={handleBerandaClick}>

            Beranda

          </NavRow>

          {!sellerStatusLoading && (<NavRow href={isSeller ? "/dashboard/penjual" : "/auth/register/penjual"} title={isSeller ? "Toko Saya" : "Mulai Jual"} active={isSeller ? isSellerDashboardRoute : false} collapsed={collapsed} icon={isSeller ? LayoutDashboard : Megaphone}>
              {isSeller ? "Toko Saya" : "Mulai Jual"}
            </NavRow>)}

          <NavRow href="/langganan" title="Langganan" active={isLanggananRoute} collapsed={collapsed} icon={Crown}>
            Langganan
          </NavRow>


          <NavRow href="/riwayatPesanan" title="Pesanan Saya" active={isPesananRoute} collapsed={collapsed} icon={ReceiptText}>
            Pesanan Saya

          </NavRow>



          {isCourier && (<NavRow href="/dashboard/kurir" title="Dashboard Kurir" active={isCourierDashboardRoute} collapsed={collapsed} icon={Truck}>

              Dashboard Kurir

            </NavRow>)}

        </div>



        <div className="my-4 h-px bg-border"/>



        <GroupLabel collapsed={collapsed}>Lainnya</GroupLabel>



        <div className="space-y-1">

          <NavRow href="/toko-diikuti" title="Toko Diikuti" active={isTokoDiikutiRoute} collapsed={collapsed} icon={Store}>
            Toko Diikuti
          </NavRow>

          <NavRow href="/alamat" title="Alamat Pengiriman" active={isAlamatRoute} collapsed={collapsed} icon={MapPin}>
            Alamat Pengiriman
          </NavRow>

          <NavRow href="/pengaturan" title="Pengaturan" active={isPengaturanRoute} collapsed={collapsed} icon={Settings}>
            Pengaturan

          </NavRow>

        </div>

      </nav>



      

      <div className="shrink-0 border-t border-border px-3 py-3">

        <div className="space-y-1">

          {user ? (<IconTooltip label="Keluar Akun" side="right" enabled={collapsed} className="flex w-full">

              <button type="button" onClick={handleLogout} className={cn("group flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/[0.05] text-[13px] font-semibold text-destructive transition-colors duration-150 hover:border-destructive hover:bg-destructive hover:text-white", collapsed ? "justify-center px-0" : "px-3", FOCUS_RING)}>

                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-destructive/20 bg-white text-destructive transition-colors group-hover:border-white/40 group-hover:bg-white/20 group-hover:text-white">

                  <LogOut className="h-[18px] w-[18px]" aria-hidden/>

                </span>

                <span className={cn("truncate", collapsed && "sr-only")}>

                  Keluar Akun

                </span>

              </button>

            </IconTooltip>) : (<NavRow href="/auth/login" title="Masuk / Daftar" active={false} collapsed={collapsed} icon={LogIn}>

              Masuk / Daftar

            </NavRow>)}

        </div>



        <div className="mt-2 border-t border-border pt-2">

          <IconTooltip label={collapsed ? "Perbesar navigasi" : "Perkecil navigasi"} side="right" enabled={collapsed} className="flex w-full">

            <button type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "Perbesar navigasi" : "Perkecil navigasi"} className={cn("flex min-h-[44px] w-full items-center gap-3 rounded-xl text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-primary", collapsed ? "justify-center px-0" : "px-3", FOCUS_RING)}>

            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground">

              {collapsed ? (<PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden/>) : (<PanelLeftClose className="h-[18px] w-[18px]" aria-hidden/>)}

            </span>

            <span className={cn("truncate", collapsed && "sr-only")}>

              {collapsed ? "Perbesar" : "Perkecil navigasi"}

            </span>

            </button>

          </IconTooltip>

        </div>

      </div>

    </aside>);
}
