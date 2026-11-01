
'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

type Direction = 'left' | 'right' | 'top' | 'bottom';
type Mode = 'stack' | 'slide';

interface HeroStackProps {
  children: ReactNode;
  direction?: Direction;
  mode?: Mode;
  distance?: number;
  duration?: number;
  className?: string;
}

export function HeroStack({
  children,
  direction = 'top',
  mode = 'stack',
  distance = 80,
  duration = 1,
  className = '',
}: HeroStackProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const panel = panelRef.current;

    if (!wrapper || !panel) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const ctx = gsap.context(() => {
      if (mode === 'stack') {
        ScrollTrigger.create({
          trigger: wrapper,
          start: 'top top',
          end: '+=100%',
          pin: panel,
          pinSpacing: false,
          anticipatePin: 1,
        });

        return;
      }

      const horizontal =
        direction === 'left' || direction === 'right';

      const property = horizontal ? 'x' : 'y';

      const sign =
        direction === 'right' || direction === 'bottom' ? 1 : -1;

      gsap.to(panel, {
        [property]: sign * distance,
        ease: 'none',
        scrollTrigger: {
          trigger: wrapper,
          start: 'top top',
          end: () => `+=${window.innerHeight * duration}`,
          scrub: true,
          pin: wrapper,
          pinSpacing: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });
    }, wrapper);

    const refreshId = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });

    return () => {
      cancelAnimationFrame(refreshId);
      ctx.revert();
    };
  }, [direction, mode, distance, duration]);

  return (
    <div
      ref={wrapperRef}
      className={`relative w-full bg-white ${className}`}
    >
      <div
        ref={panelRef}
        className="relative w-full bg-white"
      >
        {children}
      </div>
    </div>
  );
}
