'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { NOTIFICATIONS_UPDATED_EVENT, getUnreadCountByType, markTypeAsRead, type NotificationRole, type NotificationType } from '@/lib/notification-storage';

const ORDERS_PAGE_PREFIX = '/riwayatPesanan';

/**
 * Badge merah menu "Pesanan Saya".
 *
 * Setiap kali pembayaran berhasil, `settleOrderPaid` (server) menyisipkan
 * tepat satu notifikasi pembeli bertipe `payment_success` yang belum
 * dibaca — jadi hitungan notifikasi tersebut = jumlah pesanan baru yang
 * belum pernah dibuka di menu Pesanan Saya.
 *
 * Badge hilang otomatis ketika pembeli sedang membuka halaman
 * /riwayatPesanan (dianggap sudah melihat pesanannya).
 */
export function useOrderBadge(userId: string | null | undefined, role: NotificationRole = 'buyer', type: NotificationType = 'payment_success') {
    const pathname = usePathname();
    const [count, setCount] = useState(0);
    const channelSuffixRef = useRef<string>(Math.random().toString(36).slice(2, 8));
    const lastClearAttemptRef = useRef<number>(-1);

    const refresh = useCallback(async () => {
        const unread = await getUnreadCountByType(userId, role, type);
        setCount(unread);
    }, [userId, role, type]);

    const isOnOrdersPage = Boolean(pathname?.startsWith(ORDERS_PAGE_PREFIX));

    useEffect(() => {
        refresh();
        window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
        let channel: ReturnType<typeof supabase.channel> | null = null;
        if (userId) {
            try {
                const uniqueChannelName = `rebites-order-badge-${role}-${userId}-${channelSuffixRef.current}`;
                channel = supabase
                    .channel(uniqueChannelName)
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${userId}`,
                    }, () => refresh())
                    .subscribe((status, err) => {
                        if (err)
                            console.error('[useOrderBadge] realtime subscribe error:', err);
                    });
            }
            catch (e) {
                console.error('[useOrderBadge] gagal subscribe realtime:', e);
            }
        }
        return () => {
            window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
            if (channel) {
                try {
                    supabase.removeChannel(channel);
                }
                catch { }
            }
        };
    }, [refresh, userId, role]);

    useEffect(() => {
        if (!isOnOrdersPage || !userId || count === 0)
            return;
        if (lastClearAttemptRef.current === count)
            return;
        lastClearAttemptRef.current = count;
        void markTypeAsRead(userId, role, type);
    }, [isOnOrdersPage, count, userId, role, type]);

    return count;
}
