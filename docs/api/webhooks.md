# Webhooks

> **Implementation:** `app/api/webhooks/xendit/route.ts`, `app/api/webhooks/biteship/route.ts`, `lib/server/checkout-idempotency.ts`, `lib/server/order-settlement.ts`, `lib/server/subscription-activation.ts`

---

## Xendit Webhook

### Endpoint

```
POST /api/webhooks/xendit
```

### Authentication

Header: `X-Callback-Token: <XENDIT_CALLBACK_TOKEN>` (or `XENDIT_WEBHOOK_TOKEN` fallback)

Verified via **timing-safe comparison** (constant-time string compare).

### Payload (Invoice Callback)

```json
{
  "id": "inv_abc123",
  "external_id": "RB-ORD-20250115-A1B2C3",
  "status": "PAID",
  "amount": 50000,
  "paid_amount": 50000,
  "payment_method": "VA",
  "payment_channel": "BCA",
  "payer_email": "buyer@example.com"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Xendit invoice ID |
| `external_id` | string | Our order code (`RB-...`) or subscription code (`SUB-...`) |
| `status` | string | `PAID`, `SETTLED`, `EXPIRED`, `FAILED`, `VOIDED`, `PENDING` |
| `amount` | number | Invoice amount (IDR minor units) |
| `paid_amount` | number | Actual paid amount (may differ for overpay) |
| `payment_method` | string | High-level method (e.g., `VA`, `EWALLET`, `RETAIL_OUTLET`) |
| `payment_channel` | string | Specific channel (e.g., `BCA`, `OVO`, `ALFAMART`) |

### Processing Logic

#### Order Invoices (`external_id` starts with `RB-`)

1. **Fetch order** by `order_code = external_id`
2. **Status transition** based on `normalizedStatus = status.toUpperCase()`:

| Xendit Status | Action |
|---------------|--------|
| `PAID` \| `SETTLED` | Call `settleOrderPaid()` → updates `payment_status=paid`, `order_status=processing`, `invoice_state=paid`, stores `xendit_invoice_id`, `payment_channel`, `paid_amount`. If already paid → idempotent no-op. Then `createBiteshipShipment()` if `delivery_option='delivery'`. |
| `EXPIRED` \| `FAILED` \| `VOIDED` | If `payment_status='unpaid'` → set `payment_status=failed`, `order_status=cancelled`, `invoice_state=failed`. Release promo code usage (`release_promo` RPC). Refund buyer coins (`refund_order_coins` RPC). If already paid → ignore (idempotent). |

3. **Idempotency** — `settleOrderPaid()` uses `invoice_state` column as guard:
   - `unpaid` → `paid` transition allowed once
   - Replay on `paid` returns `{ reason: 'already_paid' }`
   - Amount mismatch → `{ reason: 'amount_mismatch' }` (409)

#### Subscription Invoices (`external_id` starts with `SUB-`)

1. **Fetch subscription** by `subscription_code = external_id`
2. On `PAID`/`SETTLED`: call `activateSubscriptionPaid()` → sets `status=active`, `current_period_start/end`, stores `xendit_invoice_id`.
3. Idempotent via `subscription.status` guard.

### Response

| Scenario | HTTP | Body |
|----------|------|------|
| Success (order) | 200 | `{ "received": true }` |
| Already paid | 200 | `{ "received": true, "already": "paid" }` |
| Order not found | 200 | `{ "received": true, "note": "order not found" }` |
| Amount mismatch | 409 | `{ "error": "Amount mismatch" }` |
| Invalid token | 401 | `{ "error": "Invalid callback token" }` |
| Invalid JSON | 400 | `{ "error": "Invalid JSON" }` |
| Missing amount | 400 | `{ "error": "Missing amount" }` |
| Server misconfigured | 500 | `{ "error": "Server misconfigured" }` |
| DB update failed | 500 | `{ "error": "DB update failed" }` |

**Always return 2xx** to Xendit within 10s to avoid retries. Processing is async-safe.

### Retry & Deduplication

- Xendit retries with exponential backoff (1m, 5m, 15m, 30m, 1h, 3h, 6h, 12h, 24h)
- Our idempotency via `invoice_state` / `subscription.status` makes retries safe
- No separate deduplication table needed

---

## Biteship Webhook

### Endpoint

```
POST /api/webhooks/biteship
```

### Authentication

Header: `X-Biteship-Signature: <hmac_sha256(payload, BITESHIP_WEBHOOK_SECRET)>`

Verified in `lib/server/biteship-shipment.ts` → `verifyBiteshipSignature()`.

### Payload (Shipment Status Update)

```json
{
  "courier_tracking_url": "https://track.biteship.com/...",
  "waybill": "1234567890",
  "courier": "jne",
  "service": "reg",
  "status": "ON_DELIVERY",
  "note": "Kurir sedang mengantarkan",
  "updated_at": "2025-01-15T07:30:00+07:00",
  "order_id": "SHP-20250115-A1B2C3"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `order_id` | string | Our shipment code (matches `orders.shipment_code`) |
| `status` | string | Biteship status (see mapping below) |
| `waybill` | string | Courier tracking number |
| `courier` | string | Courier code (`jne`, `sicepat`, `ninja`, etc.) |
| `service` | string | Service code (`reg`, `yes`, `cargo`) |
| `note` | string | Human status note |
| `updated_at` | string | ISO 8601 timestamp (WIB) |

### Status Mapping

| Biteship Status | Our `shipment_status` | Order `order_status` Transition |
|-----------------|----------------------|----------------------------------|
| `PICKUP_REQUESTED` | `pickup_requested` | — |
| `PICKED_UP` | `picked_up` | `processing` → `out_for_delivery` |
| `ON_DELIVERY` | `on_delivery` | `out_for_delivery` |
| `DELIVERED` | `delivered` | `out_for_delivery` → `completed` (triggers `settleOrderCompleted`) |
| `RETURNED` | `returned` | `out_for_delivery` → `cancelled` (refund) |
| `FAILED` | `failed` | `out_for_delivery` → `cancelled` |
| `CANCELLED` | `cancelled` | `processing` → `cancelled` |
| `EXPIRED` | `expired` | `pickup_requested` → `cancelled` |

### Processing Logic

1. Verify signature
2. Find order by `shipment_code = order_id`
3. Update `shipment_status`, `shipment_updated_at`, `waybill`, `courier_tracking_url`
4. If `status === 'DELIVERED'` and `order_status !== 'completed'`:
   - Call `settleOrderCompleted(orderCode)` → sets `order_status=completed`, `completed_at=now()`, earns buyer coins, releases seller payout hold
5. If `status` in `RETURNED, FAILED, CANCELLED, EXPIRED`:
   - Set `order_status=cancelled`, `payment_status=refunded` (if paid)
   - Trigger refund flow (Xendit refund API — future)

### Response

| Scenario | HTTP | Body |
|----------|------|------|
| Success | 200 | `{ "received": true }` |
| Invalid signature | 401 | `{ "error": "Invalid signature" }` |
| Shipment not found | 200 | `{ "received": true, "note": "shipment not found" }` |
| Server error | 500 | `{ "error": "Internal error" }` |

---

## Webhook Security Checklist

- [ ] `XENDIT_CALLBACK_TOKEN` / `XENDIT_WEBHOOK_TOKEN` set in production env
- [ ] `BITESHIP_WEBHOOK_SECRET` set in production env
- [ ] Timing-safe comparison used (implemented)
- [ ] Idempotent processing via state columns (implemented)
- [ ] 2xx returned within 10s (implemented — minimal sync work)
- [ ] Structured logging for audit (implemented — `console.log` with `[webhook/xendit]` prefix)
- [ ] Alert on webhook failures (TODO: integrate with monitoring)

---

## Local Testing

### Xendit (ngrok)

```bash
ngrok http 3000
# Set XENDIT_WEBHOOK_URL=https://xxx.ngrok-free.app/api/webhooks/xendit in Xendit dashboard
```

### Biteship (ngrok)

```bash
# Set BITESHIP_WEBHOOK_URL=https://xxx.ngrok-free.app/api/webhooks/biteship in Biteship dashboard
```

### Manual curl (Xendit)

```bash
curl -X POST http://localhost:3000/api/webhooks/xendit \
  -H "Content-Type: application/json" \
  -H "X-Callback-Token: $XENDIT_CALLBACK_TOKEN" \
  -d '{"id":"inv_test","external_id":"RB-TEST-123","status":"PAID","amount":50000,"paid_amount":50000,"payment_method":"VA","payment_channel":"BCA"}'
```

---

## Related Docs

- [API Overview](./overview.md)
- [Checkout Idempotency](../features/checkout.md#idempotency--invoice-state-machine)
- [Order Settlement](../features/checkout.md#order-settlement--completion)
- [Integrations: Xendit](../integrations/xendit.md)
- [Integrations: Biteship](../integrations/biteship.md)