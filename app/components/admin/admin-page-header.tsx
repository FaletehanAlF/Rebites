import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Kepala halaman admin. Semua halaman memakai komponen ini supaya
 * jarak, ukuran judul, warna, dan posisi tombol aksi selalu sama.
 */
export const ADMIN_PAGE_WRAPPER =
  // max-w-7xl (80rem): konten tabel admin butuh ruang horizontal agar
  // kolom tidak terpotong di layar 1440px. max-w-6xl membuat tabel
  // artikel (minWidth 1080px) nyaris tidak muat di dalam padding.
  'mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8';

// Hierarki tipografi admin (satu sumber kebenaran):
//   page title 28-32px / weight 700
//   eyebrow (metadata) 12px / weight 600
//   body 14px / line-height longgar
// Ukuran memakai clamp agar tetap proporsional di layar sempit tanpa
// melompat ke ukuran teks yang kebesaran.
export const ADMIN_PAGE_TITLE =
  'mt-1 font-display text-[clamp(1.75rem,2.4vw,2rem)] font-bold tracking-tight text-primary';

export const ADMIN_PAGE_EYEBROW =
  'text-xs font-semibold uppercase tracking-[0.14em] text-sage-500';

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  backHref,
  backLabel = 'Kembali ke dasbor',
  actions,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-6', className)}>
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-semibold text-sage-500 transition-colors hover:bg-sage-100/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {backLabel}
        </Link>
      )}

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className={ADMIN_PAGE_EYEBROW}>{eyebrow}</p>}
          <h1 className={cn(ADMIN_PAGE_TITLE, 'break-words')}>{title}</h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-sage-500">
              {description}
            </p>
          )}
        </div>
        {(actions || children) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
            {children}
          </div>
        )}
      </div>
    </header>
  );
}