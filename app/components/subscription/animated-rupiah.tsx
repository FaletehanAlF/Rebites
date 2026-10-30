'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { formatRupiah } from '@/lib/data';

/**
 * Angka rupiah yang bergeser halus saat nilainya berubah.
 *
 * Kenapa bukan `animate()` milik framer-motion pada teks: teks bukan elemen
 * yang bisa di-`style` per angka tanpa memaksa layout setiap frame. Di sini
 * hanya nilai rupiah yang disimpan di state kecil dan diperbarui lewat
 * requestAnimationFrame, sementara elemen yang digeser tidak me-layout ulang
 * apa pun selain dirinya.
 *
 * Aturan yang dijaga:
 *  - Satu timer saja per angka; selalu dibatalkan saat unmount atau saat nilai
 *    baru masuk, sehingga tidak ada interval yang menumpuk.
 *  - Nilai akhir SELALU tepat sama dengan `value` (frame terakhir menulis nilai
 *    penuh), bukan hasil pembulatan animasi.
 *  - `prefers-reduced-motion` mematikan animasi: angka langsung final.
 *  - Durasi pendek (220 ms) agar tidak terasa lambat, dan nilai awal sama
 *    dengan target pada render pertama (tidak ada hitungan dari 0).
 */
const DURATION_MS = 220;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function AnimatedRupiah({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const frameRef = useRef<number | null>(null);
  const fromRef = useRef(value);
  const startRef = useRef(0);

  useEffect(() => {
    // Render pertama (belum ada perubahan nilai) tidak perlu animasi.
    if (display === value) return;
    fromRef.current = display;
    startRef.current = 0;

    if (reducedMotion) {
      setDisplay(value);
      return;
    }

    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const progress = Math.min(1, (now - startRef.current) / DURATION_MS);
      const next = Math.round(
        fromRef.current + (value - fromRef.current) * easeOutCubic(progress),
      );
      if (progress >= 1) {
        setDisplay(value);
        frameRef.current = null;
        return;
      }
      setDisplay(next);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
    // `display` sengaja tidak masuk dependensi: ia adalah nilai berjalan yang
    // justru dibaca di dalam efek, bukan pemicu animasi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reducedMotion]);

  return (
    <span className={className} aria-label={`Rp${value.toLocaleString("id-ID")}`}>
      {/* Angka yang sedang bergerak disembunyikan dari pembaca layar agar
          tidak dibacakan puluhan kali; yang dibacakan adalah nilai akhir. */}
      <span aria-hidden>{formatRupiah(display)}</span>
    </span>
  );
}
