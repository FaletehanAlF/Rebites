'use client';
import Link from 'next/link';
import { Lock, ShieldCheck } from 'lucide-react';
import { Card } from './Card';
interface LockedFeatureCardProps {
    title: string;
    description: string;
    requiredPlanLabel: string;
    upgradeSlug?: 'standar' | 'premium';
    compact?: boolean;
    ctaLabel?: string;
    ctaHref?: string;
}
export function LockedFeatureCard({ title, description, requiredPlanLabel, upgradeSlug = 'standar', compact = false, ctaLabel, ctaHref, }: LockedFeatureCardProps) {
    return (<Card className={compact
            ? 'flex items-center gap-4 border-dashed border-border bg-secondary/60'
            : 'border-dashed border-border bg-secondary/60'} aria-label={`${title} - butuh ${requiredPlanLabel}`}>
      <div className={compact ? 'shrink-0' : 'flex flex-col gap-3'}>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Lock className="h-5 w-5"/>
        </span>
        <div>
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
          <Link href={ctaHref ??
            `/langganan/pembayaran?plan=${upgradeSlug}&billing=monthly`} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-primary-dark">
            <ShieldCheck className="h-3.5 w-3.5"/>
            {ctaLabel ?? `Upgrade ke ${requiredPlanLabel}`}
          </Link>
        </div>
      </div>
    </Card>);
}
