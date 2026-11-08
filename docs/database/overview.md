# Database Schema Overview

> Complete table catalog with columns, types, and constraints.

---

## Core Tables

### Authentication & Users

| Table | Purpose |
|-------|---------|
| `auth.users` | Supabase Auth users (managed by Supabase) |
| `profiles` | Public profile data linked to auth.users |

### Seller/UMKM

| Table | Purpose |
|-------|---------|
| `umkm_profiles` | Store/business profiles |
| `plans` | Subscription plan definitions |
| `subscriptions` | Active subscriptions per store |

### Products & Catalog

| Table | Purpose |
|-------|---------|
| `products` | Product/menu items |
| `categories` | Product categories (static) |
| `product_favorites` | User favorites |

### Orders & Checkout

| Table | Purpose |
|-------|---------|
| `orders` | Orders with full state machine |
| `order_items` | Line items per order |
| `checkout_idempotency` | Idempotency keys for checkout |
| `reservation_markers` | Stock reservation tracking |

### Shipping & Courier

| Table | Purpose |
|-------|---------|
| `couriers` | Courier profiles |
| `courier_assignments` | Order assignments to couriers |
| `courier_locations` | Live GPS positions |
| `courier_locations_history` | Position history |

### Payments

| Table | Purpose |
|-------|---------|
| `xendit_invoices` | Xendit invoice records |
| `xendit_webhooks` | Webhook event log |

### Reviews & Social

| Table | Purpose |
|-------|---------|
| `reviews` | Product reviews |
| `store_follows` | User follows stores |

### Articles & Content

| Table | Purpose |
|-------|---------|
| `articles` | Blog articles |

### Notifications

| Table | Purpose |
|-------|---------|
| `notifications` | In-app notifications |

### Support & Moderation

| Table | Purpose |
|-------|---------|
| `reports` | User reports |
| `support_appeals` | User appeals |
| `warnings` | Product warnings |
| `sanctions` | Account/store sanctions |
| `chat_threads` | Admin support threads |
| `messages` | Chat messages |

### Admin & Audit

| Table | Purpose |
|-------|---------|
| `admin_audit_logs` | Admin action audit trail |
| `activity_logs` | System activity logs |
| `role_requests` | Role change requests |

### Analytics

| Table | Purpose |
|-------|---------|
| `site_visitors` | Unique site visitors |
| `store_visitors` | Per-store visitors |

### Coin Economy

| Table | Purpose |
|-------|---------|
| `coin_ledger` | Coin transactions |

---

## Detailed Table Schemas

### profiles
```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'buyer' 
        CHECK (role IN ('buyer','seller','admin','super_admin','courier')),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### umkm_profiles
```sql
CREATE TABLE umkm_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slug TEXT UNIQUE NOT NULL,
    business_name TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    cover_url TEXT,
    address TEXT,
    city TEXT,
    postal_code TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    verification_status TEXT DEFAULT 'pending'
        CHECK (verification_status IN ('pending','approved','rejected')),
    rejection_reason TEXT,
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    plan_id UUID REFERENCES plans(id),
    subscription_expires_at TIMESTAMPTZ,
    max_products INT DEFAULT 3,
    max_history_days INT DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### products
```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    umkm_id UUID NOT NULL REFERENCES umkm_profiles(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    original_price INT NOT NULL,
    surplus_price INT NOT NULL,
    stock INT DEFAULT 0,
    image_url TEXT,
    is_delivery BOOLEAN DEFAULT false,
    weight_gram INT,
    dimensions JSONB, -- {length, width, height}
    all_day BOOLEAN DEFAULT true,
    start_time TEXT, -- HH:mm
    end_time TEXT,   -- HH:mm
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    featured BOOLEAN DEFAULT false,
    verification_status TEXT DEFAULT 'pending'
        CHECK (verification_status IN ('pending','approved','rejected')),
    rejection_reason TEXT,
    flash_sale JSONB, -- {price, startIso, endIso}
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (umkm_id, slug)
);
```

