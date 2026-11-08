import { Card, CardContent } from '@/app/components/ui/card';
import { cn } from '@/lib/utils';
export function DashboardSection({ title, description, children, className, }: {
    title: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (<section className={cn('min-w-0', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        
        <h2 className="font-display text-[15px] font-semibold tracking-tight text-charcoal-900">
          {title}
        </h2>
        {description && <p className="text-xs text-sage-500">{description}</p>}
      </div>
      <div className="mt-3">{children}</div>
    </section>);
}
export function DashboardCard({ children, className, }: {
    children: React.ReactNode;
    className?: string;
}) {
    return (<Card className={cn('rounded-[var(--radius)]', className)}>
      <CardContent className="p-5">{children}</CardContent>
    </Card>);
}
