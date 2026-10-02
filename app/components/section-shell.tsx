
import { cn } from '@/lib/utils';
import { SoftBlob } from '@/app/components/shared/ornaments';

type SectionTone = 'neutral' | 'white' | 'green' | 'transparent';

const toneClasses: Record<SectionTone, string> = {
  neutral: 'grain-overlay bg-secondary',
  white: 'grain-overlay bg-white',
  green: 'grain-overlay bg-primary',
  transparent: '',
};

interface SectionShellProps {
  id?: string;
  dataNav?: 'neutral' | 'green';
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
  tone = 'neutral',
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
          'pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full blur-3xl',
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
