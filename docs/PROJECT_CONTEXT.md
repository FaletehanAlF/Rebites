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
| UI | React `18.2.0`, Server Components by default, `"use client"` only where needed | e.g. `app/page.tsx` is a Server Component |
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
(seller pages only), `embla-carousel-react` (carousel components).

## 3. Repository structure

```
app/
  page.tsx                 # landing page (Server Component) + landing sections
  layout.tsx               # fonts, metadata, lang="id"
  home/                    # buyer app home
  makanan/[category]/      # SSG category pages (8 categories)
  detail/                  # product, pesanan, pesanan/sukses, toko
  dashboard/penjual/       # seller dashboard (menu, pesanan, ulasan, performa,
                           #   pengaturan, notifikasi, langganan)
  auth/                    # login, register, seller login/register,
                           #   forgotPassword, buat-sandi-baru, callback
  riwayatPesanan/ notifikasi/ profile/ toko/ langganan/
  api/                     # xendit checkout+verify, orders/[code], profile,
                           #   subscriptions, webhooks/xendit
  components/
    landing/               # landing sections (see §5)
    dashboard-penjual/ home/ shared/ ui/
  globals.css              # design tokens + utilities
hooks/                     # data hooks (orders, products, reviews, …)
lib/                       # categories, catalog, data, types, supabase, pricing,
                           #   subscription plans, store settings/hours, xendit
supabase/migrations/       # SQL schema + RLS
public/                    # images (makanan*.jpg, *.avif, …)
```

## 4. Routes (from `npm run build`)

Static (○): `/`, `/home`, `/auth/*`, `/detail/*`, `/riwayatPesanan`,
`/notifikasi/pembeli`, `/profile`, `/toko`, `/dashboard/penjual/*`,
`/langganan/pembayaran`, **`/dashboard/admin/*`** (see §5.1).
SSG (●): `/makanan/[category]` (8 paths).
Dynamic (ƒ): `/langganan/sukses`, `/api/checkout/xendit(+verify)`,
`/api/orders/[code]`, `/api/profile(+addresses|avatar)`,
`/api/subscriptions/xendit(+verify)`, `/api/webhooks/xendit`,
`/api/admin/**` (role-guarded helper routes).

## 5.1 Admin panel (merged from `feature/admin-full-update`)

Area `/dashboard/admin/**` + `app/components/admin/**`, protected by RBAC:
every admin route/row passes an admin-verification wrapper (see
`lib/admin-*` helpers and cookie/session `me` status). Two roles only:
`super_admin` (full) and `admin` (proposer/`super_admin` approval for role
changes). Verified sub-areas: overview, artikel, langganan, moderasi,
monitoring (+ aktivitas/audit/laporan/peringatan/sanksi), pengaturan,
pengguna (+detail), permintaan-role, pesanan, produk, profile, riwayat,
system, UMKM (+detail).

Admin UX conventions (unittest-checked in `tests/`): localStorage-backed
preferences (`lib/admin-preferences.ts`, `ADMIN_LOCAL_STORAGE_KEYS`), audit
trail writes attempt best-effort inserts into `admin_audit_logs`, and shared
fetch helpers in `lib/` get 401-retry with one refresh.

## 5. Landing page architecture (`/`)

`app/page.tsx` stays a **Server Component**; `LandingShell` (client) wraps
`MotionConfig` + Lenis + `Preloader`. Section order:

| Component | Section id (navigation contract) | Client? |
| --- | --- | --- |
| `LandingNavbar` | — (fixed, active-section highlight) | yes |
| `HeroSection` | `top` | yes |
| `TrustSection` | `about` | no |
| `HowItWorksSection` | `cara-kerja` | no |
| `FoodDiscoverySection` | `rekomendasi` | yes (lazy `lib/catalog` fetch) |
| `SellerSection` | `umkm` + `langganan` (anchor span) | no |
| `BuyerSection` | `pembeli` | no |
| `FeaturesSection` | `fitur` | no |
| `BenefitsSection` | `manfaat` | no |
| `FAQSection` | `faq` (accordion + contact form) | yes |
| `FinalCTASection` | heading id `final-cta-heading` | no |
| `LandingFooter` | — (anchor links + back-to-top) | yes |

