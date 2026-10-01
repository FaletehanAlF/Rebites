'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function Preloader() {
  const [done, setDone] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const finishedRef = useRef(false);
  const barRef = useRef<HTMLDivElement>(null);

  // Identitas stabil: re-render parent tidak boleh me-restart progres loading.
  const finish = useCallback((markPlayed: boolean) => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    // Buka kunci scroll begitu intro selesai. Kuncinya dimiliki komponen ini
    // sendiri supaya halaman induk tidak perlu state `loaded` — yang dulu
    // me-render ulang seluruh landing page tepat saat animasi keluar berjalan.
    document.body.style.overflow = '';

    if (markPlayed) {
      setDone(true);
    } else {
      setSkipped(true);
    }
  }, []);

  // Kunci scroll selama intro tampil; selalu dikembalikan saat unmount supaya
  // navigasi ke halaman lain tidak ikut terkunci.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Jalan sekali per mount; tiap buka landing selalu main 1x.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish(false);
      return;
    }

    const safety = setTimeout(() => finish(true), 3200);
    return () => clearTimeout(safety);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Progress is written straight to the DOM instead of via setState: the old
  // version re-rendered the whole AnimatePresence tree ~120x during
  // hydration, and animated `width` (a layout property) every frame.
  useEffect(() => {
    let raf = 0;
    const DURATION = 2000;
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
          {/* Lingkaran raksasa di tengah; saat masuk ia terangkat ke atas. */}
          <motion.div
            className="absolute left-1/2 top-1/2 flex flex-col items-center justify-center rounded-full bg-primary"
            style={{ width: '200vmax', height: '200vmax', marginLeft: '-100vmax', marginTop: '-100vmax' }}
            initial={false}
            exit={{ y: '-160vh', scale: 0.5 }}
            transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
          >
            <div className="flex flex-col items-center px-6 text-center">
              {/* Tulisan timbul dari bawah ke atas */}
              <span className="block overflow-hidden pb-2">
                <motion.span
                  className="block font-display text-[clamp(3.5rem,12vw,8.5rem)] font-semibold leading-none tracking-tight text-cream"
                  initial={{ y: '110%' }}
                  animate={{ y: '0%' }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                >
                  ReBites
                </motion.span>
              </span>

              {/* Loading bar polos cream */}
              <div className="mt-8 h-[3px] w-[min(420px,60vw)] overflow-hidden rounded-full bg-cream/20">
                <div
                  ref={barRef}
                  className="h-full w-full origin-left rounded-full bg-cream"
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
