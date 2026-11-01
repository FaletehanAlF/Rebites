'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface AdminRealtimeEvent {
  table: 'activity_logs' | 'products';
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  at: string;
  id: string | null;
}

export type AdminRealtimeConnection = 'idle' | 'connecting' | 'connected' | 'error';

let instanceCounter = 0;

/**
 * Subscription Realtime tunggal untuk monitoring admin:
 * activity_logs (INSERT) + products (INSERT/UPDATE/DELETE).
 * - Satu channel per hook instance; cleanup via removeChannel.
 * - Tidak membuat subscription ganda: guard ref + deps stabil.
 * - Hanya menerima data sesuai otorisasi RLS (admin membaca semua;
 *   non-admin tidak memakai hook ini — halaman admin sudah guard 403).
 */
export function useAdminRealtimeActivity(
  enabled: boolean,
  onEvent?: (event: AdminRealtimeEvent) => void
) {
  const [newCount, setNewCount] = useState(0);
  const [lastEvent, setLastEvent] = useState<AdminRealtimeEvent | null>(null);
  const [connection, setConnection] = useState<AdminRealtimeConnection>('idle');
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const subscribedRef = useRef(false);
  // Topik channel unik per instance supaya dua pemanggil hook pada halaman
  // yang sama tidak pernah berbagi (atau menabrakkan) subscription.
  const topicRef = useRef<string | null>(null);
  if (topicRef.current === null) {
    instanceCounter += 1;
    topicRef.current = `rebites-admin-monitoring-${instanceCounter}`;
  }

  const reset = useCallback(() => setNewCount(0), []);

  useEffect(() => {
    if (!enabled) {
      setConnection('idle');
      return;
    }
    if (subscribedRef.current) return;
    subscribedRef.current = true;
    setConnection('connecting');

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let disposed = false;
    try {
      channel = supabase
        .channel(topicRef.current as string)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'activity_logs' },
          (payload) => {
            const row = (payload.new ?? {}) as Record<string, unknown>;
            const evt: AdminRealtimeEvent = {
              table: 'activity_logs',
              event: 'INSERT',
              at: new Date().toISOString(),
              id: typeof row.id === 'string' ? row.id : null,
            };
            setLastEvent(evt);
            setNewCount((c) => c + 1);
            onEventRef.current?.(evt);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'products' },
          (payload) => {
            const evt: AdminRealtimeEvent = {
              table: 'products',
              event: (payload.eventType as AdminRealtimeEvent['event']) ?? 'UPDATE',
              at: new Date().toISOString(),
              id:
                typeof ((payload.new ?? payload.old ?? {}) as Record<string, unknown>).id ===
                'string'
                  ? (((payload.new ?? payload.old ?? {}) as Record<string, unknown>).id as string)
                  : null,
            };
            setLastEvent(evt);
            setNewCount((c) => c + 1);
            onEventRef.current?.(evt);
          }
        )
        .subscribe((status, err) => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') {
            setConnection('connected');
            return;
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setConnection('error');
          }
          if (err) console.error('[useAdminRealtimeActivity] subscribe error:', err);
        });
    } catch (e) {
      if (!disposed) setConnection('error');
      console.error('[useAdminRealtimeActivity] gagal subscribe:', e);
    }

    return () => {
      disposed = true;
      subscribedRef.current = false;
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [enabled]);

  return { newCount, lastEvent, reset, connection };
}
