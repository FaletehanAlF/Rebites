"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Settings,
  ShoppingBag,
  Star,
  TrendingUp,
  Utensils,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard/penjual", label: "Home", icon: LayoutGrid, exact: true },
  { href: "/dashboard/penjual/pesanan", label: "Pesanan", icon: ShoppingBag },
  { href: "/dashboard/penjual/menu", label: "Menu", icon: Utensils },
  { href: "/dashboard/penjual/performa", label: "Performa", icon: TrendingUp },
  { href: "/dashboard/penjual/pengaturan", label: "Lainnya", icon: Settings },
];

export function MobileSellerNav() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (!pathname) return false;
    return exact ? pathname === href : pathname.startsWith(href);
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white lg:hidden"
      aria-label="Navigasi dashboard penjual"
    >
      <div className="mx-auto flex max-w-lg items-center justify-around px-1 py-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-colors min-w-[56px]",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5",
                  active ? "text-primary" : "text-muted-foreground"
                )}
                strokeWidth={active ? 2.2 : 1.8}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
