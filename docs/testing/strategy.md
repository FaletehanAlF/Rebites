# Testing Strategy

> **Framework:** Node.js built-in test runner (`node --test`)
> **Philosophy:** Test behavior, not implementation. Fast, isolated, deterministic.

---

## Test Pyramid

```
         ┌─────────────┐
         │  E2E (0)    │  ← Future: Playwright
         └──────┬──────┘
        ┌───────┴───────┐
        │ Integration   │  12 suites
        │ (API routes,  │
        │  DB, RPC)     │
        └───────┬───────┘
       ┌────────┴────────┐
       │    Unit (84)    │  Pure functions, state machines,
       │  (96 total)     │  idempotency, pricing, validation
       └────────────────┘
```

---

## Test Categories

### Unit Tests (84 suites, ~25s)

| Module | Suites | Focus |
|--------|--------|-------|
| `order-state-machine` | 12 | Transitions, guards, invalid inputs |
| `checkout-idempotency` | 15 | Key normalization, state transitions, compensation |
| `pricing` | 8 | Fee calc, coin usage, promo, flash sale |
| `shipping-tariff` | 10 | Haversine, road factor, fee tiers |
| `flash-sale` | 7 | Schedule visibility, price selection |
| `subscription-activation` | 6 | Period calc, trial, upgrade |
| `order-settlement` | 8 | Coin earn, payout hold, status sync |
| `catalog-filters` | 6 | Category, price, distance, search |
| `validation` | 5 | Address, weight, coordinates |
| `ai-provider` | 3 | Tool calling, context injection |
| `utils` | 4 | Date, currency, string helpers |

### Integration Tests (12 suites, ~5s)

| Module | Suites | Focus |
|--------|--------|-------|
| `supabase-rpc` | 4 | `reserve_stock`, `release_promo`, `earn_coins` |
| `api-checkout` | 3 | Full checkout flow (mocked Xendit) |
| `api-webhooks` | 3 | Xendit/Biteship webhook handling |
| `auth-flows` | 2 | Login, register, role assignment |

---

## Running Tests

```bash
# All tests
npm test
# or: node --test

# Watch mode
npm run test:watch

# Specific file
node --test tests/checkout-idempotency.test.ts

# Pattern match
node --test --test-name-pattern="idempotency"

# With coverage (experimental)
node --experimental-test-coverage --test
```

---

## Test Structure

### Unit Test Example

```typescript
// tests/checkout-idempotency.test.ts
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { normalizeIdempotencyKey, canTransitionInvoiceState, planKeyedFailureCompensation } from '@/lib/server/checkout-idempotency';

describe('checkout-idempotency', () => {
  describe('normalizeIdempotencyKey', () => {
    it('trims and lowercases', () => {
      assert.equal(normalizeIdempotencyKey('  ABC-123  '), 'abc-123');
      assert.equal(normalizeIdempotencyKey('  '), '');
    });
  });

  describe('canTransitionInvoiceState', () => {
    it('allows unpaid -> paid', () => {
      const result = canTransitionInvoiceState('unpaid', 'paid');
      assert.equal(result.allowed, true);
    });

    it('blocks paid -> unpaid', () => {
      const result = canTransitionInvoiceState('paid', 'unpaid');
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'cannot_regress');
    });

    it('blocks paid -> paid (idempotent)', () => {
      const result = canTransitionInvoiceState('paid', 'paid');
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'already_terminal');
    });
  });
});
```

### Integration Test Example

