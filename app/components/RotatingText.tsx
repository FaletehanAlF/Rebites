"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ForwardedRef,
} from "react";
import { useReducedMotion } from "framer-motion";
import { motion, AnimatePresence, type Transition } from "framer-motion";
import { cn } from "@/lib/utils";

type StaggerFrom = "first" | "last" | "center" | "random" | number;

interface RotatingTextProps extends Omit<ComponentProps<typeof motion.span>, "initial" | "animate" | "exit" | "transition" | "layout"> {
  texts: string[];
  rotationInterval?: number;
  initial?: ComponentProps<typeof motion.span>["initial"];
  animate?: ComponentProps<typeof motion.span>["animate"];
  exit?: ComponentProps<typeof motion.span>["exit"];
  animatePresenceMode?: "sync" | "wait" | "popLayout";
  animatePresenceInitial?: boolean;
  staggerDuration?: number;
  staggerFrom?: StaggerFrom;
  transition?: Transition;
  loop?: boolean;
  auto?: boolean;
  splitBy?: string;
  onNext?: (index: number) => void;
  mainClassName?: string;
  splitLevelClassName?: string;
  elementLevelClassName?: string;
}

export interface RotatingTextHandle {
  next: () => void;
  previous: () => void;
  jumpTo: (index: number) => void;
  reset: () => void;
}

