'use client';

import type { ReactNode } from 'react';
import { CircleAlert, Inbox, Loader2, Lock, RefreshCw } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * State admin yang seragam: memuat, gagal, akses ditolak, dan kosong.
 * Halaman admin tidak lagi menulis ulang blok ini satu per satu.
 *
 * Catatan jarak: state ini TIDAK memakai margin atas sendiri. Halaman
 * sudah memberi jarak lewat `AdminPageHeader` (mb-6) dan toolbar (mb-4),
 * sehingga margin tambahan di sini membuat state error/terlarang mulai
 * 48px di bawah judul — tidak sejajar dengan isi halaman saat normal.
 */

const IKON = 'h-10 w-10 shrink-0 text-primary';

export function AdminLoadingState({ label = 'Memuat data' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3"
    >
      <Loader2 aria-hidden className="h-7 w-7 animate-spin text-primary motion-reduce:animate-none" />
      <p className="text-sm text-sage-500">{label}…</p>
    </div>
  );
}

export function AdminErrorState({
  title = 'Gagal memuat data',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center px-6 py-14 text-center">
        <CircleAlert aria-hidden className={IKON} />
        <h2 className="mt-4 font-display text-lg font-semibold text-charcoal-900">
          {title}
        </h2>
        <p className="mt-1.5 max-w-sm text-sm text-sage-500">{message}</p>
        {onRetry && (
          <Button type="button" size="sm" className="mt-5" onClick={onRetry}>
            <RefreshCw aria-hidden className="h-3.5 w-3.5" />
            Coba Lagi
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminForbiddenState({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center px-6 py-14 text-center">
        <Lock aria-hidden className={IKON} />
        <h2 className="mt-4 font-display text-lg font-semibold text-charcoal-900">
          Akses ditolak
        </h2>
        <p className="mt-1.5 max-w-sm text-sm text-sage-500">
          {message ?? 'Halaman ini hanya dapat diakses oleh admin.'}
        </p>
      </CardContent>
    </Card>
  );
}

export function AdminEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center px-6 py-14 text-center">
        {icon ?? <Inbox aria-hidden className={IKON} />}
        <h2 className="mt-4 font-display text-lg font-semibold text-charcoal-900">
          {title}
        </h2>
        <p className="mt-1.5 max-w-sm text-sm text-sage-500">{description}</p>
        {action && <div className="mt-5">{action}</div>}
      </CardContent>
    </Card>
  );
}

/** Pesan error pendek di dalam modal atau panel, bukan halaman penuh. */
export function AdminInlineError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-[var(--radius)] border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 break-words">{message}</span>
    </p>
  );
}

/** Baris info singkat di dalam panel: dipakai untuk status riwayat, filter, dsb. */
export function AdminInlineMessage({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'danger' | 'success';
}) {
  return (
    <p
      className={cn(
        'text-sm',
        tone === 'danger' && 'text-destructive',
        tone === 'success' && 'text-success',
        tone === 'neutral' && 'text-sage-500'
      )}
    >
      {children}
    </p>
  );
}

/** Pemuat ringkas untuk panel kecil (drawer, sidebar detail). */
export function AdminInlineLoading({ label = 'Memuat' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex items-center justify-center gap-2.5 py-8 text-sm text-sage-500"
    >
      <Loader2 aria-hidden className="h-4 w-4 animate-spin text-primary motion-reduce:animate-none" />
      {label}…
    </div>
  );
}