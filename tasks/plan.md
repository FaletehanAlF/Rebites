<<<<<<< HEAD
# Implementation Plan: Separate the public landing page from the ReBites application

## Overview

The public landing page (`/`) must stay a public showcase: no application
account/navbar, no logged-in UI, no demo-account state. Today the leak happens
because the landing's product cards link to `/detail/product?id=…`, and that
route's page component bakes the application shell (`ProfileNavbar` +
`MobileNavbar` — notifications, profile, logout) directly into
`app/components/detail-product/detail-page.tsx`. The fix is structural: split
the product-detail shell by route, give the landing its own public product
route, and use route groups so `app/` communicates which routes are public and
which are application.

## Root cause (verified by reading the code)

- `app/layout.tsx` renders only fonts + metadata — no providers, no auth state.
  `/` itself does not inherit application UI.
- `app/page.tsx` composes only landing components (`app/components/landing/*`)
  and has no `useCurrentUser` / `supabase` usage.
- `app/components/detail-product/detail-page.tsx:89-90` unconditionally renders
  `<MobileNavbar />` and `<ProfileNavbar />`. `ProfileNavbar` (shared/navbar.tsx)
  renders notification bell, profile avatar, `AccountSidebar`, logout.
- `app/components/landing/FoodDiscoverySection.tsx:148` links landing products
  to `/detail/product?id=…` → visitor lands inside the application shell.

So the boundary failure is route/chrome ownership, not global provider leakage.

## Architecture decisions

1. **Shell is chosen by the route, never by pathname conditionals.**
   `DetailProductContent` takes a `shell` prop (`header`, `productPath`,
   `seeAllHref`). `/detail/product` passes the application chrome;
   `/preview/product` passes the landing chrome. `detail-page.tsx` no longer
   imports the application navbars, so the public route never pulls supabase /
   auth hooks into its bundle.
2. **New public route: `/preview/product?id=…`** at
   `app/(landing)/preview/product/page.tsx` (user-approved). `/detail/product`
   is preserved unchanged for the application.
3. **Route groups**: `app/(landing)/` and `app/(app)/`. Route groups do not
   appear in URLs, so every existing URL is preserved. No `app/page.tsx` may
   remain next to `app/(landing)/page.tsx` (both would resolve to `/`).
4. **No empty layouts.** Application chrome is rendered per page today
   (`/home`, `/detail`, `/profile` … each render their own navbar), so an
   `(app)/layout.tsx` would be structure without content. Skipped on purpose;
   documented in `docs/PROJECT_CONTEXT.md`.
5. **Left alone** (documented, not changed): category tiles on the landing
   still open `/makanan/[category]` (application catalog — same intent as the
   explicit "Buka katalog lengkap" → `/home` CTA), the vendor page
   `/detail/toko`, checkout `/detail/pesanan` (redirects unauthenticated
   visitors to `/auth/login?redirect=…` only after an explicit "Pesan
   Sekarang" action), and the flat `hooks/` + `lib/` layout.

## Task List

### Phase 1: Quality bar and plan
- [x] Task 1: Write `CONSTRAINTS.md` (floor + existing checks + landing/app boundary rule)
- [x] Task 2: Write this plan and `tasks/todo.md`

### Phase 2: Route groups (mechanical, no behavior change)
- [ ] Task 3: Create `app/(landing)/` + `app/(app)/`; move `app/page.tsx` and
  the application route folders into them; leave `auth/`, `api/`,
  `components/`, `globals.css`, `layout.tsx` at the top level.

**Checkpoint:** `npm run typecheck` passes; `npm run build` emits the same route
table as before (`/`, `/home`, `/detail/*`, … unchanged).

### Phase 3: Shell-injected product detail
- [ ] Task 4: Add the `shell` prop to `DetailProductContent` → `DetailPage` →
  `RelatedProducts`; move the application navbar JSX into
  `app/(app)/detail/product/page.tsx`; fix the stale `/homePage` links inside
  `detail-product/` (route was renamed to `/home` in commit 6749d25).

**Checkpoint:** `/detail/product?id=…` renders exactly the application chrome
it does today; typecheck + lint clean.

### Phase 4: Public product route + landing links
- [ ] Task 5: Create `app/(landing)/preview/product/page.tsx` with the landing
  shell; make `LandingNavbar` section-jump links work from a page that has no
  landing sections (only `preventDefault` when the section exists).
- [ ] Task 6: Point `FoodDiscoverySection` product cards at
  `/preview/product?id=…`.

**Checkpoint:** no landing link targets `/detail/product`; typecheck + lint
clean.

### Checkpoint: Core
- [ ] `npm run typecheck`, `npm run lint`, `npm run build` all pass
- [ ] Manual/HTTP route checks: `/`, `/preview/product?id=sate-ayam-10-pcs`,
  `/home`, `/detail/product?id=sate-ayam-10-pcs`, `/auth/login`

### Phase 5: Documentation
- [ ] Task 7: Update `docs/PROJECT_CONTEXT.md` (structure, routes, boundary
  rules, hook/component classification) and report results.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Two pages resolving to `/` after the move | build failure | move `app/page.tsx`, never copy |
| Server → client prop with a JSX `header` not serializable | runtime error | verified by `npm run build` + rendered HTML check of `/preview/product` |
| Public route bundles supabase/auth code | perf + boundary violation | `detail-page.tsx` drops the navbar imports; each route imports only its own chrome |
| Moving folders breaks relative imports | compile errors | repo uses `@/*` alias only (verified: no `../` imports under `app/`) |
| `/homePage` fix changes an application link target | navigation change | target is a 404 today (route renamed in 6749d25); new target `/home` |

## Open Questions

- None outstanding. Route URL (`/preview/product`) and constraints scope were
  confirmed with the user before implementation.
=======
# Implementation Plan: Cara Kerja Horizontal Scroll Redesign

## Overview
Replace the vertical timeline in `HowItWorks` with a GSAP ScrollTrigger-scrubbed horizontal slider (pattern from howitworkss.tsx): vertical scrolling moves the slide sideways and each step (image, title, description) reveals in sequence. `howitworkss.tsx` is deleted after adaptation.

## Architecture Decisions
- Inline `useGSAP` helper (no @gsap/react dependency), copied from howitworkss.tsx.
- Keep `steps` data (4 ReBites steps, each with its own image), `id="cara-kerja"`, `data-nav="green"`.
- Sticky viewport section; horizontal flex slider; per-item reveal (line + dot + SplitText title/description).
- ReBites theme: `bg-primary`, `text-primary-foreground`, `caramel` accent instead of `#ff5f00`.
- Lenis sync: `ScrollTrigger.update` on `window.__lenis` scroll.
- Reduced motion: `gsap.set` fallbacks.
- Heading stays inside the slider as the first column (Product Storyline pattern).

## Task List

### Phase 1
- [x] Task 1: Rewrite HowItWorks.tsx with GSAP sticky horizontal slider
- [x] Task 2: Per-step reveal (line/dot/SplitText) + reduced-motion fallback + Lenis sync
- [x] Task 3: ReBites styling, delete howitworkss.tsx, update plan files

### Checkpoint
- [x] `npm run typecheck`, `npm run lint`, `npm run build` pass; manual scroll check

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| SplitText not registered | High | registerPlugin(ScrollTrigger, SplitText) |
| Lenis/ScrollTrigger desync | Med | lenis.on('scroll', ScrollTrigger.update) |
| Mobile overflow | Med | max-[600px]: breakpoints from howitworkss |

## Open Questions
- None
>>>>>>> d0731afe550acef6d24336e1b9d005e38887e53a
