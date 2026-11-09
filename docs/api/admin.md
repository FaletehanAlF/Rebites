# Admin API

> **Implementation:** `app/api/admin/**/route.ts`, `lib/admin-*.ts`, `lib/server/supabase.ts` (getAdminUser)

---

## Access Control

| Requirement | Implementation |
|-------------|----------------|
| Authentication | Bearer token (valid Supabase user) |
| Authorization | `profile.role IN ('admin', 'super_admin')` AND `account_status='active'` |
| Super Admin Gate | `profile.id === process.env.SUPER_ADMIN_USER_ID` for: role changes, user deletion, sanction approval |

```typescript
// lib/server/supabase.ts
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

---

## Admin Endpoints Catalog

### Identity & Capabilities

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/admin/me` | Admin | Current admin identity, role, capabilities |

**Response:**
```json
{
  "admin": {
    "id": "uuid",
    "email": "admin@rebites.com",
    "role": "admin",
    "capabilities": ["users:read", "users:write", "orders:read", "orders:write", "products:moderate", "reports:manage", "sanctions:manage", "analytics:read"]
  }
}
```

Capabilities derived from `role` + `id === SUPER_ADMIN_USER_ID`.

---

### Dashboard & Analytics

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/admin/dashboard` | Admin | Platform KPIs: GMV, orders, users, revenue, conversion, top categories, recent activity |
| GET | `/api/admin/analytics` | Admin | Time-series charts: daily/weekly/monthly GMV, orders, new users, retention |
| GET | `/api/admin/visitors` | Admin | Anonymous visitor tracking (page views, unique visitors, referrers) |

**Dashboard Query Params:**
- `range=7d|30d|90d|1y` (default `30d`)
- `granularity=day|week|month`

---

### User Management

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/admin/users` | Admin | List users (paginated, filterable) |
| PATCH | `/api/admin/users/[id]` | Super Admin | Update role, account_status, ban reason |
| GET | `/api/admin/users/[id]` | Admin | User detail + profile + UMKM + orders summary |

**User List Filters:**
- `role=buyer|umkm|admin`
- `status=active|suspended|banned`
- `search=` (email, name)
- `page`, `limit`, `sort`

**PATCH Body:**
```json
{
  "role": "admin",              // super_admin only
  "account_status": "suspended", // admin or super_admin
  "ban_reason": "Spam reports"   // required if suspended/banned
}
```

---

### Order Management

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/admin/orders` | Admin | All orders (paginated, filterable) |
| PATCH | `/api/admin/orders/[code]` | Admin | Force status transition, refund |

**Order List Filters:**
- `status=pending|paid|processing|ready_for_pickup|out_for_delivery|completed|cancelled|refunded`
- `payment_status=unpaid|paid|failed|refunded`
- `buyer_id=`, `umkm_id=`, `date_from=`, `date_to=`
- `page`, `limit`, `sort`

**PATCH Body:**
```json
{
  "order_status": "cancelled",
  "payment_status": "refunded",
  "admin_note": "Fraudulent order"
}
```
Triggers `settleOrderCancelled()` / `settleOrderRefunded()` internally.

---

### Product Moderation

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/admin/products` | Admin | All products (moderation queue) |
| PATCH | `/api/admin/products/[id]` | Admin | Approve/reject/hide product |

**Product List Filters:**
- `verification_status=pending|approved|rejected`
- `status=available|sold_out|hidden`
- `umkm_id=`, `category=`
- `page`, `limit`, `sort`

**PATCH Body:**
```json
{
  "verification_status": "approved",  // or "rejected"
  "rejection_reason": "Photo tidak jelas", // required if rejected
  "status": "available"                // optional
}
```

---

### Subscription Management

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/admin/subscriptions` | Admin | All subscriptions |
| PATCH | `/api/admin/subscriptions/[id]` | Admin | Override status, extend, cancel |

**PATCH Body:**
```json
{
  "status": "active",           // trial|active|expired|cancelled
  "current_period_end": "2025-12-31T23:59:59Z",
  "admin_note": "Extended per request"
}
```

---

### Shipment Management

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/admin/shipments` | Admin | All shipments with tracking |
| PATCH | `/api/admin/shipments/[code]` | Admin | Manual status override (rare) |

---

