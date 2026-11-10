import { cn } from '@/lib/utils';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

interface MarqueeProps extends ComponentPropsWithoutRef<'div'> {
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  repeat?: number;
  children?: ReactNode;
}

// Marquee horizontal generik (pola shadcn/magicui), dengan opsi reverse
// melihat arah berlawanan dan pauseOnHover (aksi berhenti saat di-hover).
// Kecepatan diatur via `[--duration:...]`.
export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  repeat = 4,
  children,
  ...props
}: MarqueeProps) {
  return (
    <div {...props} className={cn('group flex overflow-hidden [--duration:40s] [--gap:1rem] [gap:var(--gap)]', className)}>
      {Array.from({ length: repeat }).map((_, i) => (
        <div key={i} aria-hidden={i > 0} className={cn('animate-marquee flex shrink-0 justify-around [gap:var(--gap)] [--duration:20s]', reverse && '[animation-direction:reverse]', pauseOnHover && 'group-hover:[animation-play-state:paused]')}>
          {children}
        </div>
      ))}
    </div>
  );
}
