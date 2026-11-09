# Xendit Integration

> **Implementation:** `lib/server/xendit.ts`, `app/api/checkout/xendit/route.ts`, `app/api/webhooks/xendit/route.ts`, `lib/server/checkout-idempotency.ts`, `lib/server/order-settlement.ts`, `lib/server/subscription-activation.ts`

---

## Role

Xendit is the **primary payment processor** for:
- Buyer orders (food purchases)
- Seller subscriptions (monthly/annual plans)

Replaces legacy Midtrans integration.

---

## Configuration

| Env Variable | Description | Required |
|-------------|-------------|----------|
| `XENDIT_SECRET_KEY` | API secret (Basic auth) | ✅ |
| `XENDIT_CALLBACK_TOKEN` | Webhook verification token | ✅ |
| `XENDIT_WEBHOOK_TOKEN` | Fallback webhook token (if above not set) | Optional |
| `XENDIT_TEST_MODE` | `true` for sandbox | Optional |

**Security:** `XENDIT_SECRET_KEY` is server-only. Never in client bundle.

---

## Invoice Creation

### `createXenditInvoice(params)` — `lib/server/xendit.ts`

```typescript
interface CreateInvoiceParams {
  externalId: string;        // "RB-ORD-20250115-A1B2C3" or "SUB-..."
  amount: number;            // IDR minor units
  payerEmail: string | null;
  description: string;
  successRedirectUrl: string;
  failureRedirectUrl: string;
  customerName?: string;
}
```

**Request to Xendit:**
```
POST https://api.xendit.co/v2/invoices
Authorization: Basic base64(XENDIT_SECRET_KEY:)
```

**Response:**
```json
{
  "id": "inv_abc123",
  "external_id": "RB-ORD-20250115-A1B2C3",
  "amount": 50000,
  "status": "PENDING",
  "invoice_url": "https://invoicing.xendit.co/pay/abc123",
  "expiry_date": "2025-01-15T08:23:11Z"
}
```

- `invoice_duration`: 3600 seconds (1 hour)
- `currency`: `IDR`

### Invoice Fetching

```typescript
export async function getXenditInvoice(invoiceId: string): Promise<XenditInvoice & {
  payment_method?: string;
  payment_channel?: string;
}>
```

- `GET https://api.xendit.co/v2/invoices/{invoiceId}`
- Used in `/api/checkout/xendit/verify` to check payment status

---

## Payment Flow

### Buyer Order

```
┌──────────┐     ┌───────────────┐     ┌──────────────┐
│  Buyer   │────▶│ POST /api/    │────▶│ Xendit API   │
│  Clicks  │     │ checkout/xendit│     │ Create Invoi-│
│  Pay     │     │               │     │ ce           │
└──────────┘     └───────────────┘     └──────────────┘
                              │                  │
                              ▼                  ▼
                       Order row created   invoice_url returned
                       (payment=unpaid)   to client
                              │
                              ▼
                    Buyer opens invoice_url
                    (pays via VA, e-wallet,
                     retail outlet)
                              │
                              ▼
                    Xendit webhook → POST /api/webhooks/xendit
                              │
                              ▼
                    settleOrderPaid() → order_status=processing
                              │
                              ▼
                    createBiteshipShipment() (if delivery)
```

### Seller Subscription

Same flow, `external_id` = `SUB-{umkm_id}-{plan_id}-{timestamp}`.

On `PAID`: `activateSubscriptionPaid()` → subscription becomes active.

---

## Webhook Processing

