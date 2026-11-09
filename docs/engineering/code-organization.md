# Code Organization

> **Architecture:** Next.js 14 App Router with layered separation

---

## Directory Structure

```
rebites/
├── app/                          # Next.js App Router
│   ├── (landing)/               # Public marketing pages (no auth)
│   │   ├── blog/
│   │   ├── dampak/
│   │   ├── fitur/
│   │   ├── hubungi-kami/
│   │   ├── tentang-kami/
│   │   ├── halaman-home/
│   │   └── layout.tsx
│   ├── (app)/                   # Authenticated buyer/seller app
│   │   ├── home/
│   │   ├── makanan/            # Catalog + category pages
│   │   ├── detail/             # Product detail, order detail
│   │   ├── dashboard/          # Seller dashboard
│   │   ├── langganan/          # Subscriptions
│   │   ├── notifikasi/         # Notifications
│   │   ├── riwayatPesanan/     # Order history
│   │   ├── toko/               # Store pages
│   │   ├── alamat/             # Addresses
│   │   ├── akun/               # Account settings
│   │   ├── profile/
│   │   └── layout.tsx
│   ├── (preview)/              # Preview routes
│   │   └── preview/
│   ├── api/                    # All API route handlers
│   │   ├── admin/              # Admin endpoints
│   │   ├── articles/           # Blog
│   │   ├── checkout/           # Payment (Xendit)
│   │   ├── courier/            # Courier dashboard
│   │   ├── orders/             # Order endpoints
│   │   ├── profile/            # User profile
│   │   ├── reports/            # User reports
│   │   ├── seller/             # Seller endpoints
│   │   ├── shipping/           # Shipping rates
│   │   ├── subscriptions/      # Subscription endpoints
│   │   ├── support/            # Support/appeals
│   │   ├── webhooks/           # Xendit, Biteship
│   │   ├── chat/               # AI chatbot
│   │   ├── delivery/           # Route geometry
│   │   ├── store-visitors/     # Analytics
│   │   ├── visitors/           # Visitor tracking
│   │   └── [domain]/
│   ├── auth/                   # Auth pages (login, register, etc.)
│   ├── dashboard/              # Admin & courier dashboards
│   ├── artikel/                # Blog posts (public)
│   ├── pengaturan/             # Settings (coins, etc.)
│   ├── riwayatPesanan/         # Order history (root)
│   ├── toko-diikuti/           # Followed stores
│   ├── banding/                # Appeal page
│   ├── components/             # All React components
│   │   ├── admin/             # Admin dashboard components
│   │   ├── analytics/         # Charts, metrics
│   │   ├── auth/             # Login, register forms
│   │   ├── buyer/            # Buyer UI (checkout, products, orders)
│   │   ├── chatbot/          # AI chat UI
│   │   ├── dashboard-penjual/ # Seller dashboard
│   │   ├── detail-product/   # Product detail components
│   │   ├── landing/          # Marketing pages
│   │   ├── legal/            # Terms, privacy
│   │   ├── profile/          # User profile UI
│   │   ├── seller/           # Seller components (products, subscription)
│   │   ├── shared/           # Shared components (notifications, etc.)
│   │   ├── support/          # Support/appeal UI
│   │   └── ui/               # Primitive UI components
│   ├── layout.tsx             # Root layout
│   └── page.tsx              # Home route
├── lib/                        # Shared utilities (147+ modules)
│   ├── server/               # Server-only (Supabase, Xendit, Biteship, AI)
│   │   ├── supabase.ts      # Client factories
│   │   ├── xendit.ts        # Xendit API
│   │   ├── biteship.ts      # Biteship API
│   │   ├── biteship-shipment.ts
│   │   ├── ai-provider.ts   # AI abstraction
│   │   ├── gemini.ts        # Gemini implementation
│   │   ├── courier-ai.ts    # Courier AI assistant
│   │   ├── checkout-idempotency.ts
│   │   ├── order-settlement.ts
│   │   ├── subscription-activation.ts
│   │   ├── pricing.ts
│   │   ├── account-ban.ts
│   │   ├── admin-export.ts
│   │   ├── coin-debit.ts
│   │   ├── courier-history.ts
│   │   ├── hard-delete-password.ts
│   │   ├── health-probes.ts
│   │   ├── health-service.ts
│   │   ├── moderation-notifications.ts
│   │   ├── seller-status.ts
│   │   ├── site-url.ts
│   │   ├── supabase-errors.ts
│   │   ├── supabase-rows.ts
│   │   └── verify-throttle.ts
│   ├── chatbot/              # AI chatbot logic
│   ├── catalog/              # Product filtering
│   ├── order-state-machine.ts
│   ├── checkout-idempotency.ts
│   ├── shipping-tariff.ts
│   ├── flash-sale.ts
│   ├── notifications/        # In-app notifications
│   ├── ...
├── hooks/                    # Custom React hooks
│   ├── buyer/
│   ├── seller/
│   ├── courier/
│   └── shared/
├── types/
│   └── index.ts             # Domain TypeScript interfaces
├── supabase/
│   ├── migrations/         # 80+ SQL migrations
│   └── config.toml
├── public/
├── .env.example
├── next.config.js
├── tailwind.config.ts
└── tsconfig.json
```

