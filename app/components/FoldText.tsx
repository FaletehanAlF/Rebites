"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ElementType,
} from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";

type Hinge = "top" | "bottom" | "left" | "right" | "center";
type Trigger = "scroll" | "hover" | "load";
type SplitBy = "chars" | "words" | "lines";
type Axis = "X" | "Y";

const HINGE_ORIGIN: Record<Hinge, string> = {
  top: "50% 0%",
  bottom: "50% 100%",
  left: "0% 50%",
  right: "100% 50%",
  center: "50% 50%",
};

const HINGE_PERSPECTIVE_ORIGIN: Record<Hinge, string> = {
  top: "50% 0%",
  bottom: "50% 100%",
  left: "0% 50%",
  right: "100% 50%",
  center: "50% 50%",
};

const HINGE_AXIS: Record<Hinge, Axis> = {
  top: "X",
  bottom: "X",
  left: "Y",
  right: "Y",
  center: "X",
};

const FOLD_ANGLE = 90;

export interface FoldTextProps {
  text: string;
  splitBy?: SplitBy;
  hinge?: Hinge;
  trigger?: Trigger;
  duration?: number;
  stagger?: number;
  ease?: string;
  perspective?: number;
  creaseShading?: number;
  as?: ElementType;
  color?: string;
  fontSize?: string | number;
  fontWeight?: number | string;
  lineHeight?: number | string;
  letterSpacing?: string;
  className?: string;
  style?: CSSProperties;
  once?: boolean;
  start?: string;
  onComplete?: () => void;
}

interface Group {
  /** Karakter satu kata; array kosong menandakan spasi (titik patah baris). */
  chars: string[];
}

const tokenize = (text: string): Group[] => {
  const groups: Group[] = [];
  for (const token of text.split(/(\s+)/)) {
    if (!token) continue;
    if (/^\s+$/.test(token)) {
      groups.push({ chars: [] });
    } else {
      groups.push({ chars: Array.from(token) });
    }
  }
  return groups;
};

/**
 * FoldText - full-width headline that unfolds along a hinge axis,
 * driven by scroll, hover or load. Port of the React Bits FoldText.
 */
export function FoldText({
  text,
  hinge = "top",
  trigger = "scroll",
  duration = 1,
  stagger = 0.025,
  ease = "expo.out",
  perspective = 500,
  creaseShading = 0.5,
  as: Tag = "h1",
  color,
  fontSize,
  fontWeight,
  lineHeight = 1.04,
  letterSpacing,
  className,
  style,
  once = false,
  start = "top 85%",
  onComplete,
}: FoldTextProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const spriteRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const triggerRef = useRef<{ kill: () => void } | null>(null);

  const groups = useMemo(() => tokenize(text), [text]);
  const charBase = useMemo(() => {
    const base: number[] = [];
    let acc = 0;
    for (const group of groups) {
      base.push(acc);
      acc += group.chars.length;
    }
    return base;
  }, [groups]);
  const axis = HINGE_AXIS[hinge];

  const styles: Record<string, string> = {
    "--fold-p": "1",
    "--fold-crease": "1",
    "--fold-blend": creaseShading.toFixed(2),
  };

  const faceFront: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    transformOrigin: HINGE_ORIGIN[hinge],
    transform: `rotate${axis}(calc(var(--fold-p) * -${FOLD_ANGLE}deg))`,
  };

  const faceBack: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    transformOrigin: HINGE_ORIGIN[hinge],
    transform: `rotate${axis}(180deg) translateZ(1px)`,
  };

  const creaseStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    opacity: "calc(var(--fold-crease) * var(--fold-blend))",
    backgroundImage:
      "linear-gradient(to bottom, rgba(0,0,0,0.18), rgba(0,0,0,0.04) 55%, transparent)",
  };

  const animate = (open: boolean) => {
    tweenRef.current?.kill();
    tweenRef.current = gsap.to(spriteRefs.current, {
      "--fold-p": open ? 0 : 1,
      "--fold-crease": open ? 0 : 1,
      duration,
      ease,
      stagger: open ? stagger : stagger * 0.6,
      onComplete,
    });
  };

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (trigger === "load") {
      const t = gsap.delayedCall(0.05, () => animate(true));
      return () => {
        t.kill();
        tweenRef.current?.kill();
      };
    }

    if (trigger === "hover") {
      const enter = () => animate(true);
      const leave = () => animate(false);
      root.addEventListener("pointerenter", enter);
      root.addEventListener("pointerleave", leave);
      return () => {
        root.removeEventListener("pointerenter", enter);
        root.removeEventListener("pointerleave", leave);
        tweenRef.current?.kill();
      };
    }

    // `gsap/ScrollTrigger` (~51 kB raw) hanya dipakai untuk trigger="scroll".
    // Headline hero memakai trigger="load", jadi modulnya di-load on-demand
    // supaya tidak masuk ke first-load JS halaman landing.
    let cancelled = false;
    let st: { kill: () => void } | null = null;

    import("gsap/ScrollTrigger")
      .then((mod) => {
        if (cancelled) return;
        gsap.registerPlugin(mod.ScrollTrigger);
        st = mod.ScrollTrigger.create({
          trigger: root,
          start,
          end: "top 20%",
          toggleActions: once ? "play none none none" : "play none none reverse",
          onEnter: () => animate(true),
          onLeaveBack: () => animate(false),
        });
        triggerRef.current = st;
      })
      .catch((error) => {
        if (cancelled) return;
        // Jika modul gagal dimuat, headline tidak boleh tetap terlipat
        // (tersembunyi) — langsung buka agar konten tetap terbaca.
        console.error("[FoldText] gagal memuat ScrollTrigger:", error);
        animate(true);
      });

    return () => {
      cancelled = true;
      st?.kill();
      triggerRef.current = null;
      tweenRef.current?.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn(
        "font-display select-none [text-wrap:balance]",
        className,
      )}
      style={{
        perspective,
        perspectiveOrigin: HINGE_PERSPECTIVE_ORIGIN[hinge],
        color,
        fontSize,
        fontWeight,
        lineHeight,
        letterSpacing,
        ...style,
      }}
    >
      <Tag style={styles}>
        {groups.map((group, groupIndex) => {
          if (group.chars.length === 0) {
            return <span key={`s-${groupIndex}`}> </span>;
          }
          return (
            <span
              key={`w-${groupIndex}`}
              className="inline-block whitespace-nowrap"
              style={{ transformStyle: "preserve-3d" }}
            >
              {group.chars.map((value, charIndex) => {
                const spriteIndex = charBase[groupIndex] + charIndex;
                return (
                  <span
                    key={`c-${spriteIndex}`}
                    ref={(el) => {
                      spriteRefs.current[spriteIndex] = el;
                    }}
                    className="relative inline-block whitespace-pre will-change-transform"
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <span style={faceFront}>{value}</span>
                    {/* Muka belakang & lipatan hanya dekoratif. Tanpa
                        aria-hidden pembaca layar melafalkan tiap karakter dua
                        kali: "Ubah" terdengar "UUbbaahh". */}
                    <span aria-hidden style={faceBack}>
                      {value}
                    </span>
                    <span aria-hidden style={creaseStyle} />
                  </span>
                );
              })}
            </span>
          );
        })}
      </Tag>
    </div>
  );
}

export default FoldText;