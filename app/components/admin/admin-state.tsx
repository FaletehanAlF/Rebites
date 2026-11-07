'use client';
import type { ReactNode } from 'react';
import { CircleAlert, Inbox, Lock, RefreshCw } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';
import { cn } from '@/lib/utils';
const IKON = 'h-10 w-10 shrink-0 text-primary';
export function AdminLoadingState({ label = 'Memuat data' }: {
    label?: string;
}) {
    return (<div role="status" aria-live="polite" aria-label={label} className="space-y-4">
      <Skeleton className="h-9 w-56 rounded-full bg-white/80 ring-1 ring-border/60"/>
      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="border-b border-border bg-secondary/60 px-4 py-3">
          <Skeleton className="h-4 w-full rounded-full bg-white/70"/>
        </div>
        <div className="space-y-3 px-4 py-4">
          {[0, 1, 2, 3].map((i) => (<Skeleton key={i} className="h-10 w-full rounded-lg bg-white/70 ring-1 ring-border/50"/>))}
        </div>
      </div>
      <p className="text-sm text-sage-500">{label}…</p>
    </div>);
}
export function AdminErrorState({ title = 'Gagal memuat data', message, onRetry, className, }: {
    title?: string;
    message: string;
    onRetry?: () => void;
    className?: string;
}) {
    return (<Card className={className}>
      <CardContent className="flex flex-col items-center px-6 py-14 text-center">
        <CircleAlert aria-hidden className={IKON}/>
        <h2 className="mt-4 font-display text-lg font-semibold text-charcoal-900">
          {title}
        </h2>
        <p className="mt-1.5 max-w-sm text-sm text-sage-500">{message}</p>
        {onRetry && (<Button type="button" size="sm" className="mt-5" onClick={onRetry}>
            <RefreshCw aria-hidden className="h-3.5 w-3.5"/>
            Coba Lagi
          </Button>)}
      </CardContent>
    </Card>);
}
export function AdminForbiddenState({ message, className, }: {
    message?: string;
    className?: string;
}) {
    return (<Card className={className}>
      <CardContent className="flex flex-col items-center px-6 py-14 text-center">
        <Lock aria-hidden className={IKON}/>
        <h2 className="mt-4 font-display text-lg font-semibold text-charcoal-900">
          Akses ditolak
        </h2>
        <p className="mt-1.5 max-w-sm text-sm text-sage-500">
          {message ?? 'Halaman ini hanya dapat diakses oleh admin.'}
        </p>
      </CardContent>
    </Card>);
}
export function AdminEmptyState({ icon, title, description, action, className, }: {
    icon?: ReactNode;
    title: string;
    description: string;
    action?: ReactNode;
    className?: string;
}) {
    return (<Card className={className}>
      <CardContent className="flex flex-col items-center px-6 py-14 text-center">
        {icon ?? <Inbox aria-hidden className={IKON}/>}
        <h2 className="mt-4 font-display text-lg font-semibold text-charcoal-900">
          {title}
        </h2>
        <p className="mt-1.5 max-w-sm text-sm text-sage-500">{description}</p>
        {action && <div className="mt-5">{action}</div>}
      </CardContent>
    </Card>);
}
export function AdminInlineError({ message }: {
    message?: string | null;
}) {
    if (!message)
        return null;
    return (<p role="alert" className="flex items-start gap-2 rounded-[var(--radius)] border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0"/>
      <span className="min-w-0 break-words">{message}</span>
    </p>);
}
export function AdminInlineMessage({ children, tone = 'neutral', }: {
    children: ReactNode;
    tone?: 'neutral' | 'danger' | 'success';
}) {
    return (<p className={cn('text-sm', tone === 'danger' && 'text-destructive', tone === 'success' && 'text-success', tone === 'neutral' && 'text-sage-500')}>
      {children}
    </p>);
}
export function AdminInlineLoading({ label = 'Memuat' }: {
    label?: string;
}) {
    return (<div role="status" aria-label={label} className="flex items-center justify-center gap-2.5 py-6 text-sm text-sage-500">
      <Skeleton className="h-4 w-32 rounded-full bg-white/80 ring-1 ring-border/60"/>
      <span className="sr-only">{label}…</span>
    </div>);
}
