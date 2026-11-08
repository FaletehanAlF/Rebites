# Authentication & Authorization Security

> **Implementation:** `lib/auth-*.ts`, `lib/server/supabase.ts`, `lib/current-user.ts`, `middleware.ts`

---

## Authentication

### Session Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Cookie-based sessions via @supabase/ssr)         │
│                                                             │
│  HttpOnly cookies:                                          │
│  - sb-<project>-auth-token (access + refresh)               │
│  - SameSite=Lax, Secure (HTTPS), Path=/                    │
│                                                             │
│  Supabase Auth (GoTrue) manages:                            │
│  - JWT signing (HS256)                                      │
│  - Token rotation (access 1hr, refresh 30d)                │
│  - OAuth (Google PKCE)                                      │
│  - Magic links (OTP, single-use, 10min expiry)             │
└─────────────────────────────────────────────────────────────┘
```

### Token Validation

```typescript
// In getUserFromBearer()
const { data: { user }, error } = await supabase.auth.getUser(token);
// Validates:
// 1. JWT signature (Supabase auth secret)
// 2. JWT expiry (1 hour)
// 3. User exists in auth.users
// 4. User not deleted
```

### Auth Endpoints (Supabase Auth)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/v1/token?grant_type=password` | POST | Email/password login |
| `/auth/v1/token?grant_type=refresh_token` | POST | Token refresh |
| `/auth/v1/token?grant_type=otp` | POST | Magic link / OTP |
| `/auth/v1/authorize?provider=google` | GET | OAuth redirect |
| `/auth/v1/callback` | GET | OAuth callback |
| `/auth/v1/logout` | POST | Sign out |
| `/auth/v1/verify` | POST | Email verification |

### Rate Limits (Supabase Auth)

| Endpoint | Default Limit |
|----------|---------------|
| Login attempts | 30 per hour per IP |
| Magic link requests | 10 per hour per email |
| Password reset | 3 per hour per email |

---

## Authorization

### Role Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│  SUPER_ADMIN (env: SUPER_ADMIN_USER_ID)                 │
│  - Full access to all admin endpoints                   │
│  - Role changes, user deletion                          │
│  - Approve role upgrade requests                        │
│  - System configuration                                 │
└──────────────────────┬──────────────────────────────────┘
                       │ (env-gated)
┌──────────────────────┴──────────────────────────────────┐
│  ADMIN (role='admin' in profiles)                       │
│  - Platform KPIs, user management                       │
│  - Order/product moderation                               │
│  - Reports, warnings, sanctions                         │
│  - Subscription overrides                               │
│  - ❌ Cannot change roles, cannot delete users          │
└──────────────────────┬──────────────────────────────────┘
                       │ (profile.role in DB)
┌──────────────────────┴──────────────────────────────────┐
│  UMKM/SELLER (role='umkm' in profiles)                  │
│  - Manage own store, products, orders                   │
│  - View sales reports, visitor analytics                │
│  - Manage subscription                                  │
└──────────────────────┬──────────────────────────────────┘
                       │ (profile.role in DB)
┌──────────────────────┴──────────────────────────────────┐
│  BUYER (role='buyer' in profiles)                       │
│  - Browse catalog, order food                           │
│  - Manage addresses, view order history                 │
│  - Earn/spend coins                                     │
│  - Submit reports, appeals                              │
└─────────────────────────────────────────────────────────┘
```

### Role Assignment Flow

```
Registration:
  buyer:  POST /auth/register → profile.role = 'buyer'
  seller:  POST /auth/register/penjual → profile.role = 'umkm' + umkm_profiles row

Promotion:
  umkm → admin:    Super Admin PATCH /api/admin/users/[id] { role: 'admin' }
  admin → super:   Manual env var (SUPER_ADMIN_USER_ID)

Demotion:
  admin → buyer:   Super Admin PATCH /api/admin/users/[id] { role: 'buyer' }
