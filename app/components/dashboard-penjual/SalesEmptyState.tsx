
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';

export function SalesEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-sage-100 bg-cream-50/70 px-6 py-9 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sage-100 text-sage-500">
        <BarChart3 className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-bold text-charcoal-900">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-sage-500">
          {description}
        </p>
      </div>
    </div>
  );
}

export function CardLinesSkeleton() {
  return (
    <div aria-hidden className="space-y-2.5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-4 w-full animate-pulse rounded-full bg-cream-100" />
      ))}
    </div>
  );
}

export function DashboardCtaLink() {
  return (
    <Link
      href="/dashboard/penjual/tambahMenu"
      className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-caramel"
    >
      Kelola Menu
    </Link>
  );
}
