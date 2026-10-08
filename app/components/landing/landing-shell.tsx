'use client';

import type { ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { SmoothScroll } from '@/app/components/smooth-scroll';

/**
 * Client boundary untuk seluruh situs publik ReBites.
 *
 * Halaman di `app/(landing)/` tetap Server Component (markup statis tidak
 * pernah dikirim sebagai JS klien), dan hanya hal yang benar-benar butuh
 * browser — framer-motion `MotionConfig` serta Lenis — yang dibatasi di
 * sini. `children` datang dari server, jadi section di dalamnya dirender
 * sekali di server dan dilewatkan sebagai payload.
 *
 * `reducedMotion="user"` membuat semua animasi framer-motion (Reveal,
 * transisi tab) menghormati prefers-reduced-motion — aturan CSS global hanya
 * menutup animasi CSS, bukan animasi berbasis JS.
 */
export function LandingShell({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <SmoothScroll>{children}</SmoothScroll>
    </MotionConfig>
  );
}
