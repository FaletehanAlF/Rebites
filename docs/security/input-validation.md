# Input Validation

> **Implementation:** Manual validation in API routes, `lib/location-validation.ts`, `lib/verify-throttle.ts`

---

## Validation Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Transport (HTTPS, Vercel)                        │
│  - TLS 1.3, HSTS, CSP (Vercel defaults)                    │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Middleware                                        │
│  - Auth check (middleware.ts)                               │
│  - Rate limiting (verifyThrottle per-endpoint)              │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: API Route Handler                                 │
│  - JSON parse (catch null)                                  │
│  - Required fields                                          │
│  - Type checks (typeof, Number.isFinite)                    │
│  - Range/enum validation                                    │
│  - Business logic checks (stock, schedule, ownership)       │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Database (RLS + Constraints)                     │
│  - NOT NULL, CHECK constraints                              │
│  - Foreign keys                                             │
│  - RLS policies                                             │
│  - RPC functions with SECURITY DEFINER                     │
└─────────────────────────────────────────────────────────────┘
```

---

## API Route Validation Patterns

### 1. Auth Check (Always First)

```typescript
const user = await getUserFromBearer(req.headers.get('authorization'));
if (!user) {
  return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
}
```

### 2. JSON Parse with Fallback

```typescript
const body = await req.json().catch(() => null) as RequestBody | null;
if (!body) {
  return NextResponse.json({ error: 'Body harus JSON valid.', code: 'invalid_json' }, { status: 400 });
}
```

### 3. Required Fields

```typescript
if (!body?.productSlug || !body.quantity || !body.fulfillment) {
  return NextResponse.json(
    { error: 'Payload tidak lengkap.', code: 'payload_incomplete' },
    { status: 400 }
  );
}
```

### 4. Type & Range Checks

```typescript
const quantity = Math.floor(body.quantity);
if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
  return NextResponse.json({ error: 'Quantity tidak valid.', code: 'quantity_invalid' }, { status: 400 });
}

if (body.fulfillment !== 'delivery' && body.fulfillment !== 'pickup') {
  return NextResponse.json({ error: 'fulfillment harus delivery atau pickup.', code: 'fulfillment_invalid' }, { status: 400 });
}
```

### 5. Business Logic Validation

```typescript
// Stock check
const { data: product } = await anon.from('products').select('stock, status').eq('slug', productSlug).single();
if ((product.stock ?? 0) < quantity) {
  return NextResponse.json({ error: 'Stok tidak mencukupi.', code: 'insufficient_stock' }, { status: 400 });
}

