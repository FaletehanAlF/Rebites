# Tasks — Landing vs application separation

Plan: `tasks/plan.md`. Constraints: `CONSTRAINTS.md`.

## Task 1: Quality bar
- [x] `CONSTRAINTS.md` written (floor + typecheck/lint/build + landing boundary rule)

## Task 2: Plan and task list
- [x] `tasks/plan.md` and `tasks/todo.md` written

## Task 3: Route groups in `app/`
**Acceptance criteria**
- [x] `app/(landing)/page.tsx` resolves to `/`; no `app/page.tsx` remains
- [x] Application routes live under `app/(app)/` with unchanged URLs
- [x] `auth/`, `api/`, `components/`, `globals.css`, `layout.tsx` untouched at top level

**Verification**
- [x] `npm run typecheck` exits 0
- [x] `npm run build` succeeds and lists the same routes

**Dependencies:** none — **Files:** `app/**` (moves only)

## Task 4: Shell-injected product detail
**Acceptance criteria**
- [x] `DetailProductContent` accepts a `shell` prop; `detail-page.tsx` no longer imports `ProfileNavbar`/`MobileNavbar`
- [x] `/detail/product` still renders the application navbar + mobile navbar
- [x] Stale `/homePage` links inside `detail-product/` now target `/home`

**Verification**
- [x] `npm run typecheck`, `npm run lint` exit 0
- [x] HTTP check: `/detail/product?id=sate-ayam-10-pcs` returns 200; page JS contains `Profil saya`/`Keluar` (app shell present)

**Dependencies:** Task 3 — **Files:** `app/components/detail-product/*`, `app/(app)/detail/product/page.tsx`

## Task 5: Public product route `/preview/product`
**Acceptance criteria**
- [x] `app/(landing)/preview/product/page.tsx` renders the detail content with the landing chrome
- [x] `LandingNavbar` jump links still smooth-scroll on `/` and navigate to `/#id` elsewhere
- [x] No account/profile/notification UI on `/preview/product`

**Verification**
- [x] `npm run typecheck`, `npm run lint`, `npm run build` exit 0
- [x] HTTP check: route returns 200; HTML + page JS contain no account-UI literals

**Dependencies:** Task 4 — **Files:** `app/(landing)/preview/product/page.tsx`, `app/components/landing/LandingNavbar.tsx`

## Task 6: Landing product links
**Acceptance criteria**
- [x] Landing product cards target `/preview/product?id=…`
- [x] No landing component links to `/detail/product`

**Verification**
- [x] grep for `detail/product` under `app/components/landing` returns nothing
- [x] `npm run typecheck`, `npm run lint` exit 0

**Dependencies:** Task 5 — **Files:** `app/components/landing/FoodDiscoverySection.tsx`

## Task 7: Documentation and report
**Acceptance criteria**
- [x] `docs/PROJECT_CONTEXT.md` reflects the new structure, routes and boundary rules
- [x] Report covers root cause, architecture, structure, routing, auth boundary, files changed, validation

**Verification**
- [x] Final `npm run typecheck`, `npm run lint`, `npm run build` results recorded honestly

**Dependencies:** Tasks 3–6

## Checkpoint: Core (after Tasks 3–6)
- [x] typecheck / lint / build pass
- [x] `/`, `/preview/product`, `/home`, `/detail/product`, `/auth/login` checked (HTTP 200; shell markers verified via HTML + JS-chunk literals — browser/DevTools pass not run: no chrome-devtools MCP configured)