---

## Layering

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation Layer (app/, components/, hooks/)            │
│  - React components, routes, hooks                         │
│  - No direct DB access                                      │
│  - Calls API endpoints or uses hooks                        │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  API Layer (app/api/**/route.ts)                           │
│  - Auth validation, input validation                        │
│  - Business logic orchestration                             │
│  - Calls lib/ and lib/server/                              │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Domain Layer (lib/, lib/server/)                          │
│  - Pure business logic (pricing, state machines, validation)│
│  - External API integrations (Xendit, Biteship, AI)        │
│  - Database operations (Supabase)                          │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Data Layer (Supabase: Postgres, Auth, Realtime, Storage)  │
│  - RLS-enforced access control                             │
│  - Atomic RPC functions                                    │
└─────────────────────────────────────────────────────────────┘
```

**Dependency rule:** Lower layers never import from higher layers.

---

## Module Boundaries

### `lib/` vs `lib/server/`

| Module | Location | Reason |
|--------|----------|--------|
| Pure functions (pricing, state machine, validation) | `lib/` | No secrets, no client dependency |
| Supabase client factories | `lib/server/` | Use service role key |
| Xendit/Biteship/AI API clients | `lib/server/` | Use API keys |
| Auth helpers | `lib/` (user-facing) / `lib/server/` (service role) | Separation |
| Throttle, validation | `lib/` | Pure logic |

### `app/` vs `lib/`

| Concern | Location |
|---------|----------|
| Route handlers | `app/api/` |
| Business logic called by routes | `lib/` / `lib/server/` |
| UI components | `app/components/` |
| Custom hooks | `hooks/` |
| Domain types | `types/` |

### `hooks/` Organization

| Hook | Location | Use |
|------|----------|-----|
| `useCurrentUser`, `useProfile` | `hooks/shared/` | All authenticated pages |
| `useBuyerOrders`, `useAddresses` | `hooks/buyer/` | Buyer UI |
| `useSellerProducts`, `useSellerOrders` | `hooks/seller/` | Seller dashboard |
| `useCourierAssignments`, `useCourierLocation` | `hooks/courier/` | Courier dashboard |

---

## Route Groups

### `(landing)` — Public, No Auth

| Route | Purpose |
|-------|---------|
| `/` | Home / Marketing |
| `/tentang-kami` | About |
| `/fitur` | Features |
| `/dampak` | Impact (CO2 savings) |
| `/blog` | Blog listing |
| `/hubungi-kami` | Contact |

### `(app)` — Authenticated Buyer/Seller

| Route | Purpose |
|-------|---------|
| `/home` | Buyer home (catalog) |
| `/makanan` | Catalog |
| `/makanan/[category]` | Category page |
| `/detail/product/[slug]` | Product detail |
| `/detail/pesanan/[code]` | Order detail |
| `/riwayatPesanan` | Order history |
| `/dashboard/penjual` | Seller dashboard |
| `/langganan` | Subscription |
| `/notifikasi/pembeli` | Buyer notifications |
| `/toko` | Store listing |
| `/alamat` | Addresses |
| `/akun` | Account settings |
| `/profile` | Profile |

### `(preview)` — Preview

| Route | Purpose |
|-------|---------|
| `/preview/product/[slug]` | Preview product without auth |

---

## Data Flow Patterns

### Server Component → Client Component

```tsx
// Server Component (app/makanan/page.tsx)
export default async function CatalogPage({ searchParams }) {
  const products = await fetchProducts(searchParams); // Direct Supabase (service or anon)
  return <CatalogClient products={products} />; // Serializes to client
}