// Schedule check
if (!isMenuScheduleVisible({ scheduledStart: product.scheduled_start, scheduledEnd: product.scheduled_end })) {
  return NextResponse.json({ error: 'Menu belum tayang/jadwal berakhir.', code: 'product_not_scheduled' }, { status: 400 });
}
```

### 6. Address Sanitization

```typescript
const { snapshot, error } = sanitizeAddressSnapshot(body.addressSnapshot);
if (error || !snapshot) {
  return NextResponse.json({ error: error ?? 'Alamat tidak valid.', code: 'address_invalid' }, { status: 400 });
}
// snapshot is now safe: stripped unknown fields, validated structure
```

### 7. Coordinate Validation

```typescript
function isValidCoordinatePair(lat: unknown, lng: unknown): boolean {
  const latitude = typeof lat === 'number' ? lat : Number(lat);
  const longitude = typeof lng === 'number' ? lng : Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
         latitude >= -90 && latitude <= 90 &&
         longitude >= -180 && longitude <= 180;
}
```

---

## Validation Helpers

### `lib/location-validation.ts`

```typescript
export function parseDistanceKm(value: unknown): number | null {
  if (value == null) return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

export function sanitizeAddressSnapshot(raw: unknown): { snapshot: AddressSnapshot | null; error: string | null } {
  if (!raw || typeof raw !== 'object') return { snapshot: null, error: 'Address snapshot required' };
  const obj = raw as Record<string, unknown>;
  
  // Only allow known fields, strip unknown
  const allowed = ['addressId', 'label', 'receiverName', 'phone', 'province', 'city', 'district', 'fullAddress', 'note', 'postalCode', 'latitude', 'longitude'];
  const snapshot: Partial<AddressSnapshot> = {};
  
  for (const key of allowed) {
    if (obj[key] !== undefined && obj[key] !== null) {
      // Type check each
      if (typeof obj[key] === 'string' || typeof obj[key] === 'number') {
        (snapshot as Record<string, unknown>)[key] = obj[key];
      }
    }
  }
  
  if (!snapshot.addressId) return { snapshot: null, error: 'addressId required' };
  
  return { snapshot: snapshot as AddressSnapshot, error: null };
}
```

### `lib/verify-throttle.ts` (Rate Limiting)

```typescript
export async function verifyThrottle(key: string, limit: number, windowMs: number): Promise<ThrottleResult> {
  const now = Date.now();
  const entry = throttleMap.get(key);
  
  if (!entry || now > entry.resetAt) {
    throttleMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetMs: now + windowMs };
  }
  
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetMs: entry.resetAt };
  }
  
  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetMs: entry.resetAt };
}
```

---

## Security-Specific Validation

### Idempotency Key Normalization

```typescript
export function normalizeIdempotencyKey(raw: string | null): string {
  if (!raw) return '';
  return raw.trim().toLowerCase().slice(0, 64); // Max 64 chars
}
```

### Xendit Callback Token (Timing-Safe)

```typescript
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Used in /api/webhooks/xendit
if (!timingSafeEqual(token, expected)) {
  return NextResponse.json({ error: 'Invalid callback token' }, { status: 401 });
}
```

### Biteship Webhook Signature (HMAC-SHA256)

```typescript
// In lib/server/biteship-shipment.ts
export function verifyBiteshipSignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return timingSafeEqual(signature, expected);
}
```

### Promo Code Normalization

```typescript
const code = String(body.promoCode).trim().toUpperCase();
if (code) {
  const { data: promoRow } = await anon
    .from('promo_codes')
    .select('code, percent_off, is_valid, expires_at, max_uses, used_count')
    .eq('code', code)
    .single();
  // ...
}
```

---

## Validation Error Responses

| Scenario | HTTP | Code | Message (Indonesian) |
|----------|------|------|---------------------|
| No auth header | 401 | `unauthorized` | Unauthorized. Silakan login ulang. |
| Invalid token | 401 | `unauthorized` | Unauthorized. Silakan login ulang. |
| Not JSON | 400 | `invalid_json` | Body harus JSON valid. |
| Missing required | 400 | `payload_incomplete` | Payload tidak lengkap. |
| Wrong type/range | 400 | `quantity_invalid` | Quantity tidak valid. |
| Invalid enum | 400 | `fulfillment_invalid` | fulfillment harus delivery atau pickup. |
| Stock insufficient | 400 | `insufficient_stock` | Stok tidak mencukupi. |
| Product unavailable | 400 | `product_unavailable` | Produk tidak tersedia. |
| Address invalid | 400 | `address_invalid` | Alamat pengiriman tidak valid. |
| Coordinates missing | 400 | `dest_coordinates_missing` | Koordinat alamat tujuan belum tersedia. |
| Rate limited | 429 | `rate_limited` | Terlalu banyak permintaan. Coba lagi dalam X detik. |
| Promo invalid | 400 | `promo_invalid` | Kode promo tidak valid/berakhir. |
| Forbidden (owner check) | 403 | `forbidden` | Tidak berhak mengakses/mengubah. |

---

## Common Vulnerabilities Prevented

| Vulnerability | Prevention |
|---------------|------------|
| **SQL Injection** | Supabase SDK parameterizes all queries |
| **XSS** | React auto-escapes, no `dangerouslySetInnerHTML` with user input |
| **CSRF** | SameSite=Lax cookies, `Authorization` header required for mutations |
| **IDOR** | RLS policies enforce ownership (`user_id = auth.uid()`) |
| **Mass Assignment** | Explicit field selection in `.select()` and `.insert()` |
| **Path Traversal** | No file path from user input (storage paths generated server-side) |
| **SSRF** | External calls only to known APIs (Xendit, Biteship, Google) |
| **Timing Attack** | `timingSafeEqual` for webhook tokens |
| **Replay Attack** | Idempotency keys, `invoice_state` machine |
| **Parameter Pollution** | `await req.json().catch(() => null)` ignores duplicate keys |

---

## Testing Validation

```bash
# Run validation tests
node --test --test-name-pattern="validation"

# Manual: curl with malformed input
curl -X POST http://localhost:3000/api/checkout/xendit \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{"productSlug":"test","quantity":-5}'
# Expected: 400 "Quantity tidak valid."
```

---

## Related Docs

- [Security: Overview](./overview.md) — Threat model
- [Security: Auth & Authorization](./auth-authorization.md) — Auth validation
- [Security: Data Protection](./data-protection.md) — PII validation
- [API: Auth & Authorization](../api/auth.md) — Token validation
- [Features: Checkout](../features/checkout.md) — Checkout validation flow
- [Development: Coding Standards](../development/coding-standards.md) — Validation patterns