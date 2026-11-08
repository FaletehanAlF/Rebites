'use client';
import { useId } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';
export function DashboardDecor() {
    const { scrollY } = useScroll();
    const yBlobTop = useTransform(scrollY, [0, 900], [0, -140]);
    const yBlobMid = useTransform(scrollY, [0, 900], [0, 120]);
    const ySprig = useTransform(scrollY, [0, 900], [0, -80]);
    return (<div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">

      <motion.div style={{ y: yBlobTop }} className="absolute -right-28 -top-28 h-96 w-96 rounded-full bg-muted/70 blur-3xl"/>

      <motion.div style={{ y: yBlobMid }} className="absolute -left-36 top-1/2 h-[30rem] w-[30rem] rounded-full bg-muted/80 blur-3xl"/>

      <motion.div style={{ y: ySprig }} className="absolute right-[5%] top-36">

        <LeafSprig className="h-44 w-44 text-primary-foreground"/>

      </motion.div>

      <DotPattern className="left-10 top-10 h-44 w-44 text-primary-foreground/70"/>

    </div>);
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
