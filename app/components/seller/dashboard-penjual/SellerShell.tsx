'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { MotionConfig } from 'framer-motion';
<<<<<<< HEAD:app/components/dashboard-penjual/SellerShell.tsx
import { RefreshCw, WifiOff } from 'lucide-react';
import { DashboardDecor } from './decor';
=======
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34:app/components/seller/dashboard-penjual/SellerShell.tsx
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileSellerNav } from './MobileSellerNav';
import { useRequireSeller } from '@/hooks/seller/use-require-seller';

interface SellerShellProps {
  children: ReactNode;
}

export function SellerShell({ children }: SellerShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { loading, status, errorMessage, retry } = useRequireSeller();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <div
          role="status"
          aria-label="Memuat dashboard penjual"
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none"
        />
      </div>
    );
  }

  // Pemeriksaan gagal (jaringan/database): tampilkan pesan dan tombol coba
  // lagi, bukan isi dashboard.
  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-6">
        <div className="w-full max-w-md rounded-[var(--radius)] border border-border bg-white p-6 text-center shadow-admin-card">
          <WifiOff aria-hidden className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-3 font-display text-lg font-semibold text-charcoal-900">
            Gagal memeriksa akses penjual
          </h1>
          <p className="mt-1.5 text-sm text-sage-500">
            {errorMessage ?? 'Tidak dapat memuat data toko. Coba lagi.'}
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <RefreshCw aria-hidden className="h-4 w-4" />
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen bg-secondary font-sans text-foreground">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="relative z-10 lg:pl-[280px]">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />

          <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-4 sm:px-6 sm:pt-6 lg:pb-10 lg:px-10">
            {children}
          </main>
        </div>

        <MobileSellerNav />
      </div>
    </MotionConfig>
  );
}
