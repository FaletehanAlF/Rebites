'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth } from '@/lib/auth-token';
import { resolveLocationFreshness, type LocationFreshness, } from '@/lib/courier-location';
export interface LiveCourierLocation {
    latitude: number;
    longitude: number;
    accuracyM: number | null;
    recordedAt: string;
}
export interface UseCourierLocationResult {
    location: LiveCourierLocation | null;
    freshness: LocationFreshness;
    loading: boolean;
    error: string | null;
}
const POLL_INTERVAL_MS = 10000;
const FRESHNESS_TICK_MS = 15000;
let channelCounter = 0;
export function useCourierLocation(orderDbId: string | null | undefined, enabled = true): UseCourierLocationResult {
    const [location, setLocation] = useState<LiveCourierLocation | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const active = Boolean(orderDbId) && enabled;
    const refresh = useCallback(async () => {
        if (!orderDbId || !enabled)
            return;
        try {
            const res = await fetchWithAuth(`/api/courier/location?orderId=${encodeURIComponent(orderDbId)}`);
            if (!res.ok) {
                setError('Gagal memuat posisi kurir.');
                return;
            }
            const json = (await res.json()) as {
                location?: LiveCourierLocation | null;
            };
            setLocation(json.location ?? null);
            setError(null);
        }
        catch {
            setError('Gagal memuat posisi kurir.');
        }
    }, [orderDbId, enabled]);
    useEffect(() => {
        if (!active)
            return;
        const id = window.setInterval(() => setNow(Date.now()), FRESHNESS_TICK_MS);
        return () => window.clearInterval(id);
    }, [active]);
    useEffect(() => {
        if (!orderDbId || !enabled) {
            setLocation(null);
            setError(null);
            return;
        }
        setLoading(true);
        void refresh();
        channelCounter += 1;
        const channel = supabase
            .channel(`rebites-courier-location-${orderDbId}-${channelCounter}`)
            .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'delivery_locations',
            filter: `order_id=eq.${orderDbId}`,
        }, (payload) => {
            const row = (payload.new ?? {}) as Record<string, unknown>;
            if (row.latitude == null || row.longitude == null) {
                setLocation(null);
                return;
            }
            setLocation({
                latitude: Number(row.latitude),
                longitude: Number(row.longitude),
                accuracyM: row.accuracy_m == null ? null : Number(row.accuracy_m),
                recordedAt: row.recorded_at
                    ? String(row.recorded_at)
                    : new Date().toISOString(),
            });
            setError(null);
            setNow(Date.now());
        })
            .subscribe();
        const intervalId = window.setInterval(() => {
            void refresh();
        }, POLL_INTERVAL_MS);
        return () => {
            void supabase.removeChannel(channel);
            window.clearInterval(intervalId);
            setLoading(false);
        };
    }, [orderDbId, enabled, refresh]);
    const freshness: LocationFreshness = location
        ? resolveLocationFreshness(location.recordedAt, now)
        : 'tidak_tersedia';
    return { location, freshness, loading, error };
}
