# Security Overview

> **Threat model:** Food marketplace with payments, PII, and multi-tenant data. Primary risks: auth bypass, payment fraud, PII leakage, RLS violations, supply chain attacks.

---

## Security Posture

| Domain | Maturity | Notes |
|--------|----------|-------|
| **Authentication** | Good | Supabase Auth (JWT, OAuth), HttpOnly cookies, timing-safe token compare |
| **Authorization** | Good | RLS on all tables, role checks in API, super admin gate |
| **Data Protection** | Good | No PII in logs, address snapshots encrypted at rest (Supabase), service role isolated |
| **Input Validation** | Good | Zod-like manual validation in API routes, address sanitization, coordinate checks |
| **Secrets Management** | Good | Env vars only, no hardcoded keys, timing-safe compare for webhooks |
| **Dependency Security** | Fair | `npm audit` not automated, no Snyk/Dependabot configured |
| **Webhook Security** | Good | Timing-safe token compare, HMAC signature verification |
| **Rate Limiting** | Fair | Per-endpoint, in-memory (not distributed), no global middleware |
| **Logging & Audit** | Good | Structured logs, admin audit trail, activity logs |
| **Supply Chain** | Fair | No lock file verification in CI, no SBOM |

---

## Threat Model

### Critical Risks

| Threat | Impact | Mitigation |
|--------|--------|------------|
| **Xendit webhook spoofing** | Fake payment → free orders | Timing-safe token verify, amount validation |
| **Biteship webhook spoofing** | Fake delivery → order completed without payment | HMAC signature verification |
| **RLS policy bypass** | Buyer sees other's orders / seller data | RLS on all tables, service role never in client |
| **Service role key leakage** | Full DB access | Key in env only, no client bundle, no logs |
| **IDOR on order codes** | Order code format predictable | `order_code` includes UUID, not sequential |

### High Risks

| Threat | Impact | Mitigation |
|--------|--------|------------|
| **Admin RBAC bypass** | Non-admin accessing admin API | `getAdminUser()` checks role + status |
| **Prompt injection (AI)** | AI reveals PII or executes dangerous actions | Tool whitelist, no PII in prompts, system prompt hardening |
| **Stock reservation race condition** | Overselling | Atomic RPC `reserve_stock_for_order`, idempotency |
| **Payment amount mismatch** | Underpaying | `paid_amount` must equal `total_price`, 409 on mismatch |
| **Mass account creation** | Fraud/abuse | Supabase auth rate limits, email verification |

### Medium Risks

| Threat | Impact | Mitigation |
|--------|--------|------------|
| **CSRF** | State-changing without consent | SameSite=Lax cookies, `Authorization` header required |
| **XSS** | Client-side injection | React default escaping, `Content-Security-Policy` (future) |
| **Clickjacking** | UI manipulation | `X-Frame-Options: DENY` (Vercel default) |
| **Info leakage in errors** | Internal details exposed | Generic 500 messages, structured logs |
| **Denial of service** | API overload | Rate limits (in-memory), Vercel DDoS protection |

### Low Risks

| Threat | Impact | Mitigation |
|--------|--------|------------|
| **Timing attacks** | Key/token enumeration | Timing-safe compare for webhook tokens |
| **Log injection** | Log tampering | String interpolation (no user input in log keys) |
| **Dependency vuln** | RCE / data leak | `npm audit` (manual), pin versions |

---

## OWASP Top 10 Mapping

| OWASP | ReBites Mitigation |
|-------|-------------------|
| **A01 Broken Access Control** | RLS on all tables, role checks in API, super admin gate |
| **A02 Cryptographic Failures** | TLS 1.3 (Vercel), Supabase encryption, no plaintext secrets in code |
| **A03 Injection** | Supabase SDK parameterizes queries, Zod-like validation in routes |
| **A04 Insecure Design** | Idempotency keys, state machines, amount validation |
| **A05 Security Misconfiguration** | Service role server-only, webhook token required |
| **A06 Vulnerable Components** | `npm audit` (manual), no known critical vulns in Supabase/Next |
| **A07 Auth Failures** | Supabase Auth (JWT, 1hr TTL), magic link throttling |
| **A08 Data Integrity** | Atomic RPCs, idempotency, admin audit logs |
| **A09 Logging & Monitoring** | Structured logs, admin audit trail, activity logs |
| **A10 SSRF** | Biteship/Xendit call internal APIs only, no user-controlled URLs |

---

## Authentication Security

| Control | Implementation |
|---------|----------------|
| JWT validation | Supabase `getUser(token)` in all API routes |
| Token TTL | 1 hour access, 30 day refresh |
| Cookie security | HttpOnly, Secure (prod), SameSite=Lax |
| OAuth flow | Google (PKCE), state param, callback verification |
| Magic link | `verify-throttle.ts` rate limit, single-use |
| Password reset | Time-limited token, Supabase managed |
| Brute force | Supabase auth rate limit (default: 30/min) |

See [API: Auth & Authorization](../api/auth.md) for details.

---

