'use client';

import { useSyncExternalStore } from 'react';
import {
  ORDERS_UPDATED_EVENT,
  getSellerOrders,
} from '@/lib/order-storage';
import { subscribeOrdersRealtime } from '@/lib/orders-realtime';
import type { StoredOrder } from '@/lib/types';

/**
 * Polling sekarang hanya FALLBACK. Perubahan status terlihat lewat Realtime
 * dalam hitungan detik; polling menjaga bila websocket putus (jaringan
 * berpindah, laptop tidur) — keadaan di mana Realtime diam tanpa memberi tahu.
 */
const POLL_INTERVAL_MS = 20_000; // 20 detik

interface SellerOrdersState {
  orders: StoredOrder[];
  hydrated: boolean;
}

// Store bersama (pola lib/store-closed-modal-store.ts): satu interval polling,
// satu langganan Realtime, dan satu listener untuk semua instance
// useSellerOrders.
let state: SellerOrdersState = { orders: [], hydrated: false };
let listeners: Array<() => void> = [];
let intervalId: number | null = null;
let unsubscribeRealtime: (() => void) | null = null;
let refreshGeneration = 0;

const SERVER_SNAPSHOT: SellerOrdersState = { orders: [], hydrated: false };

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

async function refreshOrders(): Promise<void> {
  const generation = ++refreshGeneration;
  const list = await getSellerOrders();
  // Buang hasil fetch yang sudah tergantikan refresh lebih baru.
  if (generation !== refreshGeneration) return;
  state = { orders: list, hydrated: true };
  emitChange();
}

function onOrdersUpdated() {
  void refreshOrders();
}

function subscribe(listener: () => void) {
  const first = listeners.length === 0;
  listeners = [...listeners, listener];
  if (first) {
    // Event-driven refresh (browser lokal)
    window.addEventListener(ORDERS_UPDATED_EVENT, onOrdersUpdated);
    // Perubahan dari browser/klien lain: pesanan baru, status berubah,
    // atau kurir ditugaskan — terlihat dalam hitungan detik.
    unsubscribeRealtime = subscribeOrdersRealtime({
      label: 'seller',
      onChange: onOrdersUpdated,
    });
    // Polling fallback: Realtime bisa diam tanpa memberi tahu.
    intervalId = window.setInterval(onOrdersUpdated, POLL_INTERVAL_MS);
    void refreshOrders();
  }
  return () => {
    listeners = listeners.filter((l) => l !== listener);
    if (listeners.length === 0) {
      // Subscriber terakhir unmount: lepaskan SEMUA sumber refresh agar
      // tidak ada kanal atau timer yang tertinggal.
      window.removeEventListener(ORDERS_UPDATED_EVENT, onOrdersUpdated);
      if (unsubscribeRealtime !== null) {
        unsubscribeRealtime();
        unsubscribeRealtime = null;
      }
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    }
  };
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

/** Pesanan nyata yang masuk ke toko seller yang sedang login. */
export function useSellerOrders() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  const hasOrders = snapshot.hydrated && snapshot.orders.length > 0;

  return { orders: snapshot.orders, hasOrders, hydrated: snapshot.hydrated };
}
