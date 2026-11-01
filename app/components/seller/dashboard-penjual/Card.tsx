import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/70 bg-white p-5 shadow-sm sm:p-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
