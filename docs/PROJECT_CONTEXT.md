# ReBites — Project Context

Verified snapshot of the ReBites codebase. Update this file when architecture,
routes, design tokens, or feature scope change. Items marked **Unverified** or
**Assumption** were not confirmed by reading the implementation.

---

## 1. Purpose and scope

ReBites is a marketplace for surplus food ("makanan surplus") that is still fit
for consumption, sold by culinary MSMEs (UMKM) to buyers. The product connects
sellers and buyers, lets sellers list surplus menu items with price/stock/time
windows, and lets buyers order with delivery or self-pickup. Service area is
currently limited to **Kota Depok** (stated on the landing page).

Two-sided product:

- **Buyer**: browse categories, search/filter, product detail, order, payment,
  order tracking, history, reviews, favorites, notifications, store follows.
- **Seller (UMKM)**: seller auth, store profile/hours, menu & stock management,
  incoming orders, reviews, sales performance, subscription plans (Basic /
  Standar / Max) billed monthly.

## 2. Verified technology stack

| Area | Technology | Where / responsibility |
| --- | --- | --- |
| Framework | Next.js `^14.2.35` (App Router, Turbopack dev) | `app/` routes, `next.config.js` |
| Language | TypeScript `5.2.2` | strict project (`tsconfig.json`), `npm run typecheck` |
| UI | React `18.2.0`, Server Components by default, `"use client"` only where needed | e.g. `app/(landing)/page.tsx` is a Server Component |
| Styling | Tailwind CSS `3.3.3` + tokens in `app/globals.css` | `tailwind.config.ts` maps every color to an `hsl(var(--…))` token |
| Components | shadcn-style UI primitives (`components.json`), Radix UI primitives | `app/components/ui/*` |
| Animation | framer-motion `^13` (wrapped in `MotionConfig reducedMotion="user"`), Lenis smooth scroll | `app/components/landing/landing-shell.tsx`, `app/components/smooth-scroll.tsx`, `app/components/shared/reveal.tsx` |
| Icons | lucide-react `^0.446` | throughout |
| Forms/validation | react-hook-form `^7.53`, zod `^3.23`, @hookform/resolvers | auth/profile forms |
| Data | Supabase (`@supabase/supabase-js` `^2.58`) | client `lib/supabase.ts`, server `lib/server/supabase.ts`, SQL migrations in `supabase/migrations/` |
| Payments | Xendit (invoices + webhooks) | `lib/server/xendit.ts`, `app/api/checkout/xendit`, `app/api/webhooks/xendit` |
| Charts | recharts `^2.12` | seller analytics (`hooks/use-seller-analytics.ts`) |
| Carousel | embla-carousel-react `^8.3` | shadcn carousel |
| Fonts | next/font/google: **Plus Jakarta Sans** (`--font-sans`) + **Be Vietnam Pro** (`--font-secondary`) | `app/layout.tsx` — only two families allowed |
| Images | next/image, remote hosts `images.pexels.com` and `*.supabase.co` | `next.config.js` |
| Testing | **None configured** | no test script in `package.json` |

Installed but not obviously used on the landing page: `gsap`, `recharts`
(seller pages only), `embla-carousel-react` (carousel components), and
`lottie-react` (only imported by the temporary `/test` experiment — see §10).

## 3. Repository structure

