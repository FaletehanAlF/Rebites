"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, ReceiptText, User, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/current-user";
import { useNotifications } from "@/hooks/use-notifications";
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white";
const ITEMS = [
    { href: "/home", label: "Beranda", icon: Home },
    { href: "/makanan", label: "Makanan", icon: UtensilsCrossed },
    { href: "/riwayatPesanan", label: "Pesanan", icon: ReceiptText },
    { href: "/notifikasi/pembeli", label: "Notifikasi", icon: Bell },
    { href: "/profile", label: "Profil", icon: User },
] as const;
export function MobileBottomNav() {
    const pathname = usePathname();
    const { userId } = useCurrentUser();
    const { unreadCount } = useNotifications(userId, "buyer");
    const isActive = (href: string) => {
        if (!pathname)
            return false;
        if (href === "/home")
            return pathname === "/home";
        return pathname === href || pathname.startsWith(`${href}/`);
    };
    return (<nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Navigasi bawah">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            const showBadge = href === "/notifikasi/pembeli" && unreadCount > 0;
            return (<Link key={href} href={href} aria-current={active ? "page" : undefined} aria-label={showBadge
                    ? `${label}, ${unreadCount} belum dibaca`
                    : label} className={cn("flex min-h-12 min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-medium transition-colors", active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground", FOCUS_RING)}>
              <span className={cn("relative flex h-8 w-8 items-center justify-center rounded-full transition-colors", active ? "bg-accent text-primary" : "text-muted-foreground")}>
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.8} aria-hidden/>
                {showBadge && (<span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>)}
              </span>
              <span>{label}</span>
            </Link>);
        })}
      </div>
    </nav>);
}
