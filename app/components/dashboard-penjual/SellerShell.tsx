'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { DashboardDecor } from './decor';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileSellerNav } from './MobileSellerNav';
import { useRequireSeller } from '@/hooks/use-require-seller';

interface SellerShellProps {
  children: ReactNode;
}

export function SellerShell({ children }: SellerShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { loading } = useRequireSeller();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen bg-secondary font-sans text-foreground">
        <DashboardDecor />

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