See [API: Webhooks](../api/webhooks.md#xendit-webhook) for full details.

### Key Guards

1. **Token verification** — timing-safe compare `X-Callback-Token`
2. **Idempotency** — `invoice_state` column prevents double-settle
3. **Amount validation** — `paid_amount` must match `order.total_price`
4. **State machine** — `unpaid → paid → failed` (terminal states)

### `invoice_state` Column

```sql
ALTER TABLE orders ADD COLUMN invoice_state TEXT;
-- Values: 'pending', 'paid', 'failed', 'refunded'
```

| State | Transition |
|-------|------------|
| `pending` | → `paid` (webhook PAID/SETTLED) |
| `pending` | → `failed` (webhook EXPIRED/FAILED/VOIDED) |
| `paid` | → `refunded` (admin refund action) |
| `failed` | → `pending` (buyer retry, new invoice) |

---

## Payment Methods (Xendit-supported)

| Method | Channel | Typical Use |
|--------|---------|-------------|
| Virtual Account (VA) | BCA, Mandiri, BNI, BRI, BSI | Most common |
| E-Wallet | OVO, GoPay, DANA, LinkAja | Mobile |
| Retail Outlet | Alfamart, Alfamidi, Indomaret, Tokopedia | Offline |
| Card | VISA, Mastercard, JCB | International |
| QRIS | QR scan | Mobile |

Xendit handles all channels; ReBites is method-agnostic.

---

## Fee Structure

| Component | Who Bears | Amount |
|-----------|-----------|--------|
| Xendit processing fee | ReBites (platform) | ~2.4% + fixed per method |
| Delivery fee | Buyer | Calculated via Biteship |
| Service fee | ReBites (platform) | % of order value |

Fees not in `total_price` for buyer — `total_price` = `subtotal + discount + delivery_fee + service_fee`.

---

## Error Handling

### `classifyInvoiceError(error)` — `lib/server/checkout-idempotency.ts`

| Xendit Error | Classification | Action |
|--------------|----------------|--------|
| 400 (validation) | `validation` | Return 400 to user |
| 401 (auth) | `auth` | 500 (server config issue) |
| 402 (insufficient funds) | `insufficient_funds` | 400 to user |
| 429 (rate limit) | `rate_limited` | Retry with backoff |
| 5xx (Xendit down) | `unavailable` | 503 to user |
| Timeout | `timeout` | Retry once, then 504 |

### `classifyOrderWriteError(error)`

| DB Error | Classification | Action |
|----------|----------------|--------|
| `relation does not exist` | `schema_error` | 500 (migration needed) |
| `duplicate key` | `duplicate` | 409 |
| RLS violation | `rls_violation` | 500 (should use service role) |

---

## Testing

### Sandbox

- `XENDIT_TEST_MODE=true`
- Xendit test secret key
- Webhook via ngrok

### Unit Tests

- `tests/xendit-mock.test.ts` — Invoice creation mocking
- `tests/checkout-idempotency.test.ts` — State machine transitions
- `tests/order-settlement.test.ts` — Settlement logic

### E2E

- Manual: create order → open invoice URL → pay in sandbox → verify webhook

---

## Local Development

```env
# .env.local
XENDIT_SECRET_KEY=xst_public_xxx  # test key
XENDIT_CALLBACK_TOKEN=test_callback_token
XENDIT_WEBHOOK_URL=http://localhost:3000/api/webhooks/xendit
```

Xendit supports **webhook simulator** in dashboard: "Simulate Webhook" → triggers callback.

---

## Migration from Midtrans

| Aspect | Midtrans (legacy) | Xendit (current) |
|--------|-------------------|------------------|
| Invoice API | `POST /v2/invoices` | `POST /v2/invoices` (similar) |
| Webhook | `POST /webhooks/midtrans` | `POST /api/webhooks/xendit` |
| Auth | Server key (query param) | Basic auth (secret key) |
| Test mode | `merchantId` sandbox | Test secret key |
| Integration code | `lib/server/midtrans.ts` (removed) | `lib/server/xendit.ts` |

All Midtrans references removed from codebase. No migration path needed (data is order-based, not payment-provider-based).

---

## Monitoring

| Metric | Alert |
|--------|-------|
| Xendit API 5xx rate > 1% | Xendit down / our misconfig |
| Webhook failures > 10/min | Xendit retry storm |
| Amount mismatch events > 5/day | Data inconsistency |
| `invoice_state` stuck at `pending` > 2 hours | Webhook not received |

Log prefixes: `[checkout/xendit]`, `[webhook/xendit]`, `[xendit]`

---

## Related Docs

- [API: Webhooks](../api/webhooks.md#xendit-webhook) — Webhook payload & processing
- [API: Auth](../api/auth.md) — Token verification
- [Features: Checkout](../features/checkout.md) — Full checkout flow
- [Features: Subscriptions](../features/subscriptions.md) — Subscription payments
- [Integrations: Biteship](../integrations/biteship.md) — Post-payment shipment
- [Security: Secrets Management](../security/secrets-management.md) — Key rotation