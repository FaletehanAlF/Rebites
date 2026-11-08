import { cn } from '@/lib/utils';
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (<div aria-hidden className={cn('relative overflow-hidden rounded-md bg-muted', className)} {...props}>
      <span className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent motion-reduce:animate-none"/>
    </div>);
}
export { Skeleton };
