"use client";

import { useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { cn } from "@/lib/utils";
import { BuyerTopbar } from "./navbar";
import {
  BUYER_CONTENT_OFFSET_CLASS,
  BuyerSidebarNav,
} from "./profile-sidebar-nav";
import { MobileNavbar } from "./MobileNavbar";
import { MobileBottomNav } from "./MobileBottomNav";

const SIDEBAR_COLLAPSED_KEY = "rebites-buyer-sidebar-collapsed";

/** Event internal agar halaman lain (mis. /pengaturan) bisa sinkron instan. */
export const SIDEBAR_COLLAPSED_CHANGED_EVENT =
  "rebites-buyer-sidebar-collapsed-changed";

export function getSidebarCollapsedPreference(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    // localStorage bisa tidak tersedia (mode privat/SSR); anggap tidak ringkas.
    return false;
  }
}

export function setSidebarCollapsedPreference(collapsed: boolean) {
  try {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_KEY,
      collapsed ? "1" : "0",
    );
  } catch {
    // Non-blocking: preferensi hanya nice-to-have.
  }
  window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_CHANGED_EVENT));
}

interface BuyerShellProps {
  children: React.ReactNode;
  /** Sembunyikan bottom nav pada alur terfokus seperti checkout. */
  showBottomNav?: boolean;
}

/**
 * Kerangka halaman pembeli.
 *
 * Desktop : topbar ringkas + sidebar kiri + konten kanan.
 * Mobile  : topbar ringkas + drawer (MobileNavbar) + bottom nav.
 *
 * Konten tidak diberi container sendiri supaya halaman tetap bebas memakai
 * layout full-bleed (hero, footer, grid) tanpa nesting yang berlebihan.
 */
export function BuyerShell({
  children,
  showBottomNav = true,
}: BuyerShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(getSidebarCollapsedPreference());

    // Preferensi bisa diubah dari halaman lain (mis. /pengaturan). Listener
    // ini membuat perubahan diterapkan seketika tanpa menunggu refresh.
    const onPreferenceChange = () => setCollapsed(getSidebarCollapsedPreference());
    window.addEventListener(SIDEBAR_COLLAPSED_CHANGED_EVENT, onPreferenceChange);
    window.addEventListener("storage", onPreferenceChange);
    return () => {
      window.removeEventListener(SIDEBAR_COLLAPSED_CHANGED_EVENT, onPreferenceChange);
      window.removeEventListener("storage", onPreferenceChange);
    };
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // Non-blocking: preferensi hanya nice-to-have.
      }
      return next;
    });
  };

  return (
    // reducedMotion="user" menghormati preferensi sistem: transform/opacity
    // animasi dimatikan bagi pengguna yang memilih "kurangi gerak". Halaman
    // pembeli tidak memakai MotionConfig sebelumnya, sehingga animasi
    // framer-motion di /home berjalan penuh walau preferensi itu aktif.
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-secondary">
        <div className="lg:hidden">
          <MobileNavbar />
        </div>

        <BuyerTopbar collapsed={collapsed} />
        <BuyerSidebarNav
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />

        <div
          className={cn(
            "min-w-0 pt-14 transition-[padding] duration-200 ease-out lg:pt-16",
            collapsed
              ? BUYER_CONTENT_OFFSET_CLASS.collapsed
              : BUYER_CONTENT_OFFSET_CLASS.expanded,
          )}
        >
          {children}
          {showBottomNav && <MobileBottomNav />}
        </div>
      </div>
    </MotionConfig>
  );
}
