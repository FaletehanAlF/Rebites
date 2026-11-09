'use client';
import { useSyncExternalStore } from 'react';
import { ORDERS_UPDATED_EVENT, getSellerOrdersResult, } from '@/lib/order-storage';
import { subscribeOrdersRealtime } from '@/lib/orders-realtime';
import type { StoredOrder } from '@/lib/types';
const POLL_INTERVAL_MS = 20000;
interface SellerOrdersState {
    orders: StoredOrder[];
    hydrated: boolean;
    error: string | null;
}
let state: SellerOrdersState = { orders: [], hydrated: false, error: null };
let listeners: Array<() => void> = [];
let intervalId: number | null = null;
let unsubscribeRealtime: (() => void) | null = null;
let refreshGeneration = 0;
const SERVER_SNAPSHOT: SellerOrdersState = { orders: [], hydrated: false, error: null };
function emitChange() {
    for (const listener of listeners) {
        listener();
    }
}
async function refreshOrders(): Promise<void> {
    const generation = ++refreshGeneration;
    const result = await getSellerOrdersResult();
    if (generation !== refreshGeneration)
        return;
    state = { orders: result.orders, hydrated: true, error: result.error };
    emitChange();
}
function onOrdersUpdated() {
    void refreshOrders();
}
function subscribe(listener: () => void) {
    const first = listeners.length === 0;
    listeners = [...listeners, listener];
    if (first) {
        window.addEventListener(ORDERS_UPDATED_EVENT, onOrdersUpdated);
        unsubscribeRealtime = subscribeOrdersRealtime({
            label: 'seller',
            onChange: onOrdersUpdated,
        });
        intervalId = window.setInterval(onOrdersUpdated, POLL_INTERVAL_MS);
        void refreshOrders();
    }
    return () => {
        listeners = listeners.filter((l) => l !== listener);
        if (listeners.length === 0) {
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
export function useSellerOrders() {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const hasOrders = snapshot.hydrated && snapshot.orders.length > 0;
    return { orders: snapshot.orders, hasOrders, hydrated: snapshot.hydrated, error: snapshot.error };
}
