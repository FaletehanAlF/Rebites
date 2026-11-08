# Supabase Integration

> **Implementation:** `lib/supabase.ts` (client), `lib/server/supabase.ts` (server), `@supabase/supabase-js`, `@supabase/ssr`

---

## Role in Architecture

Supabase provides:

| Service | Used For |
|---------|----------|
| **PostgreSQL** | Primary data store (all business data) |
| **Auth** | User authentication (email, OAuth, magic links) |
| **Row Level Security** | Data isolation between buyer/seller/admin |
| **Realtime** | Order status updates, chat, courier tracking |
| **Storage** | Product images, avatars, article covers |
| **Edge Functions** | (Future: serverless compute) |

---

## Client Instantiation

### Browser Client — `lib/supabase.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- Uses **anon key** (public, safe for browser)
- RLS policies enforce data access
- Used in `hooks/`, client components, `next-client` routes

### Server Client (Anon) — `lib/server/supabase.ts`

```typescript
export function createAnonServerClient() {
  const { data: { session } } = await supabase.auth.getSession();
  // Returns anon client for public reads
}
```

- Used in server components for public data (catalog, articles)
- RLS applies

### Server Client (Service Role) — `lib/server/supabase.ts`

```typescript
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,  // NEVER exposed to client
    { auth: { autoRefreshToken: false } }
  );
}
```

- **Bypasses RLS** — use only in:
  - Webhooks (Xendit, Biteship)
  - Admin API (after admin auth check)
  - Server-only scripts / cron
- **Never** in client components or route handlers without admin check

### User-Scoped Server Client — `lib/server/supabase.ts`

```typescript
export async function createServerClient() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return createServiceClient(); // fallback
  return createClient(url, anonKey, {
    auth: { session: session.session, autoRefreshToken: true }
  });
}
```

- Uses user's JWT → RLS policies apply
- For user-scoped API routes

---

## Environment Variables

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL (`https://xxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Public anon key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Service role key (bypasses RLS) |
| `SUPABASE_AUTH_SECRET` | Server only | For auth token validation (custom domains) |

**Security:** `SUPABASE_SERVICE_ROLE_KEY` must NEVER be in `NEXT_PUBLIC_*` vars or client bundles.

---

## Authentication

### Supabase Auth Features Used

| Feature | Use |
|---------|-----|
| Email/Password | Primary login method |
| Magic Link (OTP) | Passwordless login |
| Google OAuth | Social login |
| Confirm Email | On registration |
| Reset Password | Via email link |

### Auth Endpoints (via `supabase.auth`)

```typescript
// Login
await supabase.auth.signInWithPassword({ email, password });

// Register
await supabase.auth.signUp({ email, password, options: { data: { role: 'buyer' } } });

// OAuth
await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: url } });

// Logout
await supabase.auth.signOut();

// Reset
await supabase.auth.resetPasswordForEmail(email);
```

### Session Management

| Aspect | Implementation |
|--------|----------------|
| Storage | HttpOnly cookies (via `@supabase/ssr`) |
| Auto-refresh | Client `onAuthStateChange` + server middleware |
| Token TTL | 1 hour access, 30 days refresh |
| Multi-tab | `storage` event sync in `AuthProvider` |

---

## Database Operations

### Query Patterns

```typescript
// Anon client (RLS applies)
const { data, error } = await supabaseClient
  .from('products')
  .select('*')
  .eq('status', 'available')
  .order('created_at', { ascending: false })
  .range(0, 19);

// Service client (bypasses RLS)
const service = createServiceClient();
const { data: orders, error } = await service
  .from('orders')
  .select('*, product:products(*)')
  .eq('order_status', 'processing')
  .eq('payment_status', 'paid')
  .limit(100);
```

### RPC Functions (Custom Postgres)

| Function | Arguments | Used In |
|----------|-----------|---------|
| `reserve_stock_for_order` | `p_product_id`, `p_quantity` | Checkout (atomic stock decrement) |
| `release_stock_for_order` | `p_order_code` | Order cancellation |
| `release_promo` | `p_code` | Terminal webhook (failed/expired) |
| `refund_order_coins` | `p_user_id`, `p_order_code` | Terminal webhook |
| `earn_order_coins` | `p_user_id`, `p_order_code` | Order completion |
| `release_stock` | `p_order_code` | Manual admin action |
| `cancel_order` | `p_order_code`, `p_reason` | Buyer/admin cancel |
| `complete_order` | `p_order_code` | Courier delivery confirm |
| `settle_order_paid` | `p_order_code`, `p_invoice_id` | Xendit webhook |
| `activate_subscription` | `p_subscription_code`, `p_invoice_id` | Xendit webhook (subscription) |

**Pattern:** All RPCs use `SECURITY DEFINER` to bypass RLS, with `current_user` checks where needed.

---

## Realtime

### Channels Used

| Channel | Topics | Used For |
|---------|--------|----------|
| `orders` | `order_status_changed` | Buyer/seller live order updates |
| `chat` | `message` | Courier-bat/seller chat |
| `courier-location` | `location_update` | Live courier tracking (buyer view) |
| `notifications` | `notification` | In-app notification push |

### Client Subscription

```typescript
const channel = supabaseChannel
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'orders', filter: `buyer_id=eq.${user.id}` },
    (payload) => handleOrderUpdate(payload.new)
  )
  .subscribe();
