import { cn } from '@/lib/utils';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

interface MarqueeProps extends ComponentPropsWithoutRef<'div'> {
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  vertical?: boolean;
  repeat?: number;
  children?: ReactNode;
}

// Marquee generik (pola shadcn/magicui). `vertical` untuk arah atas-bawah;
// kecepatan diatur via `[--duration:...]`, celah via `[--gap:...]`.
export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  vertical = false,
  repeat = 4,
  children,
  ...props
}: MarqueeProps) {
  return (
    <div {...props} className={cn('group flex overflow-hidden [--duration:40s] [--gap:1rem] [gap:var(--gap)]', vertical ? 'h-full flex-col' : 'w-full flex-row', className)}>
      {Array.from({ length: repeat }).map((_, i) => (
        <div key={i} aria-hidden={i > 0} className={cn('flex shrink-0 justify-around [gap:var(--gap)]', vertical ? 'animate-marquee-vertical flex-col' : 'animate-marquee flex-row', pauseOnHover && 'group-hover:[animation-play-state:paused]', reverse && '[animation-direction:reverse]')}>
          {children}
        </div>
      ))}
    </div>
  );
}
