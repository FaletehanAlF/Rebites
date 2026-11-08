# Database Functions & Triggers

> PostgreSQL functions, RPCs, and triggers used by the application.

---

## Key Functions

### Stock Reservation

```sql
-- reserve_stock_for_order(p_items jsonb)
-- Returns: TABLE(success boolean, order_code text, error_message text)

-- Called from: /api/checkout/xendit
-- Atomic stock decrement + reservation markers
-- Rolls back entirely if any item insufficient stock

CREATE OR REPLACE FUNCTION reserve_stock_for_order(p_items jsonb)
RETURNS TABLE (success boolean, order_code text, error_message text)
LANGUAGE plpgsql AS $$
DECLARE
    v_item jsonb;
    v_product_id uuid;
    v_qty int;
    v_available int;
    v_order_code text := 'RB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('order_code_seq')::text, 6, '0');
BEGIN
    -- Validate all items first (with row locks)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_qty := (v_item->>'quantity')::int;
        
        SELECT stock INTO v_available 
        FROM products 
        WHERE id = v_product_id 
        FOR UPDATE; -- Row lock prevents race conditions
        
        IF v_available < v_qty THEN
            RETURN QUERY SELECT false, v_order_code, 'Stok tidak mencukupi';
            RETURN;
        END IF;
    END LOOP;
    
    -- All items available - reserve
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_qty := (v_item->>'quantity')::int;
        
        UPDATE products 
        SET stock = stock - v_qty 
        WHERE id = v_product_id;
        
        INSERT INTO reservation_markers (product_id, qty, order_code, status)
        VALUES (v_product_id, v_qty, v_order_code, 'reserved');
    END LOOP;
    
    RETURN QUERY SELECT true, v_order_code, null;
END;
$$;
```

### Confirm Stock Reservation

```sql
-- confirm_stock_reservation(p_order_code text)
-- Called from: Xendit webhook on payment success
-- Changes reservation_markers status: 'reserved' → 'confirmed'

CREATE OR REPLACE FUNCTION confirm_stock_reservation(p_order_code text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    UPDATE reservation_markers
    SET status = 'confirmed', confirmed_at = now()
    WHERE order_code = p_order_code AND status = 'reserved';
END;
$$;
```

### Release Stock Reservation

```sql
-- release_stock_reservation(p_order_code text)
-- Called from: Xendit webhook on payment failure/expiry
-- Restores stock, marks markers 'released'

CREATE OR REPLACE FUNCTION release_stock_reservation(p_order_code text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    v_marker reservation_markers%ROWTYPE;
BEGIN
    FOR v_marker IN 
        SELECT * FROM reservation_markers 
        WHERE order_code = p_order_code AND status = 'reserved'
    LOOP
        UPDATE products 
        SET stock = stock + v_marker.qty 
        WHERE id = v_marker.product_id;
        
        UPDATE reservation_markers
        SET status = 'released', released_at = now()
        WHERE id = v_marker.id;
    END LOOP;
END;
$$;
```

### Order Code Sequence

```sql
-- Generates sequential order codes: RB-2024-000001

CREATE SEQUENCE order_code_seq;

-- Used in reserve_stock_for_order
```

### UMKM Slug Generation

```sql
-- generate_umkm_slug(p_business_name text)
-- Returns: text (unique slug)

CREATE OR REPLACE FUNCTION generate_umkm_slug(p_business_name text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
    v_slug text;
    v_counter int := 1;
BEGIN
    v_slug := lower(regexp_replace(p_business_name, '[^a-z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    
    WHILE EXISTS (SELECT 1 FROM umkm_profiles WHERE slug = v_slug) LOOP
        v_slug := v_slug || '-' || v_counter;
        v_counter := v_counter + 1;
    END LOOP;
    
    RETURN v_slug;
END;
$$;
```

### Product Slug Generation

```sql
-- generate_product_slug(p_umkm_id uuid, p_name text)
-- Returns: text (unique per store)

CREATE OR REPLACE FUNCTION generate_product_slug(p_umkm_id uuid, p_name text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
    v_slug text;
    v_counter int := 1;
BEGIN
    v_slug := lower(regexp_replace(p_name, '[^a-z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    
    WHILE EXISTS (SELECT 1 FROM products WHERE umkm_id = p_umkm_id AND slug = v_slug) LOOP
        v_slug := v_slug || '-' || v_counter;
        v_counter := v_counter + 1;
    END LOOP;
    
    RETURN v_slug;
END;
$$;
```

### Update Timestamps Trigger

```sql
-- Auto-update updated_at on row change

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Applied to: profiles, umkm_profiles, products, orders, subscriptions, etc.
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### New User Profile Creation

```sql
-- Trigger on auth.users insert → create profiles row

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO profiles (id, full_name, role)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'buyer');
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Order Activity Logging

