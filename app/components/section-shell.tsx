'use client';

import { cn } from '@/lib/utils';
import { SoftBlob } from '@/app/components/ornaments';

type SectionTone = 'cream' | 'white' | 'green' | 'transparent';

const toneClasses: Record<SectionTone, string> = {
  cream: 'grain-overlay bg-cream',
  white: 'grain-overlay bg-white',
  green: 'grain-overlay bg-primary',
  transparent: '',
};

interface SectionShellProps {
  id?: string;
  dataNav?: 'cream' | 'green';
  tone?: SectionTone;
  className?: string;
  containerClassName?: string;
  children: React.ReactNode;
}

/**
 * Consistent full-width section canvas: tone background (with grain),
 * a soft ambient blob and a page-gutter container.
 */
export function SectionShell({
  id,
  dataNav,
  tone = 'cream',
  className,
  containerClassName,
  children,
}: SectionShellProps) {
  return (
    <section
      id={id}
      data-nav={dataNav}
      className={cn(
        'relative overflow-hidden pt-28 pb-16 lg:pt-36 lg:pb-20',
        toneClasses[tone],
        className,
      )}
    >
      <SoftBlob
        className={cn(
          // `blur-3xl` (filter 64px pada bidang 448px) diganti gradien radial
          // di SoftBlob: glow sama, tanpa biaya filter saat halaman digulir.
          'pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full',
          tone === 'green' ? 'bg-white/[0.06]' : 'bg-primary/[0.06]',
        )}
      />

      <div
        className={cn(
          'relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8',
          containerClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}