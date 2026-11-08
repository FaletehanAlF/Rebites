# API Overview

> **Source of truth:** All endpoints below reflect the actual implementation in `app/api/**/route.ts`. No planned or hypothetical endpoints are documented.

---

## Base URL

| Environment | Base URL |
|-------------|----------|
| Local | `http://localhost:3000/api` |
| Production | `https://your-domain.com/api` |

All endpoints use **JSON** for request/response bodies unless noted otherwise.

---

## Authentication

| Scheme | Header | Notes |
|--------|--------|-------|
| Bearer (Supabase JWT) | `Authorization: Bearer <access_token>` | Used by all user-scoped endpoints. Token obtained via Supabase Auth (`/auth/v1/token?grant_type=password` or OAuth flow). |
| Service Role | `Authorization: Bearer <service_role_key>` | Server-to-server only (webhooks, cron, admin scripts). Never exposed to clients. |
| Xendit Callback Token | `X-Callback-Token: <token>` | Verifies Xendit webhook authenticity (`/api/webhooks/xendit`). |
| Biteship Signature | `X-Biteship-Signature` | Verifies Biteship webhook authenticity (`/api/webhooks/biteship`). |

**Idempotency** — Mutating endpoints (checkout, orders) accept `Idempotency-Key` header. Keys are normalized (trimmed, lowercased) and scoped per user. See [Checkout Idempotency](../features/checkout.md#idempotency--invoice-state-machine).

---

## Conventions

| Aspect | Convention |
|--------|------------|
| Path params | `[code]`, `[slug]`, `[id]` in folder names (`orders/[code]/route.ts`) |
| Query params | `?page=1&limit=20&sort=created_at.desc` |
| Error envelope | `{ "error": "Human-readable message", "code": "MACHINE_CODE" }` (optional `code`) |
| Success envelope | `{ "data": ... }` or `{ "order": ..., "options": [...] }` |
| Pagination | `page` (1-indexed), `limit` (default 20, max 100), returns `total`, `page`, `limit` |
| Timestamps | ISO 8601 UTC (`2025-01-15T07:23:11.000Z`) |
| Currency | Indonesian Rupiah (IDR), integer **minor units** (10000 = Rp 10.000) |
| Distance | Kilometers, 1 decimal (`5.3`) |
| Weight | Grams, integer (`350`) |

---

## Endpoint Catalog by Domain

### Authentication & Profile

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/profile` | Bearer | Current user profile + UMKM profile (if seller) |
| PATCH | `/api/profile` | Bearer | Update profile (name, phone, avatar) |
| GET | `/api/profile/addresses` | Bearer | List saved addresses |
| POST | `/api/profile/addresses` | Bearer | Create address |
| PATCH | `/api/profile/addresses/[id]` | Bearer | Update address |
| DELETE | `/api/profile/addresses/[id]` | Bearer | Delete address |
| POST | `/api/profile/avatar` | Bearer | Upload avatar (multipart) |

### Catalog & Products (Public / Buyer)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/products` | Optional | List products with filters (category, price, location, search) |
| GET | `/api/products/[slug]` | Optional | Product detail |
| GET | `/api/categories` | None | List categories with counts |
| GET | `/api/shipping/rates` | Bearer | Calculate delivery fee for a product + address |
| GET | `/api/store-visitors` | Bearer | Track store visit (analytics) |
| POST | `/api/store-visitors` | Bearer | Record store visit |

### Checkout & Orders (Buyer)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/checkout/xendit` | Bearer | Create order + Xendit invoice (idempotent) |
| GET | `/api/orders` | Bearer | List my orders (paginated, filterable) |
| GET | `/api/orders/[code]` | Bearer | Order detail (buyer/seller/admin) |
| PATCH | `/api/orders/[code]` | Bearer | Buyer: cancel (if allowed), confirm pickup |
| POST | `/api/orders/[code]/retry` | Bearer | Retry failed payment (new invoice) |

### Seller Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/seller/products` | Bearer (UMKM) | List my products |
| POST | `/api/seller/products` | Bearer (UMKM) | Create product |
| PATCH | `/api/seller/products/[id]` | Bearer (UMKM) | Update product |
| DELETE | `/api/seller/products/[id]` | Bearer (UMKM) | Delete product |
| GET | `/api/seller/orders` | Bearer (UMKM) | List orders for my store |
| PATCH | `/api/seller/orders/[code]` | Bearer (UMKM) | Update order status (prepare, ready, etc.) |
| GET | `/api/seller/reports` | Bearer (UMKM) | Sales reports (date range, export CSV/XLSX) |
| GET | `/api/seller/store-visitors` | Bearer (UMKM) | Store visitor analytics |
| GET | `/api/seller/subscription` | Bearer (UMKM) | Current subscription status |
| POST | `/api/subscriptions/xendit` | Bearer (UMKM) | Create subscription invoice |

### Courier Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/courier/profile` | Bearer (Courier) | Courier profile & status |
| PATCH | `/api/courier/profile` | Bearer (Courier) | Update availability, vehicle |
| GET | `/api/courier/assignments` | Bearer (Courier) | List assigned shipments |
| POST | `/api/courier/assignments/[id]/accept` | Bearer (Courier) | Accept assignment |
| POST | `/api/courier/assignments/[id]/pickup` | Bearer (Courier) | Mark picked up |
| POST | `/api/courier/assignments/[id]/deliver` | Bearer (Courier) | Mark delivered |
| POST | `/api/courier/location` | Bearer (Courier) | Push live location |
| GET | `/api/courier/messages` | Bearer (Courier) | Chat with buyer/seller |
| POST | `/api/courier/messages` | Bearer (Courier) | Send message |

### Admin (Super Admin / Admin)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/me` | Bearer (Admin) | Current admin identity & capabilities |
| GET | `/api/admin/dashboard` | Bearer (Admin) | Platform KPIs, charts |
| GET | `/api/admin/users` | Bearer (Admin) | List users (filter, paginate) |
| PATCH | `/api/admin/users/[id]` | Bearer (Super Admin) | Update user role, status |
| GET | `/api/admin/orders` | Bearer (Admin) | All orders (filter, paginate) |
| PATCH | `/api/admin/orders/[code]` | Bearer (Admin) | Force status change, refund |
| GET | `/api/admin/products` | Bearer (Admin) | All products (moderation queue) |
| PATCH | `/api/admin/products/[id]` | Bearer (Admin) | Approve/reject/hide product |
| GET | `/api/admin/subscriptions` | Bearer (Admin) | All subscriptions |
| PATCH | `/api/admin/subscriptions/[id]` | Bearer (Admin) | Override subscription |
| GET | `/api/admin/shipments` | Bearer (Admin) | All shipments |
| GET | `/api/admin/reports` | Bearer (Admin) | User reports (abuse, fraud) |
| PATCH | `/api/admin/reports/[id]` | Bearer (Admin) | Resolve/dismiss report |
| GET | `/api/admin/warnings` | Bearer (Admin) | User warnings |
| POST | `/api/admin/warnings` | Bearer (Admin) | Issue warning |
| GET | `/api/admin/sanctions` | Bearer (Admin) | User sanctions (suspend/ban/delete) |
| POST | `/api/admin/sanctions` | Bearer (Admin) | Apply sanction |
| GET | `/api/admin/role-requests` | Bearer (Admin) | Role upgrade requests |
| PATCH | `/api/admin/role-requests/[id]` | Bearer (Super Admin) | Approve/reject role request |
| GET | `/api/admin/audit-logs` | Bearer (Admin) | Admin action audit trail |
| GET | `/api/admin/activity-logs` | Bearer (Admin) | User activity logs |
| GET | `/api/admin/visitors` | Bearer (Admin) | Platform visitor analytics |
| GET | `/api/admin/umkm` | Bearer (Admin) | UMKM management |
| GET | `/api/admin/articles` | Bearer (Admin) | Article management |
| GET | `/api/admin/health` | Bearer (Admin) | System health probes |

### Articles & Content

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/articles` | Optional | List published articles (paginated) |
| GET | `/api/articles/[slug]` | Optional | Article detail |
| POST | `/api/articles` | Bearer (Admin) | Create article |
| PATCH | `/api/articles/[slug]` | Bearer (Admin) | Update article |
| DELETE | `/api/articles/[slug]` | Bearer (Admin) | Delete article |

### Support & Appeals

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/support` | Bearer | List my support tickets |
| POST | `/api/support` | Bearer | Create ticket |
| GET | `/api/support/[id]` | Bearer | Ticket detail + messages |
| POST | `/api/support/[id]/messages` | Bearer | Add message |
| POST | `/api/support/appeal` | Bearer | Submit sanction appeal |
| GET | `/api/support/appeal/[id]` | Bearer | Appeal status |

### Chatbot (AI Assistant)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/chat` | Bearer | Send message to AI (context-aware) |
| POST | `/api/chat/actions` | Bearer | Execute AI-triggered actions (order lookup, etc.) |

### Webhooks (Server-to-Server)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/webhooks/xendit` | X-Callback-Token | Payment status (orders + subscriptions) |
| POST | `/api/webhooks/biteship` | X-Biteship-Signature | Shipment status updates |

### Miscellaneous

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/delivery/route` | Bearer | Courier route geometry (polyline) |
| POST | `/api/reports` | Bearer | Submit user report |
| GET | `/api/visitors` | Optional | Anonymous visitor tracking |

---

## Rate Limits

| Endpoint Group | Limit | Window | Scope |
|----------------|-------|--------|-------|
| Checkout (`/api/checkout/xendit`) | 10 req | 1 min | Per user (idempotency key) |
| Shipping rates | 30 req | 1 min | Per user |
| AI Chat | 20 req | 1 min | Per user |
| Support create | 5 req | 1 hour | Per user |
| Admin bulk ops | 100 req | 1 min | Per admin |
| Webhooks | Unlimited | — | Verified source only |

Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

---

## Versioning

No formal API versioning in URL. Breaking changes are avoided by:
- Adding optional fields only
- New endpoints for new behaviors
- Deprecation notices in response `Deprecation` header (future)

---

## Error Codes Reference

| Code | HTTP | Meaning |
|------|------|---------|
| `unauthorized` | 401 | Missing/invalid token |
| `forbidden` | 403 | Insufficient role/ownership |
| `not_found` | 404 | Resource doesn't exist |
| `validation_error` | 400 | Invalid payload |
| `conflict` | 409 | Idempotency conflict, duplicate |
| `amount_mismatch` | 409 | Webhook amount ≠ order amount |
| `product_unavailable` | 400 | Stock, status, schedule |
| `origin_coordinates_missing` | 400 | Seller hasn't set store location |
| `dest_coordinates_missing` | 400 | Address lacks lat/lng |
| `service_unavailable` | 503 | Supabase/Xendit/Biteship down |
| `server_misconfigured` | 500 | Missing env vars |

Full list: [docs/reference/error-codes.md](../reference/error-codes.md)

---

## Related Docs

- [Webhooks](./webhooks.md) — Xendit & Biteship payload formats, retry logic
- [Auth & Authorization](./auth.md) — Token flows, RLS, role checks
- [Admin Endpoints](./admin.md) — Admin API details, RBAC
- [Rate Limits](./rate-limits.md) — Per-endpoint limits, headers
- [Features: Checkout](../features/checkout.md) — Idempotency, invoice state machine
- [Features: Catalog](../features/catalog.md) — Product query params, filters