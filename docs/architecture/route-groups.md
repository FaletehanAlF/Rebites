# Route Groups & URL Mapping

> Complete URL-to-path mapping for all route groups in the ReBites Next.js 14 App Router.

---

## Route Group Structure

```
app/
├── (landing)/           # Public marketing pages
├── (app)/               # Authenticated buyer/seller application
├── (preview)/           # Public preview pages
├── auth/                # Authentication pages
├── api/                 # API routes
├── dashboard/           # Dashboards (admin, kurir)
├── detail/              # Detail pages (product, order, store)
├── makanan/             # Category pages (SSG)
├── riwayatPesanan/      # Order history
├── notifikasi/          # Notifications
├── profile/             # User profile
├── toko/                # Store listing
├── toko-diikuti/        # Followed stores
├── banding/             # Comparison/dispute
├── langganan/           # Subscription pages
├── pengaturan/          # Settings
├── artikel/             # Articles/blog
├── terms/               # Terms of service
├── privacy/             # Privacy policy
├── layout.tsx           # Root layout
├── globals.css          # Global styles
├── error.tsx            # Global error boundary
├── global-error.tsx     # Root error boundary
└── not-found.tsx        # Global 404
```

---

## (landing) — Public Marketing

| Route | File | Type | Notes |
|-------|------|------|-------|
| `/` | `app/(landing)/page.tsx` | Server Component | Main landing page |
| `/fitur` | `app/(landing)/fitur/page.tsx` | Server Component | Features page |
| `/tentang-kami` | `app/(landing)/tentang-kami/page.tsx` | Server Component | About page |
| `/hubungi-kami` | `app/(landing)/hubungi-kami/page.tsx` | Server Component | Contact page |
| `/dampak` | `app/(landing)/dampak/page.tsx` | Server Component | Impact page |
| `/blog` | `app/(landing)/blog/page.tsx` | Server Component | Blog listing (legacy?) |
| `/preview/product` | `app/(preview)/preview/product/page.tsx` | Client Component | Public product preview |

---

## (app) — Authenticated Application

| Route | File | Type | Auth |
|-------|------|------|------|
| `/home` | `app/(app)/home/page.tsx` | Client Component | Buyer |
| `/makanan` | `app/(app)/makanan/page.tsx` | Server Component | Buyer |
| `/makanan/[category]` | `app/(app)/makanan/[category]/page.tsx` | Server Component (SSG) | Buyer |
| `/detail/product` | `app/(app)/detail/product/page.tsx` | Client Component | Buyer |
| `/detail/pesanan` | `app/(app)/detail/pesanan/page.tsx` | Client Component | Buyer |
| `/detail/pesanan/sukses` | `app/(app)/detail/pesanan/sukses/page.tsx` | Client Component | Buyer |
| `/detail/toko` | `app/(app)/detail/toko/page.tsx` | Client Component | Buyer |
| `/riwayatPesanan` | `app/riwayatPesanan/page.tsx` | Client Component | Buyer |
| `/riwayatPesanan/[orderCode]` | `app/riwayatPesanan/[orderCode]/page.tsx` | Client Component | Buyer |
| `/notifikasi/pembeli` | `app/(app)/notifikasi/pembeli/page.tsx` | Client Component | Buyer |
| `/profile` | `app/(app)/profile/page.tsx` | Client Component | Buyer |
| `/toko` | `app/(app)/toko/page.tsx` | Client Component | Buyer |
| `/toko-diikuti` | `app/toko-diikuti/page.tsx` | Client Component | Buyer |
| `/banding` | `app/banding/page.tsx` | Client Component | Buyer |
| `/banding/status` | `app/banding/status/page.tsx` | Client Component | Buyer |
| `/pengaturan` | `app/pengaturan/page.tsx` | Client Component | Buyer |
| `/pengaturan/coin` | `app/pengaturan/coin/page.tsx` | Client Component | Buyer |
| `/langganan/pembayaran` | `app/(app)/langganan/pembayaran/page.tsx` | Client Component | Seller |
| `/langganan/sukses` | `app/(app)/langganan/sukses/page.tsx` | Client Component | Seller |

### Seller Dashboard (`/dashboard/penjual`)

