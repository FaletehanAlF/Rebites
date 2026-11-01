'use client';

import { useRef } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion';
import { cn } from '@/lib/utils';

const SPRING = { stiffness: 320, damping: 24, mass: 0.8 };

export function MagneticButton({
  children,
  href,
  onClick,
  variant = 'default',
  className,
  strength = 0.4,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'light' | 'white';
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLAnchorElement | HTMLButtonElement>(null);
  const rectRef = useRef<DOMRect | null>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, SPRING);
  const springY = useSpring(y, SPRING);
  const contentX = useTransform(springX, (v) => v * 0.3);
  const contentY = useTransform(springY, (v) => v * 0.3);

  const handleEnter = () => {
    const el = ref.current;
    if (!el) return;
    rectRef.current = el.getBoundingClientRect();
  };

  const handleMove = (e: React.MouseEvent) => {
    const rect = rectRef.current;
    if (!rect) return;
    x.set((e.clientX - rect.left - rect.width / 2) * strength);
    y.set((e.clientY - rect.top - rect.height / 2) * strength);
  };

  const reset = () => {
    rectRef.current = null;
    x.set(0);
    y.set(0);
  };

  const base = cn(
    'group relative inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 font-sans text-sm font-medium tracking-tight transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    variant === 'default' &&
      'bg-primary text-primary-foreground-strong hover:bg-primary-dark',
    variant === 'outline' &&
      'border border-primary/40 text-primary hover:border-primary hover:bg-primary-dark hover:text-white',
    variant === 'light' &&
      'bg-secondary text-primary hover:bg-primary-dark hover:text-white border border-primary/10',
    variant === 'white' &&
      'border border-primary/40 bg-white text-primary hover:border-primary hover:bg-primary-dark hover:text-white',
    className
  );

  const content = (
    <motion.span
      className="relative z-10 flex items-center gap-2"
      style={{ x: contentX, y: contentY }}
    >
      {children}
    </motion.span>
  );

  if (href) {
    return (
      <motion.a
        href={href}
        ref={ref as React.RefObject<HTMLAnchorElement>}
        className={base}
        onMouseEnter={handleEnter}
        onMouseMove={handleMove}
        onMouseLeave={reset}
        style={{ x: springX, y: springY, willChange: 'transform' }}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      ref={ref as React.RefObject<HTMLButtonElement>}
      className={base}
      onMouseEnter={handleEnter}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ x: springX, y: springY, willChange: 'transform' }}
    >
      {content}
    </motion.button>
  );
}

