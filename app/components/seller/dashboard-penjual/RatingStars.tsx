'use client';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
export function RatingStars({ rating, className, }: {
    rating: number;
    className?: string;
}) {
    const safe = Number.isFinite(rating)
        ? Math.min(5, Math.max(0, Math.round(rating)))
        : 0;
    return (<span role="img" aria-label={`Rating ${safe} dari 5`} className={cn('flex items-center gap-0.5', className)}>

      {[1, 2, 3, 4, 5].map((n) => (<Star key={n} aria-hidden className={cn('h-3.5 w-3.5', n <= safe
                ? 'fill-gold-600 text-gold-600'
                : 'text-muted-foreground/80')}/>))}

    </span>);
}