| Route | File | Type | Notes |
|-------|------|------|-------|
| `/dashboard/penjual` | `app/(app)/dashboard/penjual/page.tsx` | Client Component | Redirects to storeId |
| `/dashboard/penjual/[storeId]` | `app/(app)/dashboard/penjual/[storeId]/page.tsx` | Client Component | Main dashboard |
| `/dashboard/penjual/[storeId]/menu` | `app/(app)/dashboard/penjual/[storeId]/menu/page.tsx` | Client Component | Product management |
| `/dashboard/penjual/[storeId]/tambahMenu` | `app/(app)/dashboard/penjual/[storeId]/tambahMenu/page.tsx` | Client Component | Add product |
| `/dashboard/penjual/[storeId]/pesanan` | `app/(app)/dashboard/penjual/[storeId]/pesanan/page.tsx` | Client Component | Order management |
| `/dashboard/penjual/[storeId]/ulasan` | `app/(app)/dashboard/penjual/[storeId]/ulasan/page.tsx` | Client Component | Reviews |
| `/dashboard/penjual/[storeId]/performa` | `app/(app)/dashboard/penjual/[storeId]/performa/page.tsx` | Client Component | Analytics |
| `/dashboard/penjual/[storeId]/pengaturan` | `app/(app)/dashboard/penjual/[storeId]/pengaturan/page.tsx` | Client Component | Store settings |
| `/dashboard/penjual/[storeId]/notifikasi` | `app/(app)/dashboard/penjual/[storeId]/notifikasi/page.tsx` | Client Component | Seller notifications |
| `/dashboard/penjual/[storeId]/langganan` | `app/(app)/dashboard/penjual/[storeId]/langganan/page.tsx` | Client Component | Subscription management |

### Alternate Seller Paths (without storeId)

| Route | File | Notes |
|-------|------|-------|
| `/dashboard/penjual/tambahMenu` | `app/(app)/dashboard/penjual/tambahMenu/page.tsx` | Redirects to storeId |
| `/dashboard/penjual/menu` | `app/(app)/dashboard/penjual/menu/page.tsx` | Redirects to storeId |
| `/dashboard/penjual/pesanan` | `app/(app)/dashboard/penjual/pesanan/page.tsx` | Redirects to storeId |
| `/dashboard/penjual/performa` | `app/(app)/dashboard/penjual/performa/page.tsx` | Redirects to storeId |
| `/dashboard/penjual/pengaturan` | `app/(app)/dashboard/penjual/pengaturan/page.tsx` | Redirects to storeId |
| `/dashboard/penjual/notifikasi` | `app/(app)/dashboard/penjual/notifikasi/page.tsx` | Redirects to storeId |
| `/dashboard/penjual/ulasan` | `app/(app)/dashboard/penjual/ulasan/page.tsx` | Redirects to storeId |
| `/dashboard/penjual/langganan` | `app/(app)/dashboard/penjual/langganan/page.tsx` | Redirects to storeId |

---

## (preview) — Public Preview

| Route | File | Type |
|-------|------|------|
| `/preview/product` | `app/(preview)/preview/product/page.tsx` | Client Component |

---

## Auth Pages (`/auth`)

| Route | File | Type |
|-------|------|------|
| `/auth/login` | `app/auth/login/page.tsx` | Client Component |
| `/auth/login/penjual` | `app/auth/login/penjual/page.tsx` | Client Component |
| `/auth/register` | `app/auth/register/page.tsx` | Client Component |
| `/auth/register/penjual` | `app/auth/register/penjual/page.tsx` | Client Component |
| `/auth/forgotPassword` | `app/auth/forgotPassword/page.tsx` | Client Component |
| `/auth/buat-sandi-baru` | `app/auth/buat-sandi-baru/page.tsx` | Client Component |
| `/auth/callback` | `app/auth/callback/page.tsx` | Client Component |

---

## API Routes (`/api`)

### Checkout & Payments
| Route | File | Method |
|-------|------|--------|
| `/api/checkout/xendit` | `app/api/checkout/xendit/route.ts` | POST |
| `/api/checkout/xendit/verify` | `app/api/checkout/xendit/verify/route.ts` | POST |
| `/api/subscriptions/xendit` | `app/api/subscriptions/xendit/route.ts` | POST |
| `/api/subscriptions/xendit/verify` | `app/api/subscriptions/xendit/verify/route.ts` | POST |