## Authorization Security

| Control | Implementation |
|---------|----------------|
| RLS policies | All 80+ tables have RLS enabled |
| Role checks | `getAdminUser()` in admin API |
| Ownership check | `user_id = auth.uid()` in RLS |
| Super admin gate | `SUPER_ADMIN_USER_ID` env check for destructive ops |
| Account status | `account_status='active'` required for all API access |
| Service role isolation | Only in `lib/server/`, never in client bundles |

See [Database: RLS Policies](../database/rls-policies.md) for full policy list.

---

## Data Protection

| Data Type | Protection |
|-----------|------------|
| Passwords | Supabase Auth (bcrypt), never in our code |
| PII (name, phone, email) | Encrypted at rest (Supabase Postgres TLS) |
| Address data | Encrypted at rest, sanitized before storage (`sanitizeAddressSnapshot`) |
| Payment info | Xendit handles (we never store card numbers) |
| JWT tokens | In-memory only (HttpOnly cookies), 1hr TTL |
| Admin audit logs | Immutable (no UPDATE/DELETE policies) |
| User activity logs | Append-only |

---

## Webhook Security

| Webhook | Verification | Timing-Safe? | Idempotent? |
|---------|--------------|--------------|-------------|
| Xendit | `X-Callback-Token` compare | ✅ | ✅ (invoice_state) |
| Biteship | `HMAC-SHA256` signature | ✅ | ✅ (shipment_code) |

---

## API Security

| Control | Implementation |
|---------|----------------|
| Input validation | Manual type checks + Supabase RLS |
| Rate limiting | `verifyThrottle` (per-endpoint), support limit (DB-backed) |
| CORS | Vercel default (same-origin) |
| HTTPS | Vercel (TLS 1.3) |
| Headers | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` (Vercel) |
| API keys | Bearer tokens only, no query param secrets |

---

## Database Security

| Control | Implementation |
|---------|----------------|
| RLS | Enabled on all tables |
| Encryption at rest | Supabase Postgres (AES-256) |
| Encryption in transit | TLS 1.2+ (Supabase) |
| Service role | Bypasses RLS, server-only, env var |
| Audit logs | `admin_audit_logs` table (append-only) |
| Activity logs | `activity_logs` table |
| Backup | Supabase PITR (Point-in-Time Recovery) |

---

## Secrets Management

| Secret | Storage | Rotation |
|--------|---------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` / Vercel env | Regenerate in Supabase Dashboard |
| `XENDIT_SECRET_KEY` | `.env.local` / Vercel env | Regenerate in Xendit Dashboard |
| `XENDIT_CALLBACK_TOKEN` | `.env.local` / Vercel env | Random 32+ chars, change quarterly |
| `BITESHIP_API_KEY` | `.env.local` / Vercel env | Regenerate in Biteship Dashboard |
| `BITESHIP_WEBHOOK_SECRET` | `.env.local` / Vercel env | Random 32+ chars, change quarterly |
| `GEMINI_API_KEY` | `.env.local` / Vercel env | Regenerate in Google AI Studio |

**Rules:**
- Never in code, never in logs, never in client bundle
- `.env.local` in `.gitignore`
- CI: GitHub Secrets / Vercel env vars
- No hardcoded fallbacks

See [Security: Secrets Management](./secrets-management.md) for rotation procedures.

---

## Compliance

| Standard | Status | Notes |
|----------|--------|-------|
| PDP (UU No. 27/2022) | Partial | PII collected for orders, no DPO, no data deletion flow |
| PCI DSS | N/A | Xendit handles card data (SAQ-A for us) |
| ISO 27001 | N/A | Not certified |
| SOC 2 | N/A | Not audited |

---

## Security Testing

| Type | Tool | Frequency |
|------|------|-----------|
| SAST | `npx audit`, TypeScript strict | Every build (manual) |
| DAST | `nuclei` | Quarterly |
| Webhook fuzzer | Manual curl | After webhook changes |
| RLS audit | `supabase gen policies` | After schema changes |
| Dependency audit | `npm audit` | Weekly (manual) |

---

## Security Checklist (Pre-Release)

- [ ] All API routes have auth check
- [ ] Service role not in client bundle (grep `SUPABASE_SERVICE_ROLE_KEY` in `.next/`)
- [ ] Webhook tokens configured in production
- [ ] RLS policies match schema (run `supabase gen policies`)
- [ ] No `console.log` with PII in production code
- [ ] `npm audit` shows no critical vulns
- [ ] Supabase `invite_url` configured (admin)
- [ ] Backup tested (PITR restore)

---

## Related Docs

- [Security: Auth & Authorization](./auth-authorization.md) — Deep dive on auth
- [Security: Data Protection](./data-protection.md) — PII handling
- [Security: Input Validation](./input-validation.md) — API input safety
- [Security: Secrets Management](./secrets-management.md) — Key handling & rotation
- [API: Auth & Authorization](../api/auth.md) — Token flows
- [Database: RLS Policies](../database/rls-policies.md) — Policy reference