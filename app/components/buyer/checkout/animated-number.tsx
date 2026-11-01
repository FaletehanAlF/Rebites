'use client';

import { useEffect } from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
} from 'framer-motion';

export function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format: (value: number) => string;
}) {
  const motionValue = useMotionValue(value);
  const text = useTransform(motionValue, (v) => format(Math.round(v)));

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [value, motionValue]);

  return <motion.span>{text}</motion.span>;
}

export const formatRupiahShort = (value: number) =>
  `Rp${value.toLocaleString('id-ID')}`;
