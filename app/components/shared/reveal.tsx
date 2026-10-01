'use client';

import { motion, useInView, type Variants } from 'framer-motion';
import { useRef } from 'react';

const defaultVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

export function Reveal({
  children,
  className,
  delay = 0,
  duration = 0.7,
  variants = defaultVariants,
  once = true,
  as = 'div',
  start = true,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  variants?: Variants;
  once?: boolean;
  as?: React.ElementType;
  start?: boolean;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once, margin: '-12% 0px -12% 0px' });
  const MotionTag = motion[as as keyof typeof motion] as typeof motion.div;

  return (
    <MotionTag
      ref={ref}
      className={className}
      variants={variants}
      initial="hidden"
      animate={start && inView ? 'visible' : 'hidden'}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  );
}

export function RevealWords({
  text,
  className,
  wordClassName,
  stagger = 0.08,
  delay = 0,
  start = true,
}: {
  text: string;
  className?: string;
  wordClassName?: string;
  stagger?: number;
  delay?: number;
  start?: boolean;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-10%' });
  const words = text.split(' ');
  return (
    <span ref={ref} className={className}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className={`inline-block ${wordClassName ?? ''}`}
            initial={{ y: '110%', opacity: 0 }}
            animate={
              start && inView ? { y: '0%', opacity: 1 } : { y: '110%', opacity: 0 }
            }
            transition={{
              duration: 0.6,
              delay: delay + i * stagger,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {word}
            {i < words.length - 1 ? '\u00A0' : ''}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
