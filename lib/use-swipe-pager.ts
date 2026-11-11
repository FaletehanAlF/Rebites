"use client";

import { useCallback, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";

export const GESER_MIN_PX = 48;
export const RODA_MIN_PX = 24;
export const JEDA_RODA_MS = 400;

export function arahGeser(dx: number, dy: number): -1 | 0 | 1 {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
  if (Math.abs(dx) < GESER_MIN_PX) return 0;
  if (Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

export function arahRoda(deltaX: number, deltaY: number): -1 | 0 | 1 {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return 0;
  if (Math.abs(deltaX) < RODA_MIN_PX) return 0;
  if (Math.abs(deltaX) <= Math.abs(deltaY)) return 0;
  return deltaX > 0 ? 1 : -1;
}

export function halamanBerikut(halamanSekarang: number, arah: number, jumlahHalaman: number): number | null {
  const berikut = halamanSekarang + arah;
  if (berikut < 1 || berikut > jumlahHalaman) return null;
  return berikut;
}

interface OpsiPager {
  page: number;
  pageCount: number;
  onPageChange: (next: number) => void;
}

export function useSwipePager({ page, pageCount, onPageChange }: OpsiPager) {
  const mulaiX = useRef<number | null>(null);
  const mulaiY = useRef(0);
  const mulaiTarget = useRef<HTMLElement | null>(null);
  const kunciRoda = useRef(0);
  const telanKlik = useRef(false);
  // Penanda untuk menelan klik sintetis browser setelah kita memicu klik manual,
  // supaya tidak terjadi double navigasi pada kartu menu unggulan.
  const telanSintetis = useRef(false);

  const geserKe = useCallback(
    (arah: number) => {
      const berikut = halamanBerikut(page, arah, pageCount);
      if (berikut !== null) onPageChange(berikut);
    },
    [page, pageCount, onPageChange],
  );

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    mulaiX.current = event.clientX;
    mulaiY.current = event.clientY;
    mulaiTarget.current = event.target instanceof HTMLElement ? event.target : null;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
    }
  }, []);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const awalX = mulaiX.current;
      const target = mulaiTarget.current;
      mulaiX.current = null;
      mulaiTarget.current = null;
      if (awalX === null) return;
      const arah = arahGeser(event.clientX - awalX, event.clientY - mulaiY.current);
      if (arah === 0) {
        // Tidak ada geseran: klik biasa. Karena pointer capture dapat menelan
        // klik sintetis browser, picu klik secara manual pada elemen yang bisa
        // diklik (kartu menu / tombol Lihat Detail / hati favorit) agar navigasi
        // dan aksi tetap berjalan saat kartu diklik.
        const bisaKlik = target?.closest?.('button, [role="button"]') as HTMLElement | null;
        if (bisaKlik && bisaKlik !== event.currentTarget) {
          telanSintetis.current = true;
          try {
            bisaKlik.click();
          } finally {
            window.setTimeout(() => {
              telanSintetis.current = false;
            }, 100);
          }
        }
        return;
      }
      telanKlik.current = true;
      geserKe(arah);
    },
    [geserKe],
  );

  const onPointerCancel = useCallback(() => {
    mulaiX.current = null;
    mulaiTarget.current = null;
  }, []);

  const onWheel = useCallback(
    (event: ReactWheelEvent<HTMLElement>) => {
      const arah = arahRoda(event.deltaX, event.deltaY);
      if (arah === 0) return;
      const sekarang = Date.now();
      if (sekarang < kunciRoda.current) return;
      kunciRoda.current = sekarang + JEDA_RODA_MS;
      geserKe(arah);
    },
    [geserKe],
  );

  const onClickCapture = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    // Telan klik sintetis browser setelah pemicuan manual agar tidak double.
    if (telanSintetis.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!telanKlik.current) return;
    telanKlik.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return { onPointerDown, onPointerUp, onPointerCancel, onWheel, onClickCapture };
}
