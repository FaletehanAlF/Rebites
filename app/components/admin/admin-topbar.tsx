'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, LogOut, Menu, Settings, UserCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/current-user';
import { useAdminPreferences } from '@/hooks/use-admin-preferences';
import { AdminNotificationBell } from './admin-notification-bell';
import { cn } from '@/lib/utils';

interface AdminTopbarProps {
  onMenuClick: () => void;
}

const AREA_TITLES: { href: string; title: string; exact?: boolean }[] = [
  { href: '/dashboard/admin', title: 'Dashboard', exact: true },
  { href: '/dashboard/admin/moderasi', title: 'Moderasi', exact: true },
  { href: '/dashboard/admin/monitoring/aktivitas', title: 'Aktivitas' },
  { href: '/dashboard/admin/monitoring/laporan', title: 'Laporan' },
  { href: '/dashboard/admin/monitoring/peringatan', title: 'Peringatan' },
  { href: '/dashboard/admin/monitoring/sanksi', title: 'Sanksi' },
  { href: '/dashboard/admin/monitoring/audit', title: 'Log Audit' },
  { href: '/dashboard/admin/monitoring', title: 'Monitoring' },
  { href: '/dashboard/admin/permintaan-role', title: 'Permintaan Role' },
  { href: '/dashboard/admin/produk', title: 'Produk' },
  { href: '/dashboard/admin/pengguna', title: 'Pengguna' },
  { href: '/dashboard/admin/umkm', title: 'UMKM' },
  { href: '/dashboard/admin/pesanan', title: 'Pesanan' },
  { href: '/dashboard/admin/langganan', title: 'Langganan' },
  { href: '/dashboard/admin/artikel', title: 'Artikel' },
  { href: '/dashboard/admin/system', title: 'Kesehatan Sistem' },
  { href: '/dashboard/admin/pengaturan', title: 'Pengaturan' },
  { href: '/dashboard/admin/profile', title: 'Profil Saya' },
];

function getAreaTitle(pathname: string | null) {
  if (!pathname) return 'Admin';
  const normalized =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  for (const entry of AREA_TITLES) {
    if (entry.exact) {
      if (normalized === entry.href) return entry.title;
    } else if (normalized === entry.href || normalized.startsWith(`${entry.href}/`)) {
      return entry.title;
    }
  }
  return 'Admin';
}

/**
 * Induk halaman saat ini, ATAU null bila halaman ini dibuka dari menu samping.
 *
 * Dipakai untuk dua hal sekaligus di topbar:
 *   1. tombol "Back" — hanya muncul saat halaman memang DITUMPUK dari halaman
 *      lain, karena itulah satu-satunya keadaan di mana "kembali" punya arti
 *      (naik satu tingkat). Halaman yang dibuka dari menu samping tidak punya
 *      tumpukan untuk dikembalikan; menunya sendiri sudah jalan keluarnya.
 *   2. judul breadcrumb "Induk > Halaman" — juga hanya saat bertingkat.
 *
 * Halaman bertingkat saat ini:
 *   /pengguna/[id]                  <- Pengguna, Laporan, Moderasi, Permintaan Role
 *   /umkm/[id]                      <- UMKM, Produk, Aktivitas
 *   /monitoring/laporan/[id]        <- Laporan, Peringatan
 * Semuanya cocok dengan pola "[segmen1]/[id]" bersegmen TIGA setelah
 * /dashboard/admin, sehingga cukup dideteksi dari bentuk path — tidak perlu
 * daftar rute yang harus diperbarui tiap kali halaman detail baru ditambah.
 */
function parentOf(pathname: string | null): { href: string; label: string } | null {
  if (!pathname) return null;

  const segments = pathname
    .replace(/\/+$/, '')
    .replace(/^\/dashboard\/admin\/?/, '')
    .split('/')
    .filter(Boolean);

  // Satu segmen = halaman daftar yang dibuka langsung dari menu samping.
  if (segments.length !== 2) return null;

  const [bagian, id] = segments;
  if (!id) return null;

  const label = getAreaTitle(`/dashboard/admin/${bagian}`);
  return { href: `/dashboard/admin/${bagian}`, label };
}

