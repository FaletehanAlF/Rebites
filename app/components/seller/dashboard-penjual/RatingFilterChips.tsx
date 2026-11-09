'use client';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
export type RatingFilter = number | 'all';
export function RatingFilterChips({ value, onChange, className, }: {
    value: RatingFilter;
    onChange: (next: RatingFilter) => void;
    className?: string;
}) {
    return (<div className={cn('flex flex-wrap gap-2', className)}>

      {(['all', 5, 4, 3, 2, 1] as const).map((option) => {
            const selected = value === option;
            return (<button key={String(option)} type="button" onClick={() => onChange(option)} aria-pressed={selected} aria-label={option === 'all' ? 'Semua rating' : `Filter ${option} bintang`} className={cn('inline-flex items-center gap-1 rounded-full px-4 py-2 text-xs font-semibold transition-colors', selected
                    ? 'bg-primary text-white'
                    : 'border border-border bg-white text-muted-foreground hover:text-foreground')}>

            {option === 'all' ? ('Semua') : (<>

                {option}

                <Star aria-hidden className={cn('h-3 w-3', selected
                        ? 'fill-gold-300 text-gold-300'
                        : 'fill-gold-600 text-gold-600')}/>

              </>)}

          </button>);
        })}

    </div>);
}