const RotatingText = forwardRef<RotatingTextHandle, RotatingTextProps>(
  (
    {
      texts = [],
      transition = { type: "spring", damping: 25, stiffness: 300 },
      initial = { y: "100%", opacity: 0 },
      animate = { y: 0, opacity: 1 },
      exit = { y: "-120%", opacity: 0 },
      animatePresenceMode = "wait",
      animatePresenceInitial = false,
      rotationInterval = 2000,
      staggerDuration = 0,
      staggerFrom = "first",
      loop = true,
      auto = true,
      splitBy = "characters",
      onNext,
      mainClassName,
      splitLevelClassName,
      elementLevelClassName,
      ...rest
    }: RotatingTextProps,
    ref: ForwardedRef<RotatingTextHandle>,
  ) => {
    const [currentTextIndex, setCurrentTextIndex] = useState(0);
    const containerRef = useRef<HTMLSpanElement | null>(null);
    // Default `true` agar render server tetap memutar teks; observer mematikan
    // rotasi begitu elemen keluar viewport.
    const [inView, setInView] = useState(true);
    // Rotasi mandiri tiap 2,2 detik — nonaktifkan saat pengguna meminta
    // prefers-reduced-motion, sama seperti carousel testimoni di halaman ini.
    const prefersReducedMotion = useReducedMotion();

    const splitIntoCharacters = (text: string): string[] => {
      if (typeof Intl !== "undefined" && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
        return Array.from(segmenter.segment(text), (segment) => segment.segment);
      }
      return Array.from(text);
    };

    const elements = useMemo(() => {
      const currentText = texts[currentTextIndex] ?? "";
      if (splitBy === "characters") {
        const words = currentText.split(" ");
        return words.map((word, i) => ({
          characters: splitIntoCharacters(word),
          needsSpace: i !== words.length - 1,
        }));
      }
      if (splitBy === "words") {
        return currentText
          .split(" ")
          .map((word, i, arr) => ({ characters: [word], needsSpace: i !== arr.length - 1 }));
      }
      if (splitBy === "lines") {
        return currentText
          .split("\n")
          .map((line, i, arr) => ({ characters: [line], needsSpace: i !== arr.length - 1 }));
      }
      return currentText
        .split(splitBy)
        .map((part, i, arr) => ({ characters: [part], needsSpace: i !== arr.length - 1 }));
    }, [texts, currentTextIndex, splitBy]);

    const getStaggerDelay = useCallback(
      (index: number, totalChars: number) => {
        if (staggerFrom === "first") return index * staggerDuration;
        if (staggerFrom === "last") return (totalChars - 1 - index) * staggerDuration;
        if (staggerFrom === "center") {
          const center = Math.floor(totalChars / 2);
          return Math.abs(center - index) * staggerDuration;
        }
        if (staggerFrom === "random") {
          const randomIndex = Math.floor(Math.random() * totalChars);
          return Math.abs(randomIndex - index) * staggerDuration;
        }
        return Math.abs(Number(staggerFrom) - index) * staggerDuration;
      },
      [staggerFrom, staggerDuration],
    );

    const handleIndexChange = useCallback(
      (newIndex: number) => {
        setCurrentTextIndex(newIndex);
        if (onNext) onNext(newIndex);
      },
      [onNext],
    );

    const next = useCallback(() => {
      if (texts.length === 0) return;
      const nextIndex =
        currentTextIndex === texts.length - 1 ? (loop ? 0 : currentTextIndex) : currentTextIndex + 1;
      if (nextIndex !== currentTextIndex) handleIndexChange(nextIndex);
    }, [currentTextIndex, texts.length, loop, handleIndexChange]);

    const previous = useCallback(() => {
      if (texts.length === 0) return;
      const prevIndex =
        currentTextIndex === 0 ? (loop ? texts.length - 1 : currentTextIndex) : currentTextIndex - 1;
      if (prevIndex !== currentTextIndex) handleIndexChange(prevIndex);
    }, [currentTextIndex, texts.length, loop, handleIndexChange]);

    const jumpTo = useCallback(
      (index: number) => {
        const validIndex = Math.max(0, Math.min(index, texts.length - 1));
        if (validIndex !== currentTextIndex) handleIndexChange(validIndex);
      },
      [texts.length, currentTextIndex, handleIndexChange],
    );

    const reset = useCallback(() => {
      if (currentTextIndex !== 0) handleIndexChange(0);
    }, [currentTextIndex, handleIndexChange]);

    useImperativeHandle(
      ref,
      () => ({ next, previous, jumpTo, reset }),
      [next, previous, jumpTo, reset],
    );

    // Rotasi memicu AnimatePresence + layout measurement untuk setiap karakter;
    // hentikan saat elemennya tidak terlihat (mis. hero sudah di-scroll jauh).
    useEffect(() => {
      const el = containerRef.current;
      if (!el || typeof IntersectionObserver === "undefined") return;

      const observer = new IntersectionObserver(
        ([entry]) => setInView(entry.isIntersecting),
        { threshold: 0 },
      );
      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      if (!auto || !inView || prefersReducedMotion) return;
      const intervalId = setInterval(next, rotationInterval);
      return () => clearInterval(intervalId);
    }, [next, rotationInterval, auto, inView, prefersReducedMotion]);

    return (
      <motion.span
        ref={containerRef}
        className={cn("relative flex flex-wrap whitespace-pre-wrap", mainClassName)}
        {...rest}
        layout
        transition={transition}
      >
        <span className="sr-only">{texts[currentTextIndex]}</span>
        <AnimatePresence mode={animatePresenceMode} initial={animatePresenceInitial}>
          <motion.span
            key={currentTextIndex}
            className={cn(
              splitBy === "lines"
                ? "flex w-full flex-col"
                : "relative flex flex-wrap whitespace-pre-wrap",
            )}
            layout
            aria-hidden="true"
          >
            {elements.map((wordObj, wordIndex, array) => {
              const previousCharsCount = array
                .slice(0, wordIndex)
                .reduce((sum, word) => sum + word.characters.length, 0);
              return (
                <span key={wordIndex} className={cn("inline-flex", splitLevelClassName)}>
                  {wordObj.characters.map((char, charIndex) => (
                    <motion.span
                      key={charIndex}
                      initial={initial}
                      animate={animate}
                      exit={exit}
                      transition={{
                        ...transition,
                        delay: getStaggerDelay(
                          previousCharsCount + charIndex,
                          array.reduce((sum, word) => sum + word.characters.length, 0),
                        ),
                      }}
                      className={cn("inline-block", elementLevelClassName)}
                    >
                      {char}
                    </motion.span>
                  ))}
                  {wordObj.needsSpace && <span className="whitespace-pre"> </span>}
                </span>
              );
            })}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    );
  },
);

RotatingText.displayName = "RotatingText";
export default RotatingText;
