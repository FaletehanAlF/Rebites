"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  ChevronDown,
  MapPin,
  Menu,
  Store,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/current-user";
import { useProfile } from "@/hooks/use-profile";
import { useNotifications } from "@/hooks/use-notifications";
import { useSellerStatus } from "@/hooks/use-seller-status";

const LOCATIONS = ["Depok", "Jakarta Selatan", "Bekasi", "Bogor", "Tangerang"];

const NAV_LINKS = [
  { id: "home", label: "Beranda" },
  { id: "rekomendasi", label: "Makanan" },
  { id: "flashSale", label: "Diskon Kilat" },
  { id: "umkm", label: "UMKM" },
  { id: "langganan", label: "Langganan" },
];

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

interface AuthSessionUser {
  email?: string;
  user_metadata?: { full_name?: string };
}

export function MobileNavbar() {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [location, setLocation] = useState(LOCATIONS[0]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<{
    fullName: string;
    email: string;
  } | null>(null);
  const { userId } = useCurrentUser();
  const { avatarUrl } = useProfile();
  const { unreadCount: unreadNotifCount } = useNotifications(userId, "buyer");
  const { isSeller } = useSellerStatus();

  useEffect(() => {
    let cancelled = false;
    const readUser = ({
      data,
    }: {
      data: { session: { user: AuthSessionUser | null } | null };
    }) => {
      if (cancelled) return;
      const user = data.session?.user;
      if (!user) {
        setSessionUser(null);
        return;
      }
      setSessionUser({
        fullName: user.user_metadata?.full_name ?? "",
        email: user.email ?? "",
      });
    };
    supabase.auth.getSession().then(readUser);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      readUser({
        data: { session } as { session: { user: AuthSessionUser | null } | null },
      });
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSessionUser(null);
    setProfileOpen(false);
    router.push("/auth/login");
  };

  const handleNav = (id: string) => {
    setDrawerOpen(false);
    scrollToId(id);
  };

  const initials = sessionUser?.fullName
    ? sessionUser.fullName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p.charAt(0).toUpperCase())
        .join("")
    : "";

  return (
    <>
      {/* Mobile-only sticky header */}
      <header className="fixed inset-x-0 top-0 z-50 lg:hidden">
        <div className="bg-white/95 backdrop-blur-lg border-b border-border">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <Link href="/home" className="flex shrink-0 items-center gap-2">
              <Image
                src="/logo.png"
                alt="ReBites"
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover"
              />
              <span className="font-display text-lg font-bold tracking-tight text-primary">
                ReBites
              </span>
            </Link>

            <div className="ml-auto flex items-center gap-1">
              <Link
                href="/notifikasi/pembeli"
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <Bell className="h-5 w-5" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                    {unreadNotifCount}
                  </span>
                )}
              </Link>

              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                aria-label="Profil"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                {avatarUrl ? (
                  <span className="relative h-7 w-7 overflow-hidden rounded-full ring-1 ring-black/5">
                    <Image
                      src={avatarUrl}
                      alt="Foto profil"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </span>
                ) : initials ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {initials}
                  </span>
                ) : (
                  <User className="h-5 w-5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Buka menu navigasi"
                aria-expanded={drawerOpen}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>


        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-[55] bg-primary/40 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed right-0 top-0 z-[60] flex h-full w-[85vw] max-w-[320px] flex-col bg-secondary shadow-2xl lg:hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <span className="flex items-center gap-2">
                  <Image
                    src="/logo.png"
                    alt="ReBites"
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <span className="font-display text-lg font-bold text-primary">
                    ReBites
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Tutup menu"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-4">
                <ul className="space-y-1">
                  {NAV_LINKS.map((link) => (
                    <li key={link.id}>
                      <a
                        href={`#${link.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          handleNav(link.id);
                        }}
                        className="block rounded-xl px-4 py-3 font-secondary text-sm font-medium text-foreground hover:bg-muted hover:text-primary"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 border-t border-border pt-4 space-y-1">
                  <Link
                    href="/notifikasi/pembeli"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center justify-between rounded-xl px-4 py-3 font-secondary text-sm text-foreground hover:bg-muted hover:text-primary"
                  >
                    <span className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Notifikasi
                    </span>
                    {unreadNotifCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                        {unreadNotifCount}
                      </span>
                    )}
                  </Link>

                  <Link
                    href="/profile"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-4 py-3 font-secondary text-sm text-foreground hover:bg-muted hover:text-primary"
                  >
                    <User className="h-4 w-4" />
                    Profil Saya
                  </Link>

                  {isSeller && (
                    <Link
                      href="/dashboard/penjual"
                      onClick={() => setDrawerOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-4 py-3 font-secondary text-sm text-foreground hover:bg-muted hover:text-primary"
                    >
                      <Store className="h-4 w-4" />
                      Dashboard Penjual
                    </Link>
                  )}
                </div>

                <div className="mt-4 border-t border-border pt-4">
                  <p className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Lokasi
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setLocation(
                        LOCATIONS[
                          (LOCATIONS.indexOf(location) + 1) % LOCATIONS.length
                        ],
                      );
                    }}
                    className="mt-2 flex items-center gap-2 px-4 text-sm font-medium text-primary"
                  >
                    <MapPin className="h-4 w-4" />
                    {location}
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </nav>

              <div className="border-t border-border p-4">
                {sessionUser ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive hover:bg-destructive/15"
                  >
                    Keluar Akun
                  </button>
                ) : (
                  <Link
                    href="/auth/login"
                    onClick={() => setDrawerOpen(false)}
                    className="block w-full rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white hover:bg-primary-dark"
                  >
                    Masuk / Daftar
                  </Link>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
