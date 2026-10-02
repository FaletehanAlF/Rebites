"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, ChevronDown, MapPin, Menu, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/lib/current-user";
import { useProfile } from "@/hooks/use-profile";
import { useNotifications } from "@/hooks/use-notifications";
import { AccountSidebar } from "./account-sidebar";

const LOCATIONS = ["Depok", "Jakarta Selatan", "Bekasi", "Bogor", "Tangerang"];

const NAV_LINKS = [
  { id: "home", label: "Beranda" },
  { id: "rekomendasi", label: "Makanan" },
  { id: "flashSale", label: "Diskon Kilat" },
  { id: "umkm", label: "UMKM" },
  { id: "langganan", label: "Langganan" },
];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// Module scope so React keeps the same component type across renders —
// defining it inside ProfileNavbar remounted both buttons (losing focus,
// restarting transitions) on every navbar render.
function IconButton({
  label,
  children,
  onClick,
  badge,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200",
        "text-muted-foreground hover:bg-muted hover:text-primary",
        FOCUS_RING,
      )}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span
          className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white"
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

interface ProfileNavbarProps {
  showLocationDropdown?: boolean;
}

export function ProfileNavbar({
  showLocationDropdown = true,
}: ProfileNavbarProps) {
  const router = useRouter();
  const [active, setActive] = useState("profil");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [location, setLocation] = useState(LOCATIONS[0]);
  const [profileOpen, setProfileOpen] = useState(false);
  // Single source of truth for the session: useCurrentUser already subscribes
  // to auth changes; a second getSession/onAuthStateChange pair was removed.
  const { user: sessionUser, userId } = useCurrentUser();
  const { avatarUrl } = useProfile();
  const { unreadCount: unreadNotifCount } = useNotifications(userId, "buyer");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfileOpen(false);
    router.push("/auth/login");
  };

  useEffect(() => {
    const ids = NAV_LINKS.map((l) => l.id);
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleNav = (id: string) => {
    setDrawerOpen(false);
    setActive(id);
    scrollToId(id);
  };

  return (
    <>
      <header className="hidden fixed inset-x-0 top-0 z-50 px-5 pt-3 sm:px-8 sm:pt-4 lg:block lg:px-5 lg:pt-4">
        <div className="mx-auto w-full max-w-[1400px]">
          <nav
            className={cn(
              "flex min-w-fit items-center justify-between rounded-full border border-border/70 bg-white px-5 text-primary shadow-[0_20px_44px_-26px_rgba(47,66,53,0.45)] backdrop-blur-xl transition-colors duration-500 lg:h-16 lg:px-6",
            )}
          >
            <Link
              href="/home"
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full sm:gap-2",
                FOCUS_RING,
              )}
            >
              <Image
                src="/logo.png"
                alt="ReBites"
                width={36}
                height={36}
                className="h-9 w-9 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-black/5"
              />
              <span
                className={cn(
                  "font-sans text-xl font-bold tracking-tight text-primary transition-colors duration-500",
                )}
              >
                ReBites
              </span>
            </Link>

            <ul className="hidden items-center gap-1 lg:flex">
              {NAV_LINKS.map((link) => (
                <li key={link.id}>
                  <a
                    href={`#${link.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNav(link.id);
                    }}
                    aria-current={active === link.id ? "page" : undefined}
                    className={cn(
                      "rounded-full px-3 py-2 font-secondary text-sm transition-colors duration-200 xl:px-4",
                      active === link.id
                        ? "bg-muted font-semibold text-primary"
                        : "text-muted-foreground hover:text-primary",
                      FOCUS_RING,
                    )}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-0.5 sm:gap-1 lg:gap-0.5">
              {showLocationDropdown && (
                <div className="relative">
                  <button
                    type="button"
                    aria-label="Pilih lokasi"
                    aria-expanded={locationOpen}
                    onClick={() => setLocationOpen((v) => !v)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors duration-200",
                      "text-muted-foreground hover:bg-muted hover:text-primary",
                      FOCUS_RING,
                    )}
                  >
                    <MapPin
                      className="h-4 w-4 text-primary transition-colors duration-500"
                    />
                    <span className="max-w-[100px] truncate">{location}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        locationOpen && "rotate-180",
                      )}
                    />
                  </button>

                  <AnimatePresence>
                    {locationOpen && (
                      <>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-40"
                          onClick={() => setLocationOpen(false)}
                        />
                        <motion.ul
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.18 }}
                          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-white p-1.5 text-primary shadow-xl"
                        >
                          {LOCATIONS.map((loc) => (
                            <li key={loc}>
                              <button
                                type="button"
                                onClick={() => {
                                  setLocation(loc);
                                  setLocationOpen(false);
                                }}
                                className={cn(
                                  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150",
                                  loc === location
                                    ? "bg-muted font-semibold text-primary"
                                    : "text-muted-foreground hover:bg-secondary hover:text-primary",
                                )}
                              >
                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                {loc}
                              </button>
                            </li>
                          ))}
                        </motion.ul>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div className="flex items-center gap-2">
                <IconButton
                  label="Notifikasi"
                  onClick={() => {
                    window.location.href = "/notifikasi/pembeli";
                  }}
                  badge={unreadNotifCount}
                >
                  <Bell className="h-5 w-5" />
                </IconButton>
                <IconButton
                  label="Profil saya"
                  onClick={() => setProfileOpen(true)}
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
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                </IconButton>
              </div>

              <button
                type="button"
                aria-label="Buka menu navigasi"
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen((v) => !v)}
                className={cn(
                  "hidden h-10 w-10 items-center justify-center rounded-full text-primary transition-colors duration-200 lg:hidden",
                  FOCUS_RING,
                )}
              >
                {drawerOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </nav>
        </div>
      </header>

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
              className="fixed right-0 top-0 z-[60] flex h-full w-72 flex-col bg-secondary p-5 shadow-2xl lg:hidden"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Image
                    src="/logo.png"
                    alt="ReBites"
                    width={36}
                    height={36}
                    className="h-9 w-9 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-black/5"
                  />
                  <span className="font-sans text-xl font-bold text-primary">
                    ReBites
                  </span>
                </span>
                <button
                  type="button"
                  aria-label="Tutup menu"
                  onClick={() => setDrawerOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <ul className="mt-8 flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <li key={link.id}>
                    <a
                      href={`#${link.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNav(link.id);
                      }}
                      className={cn(
                        "block rounded-xl px-4 py-3 font-secondary text-sm transition-colors duration-150",
                        active === link.id
                          ? "bg-muted font-semibold text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-primary",
                      )}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>

                <div className="mt-4 border-t border-border pt-4">
                <Link
                  href="/notifikasi/pembeli"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center justify-between rounded-xl px-4 py-3 font-secondary text-sm text-muted-foreground hover:bg-muted hover:text-primary"
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
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <p className="font-secondary text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                  className="mt-2 flex items-center gap-2 text-sm font-medium text-primary"
                >
                  <MapPin className="h-4 w-4" />
                  {location}
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AccountSidebar
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        user={sessionUser}
        onLogout={handleLogout}
      />
    </>
  );
}