### Webhooks
| Route | File | Method |
|-------|------|--------|
| `/api/webhooks/xendit` | `app/api/webhooks/xendit/route.ts` | POST |
| `/api/webhooks/biteship` | `app/api/webhooks/biteship/route.ts` | POST |

### Orders
| Route | File | Methods |
|-------|------|---------|
| `/api/orders/[code]` | `app/api/orders/[code]/route.ts` | GET, PATCH |

### Profile & Addresses
| Route | File | Methods |
|-------|------|---------|
| `/api/profile` | `app/api/profile/route.ts` | GET, PATCH |
| `/api/profile/avatar` | `app/api/profile/avatar/route.ts` | POST, DELETE |
| `/api/profile/addresses` | `app/api/profile/addresses/route.ts` | GET, POST, PATCH, DELETE |

### Shipping
| Route | File | Method |
|-------|------|--------|
| `/api/shipping/rates` | `app/api/shipping/rates/route.ts` | POST |
| `/api/delivery/route` | `app/api/delivery/route/route.ts` | POST |

### Chat & Chatbot
| Route | File | Method |
|-------|------|--------|
| `/api/chat` | `app/api/chat/route.ts` | POST |
| `/api/chat/actions` | `app/api/chat/actions/route.ts` | POST |

### Courier
| Route | File | Methods |
|-------|------|---------|
| `/api/courier/profile` | `app/api/courier/profile/route.ts` | GET, POST |
| `/api/courier/assignments` | `app/api/courier/assignments/route.ts` | GET, PATCH |
| `/api/courier/location` | `app/api/courier/location/route.ts` | POST |
| `/api/courier/messages` | `app/api/courier/messages/route.ts` | GET, POST |
| `/api/courier/demo` | `app/api/courier/demo/route.ts` | GET |

### Articles
| Route | File | Methods |
|-------|------|---------|
| `/api/articles` | `app/api/articles/route.ts` | GET |
| `/api/articles/[slug]` | `app/api/articles/[slug]/route.ts` | GET |

### Visitors & Analytics
| Route | File | Method |
|-------|------|--------|
| `/api/visitors` | `app/api/visitors/route.ts` | POST |
| `/api/store-visitors` | `app/api/store-visitors/route.ts` | GET |
| `/api/seller/store-visitors` | `app/api/seller/store-visitors/route.ts` | GET |

