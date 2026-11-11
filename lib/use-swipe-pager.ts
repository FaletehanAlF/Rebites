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
  const kunciRoda = useRef(0);
  const telanKlik = useRef(false);

  const geserKe = useCallback(
    (arah: number) => {
      const berikut = halamanBerikut(page, arah, pageCount);
      if (berikut !== null) onPageChange(berikut);
    },
    [page, pageCount, onPageChange],
  );

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // Jangan panggil setPointerCapture: capture dapat menelan klik sintetis
    // browser sehingga onClick pada kartu/tombol "Lihat Detail" tidak pernah
    // terpicu. Cukup catat titik awal geseran; geseran yang keluar area
    // container tidak terdeteksi (trade-off kecil demi klik yang andal).
    mulaiX.current = event.clientX;
    mulaiY.current = event.clientY;
  }, []);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const awalX = mulaiX.current;
      mulaiX.current = null;
      if (awalX === null) return;
      const arah = arahGeser(event.clientX - awalX, event.clientY - mulaiY.current);
      if (arah === 0) return;
      telanKlik.current = true;
      geserKe(arah);
    },
    [geserKe],
  );

  const onPointerCancel = useCallback(() => {
    mulaiX.current = null;
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
    if (!telanKlik.current) return;
    telanKlik.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return { onPointerDown, onPointerUp, onPointerCancel, onWheel, onClickCapture };
}