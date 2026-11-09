'use client';
import { supabase } from './supabase';
let channelCounter = 0;
const DEFAULT_DEBOUNCE_MS = 300;
export interface SupportRealtimeOptions {
    onChange: () => void;
    debounceMs?: number;
    label: string;
}
export function subscribeSupportRealtime({ onChange, debounceMs = DEFAULT_DEBOUNCE_MS, label, }: SupportRealtimeOptions): () => void {
    channelCounter += 1;
    const channelName = `rebites-support-${label}-${channelCounter}`;
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'support_threads' }, () => schedule())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => schedule())
        .subscribe();
    return () => {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
        void supabase.removeChannel(channel);
    };
}