### orders
```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_code TEXT UNIQUE NOT NULL, -- RB-2024-001234
    buyer_id UUID NOT NULL REFERENCES auth.users(id),
    umkm_id UUID NOT NULL REFERENCES umkm_profiles(id),
    status TEXT DEFAULT 'pending_payment'
        CHECK (status IN (
            'pending_payment','paid','preparing','ready',
            'delivering','delivered','completed',
            'cancelled','expired','failed'
        )),
    invoice_state TEXT DEFAULT 'created'
        CHECK (invoice_state IN ('created','paid','expired','failed','amount_mismatch')),
    fulfillment TEXT CHECK (fulfillment IN ('delivery','pickup')),
    subtotal INT NOT NULL,
    tax INT NOT NULL,
    total_amount INT NOT NULL,
    payment_method TEXT,
    payment_channel TEXT,
    address_snapshot JSONB NOT NULL,
    shipping_snapshot JSONB,
    coupon_code TEXT,
    discount_amount INT DEFAULT 0,
    xendit_external_id TEXT,
    xendit_invoice_id TEXT,
    xendit_status TEXT,
    biteship_order_id TEXT,
    biteship_tracking_id TEXT,
    biteship_waybill_id TEXT,
    shipment_status TEXT,
    notes TEXT,
    prepared_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancelled_by TEXT, -- 'buyer' | 'seller' | 'admin'
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### couriers
```sql
CREATE TABLE couriers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    vehicle_type TEXT CHECK (vehicle_type IN ('motor','mobil','sepeda')),
    is_active BOOLEAN DEFAULT true,
    is_available BOOLEAN DEFAULT true,
    current_latitude DOUBLE PRECISION,
    current_longitude DOUBLE PRECISION,
    last_location_update TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### courier_assignments
