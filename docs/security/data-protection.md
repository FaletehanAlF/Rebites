# Data Protection

> **Scope:** PII handling, data minimization, retention, and compliance for ReBites food marketplace

---

## PII Inventory

| Data Field | Table / Location | Purpose | Retention |
|------------|-----------------|---------|-----------|
| `full_name` | `profiles` | Display, legal | Indefinite (account life) |
| `email` | `profiles`, `auth.users` | Auth, comms | Indefinite |
| `phone` | `profiles`, `addresses` | Delivery contact | With address |
| `avatar_url` | `profiles` | Display | Indefinite |
| `receiver_name` | `addresses` | Delivery | With address |
| `full_address` | `addresses` | Delivery | With address |
| `latitude`/`longitude` | `addresses`, `umkm_profiles` | Location, distance calc | With address |
| `postal_code` | `addresses` | Delivery routing | With address |
| `business_name` | `umkm_profiles` | Public (storefront) | Indefinite |
| `business_address` | `umkm_profiles` | Public (store location) | Indefinite |
| `business_license` | `umkm_profiles` | Verification | Indefinite |
| `co2e_saved_kg` | `orders` | Analytics, display | Indefinite |
| `vendor_name` | `orders` | Order display | Indefinite |
| `payment_channel` | `orders` | Payment record | Indefinite |

**Not stored:** Card numbers, CVV, bank account numbers (Xendit handles all payment data).

---

## Data Minimization

| Principle | Implementation |
|-----------|----------------|
| Collect only what's needed | Address: no SSN, no ID number, no medical info |
| Anonymize analytics | `store_visitors`, `visitors` tables store counts, not individual browsing |
| No server-side PII logs | `console.log` excludes addresses, phone numbers |
| Address snapshot in orders | `address_snapshot` is a frozen copy (data minimization: original can be deleted) |
| Payment info external | Xendit stores payment details, we store only `payment_channel` |

---

## Data Access Controls

### RLS Enforcement

| Table | Who Can Read | Who Can Write |
|-------|-------------|---------------|
| `profiles` | Self, Admin | Self, Admin |
| `addresses` | Self, Admin | Self, Admin |
| `orders` | Buyer, Seller, Admin | Buyer (cancel), Seller (status), Admin (all) |
| `umkm_profiles` | Public (read), Owner, Admin | Owner, Admin |
| `user_reports` | Reporter, Subject, Admin | Reporter (create), Admin (update) |
| `user_sanctions` | Subject, Admin | Admin only |
| `admin_audit_logs` | Admin only | Admin only (append) |

### Service Role Isolation

```
Client Browser
    │
    │ (anon key, RLS applies)
    ▼
Supabase (anon)
    │
    │ (service role key, RLS bypassed)
    ▼
Server Route Handlers (lib/server/*)
    │
    │ (explicit admin check BEFORE service client use)
    ▼
Admin Operations
```

**Rule:** `createServiceClient()` is NEVER in:
- Client components
- Public API routes without admin check
- Pages without explicit `getAdminUser()` call

---

## Data Retention

| Data Type | Retention Period | Deletion Trigger |
|-----------|-----------------|-----------------|
| User profile | Account life | Account deletion (by user or admin) |
| Order history | 2 years | Automated purge (future) |
| Address data | Account life | Address deletion by user |
| PII in logs | 30 days | Log rotation |
| Payment records | 2 years | Xendit record (our side: order only) |
| Activity logs | 1 year | Automated purge (future) |
| Admin audit logs | 5 years | No auto-purge |
| User reports/warnings | Account life | Sanction expiry or account deletion |

**Current state:** No automated data deletion. Manual admin action required.

---

## Compliance (Indonesian)

### PDP Law (UU No. 27/2022)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Consent for PII processing | ⚠️ Partial | Registration implies consent; no explicit checkbox |
| Data subject rights (access, correct, delete) | ⚠️ Partial | User can delete account; no export/correction flow |
| DPO (Data Protection Officer) | ❌ Not assigned | Needed for formal compliance |
| Data breach notification | ⚠️ No process | No notification flow to affected users |
| Cross-border data transfer | ✅ No issue | All data in Supabase (Singapore/US) |
| PII minimization | ✅ Yes | Only delivery-relevant PII collected |

