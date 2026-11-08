import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
export const ADMIN_DETAIL_LABEL = 'text-xs font-semibold uppercase tracking-[0.06em] text-sage-500';
export function AdminDetailSection({ title, description, actions, children, className, }: {
    title: string;
    description?: string;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (<section className={cn('border-t border-border/70 pt-5 first:border-t-0 first:pt-0', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-semibold leading-snug text-charcoal-900">
            {title}
          </h3>
          {description && (<p className="mt-0.5 text-xs leading-relaxed text-sage-500">{description}</p>)}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="mt-3">{children}</div>
    </section>);
}
export function AdminDetailField({ label, children, className, mono = false, }: {
    label: string;
    children: ReactNode;
    className?: string;
    mono?: boolean;
}) {
    return (<div className={cn('min-w-0', className)}>
      <dt className={ADMIN_DETAIL_LABEL}>{label}</dt>
      <dd className={cn('mt-1 break-words text-sm leading-relaxed text-charcoal-900', mono && 'font-mono text-xs')}>
        {children}
      </dd>
    </div>);
}
export function AdminDetailGrid({ children, className, columns = 2, }: {
    children: ReactNode;
    className?: string;
    columns?: 2 | 3;
}) {
    return (<dl className={cn('grid grid-cols-1 gap-x-6 gap-y-4', columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3', className)}>
      {children}
    </dl>);
}
export function AdminDetailText({ children, className, muted = false, }: {
    children: ReactNode;
    className?: string;
    muted?: boolean;
}) {
    return (<p className={cn('max-w-prose whitespace-pre-wrap break-words text-sm leading-relaxed', muted ? 'text-sage-500' : 'text-charcoal-700', className)}>
      {children}
    </p>);
}
