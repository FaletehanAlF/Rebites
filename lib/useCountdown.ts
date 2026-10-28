'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Satu interval bersama untuk SEMUA countdown di halaman.
 *
 * Versi sebelumnya memberi tiap kartu `setInterval` sendiri. Halaman flash sale
 * merender puluhan kartu sekaligus, jadi ada puluhan timer yang bangun tiap
 * detik dan masing-masing memicu re-render — penyebab utama jank saat menggulir
 * di halaman itu. Dengan satu pewaktu, biaya timer tetap satu berapa pun jumlah
 * kartunya, dan semua angka berganti pada detik yang sama.
 *
 * Pembaca hanya di-notifikasi saat nilai detiknya benar-benar berubah, sehingga
 * kartu yang sudah habis (00:00:00) berhenti di-render.
 */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let currentSecond = 0;

/** Detik epoch yang dibulatkan ke bawah. Nilai primitif → aman untuk snapshot. */
function readSecond(): number {
  return Math.floor(Date.now() / 1000);
}

function notify(): void {
  const next = readSecond();
  if (next === currentSecond) return;
  currentSecond = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    currentSecond = readSecond();
    // 1 detik cukup: resolusi tampilan countdown memang per detik.
    // Timer dibersihkan begitu pembaca terakhir lepas (unmount).
    timer = setInterval(notify, 1000);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

// getSnapshot harus mengembalikan nilai stabil antar-render. Kembalikan event
// epoch dalam detik; perubahan tick mengubah nilai ini sehingga ikut "hydrate"
// nilai yang benar setelah mount tanpa setState manual.
let snapshot = 0;
function getSnapshot(): number {
  const s = readSecond();
  if (s !== snapshot) snapshot = s;
  return snapshot;
}

function getServerSnapshot(): number {
  return 0;
}

export function useCountdown(deadlineIso: string) {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!now) return null;
  const deadline = new Date(deadlineIso).getTime();
  if (Number.isNaN(deadline)) return null;
  return Math.max(0, Math.floor((deadline - now * 1000) / 1000));
}

export function formatCountdown(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
