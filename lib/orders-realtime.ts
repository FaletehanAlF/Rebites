'use client';
import { supabase } from './supabase';
let channelCounter = 0;
const DEFAULT_DEBOUNCE_MS = 400;
export interface OrdersRealtimeOptions {
    onChange: () => void;
    debounceMs?: number;
    label: string;
    table?: 'orders' | 'order_status_history';
}
export function subscribeOrdersRealtime({ onChange, debounceMs = DEFAULT_DEBOUNCE_MS, label, table = 'orders', }: OrdersRealtimeOptions): () => void {
    channelCounter += 1;
    const channelName = `rebites-${table}-${label}-${channelCounter}`;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
        if (timer !== null)
            return;
        timer = setTimeout(() => {
            timer = null;
            onChange();
        }, debounceMs);
    };
    const channel = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => schedule())
        .subscribe();
    return () => {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
        void supabase.removeChannel(channel);
    };
}
