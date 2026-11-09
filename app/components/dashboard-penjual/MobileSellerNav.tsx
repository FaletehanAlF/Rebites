"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ShoppingBag, Store, TrendingUp, Utensils, } from "lucide-react";
import { cn } from "@/lib/utils";
import { sellerStorePath, type SellerSubPage } from "@/lib/seller-store-path";
function sellerNavItems(storeId: string) {
    const page = (sub?: SellerSubPage) => sellerStorePath(storeId, sub);
    return [
        { href: page(), label: "Beranda", icon: LayoutGrid, exact: true },
        { href: page("pesanan"), label: "Pesanan", icon: ShoppingBag },
        { href: page("menu"), label: "Menu", icon: Utensils },
        { href: page("performa"), label: "Performa", icon: TrendingUp },
        { href: page("pengaturan"), label: "Profil", icon: Store },
    ];
}
export function MobileSellerNav({ storeId }: {
    storeId: string;
}) {
    const pathname = usePathname();
    const navItems = sellerNavItems(storeId);
    const isActive = (href: string, exact?: boolean) => {
        if (!pathname)
            return false;
        return exact ? pathname === href : pathname.startsWith(href);
    };
    return (<nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden" aria-label="Navigasi dashboard penjual">

      <div className="mx-auto flex max-w-lg items-center justify-around gap-1 px-1 py-1">

        {navItems.map((item) => {
            const active = isActive(item.href, item.exact);
            return (<Link key={item.label} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex min-w-[56px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground")}>

              <item.icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} strokeWidth={active ? 2.2 : 1.8}/>

              <span className="truncate">{item.label}</span>

            </Link>);
        })}

      </div>

    </nav>);
}