### Admin API
| Route | File | Methods |
|-------|------|---------|
| `/api/admin/dashboard` | `app/api/admin/dashboard/route.ts` | GET |
| `/api/admin/analytics` | `app/api/admin/analytics/route.ts` | GET |
| `/api/admin/health` | `app/api/admin/health/route.ts` | GET |
| `/api/admin/me` | `app/api/admin/me/route.ts` | GET |
| `/api/admin/users` | `app/api/admin/users/route.ts` | GET |
| `/api/admin/users/[id]` | `app/api/admin/users/[id]/route.ts` | GET, PATCH, DELETE |
| `/api/admin/users/[id]/role` | `app/api/admin/users/[id]/role/route.ts` | PATCH |
| `/api/admin/users/[id]/role-history` | `app/api/admin/users/[id]/role-history/route.ts` | GET |
| `/api/admin/users/[id]/coins` | `app/api/admin/users/[id]/coins/route.ts` | PATCH |
| `/api/admin/users/[id]/deletion` | `app/api/admin/users/[id]/deletion/route.ts` | POST |
| `/api/admin/users/[id]/hard-deletion` | `app/api/admin/users/[id]/hard-deletion/route.ts` | POST |
| `/api/admin/users/export` | `app/api/admin/users/export/route.ts` | GET |
| `/api/admin/role-requests` | `app/api/admin/role-requests/route.ts` | GET |
| `/api/admin/role-requests/[id]/approve` | `app/api/admin/role-requests/[id]/approve/route.ts` | POST |
| `/api/admin/role-requests/[id]/reject` | `app/api/admin/role-requests/[id]/reject/route.ts` | POST |
| `/api/admin/umkm` | `app/api/admin/umkm/route.ts` | GET |
| `/api/admin/umkm/[id]` | `app/api/admin/umkm/[id]/route.ts` | GET, PATCH |
| `/api/admin/umkm/[id]/verify` | `app/api/admin/umkm/[id]/verify/route.ts` | POST |
| `/api/admin/umkm/[id]/activation` | `app/api/admin/umkm/[id]/activation/route.ts` | PATCH |
| `/api/admin/umkm/[id]/deletion` | `app/api/admin/umkm/[id]/deletion/route.ts` | POST |
| `/api/admin/umkm/export` | `app/api/admin/umkm/export/route.ts` | GET |
| `/api/admin/products` | `app/api/admin/products/route.ts` | GET |
| `/api/admin/products/[id]` | `app/api/admin/products/[id]/route.ts` | GET, PATCH |
| `/api/admin/products/[id]/approve` | `app/api/admin/products/[id]/approve/route.ts` | POST |
| `/api/admin/products/[id]/reject` | `app/api/admin/products/[id]/reject/route.ts` | POST |
| `/api/admin/products/[id]/warn` | `app/api/admin/products/[id]/warn/route.ts` | POST |
| `/api/admin/products/[id]/deletion` | `app/api/admin/products/[id]/deletion/route.ts` | POST |
| `/api/admin/products/export` | `app/api/admin/products/export/route.ts` | GET |
| `/api/admin/orders` | `app/api/admin/orders/route.ts` | GET |
| `/api/admin/orders/[id]` | `app/api/admin/orders/[id]/route.ts` | GET, PATCH |
| `/api/admin/orders/[id]/status-history` | `app/api/admin/orders/[id]/status-history/route.ts` | GET |
| `/api/admin/orders/export` | `app/api/admin/orders/export/route.ts` | GET |
| `/api/admin/shipments` | `app/api/admin/shipments/route.ts` | GET |
| `/api/admin/shipments/[id]` | `app/api/admin/shipments/[id]/route.ts` | GET |
| `/api/admin/pengiriman` | `app/api/admin/pengiriman/route.ts` | GET |
| `/api/admin/pengiriman/[id]` | `app/api/admin/pengiriman/[id]/route.ts` | GET |
| `/api/admin/chat/threads` | `app/api/admin/chat/threads/route.ts` | GET |
| `/api/admin/chat/threads/[id]` | `app/api/admin/chat/threads/[id]/route.ts` | GET |
| `/api/admin/articles` | `app/api/admin/articles/route.ts` | GET, POST |
| `/api/admin/articles/[id]` | `app/api/admin/articles/[id]/route.ts` | GET, PATCH, DELETE |
| `/api/admin/articles/[id]/publish` | `app/api/admin/articles/[id]/publish/route.ts` | POST |
| `/api/admin/subscriptions` | `app/api/admin/subscriptions/route.ts` | GET |
| `/api/admin/reports` | `app/api/admin/reports/route.ts` | GET |
| `/api/admin/reports/[id]` | `app/api/admin/reports/[id]/route.ts` | GET, PATCH |
| `/api/admin/reports/[id]/notes` | `app/api/admin/reports/[id]/notes/route.ts` | POST |
| `/api/admin/reports/export` | `app/api/admin/reports/export/route.ts` | GET |
| `/api/admin/visitors` | `app/api/admin/visitors/route.ts` | GET |
| `/api/admin/activity-logs` | `app/api/admin/activity-logs/route.ts` | GET |
| `/api/admin/audit-logs` | `app/api/admin/audit-logs/route.ts` | GET |
| `/api/admin/warnings` | `app/api/admin/warnings/route.ts` | GET |
| `/api/admin/warnings/overview` | `app/api/admin/warnings/overview/route.ts` | GET |
| `/api/admin/sanctions` | `app/api/admin/sanctions/route.ts` | GET |
| `/api/admin/sanctions/[id]` | `app/api/admin/sanctions/[id]/route.ts` | GET, PATCH |
| `/api/admin/monitoring` | `app/api/admin/monitoring/route.ts` | GET |
| `/api/admin/monitoring/aktivitas` | `app/api/admin/monitoring/aktivitas/route.ts` | GET |
| `/api/admin/monitoring/laporan` | `app/api/admin/monitoring/laporan/route.ts` | GET |
| `/api/admin/monitoring/laporan/[id]` | `app/api/admin/monitoring/laporan/[id]/route.ts` | GET |
| `/api/admin/monitoring/peringatan` | `app/api/admin/monitoring/peringatan/route.ts` | GET |
| `/api/admin/monitoring/sanksi` | `app/api/admin/monitoring/sanksi/route.ts` | GET |
| `/api/admin/monitoring/audit` | `app/api/admin/monitoring/audit/route.ts` | GET |
| `/api/admin/pengaturan` | `app/api/admin/pengaturan/route.ts` | GET, PATCH |
| `/api/admin/permintaan-role` | `app/api/admin/permintaan-role/route.ts` | GET |
| `/api/admin/koin` | `app/api/admin/koin/route.ts` | GET |
| `/api/admin/profile` | `app/api/admin/profile/route.ts` | GET, PATCH |
| `/api/admin/riwayat` | `app/api/admin/riwayat/route.ts` | GET |

