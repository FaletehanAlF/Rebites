import { Skeleton } from '@/app/components/ui/skeleton';
export default function SellerDashboardLoading() {
    return (<div role="status" aria-label="Memuat dashboard penjual" className="min-h-screen bg-secondary">
      <div className="mx-auto max-w-[1400px] px-5 pt-20 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Skeleton className="h-3 w-32 rounded-full"/>
            <Skeleton className="mt-3 h-9 w-64 max-w-full rounded-full"/>
          </div>
          <Skeleton className="h-11 w-36 shrink-0 rounded-full"/>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
          <div className="space-y-5 lg:col-span-8">
            <Skeleton className="h-[300px] rounded-3xl"/>
            <Skeleton className="h-48 rounded-3xl"/>
          </div>
          <div className="space-y-5 lg:col-span-4">
            <Skeleton className="h-52 rounded-3xl"/>
            <Skeleton className="h-44 rounded-3xl"/>
          </div>
        </div>
      </div>
    </div>);
}
