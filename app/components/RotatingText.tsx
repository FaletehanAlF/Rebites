"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  type MotionProps,
  type Transition,
} from "framer-motion";

interface RotatingTextProps {
  texts: string[];
  mainClassName?: string;
  style?: React.CSSProperties;
  rotationInterval?: number;
  staggerDuration?: number;
  transition?: Transition;
  exit?: MotionProps["exit"];
}

export default function RotatingText({
  texts,
  mainClassName = "",
  style,
  rotationInterval = 2000,
  staggerDuration = 0.03,
  transition = {
    type: "spring",
    damping: 25,
    stiffness: 300,
  },
  exit = {
    y: "-120%",
    opacity: 0,
  },
}: RotatingTextProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (texts.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % texts.length);
    }, rotationInterval);

    return () => clearInterval(interval);
  }, [texts.length, rotationInterval]);

  if (texts.length === 0) return null;

  const currentText = texts[currentIndex];

  return (
    <span
      className={`inline-flex overflow-hidden align-bottom ${mainClassName}`}
      style={style}
      aria-live="polite"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={currentIndex}
          className="inline-flex whitespace-nowrap"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={exit}
          transition={transition}
        >
          {Array.from(currentText).map((char, index) => (
            <motion.span
              key={`${currentIndex}-${index}`}
              className="inline-block"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                ...transition,
                delay: index * staggerDuration,
              }}
            >
              {char === " " ? "\u00A0" : char}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}