export function DashboardSkeleton() {
    return (<div className="animate-pulse motion-reduce:animate-none" role="status" aria-label="Memuat dasbor">

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {Array.from({ length: 4 }).map((_, i) => (<div key={i} className="h-28 rounded-[var(--radius)] bg-sage-100/60"/>))}

      </div>

      <div className="mt-3 grid grid-cols-2 gap-4 xl:grid-cols-4">

        {Array.from({ length: 4 }).map((_, i) => (<div key={i} className="h-24 rounded-[var(--radius)] bg-sage-100/60"/>))}

      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">

        <div className="h-64 rounded-[var(--radius)] bg-sage-100/60 lg:col-span-2"/>

        <div className="h-64 rounded-[var(--radius)] bg-sage-100/60"/>

      </div>

    </div>);
}
