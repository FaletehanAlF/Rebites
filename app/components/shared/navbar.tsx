"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/current-user";
import { useProfile } from "@/hooks/use-profile";
import { useNotifications } from "@/hooks/use-notifications";
import { BUYER_TOPBAR_OFFSET_CLASS } from "./profile-sidebar-nav";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white";

/**
 * Topbar desktop untuk area pembeli.
 *
 * Topbar mulai tepat di sisi kanan sidebar (tanpa logo kedua — branding ada di
 * sidebar) dan hanya memuat akses notifikasi serta profil. Ikon profil
 * mengarah langsung ke halaman `/profile`; proteksi autentikasi tetap
 * ditangani `RequireAuth` pada route tersebut.
 */
export function BuyerTopbar({ collapsed = false }: { collapsed?: boolean }) {
  const { userId } = useCurrentUser();
  const { avatarUrl } = useProfile();
  const { unreadCount } = useNotifications(userId, "buyer");

  return (
    <header
      className={cn(
        "fixed right-0 top-0 z-30 hidden h-16 border-b border-border bg-white transition-[left] duration-200 ease-out lg:block",
        collapsed
          ? BUYER_TOPBAR_OFFSET_CLASS.collapsed
          : BUYER_TOPBAR_OFFSET_CLASS.expanded,
      )}
    >
      <div className="flex h-full items-center justify-end gap-2 px-6 xl:px-8">
        <Link
          href="/notifikasi/pembeli"
          aria-label={
            unreadCount > 0
              ? `Notifikasi, ${unreadCount} belum dibaca`
              : "Notifikasi"
          }
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-primary",
            FOCUS_RING,
          )}
        >
          <Bell className="h-5 w-5" aria-hidden />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        <Link
          href="/profile"
          aria-label="Buka halaman profil"
          title="Profil Saya"
          className={cn(
            "flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-primary transition-colors hover:border-primary/40 hover:bg-accent",
            FOCUS_RING,
          )}
        >
          {avatarUrl ? (
            <span className="relative h-full w-full overflow-hidden rounded-full">
              <Image
                src={avatarUrl}
                alt=""
                fill
                sizes="40px"
                className="object-cover"
                unoptimized
              />
            </span>
          ) : (
            <User className="h-[18px] w-[18px]" aria-hidden />
          )}
        </Link>
      </div>
    </header>
  );
}
