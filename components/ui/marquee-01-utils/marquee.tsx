import { cn } from '@/lib/utils';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

interface MarqueeProps extends ComponentPropsWithoutRef<'div'> {
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  repeat?: number;
  children?: ReactNode;
}

// Marquee horizontal generik (pola shadcn/magicui): konten digandakan
// `repeat` kali, tiap salinan dianimasikan translateX linear dan diulang
// di titik seam (-100% - gap) sehingga sambungan tak terlihat.
// Opsi `reverse` membalik arah; `pauseOnHover` menghentikan saat kursor di atas.
// Kecepatan diatur via `[--duration:...]` dan jarak antar kartu via `[--gap:...]`
// pada className wrapper (default 40s / 1rem).
export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  repeat = 4,
  children,
  ...props
}: MarqueeProps) {
  return (
    <div
      {...props}
      className={cn('group flex overflow-hidden [--duration:40s] [--gap:1rem] [gap:var(--gap)]', className)}
    >
      {Array.from({ length: repeat }).map((_, i) => (
        <div
          key={i}
          aria-hidden={i > 0}
          className={cn(
            'animate-marquee flex w-max shrink-0 justify-around [gap:var(--gap)]',
            reverse && '[animation-direction:reverse]',
            pauseOnHover && 'group-hover:[animation-play-state:paused]',
          )}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