```sql
-- Log order status changes to activity_logs

CREATE OR REPLACE FUNCTION log_order_activity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO activity_logs (order_id, action, old_status, new_status, actor_id)
        VALUES (NEW.id, 'status_change', OLD.status, NEW.status, 
            COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER order_status_activity
    AFTER UPDATE ON orders
    FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION log_order_activity();
```

### Auto-Approve Products (if enabled)

```sql
-- Auto-approve products from verified stores after N hours

CREATE OR REPLACE FUNCTION auto_approve_products()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    UPDATE products
    SET verification_status = 'approved'
    WHERE verification_status = 'pending'
    AND umkm_id IN (
        SELECT id FROM umkm_profiles WHERE is_verified = true
    )
    AND created_at < now() - INTERVAL '24 hours';
END;
$$;

-- Scheduled via pg_cron or external cron
```

### Sanction Cycle

```sql
-- Apply escalating sanctions based on warning count

CREATE OR REPLACE FUNCTION apply_sanction_cycle(p_umkm_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    v_warning_count int;
BEGIN
    SELECT COUNT(*) INTO v_warning_count
    FROM warnings
    WHERE umkm_id = p_umkm_id
    AND created_at > now() - INTERVAL '30 days';
    
    IF v_warning_count >= 3 THEN
        -- 3rd warning → sanction (72h deactivation)
        INSERT INTO sanctions (umkm_id, type, reason, expires_at)
        VALUES (p_umkm_id, 'sanction', '3 warnings in 30 days', now() + INTERVAL '72 hours');
        
        UPDATE umkm_profiles SET is_active = false WHERE id = p_umkm_id;
    ELSIF v_warning_count >= 2 THEN
        -- 2nd warning → warning sanction (24h deactivation)
        INSERT INTO sanctions (umkm_id, type, reason, expires_at)
        VALUES (p_umkm_id, 'warning', '2 warnings in 30 days', now() + INTERVAL '24 hours');
        
        UPDATE umkm_profiles SET is_active = false WHERE id = p_umkm_id;
    END IF;
END;
$$;
```

### Release Expired Sanctions

```sql
-- Cron job: re-activate stores with expired sanctions

CREATE OR REPLACE FUNCTION release_expired_sanctions()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    UPDATE umkm_profiles
    SET is_active = true
    WHERE id IN (
        SELECT umkm_id FROM sanctions 
        WHERE expires_at <= now() 
        AND released_at IS NULL
    );
    
    UPDATE sanctions
    SET released_at = now()
    WHERE expires_at <= now() AND released_at IS NULL;
END;
$$;
```

---

## Triggers Summary

| Trigger | Table | Event | Function |
|---------|-------|-------|----------|
| `update_updated_at` | Multiple | BEFORE UPDATE | `update_updated_at_column()` |
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` |
| `order_status_activity` | `orders` | AFTER UPDATE | `log_order_activity()` |
| `product_verification_audit` | `products` | AFTER UPDATE | Audit log insert |
| `sanction_cycle_trigger` | `warnings` | AFTER INSERT | `apply_sanction_cycle()` |

---

## Calling Functions from Application

### TypeScript RPC Calls

```typescript
// lib/server/checkout-idempotency.ts
const { data, error } = await supabase.rpc('reserve_stock_for_order', {
    p_items: itemsJson
});

// lib/server/subscription-activation.ts
await supabase.rpc('confirm_stock_reservation', { 
    p_order_code: order.order_code 
});

// lib/seller-plan.ts (for slug generation)
const { data: slug } = await supabase.rpc('generate_product_slug', {
    p_umkm_id: storeId,
    p_name: productName
});
```

---

## Security

| Function | Security |
|----------|----------|
| `reserve_stock_for_order` | SECURITY DEFINER (service role) |
| `confirm_stock_reservation` | SECURITY DEFINER |
| `release_stock_reservation` | SECURITY DEFINER |
| `generate_*_slug` | SECURITY DEFINER (reads tables) |
| `auto_approve_products` | SECURITY DEFINER (cron) |
| `apply_sanction_cycle` | SECURITY DEFINER |
| `release_expired_sanctions` | SECURITY DEFINER (cron) |

---

## Performance Notes

| Function | Optimization |
|----------|--------------|
| `reserve_stock_for_order` | Row-level locks (`FOR UPDATE`), single transaction |
| `confirm_stock_reservation` | Single UPDATE by order_code index |
| `release_stock_reservation` | Iterates only reserved markers for order |
| Slug functions | WHILE loop with index on slug columns |

---

## Testing

```bash
npm run test:stock-release-guard
npm run test:checkout-idempotency
npm run test:order-expiry
```