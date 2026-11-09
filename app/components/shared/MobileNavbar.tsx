"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Coins, Crown, LayoutDashboard, LogIn, LogOut, MapPin, Menu, Megaphone, Settings, Store, X, type LucideIcon, } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/current-user";
import { useNotifications } from "@/hooks/use-notifications";
import { useSellerStatus } from "@/hooks/seller/use-seller-status";
import { CATEGORIES } from "@/lib/categories";
import { BuyerSearchBar } from "./BuyerSearchBar";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const ACCOUNT_LINKS: {
    href: string;
    label: string;
    icon: LucideIcon;
}[] = [
    { href: "/toko-diikuti", label: "Toko Diikuti", icon: Store },
    { href: "/pengaturan/coin", label: "ReBites Coin", icon: Coins },
    { href: "/langganan", label: "Langganan", icon: Crown },
    { href: "/alamat", label: "Alamat Pengiriman", icon: MapPin },
    { href: "/pengaturan", label: "Pengaturan", icon: Settings },
];
export function MobileNavbar() {
    const router = useRouter();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const drawerRef = useRef<HTMLElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const menuButtonRef = useRef<HTMLButtonElement | null>(null);
    const { user, userId } = useCurrentUser();
    const { unreadCount } = useNotifications(userId, "buyer");
    const { isSeller, loading: sellerLoading } = useSellerStatus();
    const handleLogout = async () => {
        await supabase.auth.signOut();
        setDrawerOpen(false);
        router.push("/auth/login");
    };
    const closeDrawer = () => setDrawerOpen(false);
    useEffect(() => {
        if (!drawerOpen)
            return;
        const menuButton = menuButtonRef.current;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const focusTimer = window.setTimeout(() => {
            closeButtonRef.current?.focus();
        }, 0);
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                setDrawerOpen(false);
                return;
            }
            if (event.key !== "Tab")
                return;
            const root = drawerRef.current;
            if (!root)
                return;
            const focusable = Array.from(root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((element) => element.offsetParent !== null);
            if (focusable.length === 0)
                return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const activeElement = document.activeElement;
            if (event.shiftKey && activeElement === first) {
                event.preventDefault();
                last.focus();
            }
            else if (!event.shiftKey && activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => {
            window.clearTimeout(focusTimer);
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = previousOverflow;
            menuButton?.focus();
        };
    }, [drawerOpen]);
    return (<>

      

      <header className="fixed inset-x-0 top-0 z-[65] border-b border-border bg-white">

        <div className="flex h-14 items-center gap-2 px-4 sm:gap-3">

          

          <Link href="/home" aria-label="ReBites — ke beranda" className={cn("flex shrink-0 items-center gap-2 rounded-full", FOCUS_RING)}>

            <Image src="/logo.avif" alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover"/>

            <span className="hidden font-display text-lg font-bold tracking-tight text-primary sm:inline">

              ReBites

            </span>

          </Link>



          <BuyerSearchBar className="min-w-0 flex-1"/>



          <div className="flex shrink-0 items-center gap-1">

            <Link href="/notifikasi/pembeli" aria-label={unreadCount > 0
            ? `Notifikasi, ${unreadCount} belum dibaca`
            : "Notifikasi"} className={cn("relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-primary", FOCUS_RING)}>

              <Bell className="h-5 w-5" aria-hidden/>

              {unreadCount > 0 && (<span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">

                  {unreadCount > 99 ? "99+" : unreadCount}

                </span>)}

            </Link>



            <button ref={menuButtonRef} type="button" onClick={() => setDrawerOpen(true)} aria-label="Buka menu navigasi" aria-expanded={drawerOpen} aria-controls="buyer-mobile-navigation" className={cn("flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-primary", FOCUS_RING)}>

              <Menu className="h-5 w-5" aria-hidden/>

            </button>

          </div>

        </div>

      </header>



      <AnimatePresence>

        {drawerOpen && (<>

            

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: "linear" }} onClick={closeDrawer} className="fixed inset-0 z-[70] bg-charcoal-900/45" aria-hidden/>



            <motion.aside id="buyer-mobile-navigation" ref={drawerRef} role="dialog" aria-modal="true" aria-label="Navigasi pembeli" initial={{ x: "100%" }} animate={{ x: 0, transition: { duration: 0.26, ease: EASE } }} exit={{ x: "100%", transition: { duration: 0.18, ease: EASE } }} style={{ willChange: "transform" }} className="fixed right-0 top-0 z-[80] flex h-full w-[88vw] max-w-[340px] flex-col bg-white shadow-2xl">

              

              <div className="flex items-center justify-between border-b border-border px-4 py-3.5">

                <span className="flex items-center gap-2">

                  <Image src="/logo.avif" alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover"/>

                  <span className="font-display text-lg font-bold text-primary">

                    ReBites

                  </span>

                </span>

                <button ref={closeButtonRef} type="button" onClick={closeDrawer} aria-label="Tutup menu navigasi" className={cn("flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", FOCUS_RING)}>

                  <X className="h-5 w-5" aria-hidden/>

                </button>

              </div>



              

              <nav className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">

                <div>
                  <p className="px-3 pb-1 font-secondary text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Kategori
                  </p>
                  

                  <div className="mt-1 grid grid-cols-2 gap-2">

                    {CATEGORIES.map((category) => (<Link key={category.id} href={`/makanan/${category.id}`} onClick={closeDrawer} className={cn("flex min-h-[44px] items-center rounded-xl border border-border bg-white px-3 text-left text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent hover:text-primary", FOCUS_RING)}>

                        <span className="line-clamp-2">{category.name}</span>

                      </Link>))}

                  </div>

                </div>



                <div className="mt-5 border-t border-border/70 pt-4">

                  <p className="px-3 pb-1 font-secondary text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">

                    Akun

                  </p>



                  <div className="mt-1 space-y-0.5">

                    {ACCOUNT_LINKS.map(({ href, label, icon: Icon }) => (<Link key={href} href={href} onClick={closeDrawer} className={cn("flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary", FOCUS_RING)}>

                        <Icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden/>

                        {label}

                      </Link>))}

                  </div>

                </div>



                

                {!sellerLoading && (<div className="mt-5 border-t border-border/70 pt-4">

                    <p className="px-3 pb-1 font-secondary text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">

                      Jualan

                    </p>



                    <div className="mt-1">

                      {isSeller ? (<Link href="/dashboard/penjual" onClick={closeDrawer} className={cn("flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-semibold text-primary transition-colors hover:bg-accent", FOCUS_RING)}>

                          <LayoutDashboard className="h-[18px] w-[18px] shrink-0" aria-hidden/>

                          Toko Saya

                        </Link>) : (<Link href="/auth/register/penjual" onClick={closeDrawer} className={cn("flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-semibold text-primary transition-colors hover:bg-accent", FOCUS_RING)}>

                          <Megaphone className="h-[18px] w-[18px] shrink-0" aria-hidden/>

                          Mulai Jual

                        </Link>)}

                    </div>

                  </div>)}

              </nav>



              

              <div className="border-t border-border px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">

                {user ? (<button type="button" onClick={handleLogout} className={cn("flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-4 text-sm font-semibold text-destructive transition-colors hover:border-destructive hover:bg-destructive hover:text-white", FOCUS_RING)}>

                    <LogOut className="h-4 w-4" aria-hidden/>

                    Keluar Akun

                  </button>) : (<Link href="/auth/login" onClick={closeDrawer} className={cn("flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-dark", FOCUS_RING)}>

                    <LogIn className="h-4 w-4" aria-hidden/>

                    Masuk / Daftar

                  </Link>)}

              </div>

            </motion.aside>

          </>)}

      </AnimatePresence>

    </>);
}
