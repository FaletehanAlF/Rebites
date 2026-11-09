# Row-Level Security (RLS) Policies

> Complete RLS policy catalog for all tables.

---

## RLS Philosophy

All tables have RLS enabled. Policies follow least-privilege:
- **Public/Anonymous**: Read-only access to published content
- **Authenticated users**: Own data only (CRUD on owned resources)
- **Service Role**: Full access (server-only, bypasses RLS)
- **Admin/Super Admin**: Elevated access via role checks

---

## Policy Reference by Table

### profiles
```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read own profile
CREATE POLICY "Users read own profile" ON profiles
    FOR SELECT USING (id = auth.uid());

-- Users can update own profile
CREATE POLICY "Users update own profile" ON profiles
    FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Service role full access
CREATE POLICY "Service role full access" ON profiles
    FOR ALL USING (auth.role() = 'service_role');
```

### umkm_profiles
```sql
ALTER TABLE umkm_profiles ENABLE ROW LEVEL SECURITY;

-- Public: read approved, active stores
CREATE POLICY "Public read active stores" ON umkm_profiles
    FOR SELECT USING (is_active = true AND is_verified = true);

-- Owner: full access to own store
CREATE POLICY "Owner full access" ON umkm_profiles
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Admin: read all
CREATE POLICY "Admin read all" ON umkm_profiles
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')
    ));

-- Admin: update verification status
CREATE POLICY "Admin manage verification" ON umkm_profiles
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')
    )) WITH CHECK (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')
    ));

-- Service role
CREATE POLICY "Service role" ON umkm_profiles
    FOR ALL USING (auth.role() = 'service_role');
```

### products
```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Public: read approved products (for catalog)
CREATE POLICY "Public read approved products" ON products
    FOR SELECT USING (
        verification_status = 'approved' 
        AND (scheduled_start IS NULL OR scheduled_start <= now())
        AND (scheduled_end IS NULL OR scheduled_end >= now())
    );

-- Seller: full access to own products
CREATE POLICY "Seller full access" ON products
    FOR ALL USING (umkm_id IN (
        SELECT id FROM umkm_profiles WHERE user_id = auth.uid()
    )) WITH CHECK (umkm_id IN (
        SELECT id FROM umkm_profiles WHERE user_id = auth.uid()
    ));

-- Admin: read all
CREATE POLICY "Admin read all products" ON products
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')
    ));

-- Admin: manage all (approve/reject/warn/delete)
CREATE POLICY "Admin manage all products" ON products
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')
    )) WITH CHECK (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')
    ));

-- Service role
CREATE POLICY "Service role products" ON products
    FOR ALL USING (auth.role() = 'service_role');
```

### orders
```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Buyer: read own orders
CREATE POLICY "Buyer read own orders" ON orders
    FOR SELECT USING (buyer_id = auth.uid());

-- Seller: read own store orders
CREATE POLICY "Seller read own orders" ON orders
    FOR SELECT USING (umkm_id IN (
        SELECT id FROM umkm_profiles WHERE user_id = auth.uid()
    ));

-- Seller: update status (accept, mark_ready, cancel)
CREATE POLICY "Seller update order status" ON orders
    FOR UPDATE USING (umkm_id IN (
        SELECT id FROM umkm_profiles WHERE user_id = auth.uid()
    )) WITH CHECK (umkm_id IN (
        SELECT id FROM umkm_profiles WHERE user_id = auth.uid()
    ));

-- Courier: read assigned orders
CREATE POLICY "Courier read assigned orders" ON orders
    FOR SELECT USING (id IN (
        SELECT order_id FROM courier_assignments WHERE courier_id IN (
            SELECT id FROM couriers WHERE user_id = auth.uid()
        )
    ));

-- Admin: read all
CREATE POLICY "Admin read all orders" ON orders
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')
    ));

-- Service role
CREATE POLICY "Service role orders" ON orders
    FOR ALL USING (auth.role() = 'service_role');
```

### couriers
```sql
ALTER TABLE couriers ENABLE ROW LEVEL SECURITY;

-- Courier: read own profile
CREATE POLICY "Courier read own" ON couriers
    FOR SELECT USING (user_id = auth.uid());

-- Courier: update own profile (location, availability)
CREATE POLICY "Courier update own" ON couriers
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Admin: read all
CREATE POLICY "Admin read couriers" ON couriers
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')
    ));

-- Service role
CREATE POLICY "Service role couriers" ON couriers
    FOR ALL USING (auth.role() = 'service_role');
```

### courier_assignments
```sql
ALTER TABLE courier_assignments ENABLE ROW LEVEL SECURITY;

-- Courier: read own assignments
CREATE POLICY "Courier read own assignments" ON courier_assignments
    FOR SELECT USING (courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
    ));

-- Courier: update status on own assignments
CREATE POLICY "Courier update own assignment" ON courier_assignments
    FOR UPDATE USING (courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
    )) WITH CHECK (courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
    ));

-- Admin: read all
CREATE POLICY "Admin read all assignments" ON courier_assignments
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')
    ));

-- Service role
CREATE POLICY "Service role assignments" ON courier_assignments
    FOR ALL USING (auth.role() = 'service_role');
```

