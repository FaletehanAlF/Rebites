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
| Animation | framer-motion `^13` (wrapped in `MotionConfig reducedMotion="user"`), Lenis smooth scroll | `app/components/landing/landing-shell.tsx`, `app/components/landing/smooth-scroll.tsx`, `app/components/shared/reveal.tsx` |
| Icons | lucide-react `^0.446` | throughout |
| Forms/validation | react-hook-form `^7.53`, zod `^3.23`, @hookform/resolvers | auth/profile forms |
| Data | Supabase (`@supabase/supabase-js` `^2.58`) | client `lib/supabase.ts`, server `lib/server/supabase.ts`, SQL migrations in `supabase/migrations/` |
| Payments | Xendit (invoices + webhooks) | `lib/server/xendit.ts`, `app/api/checkout/xendit`, `app/api/webhooks/xendit` |
| Charts | recharts `^2.12` | seller analytics (`hooks/seller/use-seller-analytics.ts`) |
| Carousel | embla-carousel-react `^8.3` | shadcn carousel |
| Fonts | next/font/google: **Plus Jakarta Sans** (`--font-sans`) + **Be Vietnam Pro** (`--font-secondary`) | `app/layout.tsx` — only two families allowed |
| Images | next/image, remote hosts `images.pexels.com` and `*.supabase.co` | `next.config.js` |
| Testing | **None configured** | no test script in `package.json` |

Installed but not obviously used on the landing page: `gsap`, `recharts`
(seller pages only), `embla-carousel-react` (carousel components).
(`lottie-react` was removed on 2026-10-11 — see §10.)

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
  components/              # UI components (not routes), grouped by owner
                           #   (reorganized 2026-10-14, see docs/ARCHITECTURE.md)
    ui/                    # shadcn primitives (button, dialog, form, …)
    shared/                # cross-actor: navbar, MobileNavbar, reveal,
                           #   SmartImage, FoodCard, notification/, decor,
                           #   site-footer.tsx + app-footer.tsx (two distinct
                           #   footer implementations, both export SiteFooter)
    auth/                  # auth forms used by app/auth/*
    landing/               # landing sections + preloader + smooth-scroll
                           #   (see §5)
    buyer/                 # buyer-only feature groups:
                           #   checkout/ detail-product/ (shell-injected, see
                           #   §5a) detail-toko/ home/ makanan-category/
                           #   order-history/
    seller/                # seller-only feature groups:
                           #   dashboard-penjual/ tambahMenu/ subscription/
hooks/                     # React hooks, grouped by owner:
    buyer/                 #   use-addresses, use-followed-stores,
                           #   use-liked-foods, use-orders, use-rebites-coins,
                           #   use-countdown, use-order-calculation
    seller/                #   use-require-seller, use-seller-*,
                           #   use-store-products
    use-notifications.ts   # shared hooks stay at the root: notifications,
    use-profile.ts         #   profile, toast
    use-toast.ts
lib/                       # categories, catalog, data, types, supabase, pricing,
                           #   subscription plans, store settings/hours, xendit
                           #   (flat by design — filename prefixes carry the
                           #   domain: order-*, store-*, notification-*, …)
  server/                  # server-only: supabase admin, xendit, pricing,
                           #   order-settlement, subscription-activation
