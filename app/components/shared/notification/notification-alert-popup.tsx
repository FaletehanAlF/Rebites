'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/current-user';
import { ALERT_NOTIFICATION_TYPES, markAsRead, type Notification, } from '@/lib/notification-storage';
import { formatNotificationTime } from '@/lib/notification-helpers';
import { NotificationIcon } from './notification-icon';
export function NotificationAlertPopup() {
    const { userId } = useCurrentUser();
    const [queue, setQueue] = useState<Notification[]>([]);
    const [busy, setBusy] = useState(false);
    const dismissedRef = useRef<Set<string>>(new Set());
    const load = useCallback(async () => {
        if (!userId) {
            setQueue([]);
            return;
        }
        const { data, error } = await supabase
            .from('notifications')
            .select('id, user_id, role, type, title, message, created_at, read, reference_id, href')
            .eq('user_id', userId)
            .eq('read', false)
            .in('type', ALERT_NOTIFICATION_TYPES as string[])
            .order('created_at', { ascending: true })
            .limit(20);
        if (error) {
            console.error('[notification-alert] gagal memuat alert:', error.message);
            return;
        }
        const rows = (data ?? []) as Record<string, unknown>[];
        setQueue(rows
            .filter((row) => !dismissedRef.current.has(String(row.id ?? '')))
            .filter((row) => row.read !== true)
            .map((row) => ({
            id: String(row.id ?? ''),
            userId: String(row.user_id ?? ''),
            role: (row.role === 'seller' ? 'seller' : 'buyer') as Notification['role'],
            type: (row.type ?? 'promo') as Notification['type'],
            title: String(row.title ?? 'Pemberitahuan'),
            message: String(row.message ?? ''),
            createdAt: String(row.created_at ?? new Date().toISOString()),
            read: false,
            referenceId: typeof row.reference_id === 'string' ? row.reference_id : undefined,
            href: typeof row.href === 'string' ? row.href : undefined,
        })));
    }, [userId]);
    useEffect(() => {
        void load();
    }, [load]);
    useEffect(() => {
        if (!userId)
            return;
        const channel = supabase
            .channel(`rebites-alerts-${userId}-${Math.random().toString(36).slice(2, 8)}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => void load())
            .subscribe();
        return () => {
            void supabase.removeChannel(channel);
        };
    }, [userId, load]);
    const current = queue[0] ?? null;
    const dismiss = async () => {
        if (!current)
            return;
        dismissedRef.current.add(current.id);
        setQueue((prev) => prev.slice(1));
        setBusy(true);
        try {
            await markAsRead(current.id);
        }
        catch (err) {
            console.error('[notification-alert] gagal menandai terbaca:', err);
        }
        finally {
            setBusy(false);
        }
    };
    if (!current)
        return null;
    const sisa = queue.length - 1;
    return (<Dialog open onOpenChange={(open) => !open && void dismiss()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="space-y-1 pr-10 text-left">
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-sage-500">
            <BellRing aria-hidden className="h-3.5 w-3.5"/>
            Pemberitahuan akun
          </span>
          <DialogTitle className="mt-1 flex items-start gap-3 text-left">
            <NotificationIcon type={current.type}/>
            <span className="min-w-0 break-words text-base font-semibold text-charcoal-900">
              {current.title}
            </span>
          </DialogTitle>
          <DialogDescription asChild>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-charcoal-700">
              {current.message}
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-sage-500">
          <time>{formatNotificationTime(current.createdAt)}</time>
          {sisa > 0 && <span>{sisa} pemberitahuan lain</span>}
        </div>

        <DialogFooter className="mt-4 gap-2">
          {current.href && (<Button type="button" variant="outline" onClick={() => {
                window.location.assign(current.href as string);
            }}>
              Lihat detail
            </Button>)}
          <Button type="button" onClick={() => void dismiss()} disabled={busy}>
            Mengerti
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
