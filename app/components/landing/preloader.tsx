'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function Preloader() {
  const [done, setDone] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const finishedRef = useRef(false);
  const barRef = useRef<HTMLDivElement>(null);

  const finish = useCallback((markPlayed: boolean) => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    document.body.style.overflow = '';

    if (markPlayed) {
      setDone(true);
    } else {
      setSkipped(true);
    }
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish(false);
      return;
    }

    const safety = setTimeout(() => finish(true), 2000);
    return () => clearTimeout(safety);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Progress ditulis langsung ke DOM, bukan via setState: animasi
  // `width` me-layout ulang seluruh tree tiap frame.
  useEffect(() => {
    let raf = 0;
    const DURATION = 900;
    const start = performance.now();

    const tick = (now: number) => {
      if (finishedRef.current) return; // already skipped/finished
      const t = Math.min(1, (now - start) / DURATION);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${eased})`;
      }
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        finish(true);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (skipped) return null;

  return (
    <AnimatePresence>
      {!done && (
        <motion.div className="fixed inset-0 z-[200] overflow-hidden">
          <motion.div
            className="absolute left-1/2 top-1/2 flex flex-col items-center justify-center rounded-full bg-primary"
            style={{ width: '200vmax', height: '200vmax', marginLeft: '-100vmax', marginTop: '-100vmax' }}
            initial={false}
            exit={{ y: '-160vh', scale: 0.5 }}
            transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
          >
            <div className="flex flex-col items-center px-6 text-center">
              <span className="block overflow-hidden pb-2">
                <motion.span
                  className="block font-display text-[clamp(3.5rem,12vw,8.5rem)] font-semibold leading-none tracking-tight text-primary-foreground"
                  initial={{ y: '110%' }}
                  animate={{ y: '0%' }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                >
                  ReBites
                </motion.span>
              </span>

              <div className="mt-8 h-[3px] w-[min(420px,60vw)] overflow-hidden rounded-full bg-secondary/20">
                <div
                  ref={barRef}
                  className="h-full w-full origin-left rounded-full bg-secondary"
                  style={{ transform: 'scaleX(0)' }}
                ></div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