// Client Component (app/components/buyer/CatalogClient.tsx)
'use client';
export function CatalogClient({ products }) {
  const [filters, setFilters] = useState(...);
  return <ProductGrid products={filteredProducts} onAddToCart={...} />;
}
```

### API Route → Client

```tsx
// In hook (hooks/shared/useProducts.ts)
export function useProducts(params) {
  const [data, setData] = useState<Product[] | null>(null);
  
  useEffect(() => {
    fetchWithAuth('/api/products', { params })
      .then(res => res.json())
      .then(setData);
  }, [params]);
  
  return { data, loading: !data };
}
```

### Webhook → Database

```
Xendit Webhook → POST /api/webhooks/xendit → createServiceClient() → Supabase RPC → orders
```

---

## State Management

| State Type | Method |
|------------|--------|
| Server state | Supabase (queries in server components) |
| Client state | React `useState`, `useReducer` |
| Shared client state | React Context (`AuthProvider`, `StoreContext`) |
| Realtime state | Supabase Realtime channels |
| Form state | React Hook Form |
| UI state | Zustand (future) or Context |

**No Redux, no external state library** — keep it simple.

---

## Error Handling Patterns

### In API Routes

```typescript
try {
  // 1. Auth
  // 2. Validate
  // 3. Business logic
  // 4. Return success
} catch (err) {
  if (isSupabaseUnavailable(err)) {
    return NextResponse.json({ error: 'Service unavailable', code: 'service_unavailable' }, { status: 503 });
  }
  console.error('[module] unexpected', err);
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}
```

### In Hooks

```typescript
export function useOrder(code: string) {
  const [data, setData] = useState<Order | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    setLoading(true);
    fetchWithAuth(`/api/orders/${code}`)
      .then(res => res.ok ? res.json().then(d => { setData(d.order); }) : res.json().then(d => setError(new Error(d.error))))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [code]);
  
  return { data, error, loading };
}
```

### In Server Components

```tsx
export default async function OrderDetailPage({ params }) {
  try {
    const order = await fetchOrder(params.code);
    if (!order) notFound();
    return <OrderDetailCard order={order} />;
  } catch {
    return <ErrorState message="Gagal memuat pesanan" />;
  }
}
```

---

## Code Quality Gates

| Check | Command | When |
|-------|---------|------|
| TypeScript | `npm run typecheck` | Before commit |
| ESLint | `npm run lint` | Before commit |
| Tests | `npm test` | Before PR |
| Build | `npm run build` | Before deploy |

---

## Related Docs

- [Engineering: Performance](./performance.md) — Code performance
- [Engineering: Tech Debt](./tech-debt.md) — Known issues
- [Engineering: Decisions](./decisions.md) — Architecture choices
- [Development: Coding Standards](../development/coding-standards.md) — Style guide
- [Architecture: Overview](../architecture/overview.md) — System architecture