**Do not rename or remove ids** `cara-kerja`, `umkm`, `pembeli`, `langganan`,
`rekomendasi`, `faq`: navbar, footer and other pages deep-link to them
(`app/components/landing/scroll-to-section.ts` delegates to Lenis).

Live catalog row in `FoodDiscoverySection` lazy-imports `@/lib/catalog` on
mount and renders nothing when empty (no placeholder products).

## 6. Design system

- **Colors** (`app/globals.css`): white `--background` is the primary surface;
  brand green `--primary: 148 41% 23%` (+ `--primary-dark`); neutrals
  `--secondary`, `--muted`, `--border`; semantic `--destructive/--warning/
  --success`; `--radius: 0.25rem`. No cream/beige/caramel surfaces.
- **Tailwind** (`tailwind.config.ts`): `font-display`/`font-sans` → Plus Jakarta
  Sans, `font-secondary` → Be Vietnam Pro; `bg-sale` shares the destructive hue.
- **Admin-only palette** (also in `tailwind.config.ts` + `.admin-root` overrides
  in `app/globals.css`): tokens like `forest`, `cream`, `charcoal-*`, `sage-*`,
  `caramel` remain valid and are reserved for the admin dashboard; buyer-facing
  surfaces must keep using the white/green tokens above. `ring-hairline`,
  `border-hairline` are hairline-neutral greys usable in both areas.
- **Utilities**: `.text-balance`, `.grain-overlay` (3.5% noise texture used on
  landing sections), `[id] { scroll-margin-top: 6.5rem }` for anchor offsets.
- **Motion**: `app/components/shared/reveal.tsx` (`Reveal`, framer in-view);
  global CSS + `MotionConfig` respect `prefers-reduced-motion`.
- **Recurring pattern**: duplicated `FOCUS_RING` constant in landing files
  (`focus-visible:ring-2 focus-visible:ring-primary …`) — consider extracting to
  `lib/utils.ts` if another refactor touches those files.
- **Section rhythm**: alternating white / `bg-secondary` / `bg-primary` bands;
  editorial two-column headers (eyebrow + heading + supporting paragraph).

## 7. Data, integrations and assets

- Supabase holds profiles, UMKM stores, products, orders, reviews, follows,
  favorites, notifications, subscriptions (schema in `supabase/migrations/`).
- Payments via Xendit (secret key + webhook callback token, server only).
- Category tile images come from `images.pexels.com` (`lib/categories.ts`).
- Local photos in `public/`: **semuanya AVIF**. `hero-makanan.avif`, `logo.avif`,
  `makanan1–5` / `makanan8–10` / `makanan13–15`, `foods/ikansayur.avif`, dan foto
  langkah `penjual-login.avif`, `pembeli-mencaro.avif`, `penerimaan.avif`,
  `terselamatkan.avif`. Tidak ada lagi JPG/JPEG/WebP di `public/`.
  `makanan6`, `makanan7`, `makanan11`, dan `makanan12` sudah dihapus: tidak
  dirujuk kode maupun database (hanya tersisa di migrasi seed lama).

  **PENTING — database masih menyimpan nama lama.** `products.image_url` (18
  baris) dan `orders.image_url` (24 baris) masih berbunyi `/makanan1.jpeg`,
  `/makanan9.webp`, dan seterusnya. Berkasnya kini `.avif`. Jembatannya adalah
  `lib/image-path.ts` (`resolveImageSrc`), yang dipakai `SmartImage` dan setiap
  mapper data (katalog, flash sale, produk penjual, pesanan, detail produk).
  Resolver itu memetakan path lokal berekstensi lama ke `.avif` dan **tidak**
  menyentuh URL absolut (Supabase Storage, Pexels) maupun data URI.
  Bila kelak database diperbarui ke `.avif`, resolver tetap benar — ia hanya
  mengubah nilai yang masih berekstensi lama.
- FAQ contact form posts to a Formspree endpoint from `FAQSection.tsx`.
- **Assumption**: footer social links (`instagram.com/rebites` etc.) and
  `halo@rebites.id` were not verified as real accounts.