```

### Realtime Constraints

- Max 200 concurrent connections per Supabase project
- Filter by `auth.uid()` to limit broadcast scope
- Use `postgres_changes` (not `broadcast`) for DB-triggered updates

---

## Storage

### Buckets

| Bucket | Contents | Access |
|--------|----------|--------|
| `product-images` | Product photos (`.avif`, `.jpeg`, `.webp`) | Public read, authenticated write |
| `avatars` | User profile photos | Public read, authenticated write |
| `article-covers` | Blog/article cover images | Public read, admin write |
| `umkm-logos` | Seller store logos | Public read, seller write |

### Upload Pattern

```typescript
// Client (authenticated)
const { data: { path } } = await supabase.storage
  .from('product-images')
  .upload(`${umkmId}/${productId}/main.avif`, file, { upsert: true });

// URL
const { data: { publicUrl } } = supabase.storage
  .from('product-images')
  .getPublicUrl(path);
```

### Size Limits

| File Type | Max Size |
|-----------|----------|
| Product images | 5 MB |
| Avatars | 2 MB |
| Article covers | 5 MB |
| Store logos | 2 MB |

---

## Error Handling

### `lib/server/supabase-errors.ts`

```typescript
export function classifySupabaseError(error: Error | null): SupabaseErrorCode {
  if (!error) return 'unknown';
  const msg = error.message;
  if (msg.includes('relation') || msg.includes('column')) return 'schema_error';
  if (msg.includes('permission') || msg.includes('RLS')) return 'rls_violation';
  if (msg.includes('timeout') || msg.includes('ECONN')) return 'unavailable';
  if (msg.includes('duplicate')) return 'duplicate';
  return 'unknown';
}
```

Used in route handlers for structured error responses.

---

## Migrations

- Located in `supabase/migrations/`
- 80+ SQL files, applied via `supabase db push`
- Key migrations:
  - `0001_initial_schema.sql` — Core tables
  - `0002_rls_policies.sql` — RLS setup
  - `0003_rpc_functions.sql` — Custom functions
  - `idempotency_key_migration.sql` — `invoice_state`, `idempotency_key` columns
  - `reserve_stock_migration.sql` — `reserve_stock_for_order` RPC

See [Database: Migrations](../database/migrations.md) for full list.

---

## Local Development

### Supabase CLI

```bash
# Start local Supabase
supabase start

# Run migrations
supabase migration up

# Seed
supabase db reset

# Access Studio
open http://localhost:54323
```

### `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key>
SUPABASE_SERVICE_ROLE_KEY=<local service key>
```

### Docker (Alternative)

```bash
docker run -d -p 5432:5432 postgres:15  # Postgres only
# Use Supabase cloud for auth/storage
```

---

## Monitoring

| Metric | Where |
|--------|-------|
| DB connections | Supabase Dashboard → Settings → Connection Limits |
| Query latency | Supabase Dashboard → Analytics → Database |
| Auth logins | Supabase Dashboard → Analytics → Auth |
| Storage usage | Supabase Dashboard → Storage |
| Realtime connections | Supabase Dashboard → Realtime |
| Error rate | `console.error('[supabase] ...')` logs |

---

## Known Issues & Workarounds

| Issue | Workaround | Status |
|-------|-----------|--------|
| Image path mismatch (DB stores `.jpeg`/`.webp`, files are `.avif`) | `lib/image-path.ts` normalizes paths | Active |
| `invoice_state` column migration not applied in all envs | `isInvoiceStateColumnMissingError` fallback in webhook | Active |
| Realtime channel limit (200/project) | Filter by `auth.uid()`; consider Supabase Pro plan | Watch |

---

## Related Docs

- [Integrations Overview](../architecture/overview.md) — Where Supabase fits
- [Database Overview](../database/overview.md) — Schema, tables, RLS
- [Database: RLS Policies](../database/rls-policies.md) — Policy details
- [Database: Functions](../database/functions.md) — RPC signatures
- [Database: Migrations](../database/migrations.md) — Migration history
- [API: Auth](../api/auth.md) — Token flows
- [Security: Data Protection](../security/data-protection.md) — Key handling