import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { Skeleton } from '@/app/components/ui/skeleton';
import { useStoreRouteId } from '@/hooks/use-store-route-id';
import { sellerStorePath } from '@/lib/seller-store-path';
export function SalesEmptyState({ title, description, }: {
    title: string;
    description: string;
}) {
    return (<div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-secondary/70 px-6 py-9 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <BarChart3 className="h-5 w-5"/>
      </span>
      <div>
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>);
}
export function CardLinesSkeleton() {
    return (<div aria-hidden className="space-y-2.5">
      {[0, 1, 2].map((i) => (<Skeleton key={i} className="h-4 w-full rounded-full"/>))}
    </div>);
}
export function DashboardCtaLink() {
    const storeId = useStoreRouteId();
    return (<Link href={sellerStorePath(storeId, 'tambahMenu')} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-primary-dark">
      Kelola Menu
    </Link>);
}
