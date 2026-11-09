# Test Catalog

> **Auto-generated from:** `tests/` directory (96 test suites)
> **Run:** `npm test` or `node --test`

---

## Unit Tests (84 suites)

### Order State Machine (`order-state-machine.test.ts`)

| Test | Description |
|------|-------------|
| `transition: pending → paid` | Valid payment transition |
| `transition: paid → processing` | Order confirmed |
| `transition: processing → ready_for_pickup` | Seller ready |
| `transition: ready_for_pickup → out_for_delivery` | Courier pickup |
| `transition: out_for_delivery → completed` | Delivery confirmed |
| `transition: any → cancelled` | Cancellation from any state |
| `transition: paid → refunded` | Refund flow |
| `guard: blocks invalid` | e.g., `cancelled → paid` |
| `guard: blocks regression` | e.g., `completed → processing` |
| `concurrent: same state` | Idempotent transition |
| `edge: cancelled from pending` | No payment needed |
| `edge: refunded from paid` | Post-completion refund |

### Checkout Idempotency (`checkout-idempotency.test.ts`)

| Test | Description |
|------|-------------|
| `normalize: trims whitespace` | ` " KEY " → "key"` |
| `normalize: lowercases` | `"ABC" → "abc"` |
| `normalize: empty returns empty` | `"" → ""` |
| `state: unpaid → paid allowed` | Normal payment |
| `state: unpaid → failed allowed` | Expiry/failure |
| `state: paid → paid blocked` | Idempotent replay |
| `state: paid → failed blocked` | Can't fail after paid |
| `state: failed → paid allowed` | Retry payment |
| `compensation: reserve_fail` | Release stock on reserve fail |
| `compensation: invoice_fail` | Release promo on invoice fail |
| `compensation: write_fail` | Idempotency key replay |
| `replay: classify` | Detects replay vs new request |
| `keyed_failure: phase_reserve` | Failure during stock reserve |
| `keyed_failure: phase_invoice` | Failure during Xendit call |
| `keyed_failure: phase_write` | Failure during DB write |

### Pricing (`pricing.test.ts`)

| Test | Description |
|------|-------------|
| `calc: subtotal = unit * qty` | Basic multiplication |
| `calc: discount from promo` | Percentage off |
| `calc: service_fee = 5% subtotal` | Platform fee |
| `calc: delivery_fee from tariff` | Distance-based |
| `calc: coin usage ≤ 50%` | Max coin redemption |
| `calc: coin earn = 1% total` | Loyalty reward |
| `calc: flash price overrides` | Time-window pricing |
| `edge: zero delivery for pickup` | No shipping fee |

### Shipping Tariff (`shipping-tariff.test.ts`)

| Test | Description |
|------|-------------|
| `haversine: Jakarta → Depok` | ~15 km |
| `haversine: same point` | 0 km |
| `road_factor: 1.3 multiplier` | Straight → road distance |
| `fee: tier 0-2km = 5000` | Base fee |
| `fee: tier 2-5km = 7000` | +2000 |
| `fee: tier 5-10km = 10000` | +5000 |
| `fee: tier 10-20km = 15000` | +10000 |
| `fee: >20km = 20000` | Cap |
| `travel: 15min base + 2min/km` | Time estimate |
| `coords: invalid returns null` | Validation |

### Flash Sale (`flash-sale.test.ts`)

| Test | Description |
|------|-------------|
| `schedule: visible in window` | Start < now < end |
| `schedule: hidden before start` | now < start |
| `schedule: hidden after end` | now > end |
| `schedule: null dates = always visible` | No schedule = always on |
| `price: flash overrides surplus` | Flash price used when active |
| `price: flash inactive = surplus` | Fallback to regular |
| `timezone: WIB used for comparison` | Asia/Jakarta |

### Subscription Activation (`subscription-activation.test.ts`)

| Test | Description |
|------|-------------|
| `activate: trial → active` | First payment |
| `activate: expired → active` | Renewal |
| `period: monthly = 30 days` | Period calc |
| `period: yearly = 365 days` | Period calc |
| `upgrade: immediate prorate` | Plan change |
| `cancel: end of period` | Graceful expiry |

### Order Settlement (`order-settlement.test.ts`)

