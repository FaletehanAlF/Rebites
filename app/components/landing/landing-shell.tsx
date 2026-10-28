'use client';

import type { ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { SmoothScroll } from '@/app/components/smooth-scroll';
import { Preloader } from '@/app/components/preloader';

/**
 * Client boundary for the landing page.
 *
 * `app/page.tsx` stays a Server Component (static markup never ships as client
 * JS and never has to be hydrated), while everything that genuinely needs the
 * browser — framer-motion's `MotionConfig`, Lenis, the intro overlay — is
 * isolated here. `children` come down from the server, so the sections in
 * between are rendered once on the server and passed through as payload.
 *
 * reducedMotion="user" makes all framer-motion animations (Reveal, marquees,
 * sparkles) respect prefers-reduced-motion — the global CSS rule only covers
 * CSS animations, not JS-driven ones.
 */
export function LandingShell({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <SmoothScroll>
        <Preloader />
        {children}
      </SmoothScroll>
    </MotionConfig>
  );
}