### Seller API
| Route | File | Methods |
|-------|------|---------|
| `/api/seller/reports/export` | `app/api/seller/reports/export/route.ts` | GET |

### Support
| Route | File | Methods |
|-------|------|---------|
| `/api/support/appeal` | `app/api/support/appeal/route.ts` | POST |
| `/api/support/appeal/status` | `app/api/support/appeal/status/route.ts` | GET |
| `/api/reports` | `app/api/reports/route.ts` | POST |

---

## Dashboard Routes

### Admin Dashboard (`/dashboard/admin`)
| Route | File |
|-------|------|
| `/dashboard/admin` | `app/dashboard/admin/page.tsx` |
| `/dashboard/admin/umkm` | `app/dashboard/admin/umkm/page.tsx` |
| `/dashboard/admin/umkm/[id]` | `app/dashboard/admin/umkm/[id]/page.tsx` |
| `/dashboard/admin/produk` | `app/dashboard/admin/produk/page.tsx` |
| `/dashboard/admin/pesanan` | `app/dashboard/admin/pesanan/page.tsx` |
| `/dashboard/admin/pengiriman` | `app/dashboard/admin/pengiriman/page.tsx` |
| `/dashboard/admin/pengiriman/[id]` | `app/dashboard/admin/pengiriman/[id]/page.tsx` |
| `/dashboard/admin/pengguna` | `app/dashboard/admin/pengguna/page.tsx` |
| `/dashboard/admin/pengguna/[id]` | `app/dashboard/admin/pengguna/[id]/page.tsx` |
| `/dashboard/admin/artikel` | `app/dashboard/admin/artikel/page.tsx` |
| `/dashboard/admin/langganan` | `app/dashboard/admin/langganan/page.tsx` |
| `/dashboard/admin/monitoring` | `app/dashboard/admin/monitoring/page.tsx` |
| `/dashboard/admin/monitoring/aktivitas` | `app/dashboard/admin/monitoring/aktivitas/page.tsx` |
| `/dashboard/admin/monitoring/laporan` | `app/dashboard/admin/monitoring/laporan/page.tsx` |
| `/dashboard/admin/monitoring/laporan/[id]` | `app/dashboard/admin/monitoring/laporan/[id]/page.tsx` |
| `/dashboard/admin/monitoring/peringatan` | `app/dashboard/admin/monitoring/peringatan/page.tsx` |
| `/dashboard/admin/monitoring/sanksi` | `app/dashboard/admin/monitoring/sanksi/page.tsx` |
| `/dashboard/admin/monitoring/audit` | `app/dashboard/admin/monitoring/audit/page.tsx` |
| `/dashboard/admin/pengaturan` | `app/dashboard/admin/pengaturan/page.tsx` |
| `/dashboard/admin/permintaan-role` | `app/dashboard/admin/permintaan-role/page.tsx` |
| `/dashboard/admin/profile` | `app/dashboard/admin/profile/page.tsx` |
| `/dashboard/admin/riwayat` | `app/dashboard/admin/riwayat/page.tsx` |
| `/dashboard/admin/system` | `app/dashboard/admin/system/page.tsx` |
| `/dashboard/admin/koin` | `app/dashboard/admin/koin/page.tsx` |
| `/dashboard/admin/chat` | `app/dashboard/admin/chat/page.tsx` |
| `/dashboard/admin/chat/[id]` | `app/dashboard/admin/chat/[id]/page.tsx` |
| `/dashboard/admin/moderasi` | `app/dashboard/admin/moderasi/page.tsx` |

