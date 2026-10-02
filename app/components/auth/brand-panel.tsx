"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { motion } from "framer-motion";

const IMG_MAIN =
  "https://images.pexels.com/photos/16134564/pexels-photo-16134564.jpeg?auto=compress&cs=tinysrgb&w=900";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface BrandPanelProps {
  title: ReactNode;
  description: string;
}

export default function BrandPanel({ title, description }: BrandPanelProps) {
  return (
    <section
      aria-hidden
      className="grain-overlay relative order-1 hidden min-h-screen overflow-hidden bg-primary lg:order-1 lg:block"
    >
      <div className="absolute inset-0">
        <Image src={IMG_MAIN} alt="" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(34,81,56,0.88)_0%,rgba(34,81,56,0.55)_48%,rgba(18,45,32,0.94)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-transparent to-primary/45" />
      </div>

      <div className="pointer-events-none absolute -left-1/4 top-1/4 h-[34rem] w-[34rem] rounded-full bg-primary/25 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-1/3 -right-1/4 h-[38rem] w-[38rem] rounded-full bg-primary/85 blur-[110px]" />

      <div className="absolute left-8 top-8 z-10 flex items-center gap-2.5 text-primary-foreground xl:left-12 xl:top-10">
        <motion.span
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/25 shadow-sm ring-1 ring-white/20"
        >
          <Image src="/logo.png" alt="ReBites" width={36} height={36} className="h-9 w-9 object-cover" />
        </motion.span>
        <motion.span
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
          className="font-display text-lg font-medium tracking-tight"
        >
          ReBites
        </motion.span>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 p-10 xl:p-14">
        <h1 className="max-w-md font-display text-[clamp(2.4rem,3.2vw,2.75rem)] font-semibold leading-[1.04] tracking-[-0.02em] text-primary-foreground [text-shadow:0_2px_24px_rgba(18,45,32,0.65)]">
          {title}
        </h1>
        <p className="mt-5 max-w-[26rem] text-[0.95rem] leading-relaxed text-primary-foreground/70">
          {description}
        </p>
      </div>
    </section>
  );
}
