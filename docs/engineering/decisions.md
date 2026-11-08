# Architecture Decisions (ADRs)

> **Format:** Lightweight ADRs recorded in this file
> **Trigger:** Any non-trivial technical choice with tradeoffs

---

## ADR Template

```
## ADR-YYYYMMDD: [Title]

**Status:** Accepted / Superseded / Deprecated
**Date:** YYYY-MM-DD
**Deciders:** @name
**Context:** [What problem, what constraints]
**Decision:** [What we chose]
**Consequences:** [Positive + negative]
**Alternatives:** [What we didn't choose]
```

---

## ADR-20241101: Next.js 14 App Router with Route Groups

**Status:** Accepted
**Context:** Need SEO-friendly public pages + authenticated app with shared layouts. Traditional pages router doesn't support nested layouts well.

**Decision:** Use App Router with `(landing)`, `(app)`, `(preview)` route groups. Route groups don't affect URLs but allow different layouts/auth requirements.

**Consequences:**
- ✅ Clean separation of public vs protected routes
- ✅ Shared layouts without URL pollution
- ✅ Server components by default (less client JS)
- ❌ Learning curve for team
- ❌ Some libraries not App Router compatible yet

**Alternatives:** Pages router + custom `_app` + HOC auth wrapper.

---

## ADR-20241101: Supabase as Backend (Postgres + Auth + Realtime + Storage)

**Status:** Accepted
**Context:** Need database, auth, real-time updates, file storage. Options: Firebase, Supabase, custom Node/Postgres + auth service.

**Decision:** Supabase Cloud (managed Postgres + GoTrue + Realtime + S3-compatible storage).

**Consequences:**
- ✅ Single vendor for all backend needs
- ✅ Row Level Security = built-in authorization
- ✅ Real-time subscriptions for orders/chat
- ✅ SQL flexibility (Postgres)
- ✅ Generous free tier
- ❌ Vendor lock-in (but standard Postgres underneath)
- ❌ Less control than self-hosted
- ❌ Cold starts on some regions

**Alternatives:** Firebase (NoSQL, less SQL power), Custom (more ops burden).

---

## ADR-20241101: Xendit for Payments (Replacing Midtrans)

**Status:** Accepted
**Context:** Midtrans integration was complex (snap token, multiple environments). Need simpler API, better webhooks, VA + e-wallet + retail.

**Decision:** Migrate to Xendit. Xendit Invoice API v2 is simpler (direct invoice creation, cleaner webhooks).

**Consequences:**
- ✅ Simpler API (Basic auth, JSON)
- ✅ Better webhook structure (timing-safe token)
- ✅ Same payment methods (VA, e-wallet, retail, QRIS)
- ✅ Idempotency via external_id
- ❌ Migration effort
- ❌ Different webhook format (rebuilt handler)

**Alternatives:** Stay with Midtrans (technical debt), Midtrans Snap (frontend redirect).

---

## ADR-20241101: Biteship for Logistics + ReBites Courier Fallback

**Status:** Accepted
**Context:** Need shipping rates + shipment creation + tracking. Biteship aggregates multiple couriers (JNE, SiCepat, Ninja). Also need in-house courier option.

**Decision:** Biteship as primary for external couriers. Custom "ReBites Courier" using local haversine tariff as fallback/primary for Depok.

**Consequences:**
- ✅ Multiple couriers via single API
- ✅ Webhook for tracking updates
- ✅ In-house courier control (cost, reliability)
- ❌ Biteship balance management needed
- ❌ External dependency for rates

**Alternatives:** Direct courier APIs (JNE, SiCepat) — higher integration cost.

---

## ADR-20241101: Idempotency Keys + Invoice State Machine for Checkout

**Status:** Accepted
**Context:** Payment webhooks can retry. User might click "pay" twice. Need exactly-once order creation.

**Decision:** 
1. Client sends `Idempotency-Key` header (normalized: trim + lowercase)
2. `invoice_state` column on `orders`: `pending` → `paid` / `failed`
3. State machine in `checkout-idempotency.ts` prevents invalid transitions
4. Compensation logic for partial failures (stock release, promo release)

**Consequences:**
- ✅ No duplicate orders
- ✅ Safe webhook retries
- ✅ Clear failure recovery
- ❌ Added complexity in checkout flow
- ❌ Must handle all state transitions correctly

**Alternatives:** Optimistic locking, database unique constraint on idempotency key only.

---

## ADR-20241101: Atomic Stock Reservation via RPC

