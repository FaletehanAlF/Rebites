'use client';
import { useId } from 'react';
import { Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';
export function SoftBlob({ className }: {
    className?: string;
}) {
    return (<div aria-hidden className={cn('pointer-events-none absolute rounded-full', '[mask-image:radial-gradient(circle_at_center,black_30%,transparent_72%)]', '[-webkit-mask-image:radial-gradient(circle_at_center,black_30%,transparent_72%)]', className)}/>);
}
export function FloatingLeaf({ className, delay = 0, }: {
    className?: string;
    delay?: number;
}) {
    // Leaf statis (tanpa loop); dekorasi tetap hidup lewat reveal saat scroll,
    // bukan animasi berulang. delay dipertahankan agar pemanggil lama tetap valid.
    void delay;
    return (<span aria-hidden className={cn('pointer-events-none absolute', className)}>

      <Leaf className="h-full w-full" strokeWidth={1.5}/>

    </span>);
}
export function DotPattern({ className }: {
    className?: string;
}) {
    const rawId = useId();
    const id = rawId.replace(/:/g, '');
    return (<svg aria-hidden className={cn('pointer-events-none absolute', className)}>

      <defs>

        <pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse">

          <circle cx="2" cy="2" r="1.4" fill="currentColor"/>

        </pattern>

      </defs>

      <rect width="100%" height="100%" fill={`url(#${id})`}/>

    </svg>);
}
export function ArcLines({ className }: {
    className?: string;
}) {
    return (<svg aria-hidden viewBox="0 0 1200 600" fill="none" className={cn('pointer-events-none absolute', className)}>

      <path d="M -40,120 C 280,300 640,140 1240,420" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>

      <path d="M -40,210 C 340,370 680,240 1240,470" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>

    </svg>);
}
export function LeafSprig({ className }: {
    className?: string;
}) {
    return (<svg aria-hidden viewBox="0 0 200 200" fill="none" className={cn('pointer-events-none absolute', className)}>

      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">

        <path d="M100 180 C90 130 95 80 110 30" strokeWidth="1.5"/>

        <path d="M96 150 C70 140 60 120 64 100 C88 104 100 124 96 150 Z" strokeWidth="1.4" fill="currentColor" fillOpacity="0.14"/>

        <path d="M108 120 C132 110 142 92 138 72 C116 76 104 94 108 120 Z" strokeWidth="1.4" fill="currentColor" fillOpacity="0.14"/>

        <path d="M98 88 C76 78 68 60 72 42 C94 46 104 64 98 88 Z" strokeWidth="1.4" fill="currentColor" fillOpacity="0.14"/>

      </g>

    </svg>);
}
