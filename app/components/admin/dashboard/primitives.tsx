import { Card, CardContent } from '@/app/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Section dashboard.
 *
 * Tanpa margin atas bawaan: section ini dipakai di dua konteks —
 * berdiri sendiri (butuh jarak dari section sebelumnya) dan di dalam grid
 * (jarak sudah ditangani `gap` grid). Margin yang menempel pada komponen
 * membuat tinggi baris grid tidak rata dan section di dalam grid terlihat
 * bergeser ke bawah. Pemanggil yang berdiri sendiri menambahkan `mt-8`.
 */
export function DashboardSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('min-w-0', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-base font-semibold tracking-tight text-charcoal-900">
          {title}
        </h2>
        {description && <p className="text-xs text-sage-500">{description}</p>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function DashboardCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('rounded-[var(--radius)]', className)}>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}