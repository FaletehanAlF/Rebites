import { Skeleton } from "@/app/components/ui/skeleton";
export function SellerShellSkeleton() {
    return (<div role="status" aria-label="Memuat dashboard penjual" className="min-h-screen bg-secondary">
      <div className="hidden bg-white/80 backdrop-blur-md lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:w-[240px] lg:border-r lg:border-border/60 lg:px-4 lg:py-5">
        <Skeleton className="h-10 w-40 rounded-xl bg-white/70 ring-1 ring-border/50"/>
        <div className="mt-7 space-y-2.5">
          {Array.from({ length: 6 }).map((_, index) => (<Skeleton key={index} className="h-9 w-full rounded-xl bg-white/70 ring-1 ring-border/50"/>))}
        </div>
      </div>

      <div className="lg:pl-[240px]">
        <div className="sticky top-0 z-30 border-b border-border/60 bg-white/75 px-4 py-3 shadow-[0_2px_16px_-8px_rgba(31,45,36,0.12)] backdrop-blur-xl sm:px-6 lg:px-10">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-8 w-40 rounded-full bg-white/80 ring-1 ring-border/60 lg:hidden"/>
            <Skeleton className="ml-auto hidden h-9 w-9 rounded-full bg-white/80 ring-1 ring-border/60 sm:block"/>
            <Skeleton className="h-9 w-32 rounded-full bg-white/80 ring-1 ring-border/60"/>
          </div>
        </div>

        <div className="mx-auto max-w-[1400px] px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10">
          <Skeleton className="h-9 w-64 rounded-full bg-white/70 ring-1 ring-border/50"/>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (<Skeleton key={index} className="h-28 rounded-2xl bg-white/70 ring-1 ring-border/50"/>))}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
            <Skeleton className="h-72 rounded-2xl bg-white/70 ring-1 ring-border/50 lg:col-span-8"/>
            <Skeleton className="h-72 rounded-2xl bg-white/70 ring-1 ring-border/50 lg:col-span-4"/>
          </div>
        </div>
      </div>
    </div>);
}
