'use client';

import { useEffect, useState } from 'react';

export function useCountdown(deadlineIso: string) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const deadline = new Date(deadlineIso).getTime();
    // Tanggal tidak valid: jangan biarkan remaining menjadi NaN.
    if (Number.isNaN(deadline)) {
      setRemaining(0);
      return;
    }

    let id: number | null = null;

    const tick = () => {
      const diff = deadline - Date.now();
      if (diff <= 0) {
        setRemaining(0);
        // Hentikan interval setelah mencapai 0 agar tidak berjalan terus.
        if (id !== null) {
          window.clearInterval(id);
          id = null;
        }
        return;
      }
      setRemaining(Math.max(0, Math.floor(diff / 1000)));
    };

    tick();
    if (deadline > Date.now()) {
      id = window.setInterval(tick, 1000);
    }
    return () => {
      if (id !== null) window.clearInterval(id);
    };
  }, [deadlineIso]);

  return remaining;
}

export function formatCountdown(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
