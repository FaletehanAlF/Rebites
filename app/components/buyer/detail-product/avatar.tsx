'use client';
import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
export function Avatar({ name, src, className, }: {
    name: string;
    src: string;
    className?: string;
}) {
    const [failed, setFailed] = useState(false);
    const initials = name
        .split(' ')
        .slice(0, 2)
        .map((word) => word.charAt(0))
        .join('')
        .toUpperCase();
    if (failed) {
        return (<span aria-label={name} className={cn('flex shrink-0 items-center justify-center rounded-full bg-muted font-sans text-sm font-semibold text-primary', className)}>
        {initials}
      </span>);
    }
    return (<span aria-label={name} className={cn('relative block shrink-0 overflow-hidden rounded-full bg-muted', className)}>
      <Image src={src} alt="" fill sizes="80px" className="object-cover" onError={() => setFailed(true)}/>
    </span>);
}
