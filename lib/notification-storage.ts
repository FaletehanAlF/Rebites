'use client';

import { supabase } from './supabase';

export const NOTIFICATIONS_UPDATED_EVENT = 'rebites-notifications-updated';

export type NotificationRole = 'buyer' | 'seller';

export type NotificationType =
  | 'order_created'
  | 'payment_success'
  | 'order_delivering'
  | 'order_completed'
  | 'promo'
  | 'incoming_order'
  | 'new_review'
  | 'subscription_active'
  | 'subscription_renewed'
  | 'subscription_expiring'
  | 'subscription_changed'
  | 'subscription_expired'
  | 'product_approved'
  | 'product_rejected'
  | 'product_warning'
  /** NOTIF-1: laporan baru ditujukan ke pemilik toko yang dilaporkan. */
  | 'report_received';

export interface Notification {
  id: string;
  userId: string;
  role: NotificationRole;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  referenceId?: string;
  href?: string;
}

function dispatchUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
}

type NotificationRow = Record<string, any>;

function rowToNotification(row: NotificationRow): Notification {
  return {
    id: row.id ?? `tmp-${Math.random().toString(36).slice(2)}`,
    userId: row.user_id ?? '',
    role: (row.role ?? 'buyer') as NotificationRole,
    type: (row.type ?? 'promo') as NotificationType,
    title: row.title ?? 'Notifikasi',
    message: row.message ?? '',
    createdAt: row.created_at ?? new Date().toISOString(),
    read: row.read ?? false,
    referenceId: row.reference_id ?? undefined,
    href: row.href ?? undefined,
  };
}

export async function createNotification(
  input: Omit<Notification, 'id' | 'createdAt' | 'read'>
): Promise<Notification | null> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: input.userId,
      role: input.role,
      type: input.type,
      title: input.title,
      message: input.message,
      reference_id: input.referenceId ?? null,
      href: input.href ?? null,
      read: false,
    })
    .select()
    .maybeSingle();
  if (error) {
    console.error('[notification-storage] gagal membuat notifikasi:', error.message);
    // Fallback untuk DB yang belum include 'new_review' (sebelum migrasi 0004)
    if (error.message.includes('violates check constraint') && input.type === 'new_review') {
      const { data: retryData, error: retryErr } = await supabase
        .from('notifications')
        .insert({
          user_id: input.userId,
          role: input.role,
          type: 'incoming_order',
          title: input.title,
          message: input.message,
          reference_id: input.referenceId ?? null,
          href: input.href ?? null,
          read: false,
        })
        .select()
        .maybeSingle();
      if (!retryErr && retryData) {
        dispatchUpdated();
        return rowToNotification(retryData);
      }
    }
    return null;
  }
  dispatchUpdated();
  return data ? rowToNotification(data) : null;
}

export async function getNotifications(
  userId: string,
  role: NotificationRole
): Promise<Notification[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('role', role)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('[notification-storage] gagal memuat notifikasi:', error.message);
    return [];
  }
  return (data ?? []).map(rowToNotification);
}

export async function getUnreadCount(
  userId: string,
  role: NotificationRole
): Promise<number> {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', role)
    .eq('read', false);
  if (error) return 0;
  return count ?? 0;
}

export async function markAsRead(notificationId: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
  dispatchUpdated();
}

export async function markAllAsRead(
  userId: string,
  role: NotificationRole
): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('role', role)
    .eq('read', false);
  dispatchUpdated();
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await supabase.from('notifications').delete().eq('id', notificationId);
  dispatchUpdated();
}

export async function clearNotifications(
  userId: string,
  role: NotificationRole
): Promise<void> {
  await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId)
    .eq('role', role);
  dispatchUpdated();
}

export async function getUmkmOwnerUserId(slug: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('umkm_profiles')
    .select('user_id')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data?.user_id) return null;
  return data.user_id as string;
}