```
app/
  layout.tsx               # fonts, metadata, favicon (logo.png), <noscript>
                           #   fallback CSS, lang="id" (no providers)
  globals.css              # design tokens + utilities
  (landing)/               # PUBLIC showcase — no account UI allowed (see §5a)
    layout.tsx             # route-group layout: `LandingShell` (MotionConfig + Lenis)
    page.tsx               # landing page → `/` (Server Component)
    tentang-kami/ fitur/ dampak/ hubungi-kami/   # the four content pages
    test/                  # TEMPORARY lottie experiment → `/test` (see §10)
  (preview)/               # public product detail, outside the landing group
    preview/product/       # → `/preview/product`
  (app)/                   # application routes (URLs unchanged by the group)
    home/                  # buyer app home
    makanan/[category]/    # SSG category pages (8 categories)
    detail/                # product, pesanan, pesanan/sukses, toko
    dashboard/penjual/     # seller dashboard (menu, pesanan, ulasan, performa,
                           #   pengaturan, notifikasi, langganan)
    riwayatPesanan/ notifikasi/ profile/ toko/ langganan/pembayaran
                           #   langganan/sukses
  auth/                    # login, register, seller login/register,
                           #   forgotPassword, buat-sandi-baru, callback
  api/                     # xendit checkout+verify, orders/[code], profile,
                           #   subscriptions, webhooks/xendit
  components/              # shared components (not routes)
    landing/               # landing sections (see §5)
    detail-product/        # shell-injected product detail (see §5a)
    dashboard-penjual/ home/ shared/ ui/
hooks/                     # data hooks (orders, products, reviews, …)
lib/                       # categories, catalog, data, types, supabase, pricing,
                           #   subscription plans, store settings/hours, xendit
supabase/migrations/       # SQL schema + RLS
public/                    # images (makanan*.jpg, hero-makanan.jpeg, logo.png, …)
```

