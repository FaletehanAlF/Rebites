# Database Migrations

> Migration history, conventions, and deployment workflow.

---

## Migration Files

Located in `supabase/migrations/` (80+ files)

### Naming Convention

```
YYYYMMDDHHMMSS_descriptive_name.sql
```

Examples:
- `20260806050337_0001_rebites_schema.sql`
- `20261008000000_checkout_idempotency_foundation.sql`
- `20261008000000_reserve_stock_for_order.sql`

### Categories

| Prefix | Meaning |
|--------|---------|
| `0001_` - `0019_` | Initial schema + early features |
| `p0a_` - `p1c_` | Security hardening phases |
| `7b1_` - `7b2a_` | Address/location + shipping |
| `YYYYMMDD_` | Date-based (recent) |

---

## Key Migration Groups

### Phase 1: Core Schema (Aug 2026)
| File | Description |
|------|-------------|
| `0001_rebites_schema.sql` | Initial tables: profiles, umkm_profiles, products, orders, reviews, favorites |
| `0002_revoke_trigger_execute.sql` | Security: revoke public execute on functions |
| `0003_align_frontend_schema.sql` | Align DB with TypeScript types |
| `0004_seed_frontend_data.sql` | Seed categories, etc. |
| `0005_umkm_logos_and_slug_rpc.sql` | Logo storage + slug RPCs |
| `0006_slug_parity_columns.sql` | Add slug columns for parity |
| `0010_store_follows.sql` | Store follow feature |
| `0013_xendit_payments.sql` | Xendit tables |
| `0014_fix_storage_buckets.sql` | Supabase Storage buckets |
| `0015_product_favorites.sql` | Product favorites |
| `0019_order_state_machine.sql` | Order status machine |

### Phase 2: Security Hardening (Oct 2026)
| File | Description |
|------|-------------|
| `p0a_security_hardening.sql` | Revoke public grants, enable RLS everywhere |
| `p0a1_revoke_public_execute.sql` | Remove public function execute |
| `p0b_stock_order_state_security.sql` | Stock reservation security |
| `p0c_payment_subscription_security.sql` | Payment/subscription security |
| `p1a_coin_order_financial_security.sql` | Coin/financial security |
| `p1a1_fix_coin_guard_delete.sql` | Coin guard fix |
| `p1b_review_notification_security.sql` | Review notification security |

### Phase 3: Monitoring & Admin (Oct-Nov 2026)
| File | Description |
|------|-------------|
| `admin_monitoring_foundation.sql` | Admin monitoring tables |
| `stage3a_monitoring_enhancements.sql` | Monitoring v2 |
| `role_request_approval.sql` | Role change workflow |
| `umkm_verification_audit.sql` | UMKM audit trail |
| `order_activity_logs.sql` | Order status history |
| `admin_soft_delete.sql` | Admin soft delete |
| `admin_product_soft_delete.sql` | Product soft delete |
| `site_visitors.sql` | Visitor tracking |

### Phase 4: New Features (Nov 2026)
| File | Description |
|------|-------------|
| `scheduled_menu.sql` | Product scheduling |
| `ai_courier_gemini.sql` | AI courier features |
| `courier_live_delivery.sql` | Courier GPS tracking |
| `courier_ai_reply_dedup.sql` | AI reply deduplication |
| `notif_laporan_peringatan_pengguna.sql` | Report notifications |
| `admin_order_status_history.sql` | Order history for admin |
| `sanction_cycle_complete.sql` | Full sanction cycle |
| `store_deactivation_cycle.sql` | Store deactivation flow |
| `role_audit_and_user_preferences.sql` | Role audit + preferences |
| `support_inbox.sql` | Support system |
| `store_visitors.sql` | Store visitor analytics |

---

## Migration Conventions

### 1. Idempotency
```sql
-- Use IF NOT EXISTS for tables
CREATE TABLE IF NOT EXISTS ...

-- Use DO blocks for conditional logic
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'new_col') THEN
        ALTER TABLE products ADD COLUMN new_col TEXT;
    END IF;
END $$;
```