supabase/migrations/       # SQL schema + RLS
public/                    # images (makanan*.jpg, hero-makanan.jpeg, logo.png, …)
```

Route groups `(landing)` / `(app)` / `(preview)` do **not** affect URLs. There is
deliberately no `(app)/layout.tsx`: app chrome (MobileNavbar/ProfileNavbar) is
rendered per page today. `(landing)/layout.tsx` exists because the five public
pages now genuinely share a shell (client boundary only — navbar/`main`/footer
come from each page's `PublicShell`, see §5).

## 4. Routes (from `npm run build`, 52 pages — `/test` removed 2026-10-11)

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
(client) = `MotionConfig` + Lenis + a `.theme-landing` wrapper (the colour
theme scope, see §6). Each page is a **Server Component** that
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
`/fitur`, and both app footers link there (`app/components/shared/app-footer.tsx`,
`app/components/shared/site-footer.tsx`).

Navigation source of truth is `app/components/landing/nav-items.ts`
(`PRIMARY_NAV`, `isCurrentPath`): `Beranda → /`, `Tentang Kami →
/tentang-kami`, `Fitur Unggulan → /fitur`, `Dampak → /dampak`, `Hubungi Kami →
/hubungi-kami`, plus `Masuk → /auth/login` and `Daftar → /auth/register`.
Adding a public page means adding it there once; navbar and footer both read it.

Public content pages (`/tentang-kami`, `/fitur`, `/dampak`, `/hubungi-kami`)
open with `PageIntro` (`app/components/landing/PageIntro.tsx`) — a centered
`h1` + optional lead on plain white, **no eyebrow, no panel, no wrapper
decoration** (the `PublicPageHero` component was deleted on 2026-10-11) — and
end with `ContactCTASection`. `/hubungi-kami` owns the contact form
(`contact-form.tsx`), which posts to the same pre-existing Formspree endpoint
the old FAQ form used (`https://formspree.io/f/xdeoorwd`, verified in
`FAQSection.tsx` at `HEAD`).

**Shared public-page conventions (2026-10-10 rewrite, tightened 2026-10-11):**

- Section titles on these four pages use `SectionHeading`
  (`app/components/landing/SectionHeading.tsx`) — centered `h2` +
  description, **no eyebrow label** (the `eyebrow` prop was removed
  everywhere on 2026-10-11; hierarchy comes from typography and spacing).
- The four pages contain **no decorative italics**. The only italic left is
  the *Bites* wordmark in `LandingNavbar`/`LandingFooter` (brand identity).
- `/fitur` keeps the section ids `pembeli` and `umkm` (linked from both app
  footers) — task-oriented numbered lists, one photo per group, no icon grid.
- `/dampak` is intentionally photo-free: narrative → three outcomes as a
  white editorial numbered list (hairline `border-t`, since the 2026-10-11
  neutral-band pass) → a 3-step flat chain diagram → an honest qualitative
  note. No invented statistics.
