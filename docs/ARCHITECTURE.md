# ReBites — Repository Architecture

Companion to `docs/PROJECT_CONTEXT.md` (which holds the verified feature and
design-system detail). This file explains **where code lives and where new
code should go**. Established by the 2026-10-14 structure-only
reorganization; routes, behavior and exports were not changed.

## Directory purposes

| Directory | Purpose |
| --- | --- |
| `app/(landing)/` | Public marketing pages (`/`, `/tentang-kami`, `/fitur`, `/dampak`, `/hubungi-kami`). Must never import application chrome — see `CONSTRAINTS.md` Boundary rule. |
| `app/(preview)/` | Public product detail (`/preview/product`), outside the landing layout. |
| `app/(app)/` | Application routes. Buyer routes (`/home`, `/makanan/*`, `/detail/*`, `/riwayatPesanan`, `/notifikasi/pembeli`, `/profile`, `/toko`, `/langganan/*`) and the seller dashboard (`/dashboard/penjual/*`). Route files never move: URLs are fixed. |
| `app/auth/` | Authentication routes (buyer + seller login/register, reset, callback). |
| `app/api/` | API route handlers (Xendit checkout/subscription/webhooks, orders, profile). Handlers stay here; they are routes. |
| `app/components/ui/` | shadcn/Radix UI primitives. Shared by everything. |
| `app/components/shared/` | Components used by more than one actor or area (navbar, mobile nav, cards, `reveal`, `SmartImage`, `notification/`, `decor`, both footers). |
| `app/components/auth/` | Auth form components used only by `app/auth/*` pages. |
| `app/components/landing/` | Landing/public-site sections and shells (`LandingNavbar`, `PublicShell`, `preloader`, `smooth-scroll`). |
| `app/components/buyer/` | Buyer-only feature groups: `checkout/`, `detail-product/` (shell-injected; also backs `/preview/product`), `detail-toko/`, `home/`, `makanan-category/`, `order-history/`. |
| `app/components/seller/` | Seller-only feature groups: `dashboard-penjual/`, `tambahMenu/`, `subscription/` (seller-plan purchase flow). |
| `hooks/buyer/`, `hooks/seller/` | Actor-specific React hooks. |
| `hooks/*.ts` (root) | Genuinely shared hooks: `use-notifications`, `use-profile`, `use-toast`. |
| `lib/` | Shared domain layer (browser-safe): catalog, orders, stores, notifications, subscriptions, types, utils. Flat by design — the filename prefix (`order-*`, `store-*`, `notification-*`, `subscription-*`, `seller-*`) carries the domain. |
| `lib/server/` | Server-only code (Supabase admin client, Xendit, pricing, settlement). Imported only from `app/api/**`. Never import it from client components. |
| `supabase/migrations/` | SQL schema + RLS. Never edited as part of structural work. |
| `public/` | Static assets. |
| `docs/`, `tasks/` | Project documentation and working plans. |

## Where does a new file go?

1. **Is it a route** (`page.tsx`, `layout.tsx`, `route.ts`, …)? It goes under
   the matching `app/` route group at the URL it must serve. Nothing else.
2. **Is it a UI component?**
   - Used by exactly one actor → `app/components/buyer/…` or
     `app/components/seller/…` inside that actor's feature group.
   - Used by both actors or across areas (landing + app) →
     `app/components/shared/…`.
   - Landing-page-only → `app/components/landing/…`.
   - A low-level primitive reused everywhere → `app/components/ui/…`.
3. **Is it a React hook?** Actor-specific → `hooks/buyer/` or `hooks/seller/`;
   shared → `hooks/` root. Hooks do not belong in `lib/`.
4. **Is it non-UI logic?** `lib/`, in a file named after its domain. If it
   must only run on the server (secrets, Node APIs, service-role Supabase),
   it goes in `lib/server/`.
5. **Does it serve both actors?** Keep ONE canonical implementation in the
   shared area. Do not copy it into `buyer/` and `seller/`.

## Rules that keep this structure honest

- `app/` is routing; components/hooks/lib are imported from routes, never the
  other way around (exception: `lib/order-utils.ts` →
  `app/components/buyer/checkout/payment-methods` and `lib/review-storage.ts`
  → `app/components/buyer/detail-product/data` are known pre-existing
  inversions; do not add more).
- Import via the `@/` alias (`@/app/components/…`, `@/hooks/buyer/…`,
  `@/lib/…`), never via `../` chains.
- A folder rename requires updating every specifier; `npm run typecheck` is
  the gate.
- No route file, URL, export name or behavior changes as part of a move.
