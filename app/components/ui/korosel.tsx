"use client";

import { useRef, useState, useCallback, useEffect, CSSProperties, type ReactNode } from 'react';

type Side = 'left' | 'right';
type Orientation = 'vertical' | 'horizontal';

export interface OptionWheelApi {
  next: () => void;
  prev: () => void;
  to: (index: number) => void;
}

export interface OptionWheelProps {
  items?: string[];
  defaultSelected?: number;
  onChange?: (index: number, item: string) => void;
  textColor?: string;
  activeColor?: string;
  side?: Side;
  fontSize?: number;
  spacing?: number;
  curve?: number;
  tilt?: number;
  blur?: number;
  fade?: number;
  minOpacity?: number;
  smoothing?: number;
  inset?: number;
  loop?: boolean;
  draggable?: boolean;
  interactive?: boolean;
  className?: string;
  renderItem?: (index: number, item: string) => ReactNode;
  plateSize?: number;
  autoRotate?: boolean;
  autoRotateInterval?: number;
  orientation?: Orientation;
  apiRef?: React.MutableRefObject<OptionWheelApi | null>;
}

interface WheelConfig {
  count: number;
  items: string[];
  rowH: number;
  curve: number;
  tilt: number;
  blur: number;
  fade: number;
  minOpacity: number;
  side: Side;
  loop: boolean;
  smoothing: number;
  draggable: boolean;
  plateSize: number;
  plateMode: boolean;
  orientation: Orientation;
}

const DEFAULT_ITEMS: string[] = [];

// Read once per page instead of on every render (getComputedStyle forces a
// style recalc). Only affects animation math, never SSR'd markup, so the
// server-side fallback of 16 is safe.
let cachedRemPx: number | null = null;
function getRemPx(): number {
  if (typeof window === 'undefined') return 16;
  if (cachedRemPx == null) {
    cachedRemPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  }
  return cachedRemPx;
}

