# Authentication & Authorization

> **Implementation:** `lib/auth-*.ts`, `lib/server/supabase.ts`, `lib/current-user.ts`, `middleware.ts`, `app/(app)/layout.tsx`, route handlers

---

## Authentication Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client    │────▶│  Supabase Auth   │────▶│  Access Token   │
│  (Browser)  │     │  (GoTrue)        │     │  (JWT, 1hr)     │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                      │
                              ┌───────────────────────┘
                              ▼
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Protected  │◀───│  Next.js Middle- │◀───│  Authorization    │
│   Route     │     │  ware / RLS      │     │  Header Check   │
└─────────────┘     └──────────────────┘     └─────────────────┘
```

### Token Acquisition

| Flow | Endpoint | Use Case |
|------|----------|----------|
| Email/Password | `POST /auth/v1/token?grant_type=password` | Standard login |
| Magic Link | `POST /auth/v1/otp` → email → `GET /auth/callback` | Passwordless |
| OAuth (Google) | `GET /auth/v1/authorize?provider=google` | Social login |
| Refresh | `POST /auth/v1/token?grant_type=refresh_token` | Token rotation |

Tokens stored in **HttpOnly cookies** (`sb-<project>-auth-token`) managed by `@supabase/ssr`.

---

## Server-Side User Resolution

### `getUserFromBearer(authHeader)` — `lib/server/supabase.ts`

```typescript
export async function getUserFromBearer(authHeader: string | null): Promise<User | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const supabase = createServerClient(); // anon key
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}
```

- Used by **all API routes** requiring user context
- Validates JWT signature & expiry via Supabase
- Returns `User` with `id`, `email`, `role` (from `user_metadata`)

### `getAdminUser(authHeader)` — `lib/server/supabase.ts`

```typescript
export async function getAdminUser(authHeader: string | null): Promise<AdminUser | null> {
  const user = await getUserFromBearer(authHeader);
  if (!user) return null;
  const service = createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('id, role, account_status')
    .eq('id', user.id)
    .single();
  if (!profile || profile.account_status !== 'active') return null;
  if (profile.role !== 'admin' && profile.role !== 'super_admin') return null;
  return { id: user.id, role: profile.role };
}
```

- Returns admin only if `role IN ('admin', 'super_admin')` AND `account_status='active'`
- Super admin check: `profile.id === process.env.SUPER_ADMIN_USER_ID`

---

## Role System

### User Roles (Database Enum)

```sql
CREATE TYPE user_role AS ENUM ('buyer', 'umkm', 'admin');
-- Extended in code: 'super_admin' (derived from env)
```

| Role | Description | Route Group Access |
|------|-------------|-------------------|
| `buyer` | Orders food, manages addresses | `(app)` — all buyer pages |
| `umkm` | Seller: manages store, products, orders | `(app)` + `/dashboard/penjual` |
| `admin` | Platform ops: moderation, support, analytics | `/dashboard/admin/**` |
| `super_admin` | Full control: role changes, user deletion, system config | All admin + role approval |

### Role Assignment

| Action | Who | How |
|--------|-----|-----|
| Register as buyer | Self | `POST /auth/register` → `role='buyer'` |
| Register as seller | Self | `POST /auth/register/penjual` → `role='umkm'`, creates `umkm_profiles` row |
| Promote to admin | Super Admin | `PATCH /api/admin/users/[id]` → `role='admin'` (requires super admin) |
| Promote to super_admin | Manual | Set `SUPER_ADMIN_USER_ID` env var to user's `auth.users.id` |

### Role Checks in Code

```typescript
// API route pattern
const user = await getUserFromBearer(authHeader);
if (!user) return unauthorized();

const { data: profile } = await service
  .from('profiles')
  .select('role, account_status')
  .eq('id', user.id)
  .single();

if (profile.account_status !== 'active') return forbidden();
if (requiredRoles.includes(profile.role)) return forbidden();
```

```typescript
// Client-side (hooks)
const { data: profile } = useProfile(); // from useCurrentUser()
if (profile?.role === 'umkm') { /* seller UI */ }
```

---

## Route Protection

### Middleware (`middleware.ts`)

```typescript
export async function middleware(req: NextRequest) {
  const { supabase, response } = createServerClient(req);
  const { data: { session } } = await supabase.auth.getSession();

  // Protected route groups
  const protectedPaths = ['/(app)/', '/dashboard/admin/'];
  const isProtected = protectedPaths.some(p => req.nextUrl.pathname.startsWith(p));

  if (isProtected && !session) {
    const loginUrl = new URL('/auth/login', req.url);
    loginUrl.searchParams.set('redirect', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
```

- Redirects unauthenticated users to `/auth/login?redirect=...`
- Does **not** enforce roles (done in API/components)

### Server Components (Layouts)

```tsx
// app/(app)/layout.tsx
export default async function AppLayout({ children }) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');
  return <AuthShell user={user}>{children}</AuthShell>;
}
```

- `AuthShell` reads `profile.role` and renders appropriate nav/shell
- Used for **page-level** protection (not API)

---

## Row Level Security (RLS)

All data access goes through Supabase with RLS policies. Key patterns:

### Profiles

```sql
-- Users see own profile
CREATE POLICY "profiles_self" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Admins see all
CREATE POLICY "profiles_admin" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );
```

### Orders

```sql
-- Buyer sees own orders
CREATE POLICY "orders_buyer" ON orders
  FOR SELECT USING (buyer_id = auth.uid());

-- Seller sees orders for their UMKM
CREATE POLICY "orders_seller" ON orders
  FOR SELECT USING (
    umkm_id IN (SELECT id FROM umkm_profiles WHERE user_id = auth.uid())
  );

-- Admins see all
CREATE POLICY "orders_admin" ON orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );
```

### UMKM Profiles

```sql
-- Public read (for storefront)
CREATE POLICY "umkm_public" ON umkm_profiles
  FOR SELECT USING (true);

