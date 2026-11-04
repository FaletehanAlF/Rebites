'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const STORAGE_KEY = 'rebits:landing-seen';

/**
 * Loading screen khusus first-time masuk landing page.
 *
 * - Hanya muncul sekali per browser (flag di localStorage `rebits:landing-seen`).
 * - Isi: teks besar "Rebites" + loading bar animasi.
 * - Setelah loading selesai (font ready / safety timer): overlay slide ke atas
 *   dari bawah ke atas (`y: -100%`) selama 0.9s, lalu unmount → landing page
 *   langsung muncul di bawahnya.
 */

type Phase = 'loading' | 'leaving' | 'done';

export function Preloader({ onDone }: { onDone?: () => void }) {
  const [firstVisit, setFirstVisit] = useState(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const finishedRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      setFirstVisit(!seen);
    } catch {
      setFirstVisit(true);
    }
  }, []);

  const complete = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPhase('done');
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* storage tidak tersedia */
    }
    onDoneRef.current?.();
  }, []);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPhase('leaving');
  }, []);

  useEffect(() => {
    if (phase !== 'loading' || !firstVisit) return;

    // Hormati preferensi sistem: langsung selesai tanpa animasi.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const t = window.setTimeout(complete, 0);
      return () => window.clearTimeout(t);
    }

    // Batas atas: tanpa ini, font yang gagal dimuat akan mengunci halaman.
    const safety = window.setTimeout(finish, 900);
    let cancelled = false;
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => {
        if (!cancelled) finish();
      }).catch(() => finish());
    } else {
      finish();
    }
    return () => {
      cancelled = true;
      window.clearTimeout(safety);
    };
  }, [phase, firstVisit, finish, complete]);

  const handleAnimationComplete = useCallback(() => {
    if (phase === 'leaving') complete();
  }, [phase, complete]);

  if (phase === 'done' || !firstVisit) return null;

  return (
    <motion.div
      aria-hidden
      className="fixed inset-0 z-[200] flex items-center justify-center bg-primary"
      initial={false}
      animate={phase === 'leaving' ? { y: '-100%' } : { y: 0 }}
      transition={{ duration: 2, ease: 'easeInOut' }}
      onAnimationComplete={handleAnimationComplete}
    >
      <div className="flex flex-col items-center gap-8">
        <span className="font-display text-7xl sm:text-8xl font-bold tracking-tight text-cream">
          Rebites
        </span>
        <div className="relative h-1.5 w-64 max-w-[80vw] overflow-hidden rounded-full bg-cream/20">
          <motion.div
            className="absolute left-0 top-0 h-full rounded-full bg-cream"
            animate={{ width: ['0%', '100%', '0%'] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>
    </motion.div>
  );
}
