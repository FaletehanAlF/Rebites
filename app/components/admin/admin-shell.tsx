'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopbar } from './admin-topbar';
import { AdminErrorState } from './admin-state';
import { Toaster } from '@/app/components/ui/toaster';
import { ADMIN_SIDEBAR_COLLAPSED_KEY } from '@/lib/admin-preferences';
import { useRequireAdmin } from '@/hooks/use-require-admin';
import { cn } from '@/lib/utils';

interface AdminShellProps {
  children: ReactNode;
}

/**
 * Satu-satunya sumber lebar rel sidebar.
 *
 * Sebelumnya lebar 264px ditulis tiga kali (lebar `<aside>`, `pl-[264px]` pada
 * kolom konten, dan `left-[264px]` pada topbar). Tiga angka yang harus selalu
 * sama tetapi tersebar adalah bug menunggu terjadi begitu salah satunya
 * diubah — dan mode collapse memang mengubahnya. Sekarang ketiganya membaca
 * `--admin-rail-w` yang dipasang sekali di sini.
 */
const RAIL_EXPANDED = '264px';
const RAIL_COLLAPSED = '76px';

/**
 * Tombol "kembali ke atas" yang muncul setelah halaman digulir jauh.
 * Membantu admin kembali ke kepala halaman (dan ke topbar yang selalu
 * menempel) tanpa harus menggulir panjang dengan roda mouse.
 */
function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Kembali ke atas halaman"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={cn(
        'fixed bottom-5 right-5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-admin-panel/90 text-charcoal-700 shadow-admin-pop backdrop-blur transition-all duration-200',
        'hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        visible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-3 opacity-0'
      )}
    >
      <ArrowUp aria-hidden className="h-4 w-4" />
    </button>
  );
}

/**
 * Kerangka panel admin.
 *
 * Struktur flex kolom supaya tinggi halaman dihitung dengan benar:
 * - `<header>` (topbar) memakai `fixed top-0` (lihat admin-topbar.tsx) →
 *   selalu menempel di viewport sampai dasar halaman, termasuk saat pengguna
 *   menggulir lalu memilih halaman lain (mis. Moderasi) dari sidebar.
 *   `fixed` dipakai, bukan `sticky`: `sticky` terlepas begitu containing
 *   block-nya habis, sehingga bar tidak lagi menempel di dasar halaman.
 *   Kompensasinya adalah spacer `h-16` di dalam AdminTopbar.
 * - `<main>` memakai `flex-1` (bukan `min-h-screen`) supaya tinggi konten
 *   mengisi sisa layar TANPA menambah 57px tinggi topbar ke dokumen.
 *   Versi lama memakai `min-h-screen` di `<main>` sehingga SETIAP halaman
 *   admin selalu lebih panjang dari viewport: scrollbar permanen, bayangan
 *   topbar selalu menyala, dan ada ruang kosong di dasar halaman.
 */
export function AdminShell({ children }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { status, loading, errorMessage, retry } = useRequireAdmin();

  // Preferensi collapse desktop. `null` = belum dibaca dari storage, jadi
  // render pertama memakai lebar penuh. Itu disengaja: server dan klien
  // merender markup yang sama (tidak ada hydration mismatch), lalu efek
  // di bawah menerapkan preferensi setelah mount. Konsekuensinya pengguna
  // yang memilih ringkas melihat satu frame lebar penuh — harga yang wajar
  // dibanding menyembunyikan sidebar sampai JS selesai membaca storage.
  const [collapsed, setCollapsed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_KEY) === '1');
    } catch {
      // localStorage bisa diblokir (mode privat/kebijakan). Fail-open ke
      // sidebar terbuka — tampilan tetap utuh, hanya preferensinya tidak
      // tersimpan. Tidak ada alasan menggagalkan panel admin karenanya.
      setCollapsed(false);
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(ADMIN_SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // Diamkan: lihat alasan di atas. Preferensi bersifat kosmetik.
      }
      return next;
    });
  }, []);

  const railWidth = collapsed ? RAIL_COLLAPSED : RAIL_EXPANDED;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-admin-canvas">
        <div
          role="status"
          aria-label="Memuat panel admin"
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none"
        />
      </div>
    );
  }

  // Pemeriksaan akses GAGAL (jaringan/5xx/timeout). Ini bukan "bukan admin":
  // sesi mungkin masih sah, jadi halaman tidak dialihkan dan isinya tidak
  // dirender. Admin mendapat pesan + tombol coba lagi di tempat.
  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-admin-canvas p-6">
        <div className="w-full max-w-md">
          <AdminErrorState
            title="Gagal memeriksa akses admin"
            message={errorMessage ?? 'Tidak dapat memeriksa status admin. Coba lagi.'}
            onRetry={retry}
          />
        </div>
      </div>
    );
  }

  // `unauthenticated`/`forbidden`: redirect sedang berjalan. Jangan render
  // isi halaman sebelum verdict admin diterima (fail-closed).
  if (status !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-admin-canvas">
        <div
          role="status"
          aria-label="Mengalihkan halaman"
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none"
        />
      </div>
    );
  }

  return (
    <div
      // `overflow-x-clip` menjaga agar tidak ada scroll horizontal di level
      // dokumen. Aman dipakai di sini karena `clip` TIDAK memotong elemen
      // `position: fixed` (tooltip sidebar, tombol kembali ke atas) —
      // berbeda dari `overflow: hidden` yang akan memotongnya. Dropdown
      // notifikasi dan menu profil memakai `absolute right-0`, jadi
      // membuka ke dalam dan tidak melewati tepi ini.
      className="flex min-h-screen flex-col overflow-x-clip bg-admin-canvas font-sans text-charcoal-900"
      // Lebar rel dipasang sebagai variabel CSS supaya sidebar, topbar, dan
      // kolom konten membacanya dari satu sumber. `--admin-rail-w` dipakai
      // lewat kelas arbitrary di ketiga tempat (lihat AdminSidebar/AdminTopbar).
      style={{ '--admin-rail-w': railWidth } as CSSProperties}
    >
      <AdminSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed === true}
        onToggleCollapsed={toggleCollapsed}
      />

      {/* Padding kiri mengikuti `--admin-rail-w`; transisinya disamakan
          dengan lebar sidebar supaya keduanya bergerak sebagai satu bidang,
          bukan konten yang menyentak setelah sidebar selesai. */}
      <div className="flex min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-out motion-reduce:transition-none lg:pl-[var(--admin-rail-w)]">
        <AdminTopbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="min-h-0 flex-1">{children}</main>
      </div>

      <ScrollToTopButton />

      {/* Satu Toaster untuk SELURUH panel admin.
          Sebelumnya tidak ada Toaster di shell, padahal beberapa halaman
          (artikel, detail UMKM) memanggil `toast()`. Tanpa viewport,
          `toast()` hanya menulis ke state dan tidak pernah tampil —
          admin tidak mendapat konfirmasi sukses maupun pesan gagal.
          Dipasang sekali di sini (bukan per halaman) supaya tidak ada
          dua viewport yang menumpuk toast yang sama. */}
      <Toaster />
    </div>
  );
}
