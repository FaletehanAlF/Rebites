"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
export function IconTooltip({ label, side = "right", enabled = true, className, children, }: {
    label: string;
    side?: "right" | "bottom";
    enabled?: boolean;
    className?: string;
    children: ReactNode;
}) {
    const hostRef = useRef<HTMLSpanElement>(null);
    const [pos, setPos] = useState<{
        top: number;
        left: number;
    } | null>(null);
    const reducedMotion = useReducedMotion();
    const open = () => {
        if (!enabled)
            return;
        const host = hostRef.current;
        if (!host)
            return;
        const rect = host.getBoundingClientRect();
        setPos(side === "right"
            ? { top: rect.top + rect.height / 2, left: rect.right + 12 }
            : { top: rect.bottom + 10, left: rect.left + rect.width / 2 });
    };
    const close = () => setPos(null);
    useEffect(() => {
        if (!pos)
            return;
        const onScroll = () => close();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape")
                close();
        };
        window.addEventListener("scroll", onScroll, true);
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("scroll", onScroll, true);
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [pos]);
    if (!enabled) {
        return <span className={className}>{children}</span>;
    }
    return (<span ref={hostRef} className={cn("inline-flex", className)} onMouseEnter={open} onMouseLeave={close} onFocusCapture={open} onBlurCapture={close}>
      {children}
      {pos &&
            createPortal(<motion.span role="tooltip" initial={reducedMotion
                    ? { opacity: 0 }
                    : side === "right"
                        ? { opacity: 0, x: -6, y: "-50%" }
                        : { opacity: 0, x: "-50%", y: -6 }} animate={side === "right"
                    ? { opacity: 1, x: 0, y: "-50%" }
                    : { opacity: 1, x: "-50%", y: 0 }} transition={{ duration: 0.16, ease: "easeOut" }} style={{ top: pos.top, left: pos.left }} className="pointer-events-none fixed z-[80] whitespace-nowrap rounded-lg bg-charcoal-900 px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_10px_28px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
            {label}
            <span aria-hidden className={side === "right"
                    ? "absolute -left-[5px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 bg-charcoal-900"
                    : "absolute -top-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-charcoal-900"}/>
          </motion.span>, document.body)}
    </span>);
}
