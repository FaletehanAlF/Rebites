'use client';

import { useEffect, useRef, useState } from 'react';

export function Marquee({
  children,
  reverse = false,
  className,
  pauseOnHover = false,
}: {
  children: React.ReactNode;
  reverse?: boolean;
  className?: string;
  pauseOnHover?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Default `true` supaya render server / tanpa JS tetap beranimasi seperti
  // biasa; IntersectionObserver hanya mematikannya setelah konfirmasi strip
  // berada di luar viewport.
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Hanya satu aturan animation-play-state yang dipakai pada satu waktu agar
  // pause saat di luar viewport tidak saling menimpa pauseOnHover.
  const playStateRule = inView
    ? pauseOnHover
      ? 'group-hover:[animation-play-state:paused]'
      : ''
    : '[animation-play-state:paused]';

  return (
    <div
      ref={rootRef}
      className={`group flex overflow-hidden ${className ?? ''}`}
    >
      <div
        className={`flex shrink-0 items-center ${
          reverse ? 'animate-marquee-reverse' : 'animate-marquee'
        } ${playStateRule}`}
      >
        {children}
        {children}
      </div>
    </div>
  );
}
