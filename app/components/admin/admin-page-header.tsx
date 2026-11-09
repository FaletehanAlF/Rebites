import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
export const ADMIN_PAGE_WRAPPER = 'mx-auto w-full max-w-7xl px-4 pb-10 pt-5 sm:px-6 lg:px-8';
export const ADMIN_BACK_LABEL = 'Back';
export const ADMIN_PAGE_TITLE = 'font-display text-2xl font-semibold leading-tight tracking-[-0.01em] text-primary';
export function AdminPageHeader({ title, description, backHref, backLabel = ADMIN_BACK_LABEL, actions, children, className, }: {
    title: string;
    description?: string;
    backHref?: string;
    backLabel?: string;
    actions?: ReactNode;
    children?: ReactNode;
    className?: string;
}) {
    return (<header className={cn('mb-6', className)}>

      {backHref && (<Link href={backHref} className="-ml-2 mb-3 inline-flex items-center gap-1.5 rounded-[var(--radius)] px-2 py-1.5 text-[13px] font-semibold text-sage-500 transition-colors hover:bg-sage-100/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">

          <ArrowLeft aria-hidden className="h-4 w-4"/>

          {backLabel}

        </Link>)}



      

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">

        <div className="min-w-0">

          <h1 className={cn(ADMIN_PAGE_TITLE, 'break-words text-balance')}>{title}</h1>

          {description && (<p className="mt-2 max-w-prose text-sm leading-relaxed text-sage-500">

              {description}

            </p>)}

        </div>

        {(actions || children) && (<div className="flex shrink-0 flex-wrap items-center gap-2">

            {actions}

            {children}

          </div>)}

      </div>

    </header>);
}
