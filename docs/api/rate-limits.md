# Rate Limits

> **Implementation:** `lib/verify-throttle.ts`, `lib/support-rate-limit.ts`, middleware (future), per-endpoint logic

---

## Global Limits

| Scope | Limit | Window | Header |
|-------|-------|--------|--------|
| Per IP (unauthenticated) | 60 req | 1 min | `X-RateLimit-Limit: 60` |
| Per User (authenticated) | 120 req | 1 min | `X-RateLimit-Limit: 120` |
| Per Admin | 300 req | 1 min | `X-RateLimit-Limit: 300` |

Applied via middleware (planned) or per-route checks.

---

## Endpoint-Specific Limits

### Checkout & Payments

| Endpoint | Limit | Window | Scope | Notes |
|----------|-------|--------|-------|-------|
| `POST /api/checkout/xendit` | 10 | 1 min | Per user (idempotency key) | Idempotency key deduplicates; limit prevents abuse |
| `POST /api/orders/[code]/retry` | 5 | 1 hour | Per user | Payment retry |
| `POST /api/subscriptions/xendit` | 5 | 1 hour | Per seller | Subscription invoice |

### Shipping & Logistics

| Endpoint | Limit | Window | Scope | Notes |
|----------|-------|--------|-------|-------|
| `POST /api/shipping/rates` | 30 | 1 min | Per user | Fee calculation |
| `POST /api/courier/location` | 60 | 1 min | Per courier | Live tracking (throttled client-side) |
| `POST /api/webhooks/biteship` | Unlimited | — | Verified source | Webhook |

### AI Chatbot

| Endpoint | Limit | Window | Scope | Notes |
|----------|-------|--------|-------|-------|
| `POST /api/chat` | 20 | 1 min | Per user | Token-aware (future) |
| `POST /api/chat/actions` | 10 | 1 min | Per user | Action execution |

### Support & Appeals

| Endpoint | Limit | Window | Scope | Notes |
|----------|-------|--------|-------|-------|
| `POST /api/support` | 5 | 1 hour | Per user | `lib/support-rate-limit.ts` |
| `POST /api/support/appeal` | 3 | 24 hours | Per user | Appeal submission |

### Admin Bulk Operations

| Endpoint | Limit | Window | Scope | Notes |
|----------|-------|--------|-------|-------|
| `GET /api/admin/users` | 100 | 1 min | Per admin | Paginated |
| `PATCH /api/admin/users/[id]` | 30 | 1 min | Per admin | |
| `GET /api/admin/orders` | 100 | 1 min | Per admin | |
| `POST /api/admin/warnings` | 20 | 1 min | Per admin | |
| `POST /api/admin/sanctions` | 10 | 1 min | Per admin | |

### Public/Anonymous

| Endpoint | Limit | Window | Scope | Notes |
|----------|-------|--------|-------|-------|
| `GET /api/products` | 60 | 1 min | Per IP | Catalog browsing |
| `GET /api/articles` | 60 | 1 min | Per IP | Blog reading |
| `GET /api/categories` | 120 | 1 min | Per IP | |

---

## Rate Limit Headers

All rate-limited responses include:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1705315200  # Unix timestamp (seconds)
Retry-After: 45                # Seconds until reset (on 429)
```

Client should respect `Retry-After` on 429.

---

## 429 Response Format

```json
{
  "error": "Terlalu banyak permintaan. Coba lagi dalam 45 detik.",
  "code": "rate_limited",
  "retry_after": 45
}
```

---

## Implementation Details

### `lib/verify-throttle.ts` — Generic Throttle

```typescript
export async function verifyThrottle(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetMs: number }>
```

- In-memory `Map<key, { count, resetAt }>` (single-instance)
- **Not distributed** — works for single-server deployments
- For multi-instance: migrate to Redis (Upstash/Vercel KV)

### `lib/support-rate-limit.ts` — Support Ticket Limit

```typescript
export async function checkSupportRateLimit(userId: string): Promise<boolean>
```

- Uses `support_tickets` table: `COUNT(*) WHERE user_id=$1 AND created_at > NOW() - INTERVAL '1 hour'`
- Persistent across restarts, works multi-instance

### Per-Route Pattern

```typescript
// In route handler
const throttle = await verifyThrottle(`checkout:${user.id}`, 10, 60_000);
if (!throttle.allowed) {
  return NextResponse.json(
    { error: 'Terlalu banyak permintaan...', code: 'rate_limited', retry_after: Math.ceil((throttle.resetMs - Date.now()) / 1000) },
    { status: 429, headers: { 'X-RateLimit-Limit': '10', 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': String(Math.ceil(throttle.resetMs / 1000)) } }
  );
}
```

---

## Client-Side Handling

```typescript
// hooks/useApi.ts
async function fetchWithRetry(url, options, retries = 2) {
  const res = await fetch(url, options);
  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After') ?? '60';
    await new Promise(r => setTimeout(r, Number(retryAfter) * 1000));
    return fetchWithRetry(url, options, retries - 1);
  }
  return res;
}
```

- Auto-retry with `Retry-After` delay
- Exponential backoff for 5xx

---

## Future: Distributed Rate Limiting

| Option | Pros | Cons |
|--------|------|------|
| Upstash Redis | Serverless, global, cheap | Extra dependency |
| Vercel KV | Native Vercel integration | Vendor lock-in |
| Cloudflare Workers KV | Edge, fast | Extra infra |
| Supabase `pg_ratelimit` | In DB, no extra infra | Higher latency |

**Recommendation:** Upstash Redis when multi-instance deployment begins.

---

## Monitoring

| Metric | Alert Threshold |
|--------|-----------------|
| 429 rate > 5% of traffic | Investigate abuse / adjust limits |
| `verifyThrottle` memory > 10k keys | Restart / migrate to Redis |
| Support ticket limit hits > 100/day | UX review / increase limit |

---

## Related Docs

- [API Overview](./overview.md) — Endpoint catalog
- [Security Overview](../security/overview.md) — Abuse prevention
- [Operations: Monitoring](../operations/monitoring.md) — Alerting
- [Integrations: Supabase](../integrations/supabase.md) — DB-backed limits