- Only content-verified photos are used (`public/hero-makanan.jpeg`,
  `public/terselamatkan.jpg`, `public/penerimaan.jpg`); see §10 for why other
  filenames cannot be trusted.

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
  (`DetailProductShell` in `app/components/buyer/detail-product/detail-page.tsx`:
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
- **Brand palette** (`app/globals.css`, exact values): `--brand-forest:
  153 44% 25%` = `#245C43` (+ `--brand-forest-dark` for hover),
  `--brand-charcoal: 120 11% 14%` = `#202820`, `--brand-amber: 34.1 80.6% 55.5%`
  = `#E99A32`, `--brand-sage: 84 22% 95.5%` = `#F4F6F1`, `--brand-muted:
  126.7 4.4% 40.2%` = `#626B63`. `tailwind.config.ts` exposes them as
  `brand.*` utilities (used e.g. by the amber hero highlight).
- **Landing colour scope**: `.theme-landing` (declared in `app/globals.css`,
  applied by the wrapper in `landing-shell.tsx`) maps those palette tokens
  onto the role tokens (`--primary`, `--foreground`, `--muted-foreground`,
  `--secondary`, `--muted`, `--accent`, `--ring`, …) for the five
  `app/(landing)/` routes only. The `:root` values above are deliberately
  unchanged, so buyer, seller and auth routes render exactly as before.
  `/preview/product` lives outside the group and keeps the `:root` tokens.
- **Landing typography roles**: `h1`/`h2`/`h3` use `text-foreground`
  (Charcoal Green in the landing scope); Forest Green stays on buttons,
  links, navigation, numbers, chips, icons and other brand accents;
  descriptions use `text-muted-foreground`; Warm Amber only on the hero
  word highlight.
- **Tailwind** (`tailwind.config.ts`): `font-display`/`font-sans` → Plus Jakarta
  Sans, `font-secondary` → Be Vietnam Pro; `bg-sale` shares the destructive hue.
- **Utilities**: `.text-balance`, `[id] { scroll-margin-top: 6.5rem }` for
  anchor offsets. (`.grain-overlay` still exists in `globals.css` and is used
  by app-side components, but **landing pages no longer use it** — removed
  2026-10-11.)
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
- **Section rhythm (all-white contract, 2026-10-11)**: every public page and
  every landing section sits on `bg-white`; adjacent sections are separated by
  a hairline `border-t border-border` and generous vertical padding — **no
  colored bands, no `bg-secondary` section fills, no green panels** on the
  public surface. Green (`--primary`) is reserved for foreground accents only:
  buttons, links, icons, small labels, active states. `bg-secondary`/`bg-accent`
  remain fine for small interactive elements (hover states, chips, icon
  tiles), just never as full-width section backgrounds. Section headings are
  centered `h2` + description via `SectionHeading` (no eyebrow labels).
  Radii: buttons/pills `rounded-full`, cards/images/panels `rounded-2xl`,
  inputs/small tiles `rounded-xl`.

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
- **Removed 2026-10-11**: the temporary `/test` Lottie experiment route
  (`app/(landing)/test/page.tsx`) is gone from the route table. Later the same
  day the FAQ decorative illustration was also removed
  (`app/components/landing/faq-illustration.tsx` deleted, `lottie-react`
  uninstalled) as part of the minimalist all-white pass — the FAQ is now a
  single centered column. The orphaned `public/lottie_animation/*.json` assets
  remain on disk and can be deleted with any future cleanup.
- Fixed after the 2026-10-09 pass (2026-10-10): the rewritten
  `HowItWorksSection.tsx` had invalid ARIA ids (`"cara - tab - pembeli "`
  with spaces, so `aria-controls`/`aria-labelledby` pointed at nothing) and
  dead Tailwind opacity steps (`text-white/55`, `text-white/65`,
  `bg-white/15`, `bg-white/65` — not in the generated scale, so the step
  progress line rendered invisible); `HeroSection.tsx` still fetched a
  featured product for the deleted `HeroListingCard` (dead Supabase request
  per landing visit). All three are fixed; the hero's floating category badge
  and `bg-secondary` pill were removed in the 2026-10-11 minimalist pass (the
  location line is now plain text with a `MapPin` icon).
- **`whileInView` on the cara-kerja step list never resolved** (verified
  2026-10-10 via CDP on `b4fa38d` + `next start`): the three `motion.li`
  steps stayed at inline `opacity:0; transform:translateY(16px)` at
  1440/375, in normal *and* `prefers-reduced-motion: reduce`, after real
  wheel-event scrolling brought the `ol` fully into view (own
  IntersectionObserver confirmed the geometry; `scrollY` landed, section
  visible). Under reduced motion a tab-click remount (`key={active}`) also
  stayed at 0 — the large empty green band in full-page screenshots is
  this bug, not a layout gap. The in-flight working-tree
  fix replaces panel `whileInView` with mount-time `animate` + the shared
  `Reveal`, so the content always ends visible regardless of observer
  timing. Lesson: on this landing page prefer `Reveal`/`animate` over
  `whileInView` for content that must be visible in static captures and
  under reduced motion.
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
  branch of `app/components/buyer/detail-product/detail-product-content.tsx`
  returns without the `shell.header`, so `/preview/product?id=…` with an
  unknown id shows no navbar (the same component backs the in-app
  `/detail/product`). Fixed routes and known products render the landing
  navbar correctly (verified).
- **Pre-existing, unchanged by the redesign**: public pages have no
  skip-to-content link; landmarks are otherwise correct
  (`header`/`nav[aria-label]`/`main`/`footer`).
- **Pre-existing, outside the landing**: app pages still contain off-brand
  colors such as `text-purple-700`
  (`app/components/buyer/order-history/order-detail-modal.tsx`) — the white/green
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

### Public content pages rewritten (2026-10-10)

Scope: `/tentang-kami`, `/fitur`, `/dampak`, `/hubungi-kami` only (`/` and
`/test` untouched, except `ContactCTASection` which lost a decorative italic
span).

- `npm run typecheck` ✅, `npm run lint` ✅ (0 errors, **4 warnings = the
  recorded baseline, unchanged**), `npm run build` ✅ (53 pages; all four
  routes static; route table unchanged, `/test` still present).
- CDP sweep vs `next start -p 3100`:
  - Pass 1 — 4 routes × 8 widths (320/360/375/390/414/640/768/1024/1440):
    zero horizontal overflow, zero console errors/exceptions, exactly one
    `h1` per page, no `italic` element inside `<main>`, correct
    `aria-current="page"` per route, all 9 internal link targets → 200.
  - Pass 2 — 4 routes × 5 widths with a scroll-through to trigger the
    `Reveal` animations: zero overflow, zero broken images, zero text stuck
    below `opacity` 0.9, zero console errors.
  - Full-page screenshots at 1440 and 375 for all four routes reviewed by
    eye: hierarchy, spacing, image crops and green sections all render as
    intended at both sizes.
- Design-rule checks on the diff: no `italic`, `gradient`, `blur-*` or
  `backdrop-*` class in `app/(landing)/`; every opacity modifier used in the
  rewritten files is a real Tailwind step (e.g. `/70`, `/20`, `/10`, `/25`).

### Neutral bands, `/test` removal, FAQ Lottie (2026-10-11)

Changes (all uncommitted in the working tree at the time of writing):

- **`/hubungi-kami/page.tsx`** restored to the standard public shell
  (`PublicShell` + `PublicPageHero` with the page `h1`); the stray app-side
  `SiteFooter` import and unused imports removed; sr-only `h2` for the
  channels section. Leftover `mt-3` on the form `h2`
  (`hubungi-kami/contact-form.tsx`) removed.
- **`HowItWorksSection.tsx`**: dead hex colors `bg-[#f4f5f2]`/`bg-[#f7f8f6]`
  replaced with the `bg-muted`/`bg-secondary` tokens; leading/trailing blank
  lines stripped in it and `FAQSection.tsx`.
- **FAQ illustration**: new
  `app/components/landing/faq-illustration.tsx` — `lottie-react` loaded via
  `next/dynamic` only when the section nears the viewport (IntersectionObserver),
  `role="img"` + Indonesian `aria-label`, no autoplay under
  `prefers-reduced-motion`. `FAQSection.tsx` lost ~90 lines of manual JSON
  fetch/effect code and the `scale-[1.4]`/`hover:scale-[1.1]` overflow hacks.
- **Green bands removed**: the full-width `bg-primary` sections "Tiga hasil"
  (`/dampak`) and "Pendekatan" (`/tentang-kami`) are now white bands with a
  hairline `border-t border-border`; all `text-white`/`border-white/20`
  styles inside them were converted to tokens (`text-primary`,
  `text-muted-foreground`, `border-border`, image frames
  `border-border/70 bg-muted`). `SectionHeading`'s now-unused `variant="inverse"`
  was deleted. Green remains only on action buttons, the CTA card and footer.
- **`HeroSection.tsx`**: secondary CTA lost `hover:scale-105` (now
  `rounded-2xl border border-border` + `hover:border-primary hover:bg-secondary`,
  matching the navbar secondary style); photo badge lost `bg-white/95 +
  backdrop-blur` → solid `bg-white`.
- **`/test` route deleted** (`app/(landing)/test/`); `lottie-react` kept for
  the FAQ illustration, orphaned `basket.json` left on disk.

Verification (production build, `next start -p 3100`, scripted headless
Chrome):

- `npm run build` ✅ (52 pages; `/test` gone; all five public routes static),
  `npm run typecheck` ✅, `npm run lint` ✅ (0 errors, the same 4 baseline
  warnings — all in app-side files).
- CDP sweep: 5 routes × widths 320/375/390/430/768/1024/1280/1440 → zero
  horizontal overflow, zero console errors/exceptions, zero failed requests,
  zero local responses ≥400, exactly one `h1` per page, correct
  `aria-current="page"` per route, no `section` whose background equals the
  brand green (the CTA card is a `div`, not a section band).
- Interactions: FAQ accordion toggles one-open-at-a-time (`aria-expanded`
  tracked); the lazy Lottie mounts an SVG after scrolling `#faq` into view;
  cara-kerja tabs switch `aria-selected`; mobile menu (375) opens and closes
  on Escape.
- Keyboard: real Tab-key sweep on `/` — `:focus-visible` triggers on all first
  10 stops; every nav/CTA shows the 2px `ring-primary` + white offset ring.
- Reduced motion: with `prefers-reduced-motion: reduce` emulated, the open FAQ
  panel renders instantly at full opacity/height.
- Full-page screenshots at 1440 and 375 for all five routes (after a
  scroll-through so `Reveal` animations fire; `stillHidden: []` everywhere)
  reviewed by eye — the converted neutral bands render as intended.
- Caveat: `/#langganan` and `/#faq` cross-page anchor links were reported
  "missing" by the harness on non-landing pages, but both ids exist on `/`
  (false positive — the check tested the wrong document).

### All-white minimalist pass, `PublicPageHero` removal (2026-10-11, later)

Follow-up pass applying a stricter brief: **every public surface is white**,
no `bg-secondary` section fills, no eyebrow labels, no hero wrapper, green
only as foreground accent. Changes (all uncommitted, layered on the pass
above):

- **`PageIntro` added** (`app/components/landing/PageIntro.tsx`): centered
  `h1` + optional `lead` on plain white — replaces `PublicPageHero` on all
  four content pages; **`PublicPageHero.tsx` deleted**. No eyebrow, no panel,
  no breadcrumb.
- **`SectionHeading`**: `eyebrow` prop removed (component now takes only
  `id`/`heading`/`description`); every `eyebrow="…"` call site updated across
  the five landing sections and four content pages.
- **Navbar** (`LandingNavbar.tsx`): always solid `bg-white border-b
  border-border` — the translucent `backdrop-blur` scroll state and the
  `scrolled` state/effect are gone (no glassmorphism anywhere).
- **Footer** (`LandingFooter.tsx`): converted from `bg-primary` green to
  white with `border-t border-border`; all `text-white/70` etc. converted to
  `text-muted-foreground`/`text-foreground`; social circles and back-to-top
  button now `border-border bg-white` with green hover.
- **`ContactCTASection`**: the green rounded card is gone — now a white
  section (`border-t`) with centered heading and the same two CTAs (green
  primary pill + bordered secondary pill).
- **Homepage sections**: Why/Testimonials/FAQ lost `grain-overlay
  bg-secondary` → white + `border-t`; HowItWorks step cards lost
  `bg-secondary` card chrome → borderless numbered columns with a top
  hairline, and the tablist container is now `border border-border bg-white`;
  Membership's green "popular" card is now white with `border-primary` +
  accent "Populer" pill; product cards lost the heavy hover shadow
  (border-color change only); hero lost the floating category-count badge,
  the `bg-secondary` pill (now a plain `MapPin` line), the oversized photo
  shadow and `rounded-[1.5rem]/[2rem]` radii.
- **FAQ illustration removed**: `faq-illustration.tsx` deleted,
  `lottie-react` uninstalled (`npm uninstall`), FAQ is a single centered
  `max-w-3xl` column; orphaned `public/lottie_animation/*.json` left on disk.
- **Contact form**: panel `bg-secondary` → `bg-white border border-border`;
  the small-caps eyebrow above the channel list removed.
- **Radius standard**: buttons/pills `rounded-full`, cards/images/panels
  `rounded-2xl`, inputs/icon tiles `rounded-xl` (the last `rounded-[1.5rem]`
  images on `/tentang-kami` and `/fitur` were converted).

Verification (production build, `next start -p 3100`, scripted headless
Chrome):

- `npm run build` ✅ (52 pages, all five public routes static),
  `npm run typecheck` ✅, `npm run lint` ✅ (0 errors, same 4 baseline
  app-side warnings).
- CDP sweep: 5 routes × 8 widths (320/375/390/430/768/1024/1280/1440) → zero
  overflow, zero console errors, zero failed requests, one `h1` per page,
  correct `aria-current`, zero green `section` bands.
- Interactions: FAQ one-open-at-a-time, cara-kerja tabs switch
  `aria-selected`, mobile menu opens/closes on Escape. (`lottieSvg: true` in
  the harness output is a false positive — the probe matches any `#faq svg`,
  including the accordion's Plus icon.)
- Keyboard: real Tab-key sweep — 2px `ring-primary` + white offset on all
  first 10 stops. Reduced motion: open FAQ panel renders instantly at full
  opacity.
- Full-page scrolled screenshots (`stillHidden: []` everywhere) at 1440 and
  375 for all five routes reviewed by eye: all-white bands, hairline
  dividers, green accents only, white footer — renders as intended.
