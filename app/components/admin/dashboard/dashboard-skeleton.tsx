import { Skeleton } from '@/app/components/ui/skeleton';
export function DashboardSkeleton() {
    return (<div role="status" aria-label="Memuat dasbor" className="space-y-3">

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-28 rounded-[var(--radius)] bg-sage-100/60 ring-1 ring-border/50"/>))}

      </div>

      <div className="mt-3 grid grid-cols-2 gap-4 xl:grid-cols-4">

        {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-24 rounded-[var(--radius)] bg-sage-100/60 ring-1 ring-border/50"/>))}

      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">

        <Skeleton className="h-64 rounded-[var(--radius)] bg-sage-100/60 ring-1 ring-border/50 lg:col-span-2"/>

        <Skeleton className="h-64 rounded-[var(--radius)] bg-sage-100/60 ring-1 ring-border/50"/>

      </div>

    </div>);
}
