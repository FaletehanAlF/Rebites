import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground-strong',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        // `outline` sebelumnya memakai `text-caramel` (#C8A882). Di atas
        // putih kontrasnya hanya ~1.9:1 sehingga teks badge praktis tidak
        // terbaca pada ukuran 11px. Sekarang memakai hijau primary panel
        // (7.3:1) dengan latar sangat tipis.
        outline: 'border-primary/30 bg-primary/[0.06] text-primary',
        // Catatan: opacity 15 TIDAK ada di skala opacity bawaan Tailwind,
        // sehingga `bg-success/15` tidak pernah menghasilkan CSS dan badge
        // tampil tanpa latar sama sekali. Nilai arbitrer /[0.15] dipakai
        // supaya tint yang dimaksud benar-benar diterapkan.
        success:
          'border-transparent bg-success/[0.15] text-success',
        warning:
          'border-transparent bg-warning/[0.15] text-warning-strong',
        destructive:
          'border-transparent bg-destructive/[0.15] text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
