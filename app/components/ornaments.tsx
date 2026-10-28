'use client';

import { useId } from 'react';
import { motion } from 'framer-motion';
import { Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SoftBlob({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        // Tepi lembut dibuat dengan `mask-image`, bukan `filter: blur()`.
        // Sebelumnya kelas ini memakai `blur-3xl` (radius 64px) dan dipakai
        // belasan kali di landing/home; setiap filter blur pada bidang besar
        // harus dihitung ulang saat halaman digulir — itu yang terasa sebagai
        // scroll "patah-patah". Mask memberi gradien transparan yang sama
        // secara visual tanpa biaya filter.
        'pointer-events-none absolute rounded-full',
        '[mask-image:radial-gradient(circle_at_center,black_30%,transparent_72%)]',
        '[-webkit-mask-image:radial-gradient(circle_at_center,black_30%,transparent_72%)]',
        className
      )}
    />
  );
}

export function FloatingLeaf({
  className,
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  return (
    <motion.span
      aria-hidden
      animate={{ y: [0, -14, 0], rotate: [0, 10, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay }}
      className={cn('pointer-events-none absolute', className)}
    >
      <Leaf className="h-full w-full" strokeWidth={1.5} />
    </motion.span>
  );
}

export function DotPattern({ className }: { className?: string }) {
  const rawId = useId();
  const id = rawId.replace(/:/g, '');
  return (
    <svg aria-hidden className={cn('pointer-events-none absolute', className)}>
      <defs>
        <pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.4" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export function ArcLines({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 600"
      fill="none"
      className={cn('pointer-events-none absolute', className)}
    >
      <path
        d="M -40,120 C 280,300 640,140 1240,420"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M -40,210 C 340,370 680,240 1240,470"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LeafSprig({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 200"
      fill="none"
      className={cn('pointer-events-none absolute', className)}
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M100 180 C90 130 95 80 110 30" strokeWidth="1.5" />
        <path
          d="M96 150 C70 140 60 120 64 100 C88 104 100 124 96 150 Z"
          strokeWidth="1.4"
          fill="currentColor"
          fillOpacity="0.14"
        />
        <path
          d="M108 120 C132 110 142 92 138 72 C116 76 104 94 108 120 Z"
          strokeWidth="1.4"
          fill="currentColor"
          fillOpacity="0.14"
        />
        <path
          d="M98 88 C76 78 68 60 72 42 C94 46 104 64 98 88 Z"
          strokeWidth="1.4"
          fill="currentColor"
          fillOpacity="0.14"
        />
      </g>
    </svg>
  );
}

export function Sparkle({
  className,
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  return (
    <motion.span
      aria-hidden
      className={cn('pointer-events-none absolute', className)}
      animate={{
        y: [0, -12, 0],
        rotate: [0, 45, 0],
        opacity: [0.25, 0.9, 0.25],
      }}
      transition={{
        duration: 4.5,
        repeat: Infinity,
        ease: 'easeInOut',
        delay,
      }}
    >
      <span className="block h-2.5 w-2.5 bg-white/60" style={{ clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)" }} />
    </motion.span>
  );
}

export function DashedDivider({
  className,
  tone = 'default',
}: {
  className?: string;
  tone?: 'default' | 'soft';
}) {
  return (
    <span
      aria-hidden
      className={cn('relative block h-px', className)}
      style={{
        background:
          'repeating-linear-gradient(90deg, currentColor 0 5px, transparent 5px 10px)',
        opacity: tone === 'soft' ? 0.2 : 0.35,
      }}
    >
      <span
        className={cn(
          'absolute left-1/2 top-0 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-current',
          'opacity-50',
        )}
      />
    </span>
  );
}
