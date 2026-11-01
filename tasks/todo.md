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

---

<<<<<<< HEAD
# Tasks — HowItWorks horizontal scroll redesign
=======
# Tasks — HowItWorks horizontal timeline (branch `landing-page`)
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34

- [x] Task 1: Rewrite HowItWorks.tsx as GSAP sticky horizontal slider
- [x] Task 2: Per-step reveal (line/dot/SplitText), reduced-motion fallback, Lenis sync
- [x] Task 3: ReBites styling, delete howitworkss.tsx
- [x] Checkpoint: typecheck, build pass; manual scroll check recommended
- [x] Restore original howitworkss look: two-row timeline, growing journey-line, ReBites content, Lenis sync
- [x] Reduce to 3 steps (1 top-left, 2 bottom, 4 top-right), 3 scroll positions, kill stale dev server
<<<<<<< HEAD
=======

---

# Tasks — Repository structure reorganization (buyer / seller / shared)

Plan: `tasks/plan.md` (third plan, appended 2026-10-14). Constraints: `CONSTRAINTS.md`.

## Task 1: Baseline
- [x] Import graph audited (routes, components, hooks, lib); `npm run typecheck` ✅ exit 0, `npm run lint` ✅ exit 0 (4 baseline warnings), `npm run build` ✅ exit 0; route table saved

## Task 2: seller/ batch
**Acceptance criteria**
- [x] `dashboard-penjual/`, `tambahMenu/`, `subscription/` live under `app/components/seller/`; all imports updated; no export renamed

**Verification:** `npm run typecheck` exits 0 ✅ — **Dependencies:** Task 1

## Task 3: buyer/ batch
**Acceptance criteria**
- [x] `checkout/`, `detail-product/`, `detail-toko/`, `home/`, `makanan-category/`, `order-history/` live under `app/components/buyer/`; all imports updated (incl. `lib/order-utils.ts`, `lib/review-storage.ts`)

**Verification:** `npm run typecheck` exits 0 ✅ — **Dependencies:** Task 2

## Task 4: shared/ + landing/ batch
**Acceptance criteria**
- [x] `notification/` → `shared/notification/`; `decor.tsx` → `shared/decor.tsx`; root `site-footer.tsx` → `shared/app-footer.tsx` (export `SiteFooter` unchanged); `preloader.tsx` + `smooth-scroll.tsx` → `landing/`

**Verification:** `npm run typecheck` exits 0 ✅ (after fixing two relative `decor` imports to `@/app/components/shared/decor`) — **Dependencies:** Task 3

## Task 5: hooks/ batch
**Acceptance criteria**
- [x] Buyer hooks under `hooks/buyer/` (+ `lib/useCountdown.ts` → `hooks/buyer/use-countdown.ts`, `lib/useOrderCalculation.ts` → `hooks/buyer/use-order-calculation.ts`); seller hooks under `hooks/seller/`; `use-notifications`/`use-profile`/`use-toast` stay shared at root

**Verification:** `npm run typecheck` exits 0 ✅ (after fixing `use-order-calculation.ts`'s relative `./types` import to `@/lib/types`) — **Dependencies:** Task 4

## Task 6: Final verification
- [x] `npm run typecheck` ✅ exit 0; `npm run lint` ✅ exit 0 (0 errors, same 4 baseline warnings); `npm run build` ✅ exit 0 — route table identical to baseline (all 52 routes, same render modes; only ±1-byte size rounding on 5 lines); stale-import sweep clean; `git diff` reviewed (import-path lines only; pre-existing user changes untouched)

## Task 7: Documentation
- [x] `docs/PROJECT_CONTEXT.md` structure + path references updated; `CONSTRAINTS.md` boundary paths updated (same strength); `docs/ARCHITECTURE.md` added; final report
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34
