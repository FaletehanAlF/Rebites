import { Skeleton } from "@/app/components/ui/skeleton";
export function FoodCardSkeleton() {
    return (<div className="overflow-hidden rounded-2xl border border-border bg-white">
      <Skeleton className="aspect-[4/3] w-full rounded-none"/>
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-4 w-3/4"/>
        <Skeleton className="h-3.5 w-1/2"/>
        <Skeleton className="h-4 w-24"/>
        <Skeleton className="h-10 w-full rounded-full"/>
      </div>
    </div>);
}
