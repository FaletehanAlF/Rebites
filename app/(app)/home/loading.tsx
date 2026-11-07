import { Skeleton } from '@/app/components/ui/skeleton';
export default function HomeLoading() {
    return (<div role="status" aria-label="Memuat beranda" className="min-h-screen bg-secondary">
      <div className="mx-auto max-w-[1400px] px-5 pt-24 sm:px-8 lg:px-12">
        <Skeleton className="h-10 w-2/3 max-w-md rounded-full"/>
        <Skeleton className="mt-4 h-10 w-1/2 max-w-sm rounded-full"/>
        <Skeleton className="mt-6 h-4 w-full max-w-lg rounded-full"/>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-24 rounded-xl"/>))}
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (<Skeleton key={i} className="h-64 rounded-2xl"/>))}
        </div>
      </div>
    </div>);
}
