'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const STORAGE_KEY = 'rebits:landing-seen';

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
  }, [phase, firstVisit, complete]);

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
      transition={{ duration: 0.9, ease: 'easeInOut' }}
      onAnimationComplete={handleAnimationComplete}
    >
      <div className="flex flex-col items-center gap-8">
        <span className="font-display text-7xl sm:text-8xl font-bold tracking-tight text-cream">
          Rebites
        </span>
        <div className="relative h-1.5 w-64 max-w-[80vw] overflow-hidden rounded-full bg-cream/20">
          <motion.div
            className="absolute top-0 left-0 h-full w-full rounded-full bg-cream"
            style={{ transformOrigin: 'left bottom' }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1, ease: 'easeInOut' }}
            onAnimationComplete={() => finish()}
          />
        </div>
      </div>
    </motion.div>
  );
}
