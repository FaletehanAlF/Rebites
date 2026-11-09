# Glossary

> **Domain terms, acronyms, and abbreviations used in ReBites**

---

## Terms

| Term | Definition |
|------|------------|
| **UMKM** | *Usaha Mikro, Kecil, dan Menengah* — Indonesian term for Micro, Small, and Medium Enterprises. In ReBites, "sellers" are UMKM. |
| **ReBites Courier** | In-house delivery fleet (not Biteship). Uses local haversine tariff calculation. |
| **Surplus Price** | Discounted price for food surplus items (vs `original_price`). |
| **Flash Sale** | Time-limited price drop on specific products. |
| **Order Code** | Human-readable order identifier: `RB-YYYYMMDD-XXXXXX`. |
| **Invoice State** | Internal state machine column on `orders`: `pending`, `paid`, `failed`, `refunded`. Prevents duplicate payments. |
| **Idempotency Key** | Client-provided header (`Idempotency-Key`) to safely retry checkout requests. |
| **Stock Reservation** | Atomic PostgreSQL RPC (`reserve_stock_for_order`) that decrements stock with a marker for rollback. |
| **Settlement** | Post-payment processing: updates order status, releases stock, creates shipment, earns coins. |
| **Coin** | Loyalty points (1% of order value earned, max 50% of order payable with coins). |
| **Promo Code** | Percentage discount code with usage limits and expiry. |
| **Service Fee** | Platform commission (5% of subtotal, configurable). |
| **Delivery Fee** | Shipping cost calculated via Biteship or local tariff. |
| **Pickup** | Self-collection at store (no delivery fee). |
| **Service Area** | Currently: Kota Depok only (hardcoded in UI, DB supports multi-city). |
| **WIB** | *Waktu Indonesia Barat* — UTC+7 timezone. All timestamps stored in UTC, displayed in WIB. |
| **PITR** | Point-in-Time Recovery (Supabase backup feature, 7-day window). |
| **RLS** | Row Level Security — PostgreSQL policies enforcing data access by role/ownership. |
| **Service Role** | Supabase admin key that bypasses RLS. Used only in server-only code. |
| **Shell Injection** | Pattern where a server component passes a `shell` prop to a shared component to render different auth-dependent UI without shipping auth code to public bundles. |
| **Route Group** | Next.js App Router feature: `(folder)` doesn't affect URL path but enables different layouts/middleware. |

---

## Acronyms

| Acronym | Full Form |
|---------|-----------|
| **API** | Application Programming Interface |
| **CDN** | Content Delivery Network |
| **CI/CD** | Continuous Integration / Continuous Deployment |
| **CO2e** | Carbon Dioxide Equivalent |
| **DB** | Database |
| **E2E** | End-to-End (testing) |
| **GMV** | Gross Merchandise Value |
| **HMAC** | Hash-based Message Authentication Code |
| **IDR** | Indonesian Rupiah |
| **JWT** | JSON Web Token |
| **LCP** | Largest Contentful Paint |
| **MTTR** | Mean Time To Recovery |
| **N+1** | Query pattern: 1 query + N queries in loop |
| **PII** | Personally Identifiable Information |
| **PKCE** | Proof Key for Code Exchange (OAuth) |
| **PWA** | Progressive Web App |
| **QL** | Query Language |
| **RPC** | Remote Procedure Call (Postgres function) |
| **SAST** | Static Application Security Testing |
| **SBOM** | Software Bill of Materials |
| **SEV** | Severity (incident) |
| **SLA** | Service Level Agreement |
| **SSO** | Single Sign-On |
| **SST** | Server-Side Rendering |
| **TTFB** | Time to First Byte |
| **UMKM** | Usaha Mikro, Kecil, dan Menengah |
| **VA** | Virtual Account (bank transfer payment) |
| **WIB** | Waktu Indonesia Barat (UTC+7) |
| **XSS** | Cross-Site Scripting |

---

## Role Names

| Code Name | Display Name | Description |
|-----------|-------------|-------------|
| `buyer` | Pembeli | Food consumer |
| `umkm` | Penjual / UMKM | Food seller |
| `admin` | Admin | Platform operations |
| `super_admin` | Super Admin | Full control (env-gated) |
| `courier` | Kurir | Delivery personnel |

---

## Status Enums

### Order Status

| Value | Meaning |
|-------|---------|
| `pending` | Created, awaiting payment |
| `paid` | Payment confirmed, awaiting processing |
| `processing` | Seller confirmed, preparing |
| `ready_for_pickup` | Ready for courier pickup / buyer pickup |
| `out_for_delivery` | Courier has picked up |
| `completed` | Delivered / picked up |
| `cancelled` | Cancelled (any reason) |
| `refunded` | Refunded after payment |

### Payment Status

| Value | Meaning |
|-------|---------|
| `unpaid` | No payment received |
| `paid` | Payment confirmed |
| `failed` | Payment failed/expired |
| `refunded` | Refunded |

### Product Status

| Value | Meaning |
|-------|---------|
| `available` | In stock, visible |
| `sold_out` | Stock = 0 |
| `hidden` | Manually hidden by seller/admin |

### Subscription Status

| Value | Meaning |
|-------|---------|
| `trial` | Free trial period |
| `active` | Paid and active |
| `expired` | Ended without renewal |
| `cancelled` | Cancelled by seller |

---

## File Extensions

| Extension | Use |
|-----------|-----|
| `.ts` | TypeScript module |
| `.tsx` | React component (TypeScript) |
| `.md` | Markdown documentation |
| `.mmd` | Mermaid diagram |
| `.sql` | SQL migration |
| `.json` | Config / data |
| `.env` | Environment variables |

---

## Related Docs

- [Reference: Types](../reference/types.md) — TypeScript interfaces
- [Reference: Error Codes](../reference/error-codes.md) — API error codes
- [Architecture: Overview](../architecture/overview.md) — System context