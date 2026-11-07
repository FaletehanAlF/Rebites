'use client';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { formatRupiah } from '@/lib/data';
const DURATION_MS = 220;
function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}
export function AnimatedRupiah({ value, className, }: {
    value: number;
    className?: string;
}) {
    const reducedMotion = useReducedMotion();
    const [display, setDisplay] = useState(value);
    const frameRef = useRef<number | null>(null);
    const fromRef = useRef(value);
    const startRef = useRef(0);
    useEffect(() => {
        if (display === value)
            return;
        fromRef.current = display;
        startRef.current = 0;
        if (reducedMotion) {
            setDisplay(value);
            return;
        }
        const tick = (now: number) => {
            if (!startRef.current)
                startRef.current = now;
            const progress = Math.min(1, (now - startRef.current) / DURATION_MS);
            const next = Math.round(fromRef.current + (value - fromRef.current) * easeOutCubic(progress));
            if (progress >= 1) {
                setDisplay(value);
                frameRef.current = null;
                return;
            }
            setDisplay(next);
            frameRef.current = requestAnimationFrame(tick);
        };
        frameRef.current = requestAnimationFrame(tick);
        return () => {
            if (frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
        };
// eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, reducedMotion]);
    return (<span className={className} aria-label={`Rp${value.toLocaleString("id-ID")}`}>
      
      <span aria-hidden>{formatRupiah(display)}</span>
    </span>);
}