```sql
CREATE TABLE courier_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'assigned'
        CHECK (status IN ('assigned','picked_up','delivering','completed','cancelled')),
    distance_km NUMERIC(6,2),
    assigned_at TIMESTAMPTZ DEFAULT now(),
    picked_up_at TIMESTAMPTZ,
    delivering_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### subscriptions
```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    umkm_id UUID NOT NULL REFERENCES umkm_profiles(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending','active','expired','cancelled')),
    billing TEXT CHECK (billing IN ('monthly','yearly')),
    price_paid INT NOT NULL, -- total including tax
    xendit_invoice_id TEXT,
    xendit_status TEXT,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### notifications
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    payload JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### articles
```sql
CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT,
    cover_image TEXT,
    category TEXT,
    tags TEXT[],
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
    published_at TIMESTAMPTZ,
    author_id UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### reports
```sql
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES profiles(id),
    type TEXT NOT NULL CHECK (type IN ('product','store','order','user')),
    target_type TEXT NOT NULL,
    target_id UUID NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open','in_review','resolved','closed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### admin_audit_logs
```sql
CREATE TABLE admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES profiles(id),
    action TEXT NOT NULL,
    target_type TEXT,
    target_id UUID,
    reason TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Key Indexes

```sql
-- Products
CREATE INDEX ON products (umkm_id);
CREATE INDEX ON products (category, verification_status);
CREATE INDEX ON products (slug);
CREATE INDEX ON products (verification_status, is_delivery);

-- Orders
CREATE INDEX ON orders (buyer_id, created_at DESC);
CREATE INDEX ON orders (umkm_id, created_at DESC);
CREATE INDEX ON orders (status);
CREATE INDEX ON orders (order_code);

-- Courier assignments
CREATE INDEX ON courier_assignments (courier_id, status);
CREATE INDEX ON courier_assignments (order_id);

-- Notifications
CREATE INDEX ON notifications (user_id, created_at DESC);
CREATE INDEX ON notifications (user_id, is_read);

-- Reports
CREATE INDEX ON reports (target_type, target_id);
CREATE INDEX ON reports (reporter_id, created_at DESC);
```

---

## Migration History

| Date | Migration | Description |
|------|-----------|-------------|
| 2026-08-06 | `0001_rebites_schema.sql` | Initial schema |
| 2026-08-06 | `0002_revoke_trigger_execute.sql` | Security: revoke public execute |
| 2026-08-24 | `0003_align_frontend_schema.sql` | Align with frontend types |
| 2026-08-24 | `0004_seed_frontend_data.sql` | Seed categories, etc. |
| 2026-08-24 | `0005_umkm_logos_and_slug_rpc.sql` | Logo + slug RPC |
| 2026-08-24 | `0006_slug_parity_columns.sql` | Slug parity |
| 2026-08-25 | `0009_seed_category_topup.sql` | Category seed |
| 2026-08-25 | `0009b_demo_max_subscription.sql` | Demo subscription |
| 2026-08-25 | `0010_store_follows.sql` | Store follows |
| 2026-08-26 | `0011_backfill_umkm_slug.sql` | Backfill slugs |
| 2026-08-26 | `0012_cleanup_stores_and_demo_accounts.sql` | Cleanup |
| 2026-08-26 | `0013_xendit_payments.sql` | Xendit tables |
| 2026-08-26 | `0014_fix_storage_buckets.sql` | Storage buckets |
| 2026-08-27 | `0015_product_favorites.sql` | Favorites |
| 2026-08-29 | `0019_order_state_machine.sql` | Order state machine |
| 2026-08-29 | `0019_fix_reviews_upsert_order_progress.sql` | Reviews fix |
| 2026-08-30 | `0016_umkm_user_unique.sql` | UMKM unique |
| 2026-08-30 | `0017_drop_midtrans_depok_addresses.sql` | Remove Midtrans |
| 2026-08-30 | `0018_fix_rls_admin_recursion.sql` | RLS fix |
| 2026-08-31 | `fix_profiles_recursion_no_admin.sql` | Profiles RLS |
| 2026-09-28 | `product_verification.sql` | Product verification |
| 2026-09-28 | `fix_notifications_new_review.sql` | Review notifications |
| 2026-09-28 | `moderation_notification_types.sql` | Moderation notifications |
| 2026-09-29 | `7b1_address_location_foundation.sql` | Address location |
| 2026-09-30 | `7b2a_product_shipping_schema.sql` | Product shipping |
| 2026-09-30 | `order_delivery_eta_fields.sql` | Delivery ETA |
| 2026-09-30 | `order_shipping_snapshot.sql` | Shipping snapshot |
| 2026-09-30 | `order_shipping_selection.sql` | Shipping selection |
| 2026-09-30 | `order_shipment_identity.sql` | Shipment identity |
| 2026-09-30 | `role_security_fix.sql` | Role security |
| 2026-09-30 | `role_change_audit_log.sql` | Role change audit |
| 2026-09-30 | `articles.sql` | Articles table |
| 2026-09-30 | `article_images_storage.sql` | Article images |
| 2026-09-30 | `guard_order_payment_status.sql` | Payment guard |
| 2026-10-01 | `admin_monitoring_foundation.sql` | Admin monitoring |
| 2026-10-06 | `stage3a_monitoring_enhancements.sql` | Monitoring v2 |
| 2026-10-07 | `p0a_security_hardening.sql` | Security hardening |
| 2026-10-07 | `p0a1_revoke_public_execute.sql` | Revoke public execute |
| 2026-10-07 | `p0b_stock_order_state_security.sql` | Stock security |
| 2026-10-07 | `p0c_payment_subscription_security.sql` | Payment security |
| 2026-10-07 | `p1a1_fix_coin_guard_delete.sql` | Coin guard |
| 2026-10-07 | `p1a_coin_order_financial_security.sql` | Coin order security |
| 2026-10-07 | `p1b_review_notification_security.sql` | Review notification |
| 2026-10-08 | `checkout_idempotency_foundation.sql` | Idempotency |
| 2026-10-08 | `reserve_stock_for_order.sql` | Stock reservation |
| 2026-10-09 | `product_auto_approve.sql` | Auto-approve |
| 2026-10-10 | `product_activity_realtime_notify.sql` | Realtime notify |
| 2026-10-11 | `products_select_rls_scoping.sql` | Products RLS |
| 2026-10-12 | `order_activity_logs.sql` | Activity logs |
| 2026-10-13 | `umkm_verification_audit.sql` | UMKM audit |
| 2026-10-17 | `role_request_approval.sql` | Role approval |
| 2026-10-20 | `p1c_coin_refund_ledger_basis.sql` | Coin refund |
| 2026-10-21 | `report_notification_seller.sql` | Report notification |
| 2026-10-21 | `reports_insert_relation_guard.sql` | Reports guard |
| 2026-10-29 | `products_soft_delete.sql` | Soft delete |
| 2026-10-29 | `fix_activity_log_array_concat.sql` | Activity log fix |
| 2026-10-30 | `chatbot_history.sql` | Chatbot history |
| 2026-10-30 | `umkm_admin_deactivate.sql` | Admin deactivate |
| 2026-10-31 | `coin_adjustment_type.sql` | Coin adjustment |
| 2026-10-31 | `demo_courier.sql` | Demo courier |
| 2026-10-31 | `courier_live_delivery.sql` | Courier live delivery |
| 2026-11-02 | `scheduled_menu.sql` | Scheduled menu |
| 2026-11-04 | `ai_courier_gemini.sql` | AI courier |
| 2026-11-04 | `notif_laporan_peringatan_pengguna.sql` | Report notifications |
| 2026-11-04 | `admin_order_status_history.sql` | Order status history |
| 2026-11-04 | `sanction_cycle_complete.sql` | Sanction cycle |
| 2026-11-04 | `sanction_internal_release.sql` | Sanction release |
| 2026-11-04 | `store_deactivation_cycle.sql` | Store deactivation |
| 2026-11-04 | `role_audit_and_user_preferences.sql` | Role audit + prefs |
| 2026-11-05 | `courier_ai_reply_dedup.sql` | Courier AI dedup |
| 2026-11-06 | `admin_soft_delete.sql` | Admin soft delete |
| 2026-11-07 | `admin_product_soft_delete.sql` | Product soft delete |
| 2026-11-07 | `site_visitors.sql` | Site visitors |
| 2026-11-07 | `purge_admin_login_activity.sql` | Purge login activity |
| 2026-11-08 | `p...` | Various |
| 2026-11-09 | `support_inbox.sql` | Support inbox |
| 2026-11-10 | `store_visitors.sql` | Store visitors |

---

## ER Diagram

See `docs/diagrams/er-diagram.mmd` for Mermaid ER diagram.