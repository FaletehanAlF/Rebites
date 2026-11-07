'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { NOTIFICATIONS_UPDATED_EVENT, getNotifications, getUnreadCount, markAsRead as storageMarkAsRead, markAllAsRead as storageMarkAllAsRead, type Notification, type NotificationRole, } from '@/lib/notification-storage';
export function useNotifications(userId: string | null | undefined, role: NotificationRole) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const channelSuffixRef = useRef<string>(Math.random().toString(36).slice(2, 8));
    const refresh = useCallback(async () => {
        if (!userId) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }
        const [list, unread] = await Promise.all([
            getNotifications(userId, role),
            getUnreadCount(userId, role),
        ]);
        setNotifications(list);
        setUnreadCount(unread);
    }, [userId, role]);
    useEffect(() => {
        refresh();
        window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
        let channel: ReturnType<typeof supabase.channel> | null = null;
        if (userId) {
            try {
                const uniqueChannelName = `rebites-notifications-${role}-${userId}-${channelSuffixRef.current}`;
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
                        console.error('[useNotifications] realtime subscribe error:', err);
                });
            }
            catch (e) {
                console.error('[useNotifications] gagal subscribe realtime:', e);
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
    const markRead = useCallback((notificationId: string) => {
        storageMarkAsRead(notificationId).then(() => refresh());
    }, [refresh]);
    const markAllRead = useCallback(() => {
        if (!userId)
            return;
        storageMarkAllAsRead(userId, role).then(() => refresh());
    }, [userId, role, refresh]);
    return { notifications, unreadCount, markRead, markAllRead, refresh };
}
