# Coding Standards

> **Enforced by:** TypeScript strict mode, ESLint, code review conventions

---

## TypeScript

### Strictness

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": false,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Type Patterns

```typescript
// ✅ Use unknown for untrusted inputs
function parseResponse(raw: unknown): ApiResponse {
  if (!raw || typeof raw !== 'object') return { error: 'invalid' };
  const obj = raw as Record<string, unknown>;
  // ...
}

// ✅ Use type guards
function isOrderStatus(value: string): value is OrderStatus {
  return ['pending', 'paid', 'processing', ...].includes(value);
}

// ✅ Use generic constraints
function fetchById<T extends { id: string }>(table: string, id: string): Promise<T | null>
```

### Avoid

```typescript
// ❌ any without justification
const data = response.data as any;

// ✅ Instead:
const data = response.data as Record<string, unknown>;
// or define a proper interface

// ❌ Non-null assertion in hot paths
const user = await getUser()!;

// ✅ Instead:
const user = await getUser();
if (!user) return unauthorized();
```

---

## Naming Conventions

### Files

| Type | Pattern | Example |
|------|---------|---------|
| Component | `PascalCase.tsx` | `ProductCard.tsx` |
| Hook | `use` + `PascalCase.ts` | `useCurrentUser.ts` |
| Utility | `kebab-case.ts` | `shipping-tariff.ts` |
| Server module | `kebab-case.ts` (in `lib/server/`) | `xendit.ts` |
| API route | `route.ts` | `app/api/orders/route.ts` |
| Test | `test-name.test.ts` | `checkout-idempotency.test.ts` |
| Type | `camelCase.ts` or in `types/` | `types/index.ts` |

### Variables & Functions

| Type | Pattern | Example |
|------|---------|---------|
| Constant | `UPPER_SNAKE` | `MAX_PAGE_SIZE = 100` |
| Variable | `camelCase` | `const orderCount` |
| Function | `camelCase` (verb) | `function calculateFee()` |
| Async function | `camelCase` + `Async` suffix (optional) | `async function fetchOrder()` |
| Class | `PascalCase` | `class GeminiProvider` |
| Type/Interface | `PascalCase` | `interface OrderStatus` |
| React Component | `PascalCase` | `function ProductCard()` |
| Boolean | `is`/`has`/`can` prefix | `const isActive`, `const hasPermission` |
| Event handler | `on` prefix | `function handleClick()` |

### Database

| Type | Pattern | Example |
|------|---------|---------|
| Table | `snake_case` plural | `user_reports` |
| Column | `snake_case` | `created_at`, `order_code` |
| Index | `idx_table_column` | `idx_orders_buyer_id` |
| RLS Policy | `table_action_description` | `orders_buyer_select` |
| RPC | `snake_case` verb | `reserve_stock_for_order` |

---

## React & Next.js

### Server Components (Default)

```typescript
// ✅ Server component — can use service role, direct DB
export default async function OrderDetailPage({ params }) {
  const service = createServiceClient();
  const { data: order } = await service.from('orders').select('*').eq('order_code', params.code).single();
  return <OrderDetailCard order={order} />;
}
```

### Client Components (When Needed)

```typescript
// 'use client' — only when using state, events, browser APIs
'use client';
export function QuantitySelector() {
  const [qty, setQty] = useState(1);
  return (
    <div>
      <button onClick={() => setQty(q => Math.max(1, q - 1))}>-</button>
      <span>{qty}</span>
      <button onClick={() => setQty(q => Math.min(99, q + 1))}>+</button>
    </div>
  );
}
```

### Shell Injection Pattern

```typescript
// Keeps auth code out of public bundles
// DetailProductContent receives `shell` prop:
export function DetailProductContent({ product, shell }: Props) {
  // shell = 'public' | 'authenticated'
  // Public: no cart, no buy button
  // Authenticated: full checkout flow
}
```

### Props

```typescript
// ✅ Define interfaces
interface ProductCardProps {
  product: ProductWithUMKM;
  onAddToCart?: (id: string, qty: number) => void;
  shell?: 'public' | 'authenticated';
}

// ❌ Avoid inline object types for complex props
export function ProductCard(props: {
  product: Product;
  onAdd: () => void;
  shell?: string;  // too loose
})
```

---

## API Route Handlers

### Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromBearer, createServiceClient } from '@/lib/server/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const user = await getUserFromBearer(req.headers.get('authorization'));
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
    }

    // 2. Parse & validate
    const body = await req.json().catch(() => null) as CreateOrderRequest | null;
    if (!body?.productSlug || !body.quantity) {
      return NextResponse.json({ error: 'Payload tidak lengkap.', code: 'payload_incomplete' }, { status: 400 });
    }

    // 3. Business logic
    const service = createServiceClient();
    // ...

    // 4. Success
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    console.error('[route-name] unexpected', err);
    return NextResponse.json({ error: 'Terjadi kesalahan.' }, { status: 500 });
  }
}
```

### Error Responses

```typescript
// Always include `error` (human-readable Indonesian) and optional `code` (machine-readable)
return NextResponse.json(
  { error: 'Stok tidak mencukupi.', code: 'insufficient_stock' },
  { status: 400 }
);
```

### Logging

```typescript
// Prefix: [route-module]
console.log('[checkout/xendit] invoice created', { orderId, amount });
console.warn('[webhook/xendit] invalid token', { ip: req.headers.get('x-forwarded-for') });
console.error('[orders/[code]] fetch error', error.message);
```

---

## Database Migrations

```sql
-- ✅ Atomic migration with rollback
CREATE TABLE new_feature (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ...
);

-- RLS
ALTER TABLE new_feature ENABLE ROW LEVEL SECURITY;
CREATE POLICY "new_feature_policy" ON new_feature
  FOR SELECT USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_new_feature_user ON new_feature(user_id);
```

### Migration File Naming

```
supabase/migrations/0042_add_feature_name.sql
```

- Numbered sequentially
- Descriptive suffix
- Never edit applied migrations (create new one instead)

---

## Testing Standards

```typescript
// ✅ Test file structure
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

describe('checkout-idempotency', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  it('prevents duplicate order creation with same key', async () => {
    const result = await processCheckout(ctx.key, ctx.payload);
    assert.equal(result.orderId, 'RB-TEST');
    
    const replay = await processCheckout(ctx.key, ctx.payload);
    assert.equal(replay.orderId, 'RB-TEST'); // Same order, no duplicate
    assert.equal(replay.isNew, false);
  });
});
```

- Use `node:test` (built-in, no Jest/Mocha)
- `assert` for assertions
- One behavior per test
- No network calls in unit tests

---

## Git Conventions

### Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<name>` | `feat/flash-sale-pricing` |
| Fix | `fix/<name>` | `fix/xendit-amount-validation` |
| Documentation | `docs/<name>` | `docs/api-rate-limits` |
| Refactor | `refactor/<name>` | `refactor/checkout-idempotency` |
| Hotfix | `hotfix/<name>` | `hotfix/webhook-crash` |
| Release | `release/v1.x` | `release/v1.0` |

### Commit Messages

```
feat(checkout): add idempotency key normalization

- Normalize keys: trim + lowercase
- Add to orders table
- Prevent duplicate invoice creation on retry

Closes #123
```

### PR Process

1. Create feature branch from `main`
2. Commit with conventional messages
3. Run locally: `npm run typecheck && npm test && npm run lint`
4. Create PR with description + linked issues
5. Request review (at least 1)
6. Merge via **squash** to keep main clean

---

## Security Standards

| Rule | Rationale |
|------|-----------|
| Never log secrets (API keys, tokens, passwords) | PII & secret leakage |
| Validate all user input at API boundary | SQL injection, XSS |
| Use `createServiceClient()` only in server routes | Bypasses RLS |
| Always check `account_status='active'` before admin ops | Suspended users blocked |
| Timing-safe compare for webhook tokens | Prevent timing attacks |
| Sanitize addresses before storing | PII protection |
| Use parameterized queries (Supabase SDK handles) | SQL injection prevention |

---

## Accessibility

| Standard | Implementation |
|----------|----------------|
| WCAG 2.1 AA | Color contrast, focus states, alt text |
| Keyboard navigation | All interactive elements focusable |
| ARIA labels | Icons get `aria-label`, forms get `<label>` |
| Screen readers | Semantic HTML, skip links, live regions for notifications |
| Reduced motion | `prefers-reduced-motion` media query |

```tsx
// ✅ Accessible button
<button
  onClick={handleClick}
  aria-label="Tambah ke keranjang"
  disabled={qty < 1}
>
  <PlusIcon /> <span className="sr-only">Tambah</span>
</button>
```

---

## Related Docs

- [Development: Setup](./setup.md) — Environment, scripts
- [Development: Git Workflow](./git-workflow.md) — Branching, PR process
- [Testing: Strategy](../testing/strategy.md) — Test architecture
- [Security: Overview](../security/overview.md) — Security standards
- [Engineering: Code Organization](../engineering/code-organization.md) — Module boundaries