## 8. Environment variables (names only — see `.env.example`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (server only), `NEXT_PUBLIC_SITE_URL`,
`XENDIT_SECRET_KEY`, `XENDIT_CALLBACK_TOKEN` / `XENDIT_WEBHOOK_TOKEN`,
`BITESHIP_API_KEY`, `BITESHIP_COURIERS`, `BITESHIP_WEBHOOK_SECRET`,
`DELIVERY_BASE_FEE_IDR` / `DELIVERY_PER_KM_FEE_IDR` / `DELIVERY_MIN_FEE_IDR` /
`DELIVERY_MAX_FEE_IDR`, `SUPER_ADMIN_USER_ID` (admin bootstrap id).

Never prefix server secrets with `NEXT_PUBLIC_`.

## 9. Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | dev server with Turbopack (port 3000) |
| `npm run dev:webpack` | dev server without Turbopack |
| `npm run build` | production build + type check (lint skipped: `eslint.ignoreDuringBuilds`) |
| `npm run lint` | `next lint` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run typecheck:tests` | type-check `tests/` via `tsconfig.tests.json` |
| `npm run test:<name>` | 20 focused suites (`node --test`, e.g. checkout price/failure, admin guard/health/analytics, stock release, shipping rates); see `package.json` |
| `npm start` | serve production build |

## 10. Known issues / technical debt (verified)

- Tailwind prints an `ambiguous` warning for
  `ease-[cubic-bezier(0.22,1,0.36,1)]` (escape it or extract a token).
- `next build` skips ESLint (`eslint.ignoreDuringBuilds: true` in
  `next.config.js`); run `npm run lint` separately. Remaining warnings are
  pre-existing (`<img>` in seller dashboard, hook deps in `detail/toko`).
- **`public/makanan2.avif` and `public/makanan5.avif` have a baked-in
  transparency checkerboard** (rasterized PNG artifact) — do not use them in
  new UI. They may still be referenced by product rows in the database.
- Unreferenced components left in place (not part of the current landing page):
  `app/components/hero-section.tsx`, `app/components/HowItWorks.tsx`,
  `public/ref-pg.jpeg`, `public/loading.mp4`.
- Removed in the last cleanup: `landing/testimonial-section.tsx` (contained
  fabricated testimonials), `landing/partner-marquee.tsx`,
  `landing/catalog-sections.tsx`, `components/hero-food-carousel.tsx`,
  `components/flash-sale-grid.tsx`, and `RevealWords` in `shared/reveal.tsx`.
- 20 automated `node --test` suites exist (`tests/*`, wired as npm
  `test:<name>` scripts) covering checkout pricing/idempotency/failure,
  Xendit fail-closed paths, admin RBAC and UI regressions, stock release and
  shipping; run them before touching those areas. Visual verification for new
  UI stays manual (browser at 320/375/768/1024/1440/1920 — no horizontal
  overflow observed).
- **EOL caveat (Windows, `core.autocrlf=true`)**: `tests/admin-ui-regressions`
  has one EOL-sensitive regex (`ADMIN_ROLE_DECISIONS_SEEN_KEY,\n] as const`);
  if a fresh checkout smudges `lib/admin-preferences.ts` to CRLF the suite can
  fail spuriously — restore the file to LF (`git cat-file blob
  :0:lib/admin-preferences.ts` → workdir) or add a `.gitattributes`
  `text=auto eol=lf` rule for `tests/` fixtures later.

## 11. Conventions for future work

- Keep pages as Server Components; add `"use client"` only for genuine
  interactivity.
- Buyer pages that require a session wrap the whole view in
  `<RequireAuth>` (see `notifikasi/pembeli/page.tsx`): the guard lives OUTSIDE
  the shell so navbar/title/skeleton are hidden before redirect.
- Home navigation links point to `/home` — never `/homePage` (the
  `/homePage` path does not exist; it was a transient develop bug).
- Reuse the design tokens; do not introduce new fonts, palettes or gradients.
- Preserve landing section ids and navbar/footer anchor behavior.
- Do not fabricate stats, testimonials, partners or logos anywhere in the UI.
- Validate with `npm run typecheck`, `npm run lint`, `npm run build`, and a
  visual pass before calling UI work done.