const OptionWheel = ({
  items = DEFAULT_ITEMS,
  defaultSelected = 3,
  onChange,
  textColor = '#a6a6a6',
  activeColor = '#ffffff',
  side = 'left',
  fontSize = 3,
  spacing = 3,
  curve = 4,
  tilt = 6,
  blur = 2,
  fade = 0.25,
  minOpacity = 0.05,
  smoothing = 200,
  inset = 80,
  loop = false,
  draggable = true,
  interactive = true,
  className = '',
  renderItem,
  plateSize = 440,
  autoRotate = false,
  autoRotateInterval = 1000,
  orientation = 'vertical',
  apiRef,
}: OptionWheelProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const posRef = useRef(defaultSelected);
  const targetRef = useRef(defaultSelected);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const cfgRef = useRef<WheelConfig>({} as WheelConfig);
  const onChangeRef = useRef(onChange);
  const selectedRef = useRef(defaultSelected);
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ coord: number; start: number; id: number } | null>(null);
  const dragMovedRef = useRef(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(defaultSelected);
  const [isDragging, setIsDragging] = useState(false);

  const remPx = getRemPx();
  const isPlateMode = renderItem != null;

  const cfg: WheelConfig = {
    count: items.length,
    items,
    rowH: isPlateMode ? (plateSize * spacing * 0.7) : Math.max(fontSize * spacing * remPx, 1),
    curve,
    tilt: isPlateMode ? (tilt * 0.6) : tilt,
    blur,
    fade,
    minOpacity,
    side,
    loop,
    smoothing,
    draggable,
    plateSize,
    plateMode: isPlateMode,
    orientation,
  };

  // Mirror the latest config/callback for the rAF loop and event handlers.
  onChangeRef.current = onChange;
  cfgRef.current = cfg;

  const runFrame = useCallback((now: number) => {
    const dt = Math.min((now - lastRef.current) / 1000, 0.05);
    lastRef.current = now;
    const cfg = cfgRef.current;
    const tau = Math.max(cfg.smoothing, 1) / 1000;
    const k = 1 - Math.exp(-dt / tau);

    const target = targetRef.current;
    const cur = posRef.current;
    let next = cur + (target - cur) * k;
    const settled = Math.abs(target - next) < 0.001;
    if (settled) next = target;
    posRef.current = next;

    const els = itemRefs.current;
    const n = cfg.count;
    const mirror = cfg.side === 'right' ? -1 : 1;
    const horizontal = cfg.orientation === 'horizontal';

    const tiltRad = (cfg.tilt * Math.PI) / 180;
    const R = tiltRad > 0.0005 ? cfg.rowH / tiltRad : 0;
    for (let i = 0; i < n; i++) {
      const el = els[i];
      if (!el) continue;
      let d = i - next;
      if (cfg.loop && n > 1) {
        d = ((d % n) + n) % n;
        if (d > n / 2) d -= n;
      }
      const dist = Math.abs(d);
      let along = d * cfg.rowH;
      let perp = 0;
      let rot = 0;
      if (R > 0) {
        const ang = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d * tiltRad));
        along = R * Math.sin(ang);
        perp = -mirror * R * (1 - Math.cos(ang)) * cfg.curve;
        rot = (mirror * ang * 180) / Math.PI;
      }
      const p = Math.max(0, 1 - Math.min(dist, 1));

      const x = horizontal ? along : perp;
      const y = horizontal ? perp : along;

      let transform: string;
      if (horizontal) {
        transform = isPlateMode
          ? `translate(${x.toFixed(2)}px, calc(${y.toFixed(2)}px - 50%)) rotate(${rot.toFixed(3)}deg)`
          : `translate(calc(${x.toFixed(2)}px - 50%), calc(${y.toFixed(2)}px - 50%)) rotate(${rot.toFixed(3)}deg)`;
      } else {
        transform = `translate(${x.toFixed(2)}px, calc(${y.toFixed(2)}px - 50%)) rotate(${rot.toFixed(3)}deg)`;
      }

      if (cfg.plateMode) {
        const scale = 0.82 + 0.18 * p;
        transform += ` scale(${scale.toFixed(4)})`;
        el.style.zIndex = String(Math.round(p * 10));
      }
      el.style.transform = transform;
      el.style.opacity = String(Math.max(cfg.minOpacity, 1 - dist * cfg.fade));
      // Quantized to 0.5px steps so the (paint-triggering) blur value rarely
      // changes between frames and style invalidation is minimized.
      if (cfg.blur > 0) {
        const b = Math.round(dist * cfg.blur * 2) / 2;
        const filter = `blur(${b}px)`;
        if (el.style.filter !== filter) el.style.filter = filter;
      } else if (el.style.filter !== 'none') {
        el.style.filter = 'none';
      }
      el.style.setProperty('--ow-p', p.toFixed(4));
    }

    rafRef.current = settled ? null : requestAnimationFrame(runFrame);
  }, [isPlateMode]);

  const startLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(runFrame);
  }, [runFrame]);

  const applyTarget = useCallback(
    (value: number, snap: boolean) => {
      const cfg = cfgRef.current;
      let v = value;
      if (!cfg.loop) v = Math.min(Math.max(v, 0), Math.max(cfg.count - 1, 0));
      if (snap) v = Math.round(v);
      if (snap && cfg.count > 0 && v !== targetRef.current) {
        const delta = v - targetRef.current;
        posRef.current += Math.sign(delta) * Math.min(0.5, Math.abs(delta) * 0.2);
      }
      targetRef.current = v;
      const idx = ((Math.round(v) % cfg.count) + cfg.count) % cfg.count;
      if (idx !== selectedRef.current) {
        selectedRef.current = idx;
        setSelectedIndex(idx);
        onChangeRef.current?.(idx, cfg.items[idx]);
      }
      startLoop();
    },
    [startLoop]
  );

  const resetAutoTimer = useCallback(() => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    if (!autoRotate) return;
    const jitter = (Math.random() - 0.5) * 2;
    const delay = Math.max(1000, autoRotateInterval + autoRotateInterval * 0.3 * jitter);
    autoTimerRef.current = setTimeout(() => {
      applyTarget(Math.round(targetRef.current) + 1, true);
      resetAutoTimer();
    }, delay);
  }, [autoRotate, autoRotateInterval, applyTarget]);

  const pauseAutoTimer = useCallback(() => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    resetAutoTimer();
    return pauseAutoTimer;
  }, [resetAutoTimer, pauseAutoTimer]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cfg = cfgRef.current;
      const raw = cfg.orientation === 'horizontal' ? (e.deltaX || e.deltaY) : e.deltaY;
      const delta = e.deltaMode === 1 ? raw * 24 : raw;
      const step = Math.max(-1, Math.min(1, delta / cfg.rowH));
      applyTarget(targetRef.current + step, false);
      resetAutoTimer();
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => applyTarget(targetRef.current, true), 140);
    };
    if (!interactive) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    };
  }, [applyTarget, resetAutoTimer, interactive]);

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      next: () => applyTarget(Math.round(targetRef.current) + 1, true),
      prev: () => applyTarget(Math.round(targetRef.current) - 1, true),
      to: (index: number) => applyTarget(index, true),
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, applyTarget]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!cfgRef.current.draggable) return;
    const horizontal = cfgRef.current.orientation === 'horizontal';
    dragRef.current = {
      coord: horizontal ? e.clientX : e.clientY,
      start: targetRef.current,
      id: e.pointerId,
    };
    dragMovedRef.current = false;
    setIsDragging(true);
    resetAutoTimer();
  }, [resetAutoTimer]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const horizontal = cfgRef.current.orientation === 'horizontal';
      const coord = horizontal ? e.clientX : e.clientY;
      const d = coord - drag.coord;
      if (!dragMovedRef.current && Math.abs(d) > 4) {
        dragMovedRef.current = true;
        rootRef.current?.setPointerCapture(drag.id);
      }
      if (dragMovedRef.current) applyTarget(drag.start - d / cfgRef.current.rowH, false);
    },
    [applyTarget]
  );

  const handlePointerEnd = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
    if (dragMovedRef.current) applyTarget(targetRef.current, true);
  }, [applyTarget]);

  const handleItemClick = useCallback(
    (index: number) => {
      if (dragMovedRef.current) return;
      const cfg = cfgRef.current;
      const cur = targetRef.current;
      let d = index - (((cur % cfg.count) + cfg.count) % cfg.count);
      if (cfg.loop && cfg.count > 1) {
        if (d > cfg.count / 2) d -= cfg.count;
        else if (d < -cfg.count / 2) d += cfg.count;
      }
      applyTarget(cur + d, true);
      resetAutoTimer();
    },
    [applyTarget, resetAutoTimer]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      let delta: number | null = null;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') delta = -1;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') delta = 1;
      if (delta == null) return;
      e.preventDefault();
      applyTarget(Math.round(targetRef.current) + delta, true);
      resetAutoTimer();
    },
    [applyTarget, resetAutoTimer]
  );

  useEffect(() => {
    applyTarget(targetRef.current, false);
  }, [items, fontSize, spacing, curve, tilt, blur, fade, minOpacity, side, loop, smoothing, orientation, applyTarget]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    },
    []
  );

  return (
    <div
      ref={rootRef}
      role={interactive ? 'listbox' : undefined}
      tabIndex={interactive ? 0 : -1}
      aria-label={interactive ? 'Pilihan menu makanan' : undefined}
      aria-hidden={!interactive}
      className={`relative h-full w-full select-none overflow-hidden outline-none [touch-action:none]${isPlateMode ? ' py-16 sm:py-20' : ''} ${interactive ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'pointer-events-none'}${className ? ` ${className}` : ''}`}
      style={
        {
          '--ow-text-color': textColor,
          '--ow-active-color': activeColor,
          '--ow-font-size': `${fontSize}rem`,
          '--ow-inset': `${inset}px`
        } as CSSProperties
      }
      onPointerDown={interactive ? handlePointerDown : undefined}
      onPointerMove={interactive ? handlePointerMove : undefined}
      onPointerUp={interactive ? handlePointerEnd : undefined}
      onPointerCancel={interactive ? handlePointerEnd : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      onMouseEnter={pauseAutoTimer}
      onMouseLeave={resetAutoTimer}
    >
      {items.map((label, index) => (
        <div
          key={`${label}-${index}`}
          ref={el => {
            itemRefs.current[index] = el;
          }}
          role="option"
          aria-selected={selectedIndex === index}
          className={
            cfg.plateMode
              ? 'absolute left-1/2 top-1/2 cursor-pointer will-change-[transform,opacity,filter]'
              : `absolute top-1/2 cursor-pointer whitespace-nowrap leading-none will-change-[transform,opacity,filter] [font-size:var(--ow-font-size)] [color:color-mix(in_srgb,var(--ow-active-color)_calc(var(--ow-p,0)*100%),var(--ow-text-color))] ${
                  cfg.orientation === 'horizontal'
                    ? 'left-0 w-max'
                    : side === 'right' ? 'right-[var(--ow-inset)] origin-right' : 'left-[var(--ow-inset)] origin-left'
                } ${selectedIndex === index ? 'font-medium' : 'font-extralight'}`
          }
          style={
            cfg.plateMode
              ? { width: plateSize, height: plateSize, marginLeft: -plateSize / 2 }
              : undefined
          }
          onClick={() => handleItemClick(index)}
        >
          {cfg.plateMode ? renderItem?.(index, label) : label}
        </div>
      ))}
    </div>
  );
};

export default OptionWheel;