### 2. Transaction Safety
```sql
-- Each migration runs in its own transaction (Supabase default)
-- Use SAVEPOINT for partial rollbacks within migration

BEGIN;
-- ... statements ...
COMMIT;
```

### 3. RLS in Migrations
```sql
-- Enable RLS first
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Then create policies
CREATE POLICY "policy_name" ON table_name
    FOR SELECT USING (...);
```

### 4. Function Security
```sql
-- Use SECURITY DEFINER for functions called by service role
CREATE OR REPLACE FUNCTION func_name()
RETURNS ... LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    ...
END;
$$;
```

### 5. Indexes
```sql
-- Create indexes CONCURRENTLY for production (not in migrations)
-- In migrations, regular CREATE INDEX is fine
CREATE INDEX ON table_name (column_name);
```

---

## Deployment Workflow

### Local Development
```bash
# Apply all migrations to local Supabase
supabase db reset

# Or apply specific migration
supabase migration up --include-all
```

### Staging/Production
```bash
# Via Supabase Dashboard SQL Editor
# Or via Supabase CLI (linked project)
supabase db push

# For individual migration
supabase migration up
```

### CI/CD (Not Configured)
```yaml
# .github/workflows/deploy.yml (example)
- name: Apply Migrations
  run: |
    supabase link --project-ref $PROJECT_REF
    supabase db push
```

---

## Rollback Strategy

### Down Migrations (Not Provided)
Supabase doesn't generate down migrations by default. For rollback:

1. **Create inverse migration** with `supabase migration new rollback_name`
2. **Manual SQL** to revert changes
3. **Test thoroughly** before applying

### Safe Rollback Patterns

```sql
-- For column additions: just don't use the column
-- For table additions: leave table (no harm)

-- For data migrations: create backup table first
CREATE TABLE backup_table AS SELECT * FROM target_table;

-- For RLS changes: test policies before applying
```

---

## Migration Testing

```bash
# Test with local Supabase
supabase db reset
npm run test:admin-access
npm run test:checkout-idempotency
```

---

## Common Patterns in This Codebase

### Adding a Column
```sql
-- 20261104020000_example_add_column.sql
ALTER TABLE orders ADD COLUMN new_field TEXT;

-- Add index if needed
CREATE INDEX ON orders (new_field);
```

### Creating a Table with RLS
```sql
-- 20261104030000_example_new_table.sql
CREATE TABLE example_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE example_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User read own" ON example_table
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role" ON example_table
    FOR ALL USING (auth.role() = 'service_role');
```

### Adding a Function
```sql
-- 20261104040000_example_function.sql
CREATE OR REPLACE FUNCTION example_func(p_input TEXT)
RETURNS TABLE (result TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY SELECT p_input || '_processed';
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION example_func(TEXT) TO service_role;
```

### Modifying RLS Policies
```sql
-- 20261104050000_example_rls_change.sql
DROP POLICY IF EXISTS "Old policy name" ON table_name;

CREATE POLICY "New policy name" ON table_name
    FOR SELECT USING (new_condition);
```

---

## Migration Checklist

Before applying to production:
- [ ] Test on local Supabase
- [ ] Run full test suite (`npm run test:*`)
- [ ] Verify RLS policies work for all roles
- [ ] Check for breaking changes to API
- [ ] Verify indexes don't lock tables (use CONCURRENTLY if needed)
- [ ] Backup production database
- [ ] Apply during low-traffic window
- [ ] Monitor logs after deployment

---

## Known Migration Issues

| Issue | Migration | Resolution |
|-------|-----------|------------|
| Admin RLS recursion | `0018_fix_rls_admin_recursion.sql` | Fixed with separate policy |
| Profiles RLS recursion | `fix_profiles_recursion_no_admin.sql` | Fixed |
| Stock reservation race | `reserve_stock_for_order.sql` | Uses FOR UPDATE locks |
| Payment status guard | `guard_order_payment_status.sql` | Prevents invalid transitions |