### E-Commerce (UU ITE No. 11/2008)

| Requirement | Status |
|-------------|--------|
| Electronic signature for contracts | N/A (food marketplace, no contract) |
| Transaction records | ✅ Order history stored |
| Data integrity | ✅ Supabase Postgres (WAL, PITR) |

---

## Encryption

| Data | At Rest | In Transit |
|------|---------|------------|
| Postgres data | AES-256 (Supabase) | TLS 1.2+ |
| Auth tokens | — | TLS |
| Supabase Storage files | AES-256 | TLS |
| Webhook payloads | — | TLS + HMAC/token |
| API responses | — | TLS (Vercel) |

---

## PII in Logs

| Log Source | PII Exposed | Mitigation |
|------------|-------------|------------|
| `[checkout/xendit]` | Order code, amount | No names, addresses |
| `[webhook/xendit]` | External ID, payment channel | No PII |
| `[biteship]` | Courier, tracking number | No buyer PII |
| `[chat]` | User ID | No full name in logs |
| `supabase-errors` | Error message | No user data |
| `activity_logs` table | User ID, action | Accessible by admin only |

**Rule:** Never log `full_address`, `phone`, `email`, or `postal_code`.

---

## Data Backup & Recovery

| Feature | Supabase | RPO | RTO |
|---------|----------|-----|-----|
| Automated backup | Yes (daily) | 24h | ~1h (restore) |
| PITR | Yes (7 days) | 5min | ~1h |
| Manual backup | `pg_dump` | On demand | Minutes |

**Backup Verification:**
```bash
# Monthly test restore
supabase db dump > backup.sql
psql -U postgres -d test_restore -f backup.sql
```

---

## Data Deletion

### User Self-Service

```typescript
// POST /api/account/delete (future)
// 1. Verify email + password
// 2. Soft-delete profile (account_status = 'banned')
// 3. Schedule hard-delete in 30 days
// 4. Notify affected parties (sellers with pending orders)
```

**Current:** No user self-service deletion. Admin can ban/delete via `/api/admin/users`.

### Hard Deletion (Admin)

```typescript
// POST /api/admin/sanctions { sanction_type: 'delete' }
// 1. Verify sanction reason
// 2. Cancel active orders
// 3. Release stock reservations
// 4. Delete: profiles, addresses, orders, products (cascade)
// 5. Keep: admin_audit_logs (immutable)
```

---

## Data Breach Response (Draft)

```
1. Detect: Monitoring alert or user report
2. Assess: Scope, affected data, PII count
3. Contain: Rotate affected keys/tokens
4. Notify: Users within 72h (PDP compliance target)
5. Remediate: Patch vulnerability
6. Report: PDP regulator (Kominfo) if >1,000 records
7. Document: Incident report, post-mortem
```

---

## Security Testing for Data Protection

| Test | Tool | Frequency |
|------|------|-----------|
| RLS policy audit | `supabase gen policies` + manual review | After schema changes |
| Service role usage audit | Grep `createServiceClient` in `app/` | Weekly |
| PII in logs scan | Grep `address\|phone\|email\|postal` in `console.*` | Monthly |
| Webhook data flow | Manual: trace PII from request to response | After webhook changes |
| Backup restore | `supabase db restore` test | Monthly |

---

## Related Docs

- [Security: Overview](./overview.md) — Threat model
- [Security: Auth & Authorization](./auth-authorization.md) — Access controls
- [Security: Input Validation](./input-validation.md) — Data entry safety
- [Security: Secrets Management](./secrets-management.md) — Key handling
- [Database: RLS Policies](../database/rls-policies.md) — Policy reference
- [Operations: Incident Response](../operations/incident-response.md) — Breach response