# Notifications Feature

> In-app notification system with real-time delivery via Supabase Realtime.

---

## Overview

Notifications inform users about platform events: orders, reviews, verifications, reports, etc.

**Delivery**: Supabase Realtime (postgres_changes) + In-app list
**Types**: Buyer, Seller, Courier, Admin

---

## Data Model

### Table: `notifications`

```sql
notifications (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users,
    type TEXT NOT NULL,           -- Enum below
    title TEXT NOT NULL,
    message TEXT,
    payload JSONB,                -- Deep link data
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
)
```

### Notification Types

| Type | Recipient | Trigger | Payload |
|------|-----------|---------|---------|
| `order_created` | Buyer | Order placed | `{ orderCode, orderId }` |
| `order_paid` | Buyer + Seller | Payment confirmed | `{ orderCode, orderId }` |
| `order_status_changed` | Buyer | Seller/courier updates | `{ orderCode, status, orderId }` |
| `order_cancelled` | Buyer + Seller | Order cancelled | `{ orderCode, reason }` |
| `new_review` | Seller | Buyer leaves review | `{ productId, reviewId }` |
| `product_approved` | Seller | Admin approves | `{ productId, productName }` |
| `product_rejected` | Seller | Admin rejects | `{ productId, reason }` |
| `product_warning` | Seller | Admin warns | `{ productId, warningId }` |
| `report_submitted` | Seller + Admin | Buyer reports | `{ reportId, type }` |
| `assignment_created` | Courier | New delivery task | `{ assignmentId, orderId }` |
| `delivery_updated` | Buyer | Courier status change | `{ orderCode, status }` |
| `subscription_expiring` | Seller | 3 days before expiry | `{ planId, daysLeft }` |
| `flash_sale_starting` | Seller | 1 hour before | `{ productId, slot }` |
| `verification_request` | Admin | New UMKM verification | `{ umkmId }` |

---

## Real-Time Delivery

### Client Subscription

```typescript
// hooks/use-notifications.ts
export function useNotifications() {
    const { user } = useCurrentUser();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    
    useEffect(() => {
        if (!user) return;
        
        // Initial load
        fetchNotifications().then(setNotifications);
        
        // Realtime subscription
        const channel = supabase
            .channel(`notifications-${user.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                const newNotif = payload.new as Notification;
                setNotifications(prev => [newNotif, ...prev]);
                setUnreadCount(prev => prev + 1);
                // Show toast
                toast({ title: newNotif.title, description: newNotif.message });
            })
            .subscribe();
        
        return () => supabase.removeChannel(channel);
    }, [user]);
}
```

### Server Insert

```typescript
// lib/notification-service.ts
export async function createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    payload: Record<string, unknown> = {}
) {
    const service = createServiceClient();
    await service.from('notifications').insert({
        user_id: userId,
        type,
        title,
        message,
        payload,
    });
}
```

---

## In-App Notification Pages

### Buyer: `/notifikasi/pembeli`

```tsx
// app/(app)/notifikasi/pembeli/page.tsx
export default function BuyerNotificationPage() {
    return (
        <RequireAuth>
            <NotificationList 
                filters={['order', 'review', 'promo']}
                onMarkRead={markAsRead}
                onMarkAllRead={markAllAsRead}
            />
        </RequireAuth>
    );
}
```

### Seller: `/dashboard/penjual/[storeId]/notifikasi`

```tsx
// Similar but includes seller-specific types
```

### Admin: In admin dashboard (monitoring)

---

## UI Components

### NotificationList
- Tabs: Semua / Belum dibaca
- Infinite scroll
- Each item: icon, title, message, time, read status
- Click → deep link (mark read on click)
- "Tandai semua dibaca" button

### Toast Integration
```typescript
// Uses @radix-ui/react-toast via hooks/use-toast
toast({
    title: "Pesanan Baru",
    description: "Ada pesanan baru dari Warung Makmur",
    variant: "default",
});
```

---

## Deep Linking

| Type | Route |
|------|-------|
| `order_created` | `/riwayatPesanan/[orderCode]` |
| `order_paid` | `/riwayatPesanan/[orderCode]` |
| `order_status_changed` | `/riwayatPesanan/[orderCode]` |
| `new_review` | `/dashboard/penjual/[storeId]/ulasan` |
| `product_approved` | `/dashboard/penjual/[storeId]/menu` |
| `product_rejected` | `/dashboard/penjual/[storeId]/menu` |
| `product_warning` | `/dashboard/penjual/[storeId]/menu` |
| `report_submitted` | `/dashboard/admin/monitoring/laporan/[id]` |
| `assignment_created` | `/dashboard/kurir` |
| `delivery_updated` | `/riwayatPesanan/[orderCode]` |
| `subscription_expiring` | `/dashboard/penjual/[storeId]/langganan` |

---

## Mark as Read

```typescript
// PATCH /api/notifications/[id]
// { is_read: true }

// Or bulk:
POST /api/notifications/read-all
```

---

## Admin Notification Management

### Monitoring → Peringatan
- Product warnings with auto-link to product

### Monitoring → Laporan
- User reports with notes

### Chat
- Support threads with buyers/sellers

---

## Performance

| Optimization | Implementation |
|--------------|----------------|
| Initial load | Server-side fetch on page |
| Realtime | Single channel per user |
| Payload size | Minimal JSONB (ids only) |
| Toast debounce | Group rapid notifications |
| Cleanup | Auto-delete read > 30 days (cron) |

---

## RLS Policies

```sql
-- Users see only their own
CREATE POLICY "Users see own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

-- Service role inserts
CREATE POLICY "Service role inserts" ON notifications
    FOR INSERT WITH CHECK (true);
```

---

## Testing

```bash
npm run test:report-notification
npm run test:moderation-notification-service-role
```

---

## Known Issues

| Issue | Location | Workaround |
|-------|----------|------------|
| No push notifications | Mobile | In-app only |
| No email fallback | All types | In-app only |
| Realtime reconnect | Network | Auto-resubscribe |
| High volume | Popular stores | Consider batching |
| No preferences | All users | All types enabled |