### Reports & Moderation

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/admin/reports` | Admin | User reports (abuse, fraud, quality) |
| PATCH | `/api/admin/reports/[id]` | Admin | Resolve/dismiss report |
| GET | `/api/admin/warnings` | Admin | Issued warnings |
| POST | `/api/admin/warnings` | Admin | Issue warning (level 1/2/3) |
| GET | `/api/admin/sanctions` | Admin | Active sanctions |
| POST | `/api/admin/sanctions` | Admin | Apply sanction (suspend/ban/delete) |

**Warning Body:**
```json
{
  "user_id": "uuid",
  "report_id": "uuid|null",
  "warning_level": 2,
  "category": "product_quality",
  "reason": "Multiple complaints about expired food"
}
```

**Sanction Body:**
```json
{
  "user_id": "uuid",
  "warning_id": "uuid|null",
  "sanction_type": "suspend",  // suspend|ban|delete
  "reason": "Repeated violations",
  "start_at": "2025-01-15T00:00:00Z",
  "end_at": "2025-02-15T00:00:00Z"  // null for ban/delete
}
```

---

### Role Requests

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/admin/role-requests` | Admin | Pending role upgrade requests |
| PATCH | `/api/admin/role-requests/[id]` | Super Admin | Approve/reject role request |

**PATCH Body:**
```json
{
  "action": "approve",  // approve|reject
  "admin_note": "Verified business license"
}
```
On approve: updates `profiles.role='umkm'`, creates `umkm_profiles` row.

---

### Audit & Activity Logs

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/admin/audit-logs` | Admin | Admin action audit trail |
| GET | `/api/admin/activity-logs` | Admin | User activity logs (login, order, product create, etc.) |

**Filters:** `user_id=`, `activity_type=`, `date_from=`, `date_to=`, `page`, `limit`

---

### UMKM Management

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/admin/umkm` | Admin | All UMKM profiles |
| PATCH | `/api/admin/umkm/[id]` | Admin | Verify/unverify, update info |

---

### Articles Management

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/admin/articles` | Admin | All articles (draft/published) |
| POST | `/api/admin/articles` | Admin | Create article |
| PATCH | `/api/admin/articles/[slug]` | Admin | Update article |
| DELETE | `/api/admin/articles/[slug]` | Admin | Delete article |

---

### System Health

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/admin/health` | Admin | Supabase, Xendit, Biteship, AI connectivity probes |

**Response:**
```json
{
  "supabase": { "ok": true, "latency_ms": 12 },
  "xendit": { "ok": true, "latency_ms": 245 },
  "biteship": { "ok": true, "latency_ms": 180 },
  "ai": { "ok": true, "latency_ms": 890 }
}
```

---

## Admin Capabilities Matrix

| Capability | Admin | Super Admin |
|------------|-------|-------------|
| View dashboard/analytics | ✅ | ✅ |
| View users | ✅ | ✅ |
| Suspend/ban user | ✅ | ✅ |
| Change user role | ❌ | ✅ |
| Delete user | ❌ | ✅ |
| View orders | ✅ | ✅ |
| Force order status | ✅ | ✅ |
| Refund order | ✅ | ✅ |
| Moderate products | ✅ | ✅ |
| Manage subscriptions | ✅ | ✅ |
| View shipments | ✅ | ✅ |
| Manage reports/warnings | ✅ | ✅ |
| Apply sanctions | ✅ | ✅ |
| Approve role requests | ❌ | ✅ |
| View audit logs | ✅ | ✅ |
| Manage articles | ✅ | ✅ |
| System health | ✅ | ✅ |

---

## Error Responses

| Code | HTTP | Context |
|------|------|---------|
| `unauthorized` | 401 | No/invalid token |
| `forbidden` | 403 | Not admin or inactive |
| `super_admin_required` | 403 | Role change, delete user, approve role request |
| `not_found` | 404 | Resource missing |
| `validation_error` | 400 | Invalid payload |
| `conflict` | 409 | Duplicate, state conflict |

---

## Related Docs

- [API Overview](./overview.md) — Auth, rate limits
- [Auth & Authorization](./auth.md) — Role system, RLS
- [Features: Admin Dashboard](../features/admin-dashboard.md) — UI workflows
- [Database: RLS Policies](../database/rls-policies.md) — Admin policies
- [Security: Auth](../security/auth-authorization.md) — Admin session hardening