Route groups `(landing)` / `(app)` / `(preview)` do **not** affect URLs. There is
deliberately no `(app)/layout.tsx`: app chrome (MobileNavbar/ProfileNavbar) is
rendered per page today. `(landing)/layout.tsx` exists because the five public
pages now genuinely share a shell (client boundary only — navbar/`main`/footer
come from each page's `PublicShell`, see §5).

## 4. Routes (from `npm run build`, 53 pages)

Static (○): `/`, **`/tentang-kami`**, **`/fitur`**, **`/dampak`**,
**`/hubungi-kami`** (the four public content pages), `/home`, `/auth/*`,
`/detail/*`, `/riwayatPesanan`, `/notifikasi/pembeli`, `/profile`, `/toko`,
`/dashboard/penjual/*`, `/langganan/pembayaran`, **`/preview/product`**
(public product detail, lives in `app/(preview)/`).
SSG (●): `/makanan/[category]` (8 paths).
Dynamic (ƒ): `/langganan/sukses`, `/api/checkout/xendit(+verify)`,
`/api/orders/[code]`, `/api/profile(+addresses|avatar)`,
`/api/subscriptions/xendit(+verify)`, `/api/webhooks/xendit`.
Note: bare `/langganan` has never existed (404 by design — only
`pembayaran`/`sukses` do).

## 5. Landing page architecture (`/`)

`app/(landing)/layout.tsx` wraps the whole route group in `LandingShell`
(client) = `MotionConfig` + Lenis. Each page is a **Server Component** that
wraps its content in `PublicShell` (`LandingNavbar` + `<main>` + `LandingFooter`);
only `/` passes `intro`, so the `Preloader` runs exactly once, on the landing
page. Section order:

| Component | Section id (navigation contract) | Client? |
| --- | --- | --- |
| `LandingNavbar` | — (fixed, **route-aware** `aria-current`, no scroll-spy) | yes |
| `HeroSection` | `top` | yes |
| `HowItWorksSection` | `cara-kerja` (tabs *Untuk pembeli* / *Untuk UMKM*) | yes |
| `WhyReBitesSection` | `kenapa` | no |
| `FoodDiscoverySection` | `rekomendasi` | yes (lazy `lib/catalog` fetch) |
| `TestimonialsSection` | `ulasan` (demo data + on-page disclaimer, see §10 `EX-01`) | no |
| `MembershipSection` | `langganan` (real `SUBSCRIPTION_PLANS`, CTA → `/langganan/pembayaran?plan=…`) | no |
| `FAQSection` | `faq` (accordion only — contact form moved to `/hubungi-kami`) | yes |
| `ContactCTASection` | `kontak` | no |
| `LandingFooter` | — (route links + section links + back-to-top) | yes |

**Do not rename or remove ids** `top`, `cara-kerja`, `rekomendasi`,
`langganan`, `faq`: navbar, footer and other pages deep-link to them
(`app/components/landing/scroll-to-section.ts` delegates to Lenis, with a
`scrollIntoView` fallback). The former `#pembeli` / `#umkm` / `#about` /
`#manfaat` anchors are **gone**: `pembeli` and `umkm` are now section ids on
`/fitur`, and both app footers link there (`app/components/site-footer.tsx`,
`app/components/shared/site-footer.tsx`).

Navigation source of truth is `app/components/landing/nav-items.ts`
(`PRIMARY_NAV`, `isCurrentPath`): `Beranda → /`, `Tentang Kami →
/tentang-kami`, `Fitur Unggulan → /fitur`, `Dampak → /dampak`, `Hubungi Kami →
/hubungi-kami`, plus `Masuk → /auth/login` and `Daftar → /auth/register`.
Adding a public page means adding it there once; navbar and footer both read it.

Public content pages (`/tentang-kami`, `/fitur`, `/dampak`, `/hubungi-kami`)
share `PublicPageHero` (breadcrumb + eyebrow + `h1`) and end with
`ContactCTASection`. `/hubungi-kami` owns the contact form
(`contact-form.tsx`), which posts to the same pre-existing Formspree endpoint
the old FAQ form used (`https://formspree.io/f/xdeoorwd`, verified in
`FAQSection.tsx` at `HEAD`).

Live catalog row in `FoodDiscoverySection` lazy-imports `@/lib/catalog` on
mount and renders nothing when empty (no placeholder products).

## 5a. Landing vs application boundary (important)

The public showcase and the application are separated **architecturally**, not
with pathname checks:

- **Public side**: `app/(landing)/` holds the five public routes — `/`,
  `/tentang-kami`, `/fitur`, `/dampak`, `/hubungi-kami` — plus
  `app/(preview)/preview/product` (public product detail, moved out of
  `(landing)` so it does not inherit the landing route group's layout). No auth
  context, no account navbar, no app chrome. Landing product cards
  (`FoodDiscoverySection`) link to `/preview/product?id=…`.
- **Application side** (`app/(app)/`): everything else, URLs unchanged.
  `/detail/product?id=…` is the in-app product detail.
- **Shell injection**: `DetailProductContent` takes a required `shell` prop
  (`DetailProductShell` in `app/components/detail-product/detail-page.tsx`:
  `header`, `productPath`, `seeAllHref`). Each route picks its own chrome —
  `app/(app)/detail/product/page.tsx` passes MobileNavbar/ProfileNavbar,
  `app/(preview)/preview/product/page.tsx` passes `LandingNavbar`.
  `detail-page.tsx` therefore imports **no** navbar components, which is what
  keeps supabase/account code out of the public route's bundle.
- **Rule**: never infer chrome from the pathname and never re-add
  `hideNavbar()`-style conditionals; pass the shell from the route.
- Intentional cross-links that remain: landing category tiles →
  `/makanan/[category]` and labeled landing-footer links into app routes
  (plain links, not chrome; no auth state involved). Checkout
  (`/detail/pesanan`) redirects unauthenticated users to
  `/auth/login?redirect=…` only after an explicit "Pesan Sekarang" click.

## 6. Design system

- **Colors** (`app/globals.css`): white `--background` is the primary surface;
  brand green `--primary: 148 41% 23%` (+ `--primary-dark`); neutrals
  `--secondary`, `--muted`, `--border`; semantic `--destructive/--warning/
  --success`; `--radius: 0.25rem`. No cream/beige/caramel surfaces.
- **Tailwind** (`tailwind.config.ts`): `font-display`/`font-sans` → Plus Jakarta
  Sans, `font-secondary` → Be Vietnam Pro; `bg-sale` shares the destructive hue.
- **Utilities**: `.text-balance`, `.grain-overlay` (3.5% noise texture used on
  landing sections), `[id] { scroll-margin-top: 6.5rem }` for anchor offsets.
- **Motion**: `app/components/shared/reveal.tsx` (`Reveal`, framer in-view);
  global CSS + `MotionConfig` respect `prefers-reduced-motion`.
- **Recurring pattern**: duplicated `FOCUS_RING` constant in landing files
  (`focus-visible:ring-2 focus-visible:ring-primary …`) — consider extracting to
  `lib/utils.ts` if another refactor touches those files.
- **Opacity modifiers**: only Tailwind's generated steps exist
  (`5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 100`) — `text-white/65`,
  `border-white/15` … are dead and silently render the wrong value. On green
  backgrounds use `text-white/70` for body text (≥4.5:1) and `/20` for subtle
  borders. WCAG target rule on the landing page: primary controls ≥44px,
  secondary text links ≥36–40px.
- **Section rhythm**: alternating white / `bg-secondary` / `bg-primary` bands;
  editorial two-column headers (eyebrow + heading + supporting paragraph).

## 7. Data, integrations and assets

- Supabase holds profiles, UMKM stores, products, orders, reviews, follows,
  favorites, notifications, subscriptions (schema in `supabase/migrations/`).
- Payments via Xendit (secret key + webhook callback token, server only).
- Category tile images come from `images.pexels.com` (`lib/categories.ts`).
- Local photos in `public/`: `hero-makanan.jpeg`, `makanan1–15`, step photos
  `penjual-login.jpg`, `pembeli-mencaro.jpg`, `penerimaan.jpg`,
  `terselamatkan.jpg`, `logo.png`.
- Contact form posts to the pre-existing Formspree endpoint
  (`https://formspree.io/f/xdeoorwd`); it moved from `FAQSection.tsx` to
  `app/(landing)/hubungi-kami/contact-form.tsx` in the public-site redesign.
- **Assumption**: footer social links (`instagram.com/rebites` etc.) and
  `halo@rebites.id` were not verified as real accounts.

## 8. Environment variables (names only — see `.env.example`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (server only), `NEXT_PUBLIC_SITE_URL`,
`XENDIT_SECRET_KEY`, `XENDIT_CALLBACK_TOKEN` / `XENDIT_WEBHOOK_TOKEN`.

Never prefix server secrets with `NEXT_PUBLIC_`.

## 9. Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | dev server with Turbopack (port 3000) |
| `npm run dev:webpack` | dev server without Turbopack |
| `npm run build` | production build + type check (lint skipped: `eslint.ignoreDuringBuilds`) |
| `npm run lint` | `next lint` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm start` | serve production build |

## 10. Known issues / technical debt (verified)

- The Tailwind `ambiguous` warning for `ease-[cubic-bezier(0.22,1,0.36,1)]`
  is **resolved** — the legacy `hero-section.tsx` that used it was deleted.
- `next build` skips ESLint (`eslint.ignoreDuringBuilds: true` in
  `next.config.js`); run `npm run lint` separately. Remaining warnings are
  pre-existing (`<img>` in seller dashboard, hook deps in `detail/toko`).
- **`public/makanan2.jpeg` and `public/makanan5.jpeg` have a baked-in
  transparency checkerboard** (rasterized PNG artifact) — do not use them in
  new UI. They may still be referenced by product rows in the database.
- Unreferenced files left in place: `app/components/ReBitesStepCard.tsx`
  (orphan component), `public/ref-pg.jpeg`, `public/loading.mp4`.
- Removed by the public-site redesign (deletions are in the working tree):
  `landing/{TrustSection,CategoryMarquee,FinalCTASection,BenefitsSection,
  BuyerSection,FeaturesSection,SellerSection}.tsx`, replaced by
  `WhyReBitesSection`, `TestimonialsSection`, `MembershipSection`
  and `ContactCTASection`. Earlier QA passes removed legacy `app/page.tsx`
  (it shadowed the landing route), `components/{hero-section, HowItWorks,
  hero-food-carousel, faq-section, flash-sale-grid, FoldText, RotatingText}.tsx`,
  `components/ui/testimonials.tsx`,
  `components/subscription/subscription-section.tsx`, and earlier cleanup removed
  `landing/testimonial-section.tsx` (fabricated testimonials),
  `landing/partner-marquee.tsx`, `landing/catalog-sections.tsx`, and
  `RevealWords` in `shared/reveal.tsx`.
- **Recorded exception**: `app/components/landing/testimonials.ts` holds
  clearly-labelled demo testimonials (on-page disclaimer: "Cerita di atas
  adalah contoh tampilan (data demo), bukan ulasan pelanggan terverifikasi." +
  file comment) — allowed for this redesign per `CONSTRAINTS.md` → Exceptions
  `EX-01`. It is the only fabricated content permitted anywhere in the UI.
- **Temporary route in the working tree**: `app/(landing)/test/page.tsx` serves
  `/test` — a Lottie experiment (`lottie-react` + `public/lottie_animation/`).
  It is public, adds ~82 kB of first-load JS to the route table, and is not
  part of the website's information architecture. Remove it (and the
  `lottie-react` dependency) once the animation experiment is settled.
- Fixed after the 2026-10-09 pass (2026-10-10): the rewritten
  `HowItWorksSection.tsx` had invalid ARIA ids (`"cara - tab - pembeli "`
  with spaces, so `aria-controls`/`aria-labelledby` pointed at nothing) and
  dead Tailwind opacity steps (`text-white/55`, `text-white/65`,
  `bg-white/15`, `bg-white/65` — not in the generated scale, so the step
  progress line rendered invisible); `HeroSection.tsx` still fetched a
  featured product for the deleted `HeroListingCard` (dead Supabase request
  per landing visit). All three are fixed; the hero badge keeps its
  `border-border bg-secondary` pill.
- No automated tests; verification is scripted headless-Chrome + manual
  screenshots: `/` checked at 320/375/390/430/768/1024/1280/1440/1920 — no
  horizontal overflow, no console/network errors, WCAG AA text contrast
  passes (category-tile text pixel-sampled over the photos, min 4.84:1), and
  the page renders fully with JS disabled (`<noscript>` fallback).
- Stale `/homePage` links: fixed inside `detail-product/` (breadcrumb,
  related-products); one remains in
  `app/(app)/makanan/[category]/not-found.tsx` (`/homePage` → should be
  `/home`) — pre-existing, out of scope for the separation refactor.
- `npm run typecheck` reads generated `.next/types`; after moving routes, run
  `npm run build` first or stale types cause false TS2307 errors.
- Dead Tailwind opacity classes remain **outside** the landing page (e.g.
  `bg-primary/15` renders transparent on app pages) — only `app/layout.tsx`
  and `app/components/landing/*` were cleaned; an app-wide sweep is pending.
- FAQ answers are JS-only (client accordion); without scripts only the first
  answer is reachable. `layout.tsx` ships a `<noscript>` CSS fallback that
  reveals reveal-animated content and hides the preloader.
- `sharp` is not installed (Next.js recommends it for production image
  optimization; warning appears on `next start`).
- **Pre-existing, unchanged by the redesign**: the "Produk tidak ditemukan"
  branch of `app/components/detail-product/detail-product-content.tsx`
  returns without the `shell.header`, so `/preview/product?id=…` with an
  unknown id shows no navbar (the same component backs the in-app
  `/detail/product`). Fixed routes and known products render the landing
  navbar correctly (verified).
- **Pre-existing, unchanged by the redesign**: public pages have no
  skip-to-content link; landmarks are otherwise correct
  (`header`/`nav[aria-label]`/`main`/`footer`).
- **Pre-existing, outside the landing**: app pages still contain off-brand
  colors such as `text-purple-700`
  (`app/components/order-history/order-detail-modal.tsx`) — the white/green
  system is only enforced on `app/(landing)`, `app/(preview)` and
  `app/components/landing/*` so far.

## 11. Conventions for future work

- Keep pages as Server Components; add `"use client"` only for genuine
  interactivity.
- Respect the landing/app boundary (§5a): public pages under `app/(landing)/`
  must never render account UI; route-supplied shells, not pathname checks.
- Reuse the design tokens; do not introduce new fonts, palettes or gradients.
- Preserve the landing section ids (§5) and the route-based navbar/footer
  links; new public pages go in `app/components/landing/nav-items.ts`.
- Do not fabricate stats, partners or logos anywhere in the UI. The single
  allowed exception is the clearly-labelled demo testimonials in
  `landing/testimonials.ts` (`CONSTRAINTS.md` → Exceptions `EX-01`); no other
  testimonials, reviews or numbers may be invented.
- Validate with `npm run typecheck`, `npm run lint`, `npm run build`, and a
  visual pass before calling UI work done.

## 12. Verification performed on the public-site redesign (2026-10-09)

- `npm run typecheck` ✅, `npm run lint` ✅ (0 errors, 4 warnings = the
  recorded pre-existing baseline), `npm run build` ✅ (52 pages; the five
  public routes are static).
- Headless Chrome (CDP) against `next start -p 3100`:
  - 6 routes × 10 widths (320→1440): zero horizontal overflow, zero broken
    images, zero console errors.
  - Interactions: mobile menu opens (5 links + `Masuk`, `aria-expanded`,
    `aria-controls="landing-mobile-menu"`), menu link navigates and updates
    `aria-current`; FAQ accordion exposes `aria-expanded`/`aria-controls` and
    toggles; all seven navbar routes resolve with the correct `h1` and active
    state; hero CTAs point to `/home` and `/auth/register/penjual`.
  - The preloader briefly renders a `200vmax` circle; it is clipped by
    `overflow-hidden` and `documentElement.scrollWidth` never exceeds
    `clientWidth` (measured at 400–4000 ms), so it is not an overflow bug.
  - Followed a real landing product card into `/preview/product?id=…`:
    landing navbar present, `h1` present, no overflow at 390px.
  - `prefers-reduced-motion: reduce`: preloader skipped, `body` scroll never
    locked, every section heading rendered at full opacity.
  - Keyboard: the first six tab stops (logo, `Daftar`, hamburger, both hero
    CTAs, first product card) all show a visible focus ring; landmarks are
    `header` + 3 labelled `nav` + `main` + `footer`.
- **Known harness gotchas**: `ui-check.mjs` defaults to `BASE_URL=
  http://127.0.0.1:3000`; testing a different port silently measures another
  server. Always set `BASE_URL`. The root has CSS `scroll-behavior: smooth`
  (Lenis sets `auto` only while it is alive), so scripted `window.scrollTo`
  is asynchronous — read positions or capture screenshots only after a delay.

### Re-verification after the 2026-10-10 fixes (production build on :3100)

- `npm run build` ✅ (53 pages incl. `/test`), `npm run typecheck` ✅,
  `npm run lint` ✅ (0 errors, 4 baseline warnings).
- CDP sweep against `next start -p 3100`: 5 public routes × widths 320→1440 →
  zero horizontal overflow (also zero after the intro preloader settles),
  zero console errors, zero failed network requests; all 19 internal link
  targets return 200; `/home` renders no landing navbar (route separation
  intact).
- `aria-current="page"` matches the route on all five pages; landing
  deep-link ids `top`, `cara-kerja`, `rekomendasi`, `langganan`, `faq` all
  present; cara-kerja tabs now have valid ids (`cara-tab-pembeli`/`cara-tab-umkm`)
  with `aria-controls="cara-panel"` and the panel's `aria-labelledby` follows
  the selected tab; FAQ accordion (6 items) toggles one-open-at-a-time;
  mobile menu opens with 5 links + `Masuk`, closes on Escape; Tab-key focus
  rings visible on the first six stops.
- Membership section renders the three real `SUBSCRIPTION_PLANS` names;
  testimonials carry the on-page demo disclaimer; `/hubungi-kami` form posts
  to the existing Formspree endpoint (`formspree.io/f/xdeoorwd`) via `fetch`,
  with labels for all three fields. Heading order: one `h1` per page, no
  level jumps.
