'use client';
import type { ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { SmoothScroll } from '@/app/components/smooth-scroll';
import { Preloader } from '@/app/components/preloader';
export function LandingShell({ children }: {
    children: ReactNode;
}) {
    return (<MotionConfig reducedMotion="user">
      <SmoothScroll>
        <Preloader />
        {children}
      </SmoothScroll>
    </MotionConfig>);
}
