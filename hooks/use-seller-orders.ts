'use client';

import { useSyncExternalStore } from 'react';
import {
  ORDERS_UPDATED_EVENT,
  getSellerOrders,
} from '@/lib/order-storage';
import type { StoredOrder } from '@/lib/types';

const POLL_INTERVAL_MS = 20_000; // 20 detik

interface SellerOrdersState {
  orders: StoredOrder[];
  hydrated: boolean;
}

// Store bersama (pola lib/store-closed-modal-store.ts): satu interval polling
// dan satu listener untuk semua instance useSellerOrders.
let state: SellerOrdersState = { orders: [], hydrated: false };
let listeners: Array<() => void> = [];
let intervalId: number | null = null;
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
    // Polling fallback → pesanan dari browser pembeli lain juga terlihat
    intervalId = window.setInterval(onOrdersUpdated, POLL_INTERVAL_MS);
    void refreshOrders();
  }
  return () => {
    listeners = listeners.filter((l) => l !== listener);
    if (listeners.length === 0) {
      // Subscriber terakhir unmount: hentikan polling agar tidak bocor.
      window.removeEventListener(ORDERS_UPDATED_EVENT, onOrdersUpdated);
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