| Test | Description |
|------|-------------|
| `settle: paid → processing` | Payment confirmed |
| `settle: amount mismatch` | Reject if paid ≠ total |
| `complete: delivered → completed` | Courier confirms |
| `complete: earn coins` | 1% of total |
| `complete: payout hold release` | Seller gets funds |
| `cancel: unpaid → failed` | No stock release needed |
| `cancel: paid → refunded` | Refund flow |
| `retry: new invoice` | Failed → pending |

### Catalog Filters (`catalog-filters.test.ts`)

| Test | Description |
|------|-------------|
| `filter: category exact match` | Category filter |
| `filter: price range` | min/max surplus_price |
| `filter: distance ≤ X km` | Haversine + road factor |
| `filter: search in name/description` | ILIKE query |
| `sort: price asc/desc` | Ordering |
| `sort: newest first` | created_at desc |

### Validation (`validation.test.ts`)

| Test | Description |
|------|-------------|
| `address: postal code 5 digits` | Regex `^[0-9]{5}$` |
| `address: coordinates in range` | lat -90..90, lng -180..180 |
| `weight: grams positive integer` | `resolvePackageWeightGram` |
| `distance: km positive number` | `parseDistanceKm` |
| `promo: code uppercase` | Normalization |

### AI Provider (`ai-provider.test.ts`)

| Test | Description |
|------|-------------|
| `provider: calls generateContent` | API call shape |
| `tools: executes search_products` | Tool calling loop |
| `context: injects buyer profile` | Message construction |

### Utils (`utils.test.ts`)

| Test | Description |
|------|-------------|
| `format: currency IDR` | `formatCurrency(25000) → "Rp 25.000"` |
| `format: distance km` | `formatDistance(5.3) → "5.3 km"` |
| `date: WIB format` | `formatWIB(new Date()) → "15 Jan 2025 14:30"` |
| `string: slugify` | `slugify("Nasi Goreng") → "nasi-goreng"` |

---

## Integration Tests (12 suites)

### Supabase RPC (`supabase-rpc.test.ts`)

| Test | Description |
|------|-------------|
| `reserve_stock: atomic decrement` | Stock - qty, marker set |
| `release_stock: marker cleared` | Stock + qty, marker removed |
| `release_promo: usage count -1` | Promo code release |
| `earn_coins: buyer balance +1%` | Coin reward |

### API Checkout (`api-checkout.test.ts`)

| Test | Description |
|------|-------------|
| `POST /checkout/xendit: valid order` | 201 + invoice_url |
| `POST /checkout/xendit: idempotent` | Same key → same order |
| `POST /checkout/xendit: insufficient stock` | 400 |

### API Webhooks (`api-webhooks.test.ts`)

| Test | Description |
|------|-------------|
| `POST /webhooks/xendit: PAID → paid` | Order settled |
| `POST /webhooks/xendit: EXPIRED → failed` | Order cancelled |
| `POST /webhooks/biteship: DELIVERED → completed` | Order completed |

### Auth Flows (`auth-flows.test.ts`)

| Test | Description |
|------|-------------|
| `register: buyer role` | Profile + buyer role |
| `register: seller role` | Profile + umkm + umkm_profile |

---

## Running Specific Tests

```bash
# By file
node --test tests/checkout-idempotency.test.ts

# By name pattern
node --test --test-name-pattern="idempotency"
node --test --test-name-pattern="pricing"

# By describe block
node --test --test-name-pattern="checkout-idempotency/normalize"

# Verbose
node --test --reporter=spec
```

---

## Test Metadata

| Metric | Value |
|--------|-------|
| Total suites | 96 |
| Unit suites | 84 |
| Integration suites | 12 |
| Approx. runtime | 30 seconds |
| Framework | Node.js built-in (`node --test`) |
| Assertion | `node:assert` |
| Mocking | Manual (no library) |
| Test DB | Local Supabase (integration only) |

---

## Related Docs

- [Testing: Strategy](./strategy.md) — Architecture, philosophy
- [Testing: CI Status](./ci-status.md) — CI pipeline
- [Features: Checkout](../features/checkout.md) — Idempotency logic tested
- [Database: Functions](../database/functions.md) — RPCs under test