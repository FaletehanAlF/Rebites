import { Skeleton } from "@/app/components/ui/skeleton";
export function VendorCardSkeleton() {
    return (<div className="overflow-hidden rounded-2xl border border-border bg-white">
      <Skeleton className="aspect-[4/3] w-full rounded-none"/>
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-2/3"/>
        <Skeleton className="h-3 w-1/2"/>
        <Skeleton className="h-9 w-full rounded-full"/>
      </div>
    </div>);
}
