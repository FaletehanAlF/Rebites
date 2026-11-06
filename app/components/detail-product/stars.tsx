import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Stars({
  rating,
  className,
  size = 14,
}: {
  rating: number;
  className?: string;
  size?: number;
}) {
  return (
    <span
      role="img"
      aria-label={`Rating ${rating.toFixed(1)} dari 5`}
      className={cn('inline-flex items-center gap-0.5', className)}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = rating - i;
        return (
          <Star
            key={i}
            style={{ width: size, height: size }}
            strokeWidth={0}
            aria-hidden
            className={cn(
              fill >= 0.75
                ? 'fill-primary text-primary'
                : fill >= 0.25
                  ? 'fill-primary/50 text-primary/50'
                  : 'fill-border-100 text-primary-foreground'
            )}
          />
        );
      })}
    </span>
  );
}