export function AdminTopbar({ onMenuClick }: AdminTopbarProps) {
  const { user } = useCurrentUser();
  const { showNotificationBell } = useAdminPreferences();
  const pathname = usePathname();
  const router = useRouter();
  const areaTitle = getAreaTitle(pathname);
  const parent = parentOf(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  // Bayangan topbar muncul saat halaman digulir: menegaskan bahwa bar
  // ini memang melayang tetap di atas konten, bukan sekadar garis bawah.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Menutup menu profil saat pindah halaman supaya tidak menggantung
  // di atas konten halaman baru.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const initial = (user?.fullName || user?.email || 'A').trim().charAt(0).toUpperCase();

  const handleLogout = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  return (
    <>
      <header
        // `fixed` (bukan `sticky`): topbar harus tetap menempel sampai dasar
        // halaman. `sticky` hanya menempel selama containing block-nya masih
        // tersisa; begitu kolom konten habis, bar ikut terlepas — itulah
        // "sudah mentok tapi navbar tidak stay". `fixed` menempel pada
        // viewport, dan `lg:left-[264px]` menyamakan posisi kiri dengan
        // sidebar yang juga `fixed`. Z-index 30 sengaja di bawah drawer sisi
        // (z-40/50) supaya menu mobile tetap menutupi topbar.
        className={cn(
          // Latar PUTIH pekat (#ffffff) — tanpa opacity/blur, supaya konten
          // yang menggulir di bawahnya tidak tembus dan warna bar konsisten.
          // `left` mengikuti `--admin-rail-w` (bukan 264px tetap) agar bar
          // bergeser bersama sidebar saat diciutkan.
          'fixed left-0 right-0 top-0 z-30 border-b bg-white lg:left-[var(--admin-rail-w)]',
          'transition-[left,box-shadow] duration-200 ease-out motion-reduce:transition-none',
          scrolled
            ? 'border-border shadow-[0_2px_16px_-8px_rgba(30,43,32,0.28)]'
            : 'border-border/70'
        )}
      >
      {/* h-16 (64px) dipatok eksplisit, bukan dari padding + tinggi tombol.
          Sebelumnya topbar = py-2.5 + tombol h-9 = 56px, sedangkan kepala
          sidebar = py-4 + logo h-9 = 68px, sehingga garis bawah topbar
          tidak sejajar dengan garis bawah kepala sidebar (selisih 12px).
          Tinggi eksplisit membuat keduanya selalu sama walau isi berubah. */}
      <div className="flex h-16 min-w-0 items-center gap-2 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Buka menu navigasi"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] text-charcoal-900 transition-colors hover:bg-sage-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden"
        >
          <Menu aria-hidden className="h-5 w-5" />
        </button>

        <Link
          href="/dashboard/admin"
          className="min-w-0 flex-1 truncate text-sm font-bold text-charcoal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden"
        >
          ReBites
        </Link>

        {/*
          Satu label saja di topbar: judul halaman saat ini.

          Sebelumnya ada breadcrumb "Grup > Halaman", dan pada halaman
          bertingkat hasilnya terbaca "Pengguna > Pengguna" — mengulang kata
          yang sama dua kali, lalu diulang lagi oleh judul besar di bawahnya
          dan oleh tombol kembali. Topbar sekarang hanya menjawab "saya di
          mana", tombol Back menjawab "bagaimana naik satu tingkat".
        */}
        <div className="hidden min-w-0 flex-1 items-center gap-2 lg:flex">
          {parent && (
            <Link
              href={parent.href}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-semibold text-sage-500 transition-colors hover:bg-sage-100/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <ArrowLeft aria-hidden className="h-4 w-4" />
              Back
            </Link>
          )}
          <p className="truncate text-sm font-semibold text-charcoal-900">{areaTitle}</p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {showNotificationBell && <AdminNotificationBell />}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu profil admin"
              aria-expanded={menuOpen}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary ring-1 ring-black/5 transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {initial}
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-[var(--radius)] border border-border bg-white shadow-lg">
                <div className="border-b border-border bg-sage-100/30 px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-charcoal-900">
                    {user?.fullName || 'Admin'}
                  </p>
                  <p className="truncate text-xs text-sage-500">{user?.email || ''}</p>
                </div>
                <div className="p-1.5">
                  <Link
                    href="/dashboard/admin/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-[var(--radius)] px-3 py-2 text-sm font-medium text-charcoal-900 transition-colors hover:bg-sage-100/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <UserCircle aria-hidden className="h-4 w-4 text-sage-500" />
                    Profil Saya
                  </Link>
                  <Link
                    href="/dashboard/admin/pengaturan"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-[var(--radius)] px-3 py-2 text-sm font-medium text-charcoal-900 transition-colors hover:bg-sage-100/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <Settings aria-hidden className="h-4 w-4 text-sage-500" />
                    Pengaturan
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-[var(--radius)] px-3 py-2 text-sm font-medium text-charcoal-900 transition-colors hover:bg-sage-100/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <LogOut aria-hidden className="h-4 w-4 text-sage-500" />
                    Keluar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
    {/* Ruang pengganti topbar yang kini `fixed` (h-16 = tinggi topbar).
        Tanpa ini, baris pertama konten tertutup topbar saat halaman dibuka. */}
    <div aria-hidden className="h-16 shrink-0" />
    </>
  );
}
