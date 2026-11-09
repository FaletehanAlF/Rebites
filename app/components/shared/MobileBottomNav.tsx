"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ReceiptText, User } from "lucide-react";
import { cn } from "@/lib/utils";
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white";
const ITEMS = [
    { href: "/home", label: "Beranda", icon: Home },
    { href: "/riwayatPesanan", label: "Pesanan", icon: ReceiptText },
    { href: "/profile", label: "Profil", icon: User },
] as const;
export function MobileBottomNav() {
    const pathname = usePathname();
    const isActive = (href: string) => {
        if (!pathname)
            return false;
        if (href === "/home")
            return pathname === "/home";
        return pathname === href || pathname.startsWith(`${href}/`);
    };
    return (<nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Navigasi bawah">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1.5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (<Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-[48px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1 text-[11px]", active ? "bg-accent" : "bg-transparent", FOCUS_RING)}>
              <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} strokeWidth={2} aria-hidden/>
              <span className={cn(active ? "font-bold text-primary" : "font-semibold text-muted-foreground")}>{label}</span>
            </Link>);
        })}
      </div>
    </nav>);
}