### courier_locations
```sql
ALTER TABLE courier_locations ENABLE ROW LEVEL SECURITY;

-- Courier: insert own locations
CREATE POLICY "Courier insert own location" ON courier_locations
    FOR INSERT WITH CHECK (courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
    ));

-- Courier + Buyer (via order): read locations for assigned orders
CREATE POLICY "Read locations for assignment" ON courier_locations
    FOR SELECT USING (courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
    ) OR order_id IN (
        SELECT order_id FROM courier_assignments WHERE courier_id IN (
            SELECT id FROM couriers WHERE user_id = auth.uid()
        )
    ));

-- Service role
CREATE POLICY "Service role locations" ON courier_locations
    FOR ALL USING (auth.role() = 'service_role');
```

### subscriptions
```sql
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Seller: read own subscriptions
CREATE POLICY "Seller read own subscriptions" ON subscriptions
    FOR SELECT USING (umkm_id IN (
        SELECT id FROM umkm_profiles WHERE user_id = auth.uid()
    ));

-- Admin: read all
CREATE POLICY "Admin read subscriptions" ON subscriptions
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')
    ));

-- Service role
CREATE POLICY "Service role subscriptions" ON subscriptions
    FOR ALL USING (auth.role() = 'service_role');
```

### notifications
```sql
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- User: read own notifications
CREATE POLICY "User read own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

-- User: mark own as read
CREATE POLICY "User update own notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Service role
CREATE POLICY "Service role notifications" ON notifications
    FOR ALL USING (auth.role() = 'service_role');
```

### articles
```sql
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Public: read published articles
CREATE POLICY "Public read published articles" ON articles
    FOR SELECT USING (
        status = 'published' 
        AND published_at IS NOT NULL 
        AND published_at <= now()
    );

-- Admin: full access
CREATE POLICY "Admin full access articles" ON articles
    FOR ALL USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')
    ));

-- Service role
CREATE POLICY "Service role articles" ON articles
    FOR ALL USING (auth.role() = 'service_role');
```

### reports
```sql
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- User: create own reports
CREATE POLICY "User create reports" ON reports
    FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- User: read own reports
CREATE POLICY "User read own reports" ON reports
    FOR SELECT USING (reporter_id = auth.uid());

-- Admin: read all
CREATE POLICY "Admin read all reports" ON reports
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')
    ));

-- Admin: update status
CREATE POLICY "Admin update reports" ON reports
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')
    ));

-- Service role
CREATE POLICY "Service role reports" ON reports
    FOR ALL USING (auth.role() = 'service_role');
```

### support_appeals
```sql
ALTER TABLE support_appeals ENABLE ROW LEVEL SECURITY;

-- User: create own appeals
CREATE POLICY "User create appeals" ON support_appeals
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- User: read own appeals
CREATE POLICY "User read own appeals" ON support_appeals
    FOR SELECT USING (user_id = auth.uid());

-- Admin: read all
CREATE POLICY "Admin read all appeals" ON support_appeals
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')
    ));

-- Admin: update (resolve)
CREATE POLICY "Admin resolve appeals" ON support_appeals
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')
    ));

-- Service role
CREATE POLICY "Service role appeals" ON support_appeals
    FOR ALL USING (auth.role() = 'service_role');
```

### admin_audit_logs
```sql
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin: read all
CREATE POLICY "Admin read audit logs" ON admin_audit_logs
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')
    ));

-- Service role
CREATE POLICY "Service role audit logs" ON admin_audit_logs
    FOR ALL USING (auth.role() = 'service_role');
```

### site_visitors
```sql
ALTER TABLE site_visitors ENABLE ROW LEVEL SECURITY;

-- Admin: read all
CREATE POLICY "Admin read site visitors" ON site_visitors
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')
    ));

-- Service role
CREATE POLICY "Service role site visitors" ON site_visitors
    FOR ALL USING (auth.role() = 'service_role');
```

### store_visitors
```sql
ALTER TABLE store_visitors ENABLE ROW LEVEL SECURITY;

-- Seller: read own store visitors
CREATE POLICY "Seller read own visitors" ON store_visitors
    FOR SELECT USING (umkm_id IN (
        SELECT id FROM umkm_profiles WHERE user_id = auth.uid()
    ));

-- Admin: read all
CREATE POLICY "Admin read all visitors" ON store_visitors
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')
    ));

-- Service role
CREATE POLICY "Service role store visitors" ON store_visitors
    FOR ALL USING (auth.role() = 'service_role');
```

---

## Policy Patterns

### 1. Owner-Based Access
```sql
-- Pattern for user-owned resources
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid())
```

### 2. Seller Store Ownership (via join)
```sql
-- Pattern for resources owned via umkm_profiles
USING (umkm_id IN (
    SELECT id FROM umkm_profiles WHERE user_id = auth.uid()
))
WITH CHECK (umkm_id IN (
    SELECT id FROM umkm_profiles WHERE user_id = auth.uid()
))
```

### 3. Admin Role Check
```sql
-- Pattern for admin access
USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin','super_admin')
))
```

### 4. Service Role Bypass
```sql
-- Pattern for server-side operations
USING (auth.role() = 'service_role')
```

### 5. Public Read with Conditions
```sql
-- Pattern for published content
USING (status = 'published' AND published_at <= now())
```

---

## Testing RLS

```bash
# Test with different roles
npm run test:admin-access
npm run test:seller-orders-realtime
```

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Infinite recursion | `profiles` policy references `profiles` | Use `auth.uid()` directly |
| Missing service role | API route doesn't use service client | Use `createServiceClient()` |
| Admin can't update | Policy too restrictive | Add admin update policy |
| Public can't read | Missing public policy | Add public SELECT policy |