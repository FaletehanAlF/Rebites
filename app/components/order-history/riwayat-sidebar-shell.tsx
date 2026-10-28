'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { ProfileSidebarNav } from '@/app/components/shared/profile-sidebar-nav';
import { MobileNavbar } from '@/app/components/shared/MobileNavbar';
import { MobileBottomNav } from '@/app/components/shared/MobileBottomNav';

export function RiwayatSidebarShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-secondary lg:bg-secondary">
      <div className="lg:hidden"><MobileNavbar /></div>
      <div className="hidden lg:block">
        <ProfileSidebarNav open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="lg:pl-[280px]">
        <MobileBottomNav />
        {}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Buka navigasi"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display text-base font-semibold text-primary">Pesanan Saya</span>
        </div>

        <main className="mx-auto max-w-[1100px] px-4 pb-24 pt-[104px] sm:pb-20 sm:pt-6 lg:px-8 lg:pt-8">
          <header className="hidden lg:block">
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-primary">
              Pesanan Saya
            </h1>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
              Lihat status dan detail setiap pesanan, termasuk perjalanan pengantaran
              dan rincian biayanya.
            </p>
          </header>
          <div className="mt-4 lg:mt-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