-- Owner manages own
CREATE POLICY "umkm_owner" ON umkm_profiles
  FOR ALL USING (user_id = auth.uid());
```

### Products

```sql
-- Public: approved products only
CREATE POLICY "products_public" ON products
  FOR SELECT USING (verification_status = 'approved' AND status = 'available');

-- Seller: own products (any status)
CREATE POLICY "products_seller" ON products
  FOR ALL USING (umkm_id IN (SELECT id FROM umkm_profiles WHERE user_id = auth.uid()));

-- Admin: all
CREATE POLICY "products_admin" ON products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );
```

**Service role** (`createServiceClient()`) bypasses RLS — used only in:
- Webhooks (Xendit, Biteship)
- Admin API (explicit admin check first)
- Cron / server scripts

---

## Session Management

| Aspect | Implementation |
|--------|----------------|
| Access token TTL | 1 hour (Supabase default) |
| Refresh token TTL | 30 days (Supabase default) |
| Token storage | HttpOnly cookies (`@supabase/ssr`) |
| Auto-refresh | Client-side `onAuthStateChange` + middleware |
| Logout | `POST /auth/v1/logout` → clears cookies |
| Multi-tab sync | `storage` event listener in `AuthProvider` |

---

## OAuth Providers

| Provider | Configured | Scopes |
|----------|------------|--------|
| Google | Yes | `openid email profile` |
| (Future) Apple | No | — |

Callback: `GET /auth/callback?code=...` → exchanges code for session → redirects to `redirect` param or `/`.

---

## Account Status

```sql
CREATE TYPE account_status AS ENUM ('active', 'suspended', 'banned');
```

| Status | Login | API Access | Notes |
|--------|-------|------------|-------|
| `active` | ✅ | ✅ | Normal |
| `suspended` | ❌ | ❌ | Temporary (sanction) |
| `banned` | ❌ | ❌ | Permanent (sanction) |

Enforced in `getAdminUser()` and RLS policies.

---

## Security Considerations

| Threat | Mitigation |
|--------|------------|
| Token theft | HttpOnly + Secure + SameSite=Lax cookies; short TTL |
| Token replay | JWT signature validation; 1hr expiry |
| Privilege escalation | Role checks in API + RLS; super admin gate on role change |
| Session fixation | Supabase rotates tokens on login |
| CSRF | SameSite=Lax; mutating endpoints require `Authorization` header |
| Brute force | Supabase rate limits auth endpoints; custom `verify-throttle.ts` for OTP |

---

## Related Docs

- [API Overview](./overview.md) — Endpoint auth requirements
- [Admin API](./admin.md) — Admin RBAC details
- [Database: RLS Policies](../database/rls-policies.md) — Full policy list
- [Features: Profile](../features/profile.md) — Auth-related user flows
- [Security Overview](../security/overview.md) — Broader security posture