**Status:** Accepted
**Context:** Multiple users buying same product concurrently. Need to prevent overselling without row locks.

**Decision:** PostgreSQL RPC `reserve_stock_for_order(product_id, quantity)` with `FOR UPDATE` on product row. Returns `reserved` boolean + `marker_id` for release.

**Consequences:**
- ✅ Race-condition free
- ✅ Stock never goes negative
- ✅ Release on cancel/expiry via `release_stock_for_order`
- ❌ Requires DB function (migration)
- ❌ Must track reservation markers

**Alternatives:** Application-level lock (Redis), optimistic locking with version column.

---

## ADR-20241101: Role-Based Access via RLS + Super Admin Gate

**Status:** Accepted
**Context:** Three user roles (buyer, umkm/seller, admin). Need data isolation. Super admin needs to approve role changes.

**Decision:**
1. RLS on ALL tables using `auth.uid()` and `jwt.claims.role`
2. Admin API checks `getAdminUser()` → `role IN ('admin', 'super_admin')` + `account_status='active'`
3. Super admin = `profile.id === process.env.SUPER_ADMIN_USER_ID`
4. Role changes require super admin approval

**Consequences:**
- ✅ Defense in depth (RLS + API checks)
- ✅ Super admin gate on destructive ops
- ✅ No role escalation via API
- ❌ Complex RLS policies (80+ tables)
- ❌ Service role bypasses RLS (must be careful)

**Alternatives:** Application-level authorization only (fragile), Supabase Auth roles (limited).

---

## ADR-20241101: Shell Injection Pattern for Product Detail

**Status:** Accepted
**Context:** Product detail page used by:
- Public preview (no auth)
- Authenticated buyer (full checkout)
- Seller (edit mode)
- Admin (moderation)
Don't want auth code in public bundle.

**Decision:** Server component `DetailProductPage` fetches data, renders `DetailProductContent` with `shell` prop:
- `shell: 'public'` → no auth UI
- `shell: 'authenticated'` → full buyer UI
- `shell: 'seller'` → edit controls
- `shell: 'admin'` → moderation

**Consequences:**
- ✅ Auth logic stays in server components
- ✅ Public page has zero auth bundle
- ✅ Single product detail component
- ❌ Slightly complex prop drilling

**Alternatives:** Separate page components per role (duplication), client-side auth check (bundle bloat).

---

## ADR-20241101: Node.js Built-in Test Runner (`node --test`)

**Status:** Accepted
**Context:** Need fast, zero-config testing. Jest adds config, Vitest adds dependency. 96 test suites must run in CI.

**Decision:** Use Node 18+ built-in `node:test` and `node:assert`. No external test framework.

**Consequences:**
- ✅ Zero dependencies
- ✅ Fast startup
- ✅ Built-in watch mode
- ✅ Native TypeScript support (via `tsx` or `--loader`)
- ❌ No built-in mocking (manual mocks)
- ❌ No snapshot testing
- ❌ Less community plugins

**Alternatives:** Jest (heavy), Vitest (dependency), uvu (minimal).

---

## ADR-20241101: Manual Validation over Zod/Valibot

**Status:** Accepted
**Context:** Input validation in API routes. Options: Zod, Valibot, manual TypeScript checks.

**Decision:** Manual validation with `typeof`, `Number.isFinite`, custom helpers (`sanitizeAddressSnapshot`, `isValidCoordinatePair`).

**Consequences:**
- ✅ Zero dependencies
- ✅ Fine-grained error messages (Indonesian)
- ✅ No schema duplication (TypeScript types = source of truth)
- ❌ More verbose
- ❌ Easy to miss edge cases
- ❌ No automatic OpenAPI generation

**Alternatives:** Zod (schema + validation + OpenAPI), Valibot (smaller bundle).

---

## ADR-20241101: No Feature Flags (Yet)

**Status:** Accepted
**Context:** Feature flags help gradual rollout and kill switches. But add complexity.

**Decision:** No feature flag system yet. Use git branches + fast rollback. Add when:
- Team > 3 engineers
- Need A/B testing
- Need instant kill switch for risky feature

**Consequences:**
- ✅ Simpler codebase
- ✅ No flag evaluation overhead
- ❌ Can't gradually roll out
- ❌ Can't instantly disable without deploy

**Alternatives:** LaunchDarkly, Unleash, custom cookie-based flags.

---

## ADR-20241101: Indonesian Language Only (No i18n)

**Status:** Accepted
**Context:** Market is Indonesia (Depok specifically). i18n adds complexity.

