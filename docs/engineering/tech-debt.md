# Tech Debt

> **Known issues, shortcuts, and deferred work**

---

## High Priority

| Item | Description | Impact | Effort |
|------|-------------|--------|--------|
| **ESLint skipped in build** | `next build` doesn't run ESLint | Lint errors ship to prod | Low (1 PR) |
| **Image path mismatch** | DB stores `.jpeg`/`.webp`, files are `.avif` | Runtime normalization needed | Medium (DB migration) |
| **No CI/CD pipeline** | Manual deploy, no automated tests | Slow, error-prone deploys | Medium (1-2 days) |
| **In-memory rate limiting** | `verifyThrottle` doesn't work multi-instance | Inconsistent limits at scale | Medium (Redis) |

### ESLint Fix

```javascript
// next.config.js
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false,  // Change from true → false
  },
};
```

**Impact:** Build fails on lint errors (good). Need to fix all existing lint warnings first.

### Image Path Migration

```sql
-- One-time migration
UPDATE products SET image_url = replace(image_url, '.jpeg', '.avif') WHERE image_url LIKE '%.jpeg';
UPDATE products SET image_url = replace(image_url, '.webp', '.avif') WHERE image_url LIKE '%.webp';
```

**After migration:** Remove `normalizeImagePath` fallback.

---

## Medium Priority

| Item | Description | Impact | Effort |
|------|-------------|--------|--------|
| **Transparency artifacts** | `makanan2.avif`, `makanan5.avif` have PNG-like transparency issues | Visual quality | Low (re-export) |
| **No coverage reporting** | Tests run but no % coverage tracked | Unknown gaps | Low (add `--experimental-test-coverage`) |
| **Windows EOL test** | One test sensitive to CRLF | CI on Windows fails | Low (fix line endings) |
| **No feature flags** | Hard to disable broken features in prod | Rollback risk | Medium |
| **No structured logging** | `console.log` with key-value, not JSON | Log aggregation hard | Medium |
| **Manual DB migrations** | No automated migration runner in CI | Schema drift risk | Medium |

### Coverage Reporting

```bash
# Quick win
node --experimental-test-coverage --test
# Output: coverage/ directory with lcov
# Add to CI: check > 70% threshold
```

---

## Low Priority

| Item | Description | Impact | Effort |
|------|-------------|--------|--------|
| **Service area static** | Kota Depok hardcoded on category pages | No multi-city support | High |
| **No email notifications** | Only in-app notifications | User engagement | Medium |
| **No referral system** | Growth limited | Organic growth slower | Medium |
| **No review system** | Orders don't have ratings/reviews | Trust building | Medium |
| **No refund API** | Xendit refund not wired | Admin must refund manually | Medium |
| **No bulk product import** | Sellers add products one by one | Seller friction | Medium |
| **No multi-tenant courier** | Single courier fleet model | Scale limitation | High |
| **No i18n** | Indonesian only | Market expansion | High |

---

## Security Tech Debt

| Item | Risk | Priority |
|------|------|----------|
| No SAST in CI | Vuln in code ships | Medium |
| No dependency audit automation | Supply chain risk | Medium |
| No CSP headers | XSS surface | Low (React mitigates) |
| No audit of RLS policies quarterly | Policy drift risk | Low |
| No PDP data deletion flow | Compliance gap | Low (until PDP enforcement) |
| Webhook replay protection | Duplicate processing | Low (idempotency handles) |

---

## Architecture Tech Debt

| Item | Description | When to Fix |
|------|-------------|-------------|
| **No event bus** | Webhooks use direct API calls | When > 5 external integrations |
| **No worker queue** | Long ops (CSV export, bulk updates) run synchronously | When exports > 10s |
| **No read replicas** | All queries hit primary | When read QPS > 500 |
| **No caching layer** | No Redis/Vercel KV | When DB queries become bottleneck |
| **No feature store** | All features computed in real-time | When ML features needed |
| **Monolith boundary** | `lib/server/` growing (25 modules) | When team > 5 |

### `lib/server/` Growth

Current: 25 modules, ~15,000 lines. Split candidates:

| Sub-module | Modules | When |
|-----------|---------|------|
| `lib/server/payments/` | xendit.ts, checkout-idempotency.ts, order-settlement.ts | When payment logic changes frequently |
| `lib/server/logistics/` | biteship.ts, biteship-shipment.ts, courier-history.ts | When multiple couriers added |
| `lib/server/ai/` | ai-provider.ts, gemini.ts, courier-ai.ts | When second AI provider added |
| `lib/server/admin/` | account-ban.ts, admin-export.ts | When admin features grow |

---

## Test Tech Debt

| Item | Status | Fix |
|------|--------|-----|
| No E2E tests | 0 Playwright tests | Add critical path tests (checkout, login) |
| No visual regression | 0 screenshots | Add Chromatic or percy |
| No load tests | No k6/jmeter | Add for catalog + checkout |
| Integration tests need local Supabase | Docker dependency | Use testcontainers |
| No mocking framework | Manual mocks | Add MSW (Mock Service Worker) for API tests |

---

## Documentation Tech Debt

| Item | Status | Fix |
|------|--------|-----|
| API docs in features only | No dedicated endpoint docs | ✅ Created `docs/api/` |
| No ADRs | Decisions implicit | ✅ `docs/engineering/decisions.md` |
| No runbook for common ops | Admins guess | ✅ `docs/operations/admin-operations.md` |
| No PDP compliance doc | Partial | ✅ `docs/security/data-protection.md` |
| No disaster recovery plan | PITR only | Document in `docs/operations/` |

---

## Tracking

### Backlog Format

```markdown
## Debt Item: [Name]
**Priority:** High/Medium/Low
**Impact:** [User/Performance/Security]
**Effort:** S/M/L (or estimate in hours)
**Assigned:** @name
**Created:** YYYY-MM-DD
**Updated:** YYYY-MM-DD

### Context
[Why this is tech debt]

### Fix Plan
[Steps to resolve]

### Acceptance Criteria
- [ ] [Checkable criteria]
```

### Review Cadence

- **Weekly:** Triage new items during standup
- **Sprint start:** Assign high-priority items
- **Quarterly:** Architecture review (split decision)

---

## Related Docs

- [Engineering: Code Organization](./code-organization.md) — Module structure
- [Engineering: Performance](./performance.md) — Perf issues
- [Testing: Strategy](../testing/strategy.md) — Test gaps
- [Operations: Incident Response](../operations/incident-response.md) — Ops debt
- [Architecture: Overview](../architecture/overview.md) — System context