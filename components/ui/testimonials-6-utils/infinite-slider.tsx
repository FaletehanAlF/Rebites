'use client';

import { animate, motion, useMotionValue } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Hook ukur elemen (pengganti react-use-measure, pola kerja sama).
function useElementSize() {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!element) return;
    const measure = () => setSize({ width: element.offsetWidth, height: element.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [setElement, size] as const;
}

interface InfiniteSliderProps {
  children: ReactNode;
  /** Jarak antar item (px). */
  gap?: number;
  /** Kecepatan normal (px per detik). */
  speed?: number;
  /** Kecepatan saat kursor di atas slider — animasi melambat, bukan berhenti. */
  speedOnHover?: number;
  direction?: 'horizontal' | 'vertical';
  reverse?: boolean;
  className?: string;
}

// Slider tak berujung: konten digandakan satu kali, motion value bergerak
// linear dan diulang tepat di titik seam sehingga sambungan tak terlihat.
// Saat hover, kecepatan diganti speedOnHover dan sisa jarak dituntaskan
// dengan kecepatan baru terlebih dahulu (perilaku sama seperti aslinya).
export function InfiniteSlider({
  children,
  gap = 16,
  speed = 100,
  speedOnHover,
  direction = 'horizontal',
  reverse = false,
  className,
}: InfiniteSliderProps) {
  const [currentSpeed, setCurrentSpeed] = useState(speed);
  const [finishingHover, setFinishingHover] = useState(false);
  const [measureRef, { width, height }] = useElementSize();
  const position = useMotionValue(0);

  useEffect(() => {
    const trackSize = (direction === 'horizontal' ? width : height) + gap;
    if (trackSize <= gap) return; // belum terukur

    const seamStart = reverse ? -trackSize / 2 : 0;
    const seamEnd = reverse ? 0 : -trackSize / 2;

    let controls: ReturnType<typeof animate> | undefined;

    if (finishingHover) {
      // Tuntaskan sisa jarak menuju titik seam dengan kecepatan aktif,
      // lalu kembali ke pengulangan biasa.
      const remaining = Math.abs(seamEnd - position.get()) / currentSpeed;
      if (remaining > 0) {
        controls = animate(position, [position.get(), seamEnd], {
          ease: 'linear',
          duration: remaining,
          onComplete: () => setFinishingHover(false),
        });
      } else {
        setFinishingHover(false);
      }
    } else {
      const duration = Math.abs(seamEnd - seamStart) / currentSpeed;
      controls = animate(position, [seamStart, seamEnd], {
        ease: 'linear',
        duration,
        repeat: Infinity,
        repeatType: 'loop',
        repeatDelay: 0,
        onRepeat: () => position.set(seamStart),
      });
    }

    return () => controls?.stop();
  }, [position, currentSpeed, width, height, gap, finishingHover, direction, reverse]);

  const hoverHandlers =
    speedOnHover === undefined
      ? {}
      : {
          onMouseEnter: () => {
            setFinishingHover(true);
            setCurrentSpeed(speedOnHover);
          },
          onMouseLeave: () => {
            setFinishingHover(true);
            setCurrentSpeed(speed);
          },
        };

  return (
    <div className={cn('overflow-hidden', className)} {...hoverHandlers}>
      <motion.div
        ref={measureRef}
        className="flex w-max"
        style={{
          ...(direction === 'horizontal' ? { x: position } : { y: position }),
          gap: `${gap}px`,
          flexDirection: direction === 'horizontal' ? 'row' : 'column',
        }}
      >
        {children}
        {children}
      </motion.div>
    </div>
  );
}