### Courier Dashboard
| Route | File |
|-------|------|
| `/dashboard/kurir` | `app/dashboard/kurir/page.tsx` |

---

## Special Routes

| Route | File | Type |
|-------|------|------|
| `/artikel` | `app/artikel/page.tsx` | Server Component |
| `/artikel/[slug]` | `app/artikel/[slug]/page.tsx` | Server Component |
| `/terms` | `app/terms/page.tsx` | Server Component |
| `/privacy` | `app/privacy/page.tsx` | Server Component |
| `/banding` | `app/banding/page.tsx` | Client Component |
| `/banding/status` | `app/banding/status/page.tsx` | Client Component |

---

## Build Output Classification

From `npm run build`:

**Static (○)** — Prerendered at build time:
- `/`, `/home`, `/auth/*`, `/detail/*`, `/riwayatPesanan`, `/notifikasi/pembeli`
- `/profile`, `/toko`, `/dashboard/penjual/*`, `/dashboard/kurir/`
- `/dashboard/admin/*`, `/langganan/pembayaran`, `/langganan/sukses`
- `/preview/product`, `/artikel`, `/artikel/[slug]`, `/toko-diikuti`, `/banding/*`
- `/pengaturan/*`, `/terms`, `/privacy`

**SSG (●)** — Static Site Generation with `generateStaticParams`:
- `/makanan/[category]` (8 paths: `makanan-berat`, `makanan-ringan`, `minuman`, `kue-dan-roti`, `makanan-sehat`, `makanan-jepang`, `makanan-korea`, `makanan-barat`)

**Dynamic (ƒ)** — Server-rendered on demand:
- `/langganan/sukses`, all `/api/**` routes

---

## Navigation Conventions

### Landing Page Anchor Links (Do Not Change)

| Section ID | Component | Used By |
|------------|-----------|---------|
| `top` | HeroSection | Navbar, Footer |
| `about` | TrustSection | Navbar, Footer |
| `cara-kerja` | HowItWorksSection | Navbar, Footer |
| `rekomendasi` | FoodDiscoverySection | Navbar, Footer |
| `umkm` | SellerSection | Navbar, Footer |
| `langganan` | SellerSection (anchor span) | Navbar, Footer |
| `pembeli` | BuyerSection | Navbar, Footer |
| `fitur` | FeaturesSection | Navbar, Footer |
| `manfaat` | BenefitsSection | Footer |
| `faq` | FAQSection | Navbar, Footer |
| `final-cta-heading` | FinalCTASection | Footer |

### Seller Store Paths

Generated via `lib/seller-store-path.ts`:
```
/dashboard/penjual/[storeId]           → dashboard
/dashboard/penjual/[storeId]/menu      → menu management
/dashboard/penjual/[storeId]/tambahMenu → add product
/dashboard/penjual/[storeId]/pesanan   → orders
/dashboard/penjual/[storeId]/ulasan    → reviews
/dashboard/penjual/[storeId]/performa  → analytics
/dashboard/penjual/[storeId]/pengaturan → settings
/dashboard/penjual/[storeId]/notifikasi → notifications
/dashboard/penjual/[storeId]/langganan → subscription
```

---

## Key Rules

1. **Route groups don't affect URLs** — `(landing)`, `(app)`, `(preview)` are organizational only
2. **No `(app)/layout.tsx` or `(landing)/layout.tsx`** — App chrome rendered per page
3. **Shell injection for detail pages** — Pass shell from route, never infer from pathname
4. **RequireAuth wraps entire page** — Guard outside shell so chrome hidden before redirect
5. **Admin routes under `/dashboard/admin/**`** — Protected by RBAC middleware
6. **Courier routes under `/dashboard/kurir/**`** — Protected by courier profile check