**Decision:** Hardcode Indonesian strings. No `next-intl` or `i18next`. Accept English strings in code/comments.

**Consequences:**
- ✅ Simpler code
- ✅ No locale routing
- ✅ No translation maintenance
- ❌ Hard to expand to English/other languages
- ❌ No localization of dates/currencies (currently manual)

**Alternatives:** `next-intl` with single locale (prep for future).

---

## ADR-20241101: AVIF for Product Images

**Status:** Accepted
**Context:** Image format choice. Need good compression + quality. Files stored in Supabase Storage.

**Decision:** Client converts to AVIF before upload. Store as `.avif`. Supabase CDN serves AVIF.

**Consequences:**
- ✅ Best compression (30-50% smaller than WebP)
- ✅ Modern browser support (>95%)
- ❌ Legacy browser fallback needed
- ❌ Client-side conversion CPU
- ❌ DB path mismatch (old records `.jpeg`)

**Alternatives:** WebP (better legacy support), JPEG (larger).

---

## ADR-20241101: Supabase Storage over Local Files

**Status:** Accepted
**Context:** File uploads for products, avatars, articles. Options: local disk, S3, Supabase Storage.

**Decision:** Supabase Storage (S3-compatible, integrated with Supabase Auth/RLS).

**Consequences:**
- ✅ Integrated auth (RLS on storage objects)
- ✅ CDN included
- ✅ No separate S3 bucket management
- ❌ 1GB free tier limit
- ❌ Supabase-specific APIs

**Alternatives:** AWS S3 (more control, more setup), local disk (doesn't scale).

---

## ADR-20241101: Google Gemini for AI (Not OpenAI)

**Status:** Accepted
**Context:** Need AI for chatbot + courier assistant. Options: OpenAI GPT, Google Gemini, self-hosted (Llama).

**Decision:** Google Gemini 1.5 Flash (cheap, fast, good tool calling).

**Consequences:**
- ✅ Low cost ($0.075/1M input, $0.30/1M output)
- ✅ Native tool calling
- ✅ Large context (1M tokens)
- ❌ Google AI Studio key management
- ❌ Less ecosystem than OpenAI

**Alternatives:** OpenAI GPT-4o-mini (similar cost, different API).

---

## ADR-20241101: Pagination on All List Endpoints

**Status:** Accepted
**Context:** Lists can grow (products, orders, users). Unbounded queries crash memory.

**Decision:** All `GET /api/*` list endpoints require `page` (default 1) and `limit` (default 20, max 100). Return `total`, `page`, `limit`.

**Consequences:**
- ✅ Predictable memory
- ✅ Client can paginate UI
- ✅ Database query uses `LIMIT`/`OFFSET`
- ❌ Offset pagination slows on deep pages (future: cursor)

**Alternatives:** Cursor pagination (complex), infinite scroll only (no deep linking).

---

## Tracking

| ADR | Date | Status | Supersedes |
|-----|------|--------|------------|
| ADR-20241101: App Router | 2024-11-01 | Accepted | — |
| ADR-20241101: Supabase | 2024-11-01 | Accepted | — |
| ADR-20241101: Xendit | 2024-11-01 | Accepted | — |
| ADR-20241101: Biteship | 2024-11-01 | Accepted | — |
| ADR-20241101: Idempotency | 2024-11-01 | Accepted | — |
| ADR-20241101: Stock RPC | 2024-11-01 | Accepted | — |
| ADR-20241101: RBAC | 2024-11-01 | Accepted | — |
| ADR-20241101: Shell Injection | 2024-11-01 | Accepted | — |
| ADR-20241101: Node Test | 2024-11-01 | Accepted | — |
| ADR-20241101: Manual Validation | 2024-11-01 | Accepted | — |
| ADR-20241101: No Feature Flags | 2024-11-01 | Accepted | — |
| ADR-20241101: i18n | 2024-11-01 | Accepted | — |
| ADR-20241101: AVIF | 2024-11-01 | Accepted | — |
| ADR-20241101: Supabase Storage | 2024-11-01 | Accepted | — |
| ADR-20241101: Gemini | 2024-11-01 | Accepted | — |
| ADR-20241101: Pagination | 2024-11-01 | Accepted | — |

---

## Related Docs

- [Engineering: Code Organization](./code-organization.md) — Module boundaries
- [Engineering: Tech Debt](./tech-debt.md) — Deferred decisions
- [Architecture: Overview](../architecture/overview.md) — System context
- [Development: Coding Standards](../development/coding-standards.md) — Patterns