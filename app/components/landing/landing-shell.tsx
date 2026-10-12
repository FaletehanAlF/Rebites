'use client';

import type { ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { SmoothScroll } from '@/app/components/smooth-scroll';

export function LandingShell({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <SmoothScroll>
        <div className="theme-landing">{children}</div>
      </SmoothScroll>
    </MotionConfig>
  );
}