```

### RBAC Matrix

| Action | Buyer | UMKM | Admin | Super Admin |
|--------|-------|------|-------|-------------|
| Browse catalog | ✅ | ✅ | ✅ | ✅ |
| Create order | ✅ | ✅ | ✅ | ✅ |
| Manage own products | ❌ | ✅ | ❌ | ❌ |
| View own orders | ✅ | ✅ | ❌ | ❌ |
| View all orders | ❌ | ❌ | ✅ | ✅ |
| Moderate products | ❌ | ❌ | ✅ | ✅ |
| Suspend user | ❌ | ❌ | ✅ | ✅ |
| Change user role | ❌ | ❌ | ❌ | ✅ |
| Delete user | ❌ | ❌ | ❌ | ✅ |
| Approve role request | ❌ | ❌ | ❌ | ✅ |
| View audit logs | ❌ | ❌ | ✅ | ✅ |
| View dashboard KPIs | ❌ | ❌ | ✅ | ✅ |

---

## Row Level Security

### Policy Coverage

All tables have RLS enabled. Key policies:

| Table | Policies | Coverage |
|-------|----------|----------|
| `profiles` | Self, Admin | 2 |
| `umkm_profiles` | Public (read), Owner (write), Admin (all) | 3 |
| `products` | Public (approved), Seller (own), Admin (all) | 3 |
| `orders` | Buyer, Seller, Admin | 3 |
| `addresses` | Self, Admin | 2 |
| `user_reports` | Reporter, Subject, Admin | 3 |
| `user_warnings` | Subject, Admin | 2 |
| `user_sanctions` | Subject, Admin | 2 |
| `admin_audit_logs` | Admin (read only) | 1 |
| `activity_logs` | Self, Admin | 2 |
| `subscriptions` | Seller, Admin | 2 |
| `notifications` | Self | 1 |

### RLS Enforcement

```typescript
// Anon client: RLS applies
const { data } = await anonClient.from('orders').select('*').eq('buyer_id', user.id);
// Only sees own orders

// Service client: RLS bypassed
const { data } = await serviceClient.from('orders').select('*');
// Sees ALL orders — use only after admin check
```

### RLS Testing

```sql
-- In Supabase Dashboard → SQL Editor:
-- As buyer:
SET ROLE authenticated;
SET "jwt.claims.role" = 'buyer';
SELECT * FROM orders; -- Should return 0 rows unless owns order

-- As admin:
SET ROLE authenticated;
SET "jwt.claims.role" = 'admin';
SELECT * FROM orders; -- Should return all rows
```

---

## Middleware Protection

```typescript
// middleware.ts
const PROTECTED_PREFIXES = [
  '/(app)/',       // Authenticated buyer/seller app
  '/dashboard/admin/', // Admin dashboard
  '/dashboard/kurir/', // Courier dashboard
];

export async function middleware(req: NextRequest) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const isProtected = PROTECTED_PREFIXES.some(
    p => req.nextUrl.pathname.startsWith(p)
  );
  
  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }
  
  return response;
}
```

**Note:** Middleware does NOT enforce roles. Role checks happen in:
- API routes (via `getAdminUser()`)
- Server components (via `profile.role` check)
- RLS policies (via `auth.uid()` / `jwt.claims.role`)

---

## Security Controls Summary

| Control | Implementation | Bypass Risk |
|---------|----------------|-------------|
| JWT validation | Supabase `getUser()` | Low (signature + expiry) |
| Role check | `profile.role` in DB | Low (service role needed to change) |
| RLS | PostgreSQL policies | Low (all tables covered) |
| Service role isolation | Server-only imports | Medium (needs code review) |
| Webhook auth | Timing-safe token / HMAC | Low (constant-time compare) |
| Account status | `account_status='active'` | Low (admin check) |
| Super admin gate | `id === SUPER_ADMIN_USER_ID` | Low (env-gated, not DB) |

---

## Common Auth Bugs to Watch For

| Bug | Detection |
|-----|-----------|
| Using service client in route handler without admin check | Grep `createServiceClient` in `app/api/` — verify admin check precedes |
| RLS policy missing `AND` (OR condition too broad) | Review `supabase gen policies` output |
| `account_status` not checked for suspended users | Grep `account_status` in admin API routes |
| Webhook token not timing-safe | `timingSafeEqual` used in `lib/server/xendit.ts` (verified) |
| OAuth state param missing | Check `lib/auth-oauth.ts` PKCE flow |

---

## Related Docs

- [API: Auth & Authorization](../api/auth.md) — Full endpoint auth matrix
- [API: Admin](../api/admin.md) — Admin RBAC details
- [Database: RLS Policies](../database/rls-policies.md) — Complete policy list
- [Security: Overview](./overview.md) — Threat model
- [Security: Data Protection](./data-protection.md) — PII handling
- [Features: Profile](../features/profile.md) — Auth-related user flows