```typescript
// tests/api-checkout.test.ts
import { createTestSupabaseClient, cleanupTestData } from './helpers/supabase-test';

describe('checkout API', () => {
  let testClient: SupabaseClient;
  let buyerId: string;
  let productId: string;

  beforeEach(async () => {
    testClient = await createTestSupabaseClient();
    // Seed test data
    const { data: buyer } = await testClient.auth.admin.createUser({ email: 'buyer@test.com' });
    buyerId = buyer.user.id;
    const { data: product } = await testClient.from('products').insert({
      umkm_id: '...',
      slug: 'test-product',
      name: 'Test Product',
      surplus_price: 25000,
      stock: 10,
      status: 'available',
      verification_status: 'approved',
      is_delivery: true,
    }).select().single();
    productId = product.id;
  });

  afterEach(async () => {
    await cleanupTestData(testClient, buyerId, productId);
  });

  it('creates order with valid idempotency key', async () => {
    const response = await fetch('http://localhost:3000/api/checkout/xendit', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${buyerToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'test-key-123',
      },
      body: JSON.stringify({
        productSlug: 'test-product',
        quantity: 1,
        fulfillment: 'pickup',
      }),
    });

    assert.equal(response.status, 201);
    const data = await response.json();
    assert.ok(data.data?.order_code?.startsWith('RB-'));
  });
});
```

---

## Test Helpers

### `tests/helpers/supabase-test.ts`

```typescript
export async function createTestSupabaseClient(): Promise<SupabaseClient> {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false } }
  );
}

export async function cleanupTestData(
  client: SupabaseClient,
  buyerId: string,
  productId: string
): Promise<void> {
  await client.from('orders').delete().eq('buyer_id', buyerId);
  await client.from('products').delete().eq('id', productId);
  await client.auth.admin.deleteUser(buyerId);
}
```

### Mock Utilities

```typescript
// tests/helpers/mock-xendit.ts
export function createMockXendit() {
  return {
    createInvoice: async (params) => ({
      id: 'inv_mock',
      external_id: params.externalId,
      amount: params.amount,
      status: 'PENDING',
      invoice_url: 'https://mock.xendit.co/pay/inv_mock',
      expiry_date: new Date(Date.now() + 3600000).toISOString(),
    }),
    getInvoice: async (id) => ({
      id,
      external_id: 'RB-MOCK',
      amount: 25000,
      status: 'PAID',
      paid_amount: 25000,
      payment_method: 'VA',
      payment_channel: 'BCA',
    }),
  };
}
```

---

## CI Integration

### Current State

No CI pipeline configured. Tests run locally via `npm test`.

### Planned CI (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

---

## Test Data Management

| Strategy | Use Case |
|----------|----------|
| In-memory mocks | Unit tests (no DB) |
| Local Supabase | Integration tests (seeded) |
| Test transactions | Rollback after each test (future) |

**Current:** Integration tests use service role on local/test Supabase. Cleanup in `afterEach`.

---

## Coverage Targets

| Layer | Target | Current |
|-------|--------|---------|
| Unit (pure functions) | 90% | ~85% |
| State machines | 95% | ~90% |
| API routes | 60% | ~40% |
| Overall | 70% | ~60% |

**Not tracked** — no coverage reporter configured.

---

## Known Test Issues

| Issue | Impact | Workaround |
|-------|--------|------------|
| One test Windows EOL sensitive | Fails on Windows CI | Run on Linux or fix line endings |
| Integration tests need local Supabase | Can't run without Docker | Use `supabase start` |
| No test DB isolation | Tests can interfere | `cleanupTestData` in `afterEach` |

---

## Adding New Tests

1. Create `tests/<module>.test.ts`
2. Follow existing structure (`describe` → `it`)
3. Use `node:test` + `node:assert`
4. Mock external deps (Xendit, Biteship, AI)
5. Run `npm test` to verify
6. Add to `tests/helpers/` if reusable

---

## Related Docs

- [Testing: Test Catalog](./test-catalog.md) — Full suite list
- [Testing: CI Status](./ci-status.md) — CI pipeline
- [Development: Debugging](../development/debugging.md) — Test debugging
- [Features: Checkout](../features/checkout.md) — Idempotency test cases
- [Engineering: Decisions](../engineering/decisions.md) — Why Node test runner