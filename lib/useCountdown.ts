'use client';
import { useSyncExternalStore } from 'react';
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let currentSecond = 0;
function readSecond(): number {
    return Math.floor(Date.now() / 1000);
}
function notify(): void {
    const next = readSecond();
    if (next === currentSecond)
        return;
    currentSecond = next;
    listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void): () => void {
    if (listeners.size === 0) {
        currentSecond = readSecond();
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
let snapshot = 0;
function getSnapshot(): number {
    const s = readSecond();
    if (s !== snapshot)
        snapshot = s;
    return snapshot;
}
function getServerSnapshot(): number {
    return 0;
}
export function useCountdown(deadlineIso: string) {
    const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    if (!now)
        return null;
    const deadline = new Date(deadlineIso).getTime();
    if (Number.isNaN(deadline))
        return null;
    return Math.max(0, Math.floor((deadline - now * 1000) / 1000));
}
export function formatCountdown(totalSeconds: number) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
