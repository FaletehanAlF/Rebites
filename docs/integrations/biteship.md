# Biteship Integration

> **Implementation:** `lib/server/biteship.ts` (rates), `lib/server/biteship-shipment.ts` (shipments), `app/api/webhooks/biteship/route.ts`

---

## Role

Biteship is the **logistics/shipping provider** for food delivery in Kota Depok. ReBites also has an internal "ReBites Courier" service (in-house couriers) as a fallback/primary option.

| Service | Use |
|---------|-----|
| `getBiteshipRates()` | Calculate delivery fee before checkout |
| `createBiteshipShipment()` | Create shipment after payment |
| `verifyBiteshipSignature()` | Webhook verification |
| Biteship webhook | Update shipment status (live tracking) |

---

## Configuration

| Env Variable | Description | Required |
|-------------|-------------|----------|
| `BITESHIP_API_KEY` | API key for rates & shipments | ✅ |
| `BITESHIP_COURIERS` | Comma-separated courier codes | Optional |
| `BITESHIP_WEBHOOK_SECRET` | HMAC secret for webhook verification | ✅ |
| `REBITES_COURIER_CODE` | ReBites internal courier code (default: `rebites`) | Built-in |
| `REBITES_SERVICE_CODE` | ReBites service code (default: `standard`) | Built-in |
| `REBITES_COURIER_NAME` | Display name (default: "ReBites Courier") | Built-in |
| `REBITES_SERVICE_NAME` | Display service name (default: "Standard") | Built-in |

---

## Shipping Rates

### `getBiteshipRates(payload)` — `lib/server/biteship.ts`

```typescript
interface BiteshipRatesPayload {
  origin_postal_code: number;
  destination_postal_code: number;
  couriers: string;        // "jne,sicepat,ninja"
  items: BiteshipRateItem[];
  origin_latitude?: number;
  origin_longitude?: number;
  destination_latitude?: number;
  destination_longitude?: number;
}
```

**Request:**
```
POST https://api.biteship.com/v1/rates/couriers
Authorization: <BITESHIP_API_KEY>
```

**Response:**
```json
{
  "success": true,
  "pricing": [
    {
      "courier_code": "jne",
      "courier_service_code": "reg",
      "price": 15000,
      "duration": "1-2 hari",
      "service_type": "standard"
    }
  ]
}
```

### Fallback: Local Tariff Calculation

When Biteship API fails or no couriers configured, ReBites uses **local haversine-based calculation**:

```typescript
// lib/shipping-tariff.ts
const straightKm = haversineKm(origin, destination);
const roadKm = estimateRoadDistanceKm(straightKm);  // * 1.3 factor
const fee = calculateDeliveryFee(roadKm);          // Rp 500/km + Rp 5000 base
const travelMinutes = calculateTravelMinutes(roadKm); // 15 min base + 2 min/km
```

**ReBites Courier** (in-house) always available — no external API needed.

### Rate Errors

```typescript
export function classifyBiteshipRatesError(rawMessage: string): BiteshipRatesErrorInfo | null
```

| Error Pattern | Code | Message |
|---------------|------|---------|
| "insufficient balance" / "saldo" | `provider_balance` | Top up Biteship account |
| "rate limit" / "quota" | `provider_quota` | Retry later |
| Other | null | Generic error |

---

## Shipment Creation

### `createBiteshipShipment(orderCode)` — `lib/server/biteship-shipment.ts`

Called from Xendit webhook on `PAID`/`SETTLED` if `delivery_option='delivery'`.

```typescript
interface CreateShipmentResult {
  ok: boolean;
  status?: 'created' | 'existing' | 'skipped' | 'failed';
  reason?: string;
  shipmentCode?: string;
}
```

**Flow:**
1. Fetch order + buyer address
2. Build Biteship shipment payload (origin = store, destination = buyer)
3. `POST https://api.biteship.com/v1/shipments`
4. Store `shipment_code`, `waybill`, `courier_tracking_url` on order
5. Return result (non-blocking — shipment failure doesn't block order)

**Idempotency:** If `shipment_code` already exists → `{ status: 'existing' }`.

---

## Webhook Processing

### `POST /api/webhooks/biteship`

**Auth:** `X-Biteship-Signature: HMAC-SHA256(body, BITESHIP_WEBHOOK_SECRET)`

See [API: Webhooks](../api/webhooks.md#biteship-webhook) for status mapping.

**Key transitions:**

| Biteship Status | Our `shipment_status` | Order Effect |
|-----------------|----------------------|--------------|
| `PICKED_UP` | `picked_up` | `processing` → `out_for_delivery` |
| `DELIVERED` | `delivered` | `out_for_delivery` → `completed` + coin earn |
| `RETURNED`/`FAILED` | `returned`/`failed` | `out_for_delivery` → `cancelled` + refund |

---

## Courier Dashboard (Internal)

ReBites has an internal courier system (separate from Biteship couriers):

| Endpoint | Description |
|----------|-------------|
| `POST /api/courier/assignments` | Assign delivery to in-house courier |
| `POST /api/courier/assignments/[id]/accept` | Courier accepts |
| `POST /api/courier/assignments/[id]/pickup` | Picked up |
| `POST /api/courier/assignments/[id]/deliver` | Delivered |
| `POST /api/courier/location` | Push live GPS |
| `GET /api/delivery/route` | Route geometry (polyline) |

In-house couriers use `courier_code='rebites'` in `orders` table.

---

## Error Handling

| Scenario | Response |
|----------|----------|
| Biteship API timeout (10s) | Throw `Biteship timeout (10s) - coba lagi` |
| Balance insufficient | `provider_balance` code → show "top up needed" |
| Rate limit | `provider_quota` → show "try again later" |
| Webhook invalid signature | 401, log warning |
| Shipment creation fails | Log, non-blocking (order stays `processing`) |

---

## Local Development

```env
BITESHIP_API_KEY=test_key
BITESHIP_COURIERS=jne,sicepat
BITESHIP_WEBHOOK_SECRET=test_secret
```

Biteship has a sandbox mode. Without API key, fallback to local tariff calculation (ReBites Courier only).

---

## Monitoring

| Metric | Alert |
|--------|-------|
| Biteship API 5xx | Provider down |
| Shipment creation failures > 5/hour | Investigate |
| Webhook signature failures | Secret mismatch / attack |
| `provider_balance` errors | Top up Biteship account |

Log prefixes: `[biteship]`, `[webhook/biteship]`, `[checkout/xendit]` (for shipment creation)

---

## Related Docs

- [API: Webhooks](../api/webhooks.md#biteship-webhook) — Webhook details
- [API: Shipping Rates](../api/overview.md#catalog--products) — Rate endpoint
- [Features: Courier Dashboard](../features/courier-dashboard.md) — Internal courier
- [Features: Checkout](../features/checkout.md) — Post-payment shipment
- [Integrations: Xendit](../integrations/xendit.md) — Payment trigger