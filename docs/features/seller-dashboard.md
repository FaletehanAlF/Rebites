# Seller Dashboard Feature

> Complete seller/UMKM dashboard: overview, menu management, orders, reviews, analytics, settings, notifications, subscription.

---

## Overview

The seller dashboard is the primary interface for UMKM partners to manage their business on ReBites.

**Access**: `/dashboard/penjual/[storeId]/` (requires seller role + verified UMKM profile)

**Plan Entitlements** gate features:
| Feature | Basic | Standar | Premium/Max |
|---------|-------|---------|-------------|
| Max Products | 3 | 5 | 15 |
| Sales History | 30 days | Unlimited | Unlimited |
| Flash Sale Slots | 0 | 1 | Unlimited |
| Featured Promo | ✗ | ✓ | ✓ |
| Priority Marketplace | ✗ | ✓ | ✓ |
| Detailed Reports | ✗ | ✓ | ✓ |
| Verified Badge | ✗ | ✓ | ✓ |
| Demand Analytics | ✗ | ✗ | ✓ |
| Priority Support | ✗ | ✗ | ✓ |

---

## Routes

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard/penjual` | `app/(app)/dashboard/penjual/page.tsx` | Redirects to storeId |
| `/dashboard/penjual/[storeId]` | `app/(app)/dashboard/penjual/[storeId]/page.tsx` | **Main Dashboard** |
| `/dashboard/penjual/[storeId]/menu` | `app/(app)/dashboard/penjual/[storeId]/menu/page.tsx` | Product Management |
| `/dashboard/penjual/[storeId]/tambahMenu` | `app/(app)/dashboard/penjual/[storeId]/tambahMenu/page.tsx` | Add Product |
| `/dashboard/penjual/[storeId]/pesanan` | `app/(app)/dashboard/penjual/[storeId]/pesanan/page.tsx` | Order Management |
| `/dashboard/penjual/[storeId]/ulasan` | `app/(app)/dashboard/penjual/[storeId]/ulasan/page.tsx` | Reviews |
| `/dashboard/penjual/[storeId]/performa` | `app/(app)/dashboard/penjual/[storeId]/performa/page.tsx` | Analytics |
| `/dashboard/penjual/[storeId]/pengaturan` | `app/(app)/dashboard/penjual/[storeId]/pengaturan/page.tsx` | Store Settings |
| `/dashboard/penjual/[storeId]/notifikasi` | `app/(app)/dashboard/penjual/[storeId]/notifikasi/page.tsx` | Notifications |
| `/dashboard/penjual/[storeId]/langganan` | `app/(app)/dashboard/penjual/[storeId]/langganan/page.tsx` | Subscription |

---

## Main Dashboard (`/[storeId]`)

```tsx
// Components composed:
<StoreCard />              // Store info, rating, verification status
<StoreRatingCard />       // Rating breakdown, review count
<SalesStatsCard />        // Revenue, orders, avg order value (period selector)
<StoreVisitorCard />      // Unique visitors, page views
<DetailedReportCard />    // Period comparison table
```

**Data Sources:**
- `hooks/seller/use-store-products.ts` → products
- `hooks/seller/use-seller-orders.ts` → orders
- `hooks/seller/use-seller-analytics.ts` → charts
- `hooks/seller/use-store-visitors.ts` → visitors
- `lib/seller-plan.ts` → plan entitlements

---

## Menu Management (`/menu`)

### Product List

```tsx
// Features per product card:
- Image + featured badge (Crown)
- Name + category
- Verification badge: Tayang / Menunggu Verifikasi / Ditunda Admin
- Schedule badge: Dijadwalkan / Jadwal berakhir
- Availability: Stok X / Habis / Tutup / Belum tayang
- Price: surplus (bold) + original (strikethrough)
- Stock editor: inline +/- buttons
- Time editor: allDay toggle + start/end time inputs
- Flash Sale panel (see below)
- Actions: Toggle stock, Toggle featured (if plan allows), Edit, Delete
```

### Add/Edit Product (`/tambahMenu`)

```tsx
// EditProductModal (shared for add/edit)
Tabs: [Dasar] [Pengiriman] [Jadwal] [Flash Sale]

[Dasar]:
- Nama produk (required)
- Kategori (select from 8)
- Harga asli (required)
- Harga surplus (required, < harga asli)
- Deskripsi
- Foto (upload to Supabase Storage)
- Badge unggulan (if plan.featuredPromo)

[Pengiriman]:
- Bisa diantar (checkbox)
- Berat (gram) — required if delivery enabled
- Dimensi (L×W×H cm) — optional

[Jadwal]:
- Sepanjang hari (toggle)
- Jam mulai/selesai (if not allDay)
- Tanggal mulai tayang (optional)
- Tanggal berakhir (optional)

[Flash Sale]: (see Flash Sale feature)
- Only visible if plan.flashSaleSlots > 0
- Price, date, time slot selection
```

**Validation:**
- Surplus price < original price
- Weight required if `is_delivery = true`
- Schedule within product schedule
- Flash Sale price < surplus price

### Product Limit Enforcement

```typescript
// In MenuSayaPage
const isLimitReached = plan.maxProducts !== null && products.length >= plan.maxProducts;

{isLimitReached ? (
    <Link to={`/langganan/pembayaran?plan=${plan.upgradeSlug}`}>
        Naikkan kuota via upgrade
    </Link>
) : (
    <Link to={sellerStorePath(storeId, 'tambahMenu')}>
        Tambah Menu
    </Link>
)}
```

---

## Flash Sale Management

Integrated into Menu Management (`lib/flash-sale.ts`):

**Time Slots (WIB):**
| Slot Key | Label | Range |
|----------|-------|-------|
| `09-12` | Pagi | 09:00–12:00 |
| `12-15` | Siang | 12:00–15:00 |
| `15-18` | Sore | 15:00–18:00 |
| `18-21` | Malam | 18:00–21:00 |

**Quota by Plan:**
| Plan | Slots | Concurrent Products |
|------|-------|---------------------|
| Basic | 0 | 0 |
| Standar | 1 | 1 |
| Premium | Unlimited | Unlimited |

**UI Panel per Product:**
- Toggle switch (disabled if quota exceeded)
- Edit dialog: price, date (today/tomorrow/custom), slot
- Validation: price < surplusPrice, slot not past, within product schedule
- Live preview of discount % and schedule

---

## Order Management (`/pesanan`)

### Order Tabs
| Tab | Status Filter | Actions |
|-----|---------------|---------|
| Masuk | `pending_payment`, `paid` | Accept, Cancel |
| Diproses | `preparing`, `ready` | Mark Ready |
| Diantar | `delivering` | View courier, Chat |
| Selesai | `completed`, `delivered` | View detail |
| Dibatalkan | `cancelled` | View detail |

### Order Card Actions

```tsx
// For status=paid:
<Button onClick={() => acceptOrder(orderCode)}>Terima Pesanan</Button>
<Button variant="destructive" onClick={() => cancelOrder(orderCode)}>Batalkan</Button>

// For status=preparing:
<Button onClick={() => markReady(orderCode)}>Siap Diantar/Diambil</Button>

// For status=delivering:
<CourierChat orderDbId={order.id} /> // Real-time chat
```

### Real-Time Updates

```typescript
// hooks/seller/use-seller-orders-realtime.ts
useEffect(() => {
    const channel = supabase
        .channel(`seller-orders-${storeId}`)
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'orders',
            filter: `umkm_id=eq.${storeId}`
        }, () => refresh())
        .subscribe();
    
    return () => supabase.removeChannel(channel);
}, [storeId]);
```

---

## Reviews (`/ulasan`)

### Review List

| Column | Data |
|--------|------|
| Produk | Product name + image |
| Pembeli | Name + avatar |
| Rating | Stars (1-5) |
| Komentar | Text (truncated) |
| Tanggal | Formatted WIB |
| Balasan | Seller reply button |

### Seller Reply

```tsx
// Inline reply form
<textarea placeholder="Balas ulasan..." />
<Button onClick={submitReply}>Kirim Balasan</Button>
```

---

## Analytics (`/performa`)

### Charts (Recharts)

| Chart | Period Options | Metrics |
|-------|----------------|---------|
| Revenue | 7h/30h/90h/12b | Daily/Weekly/Monthly revenue |
| Orders | 7h/30h/90h/12b | Order count, avg value |
| Products | 7h/30h/90h/12b | Top products by revenue |
| Visitors | 7h/30h/90h/12b | Unique visitors, page views |

**Data Source**: `hooks/seller/use-seller-analytics.ts` → Supabase RPCs

### Detailed Report Table

| Period | Revenue | Orders | Avg Order | Top Product |
|--------|---------|--------|-----------|-------------|
| 7 hari | Rp 2.4M | 34 | Rp 70k | Nasi Goreng |
| 30 hari | Rp 8.1M | 112 | Rp 72k | Mie Ayam |

---

## Store Settings (`/pengaturan`)

### Sections

| Section | Fields |
|---------|--------|
| Profil Toko | Nama usaha, Deskripsi, Logo, Foto sambilan |
| Jam Operasional | Buka/Tutup per hari, Libur |
| Lokasi | Peta (LocationPickerMap), Alamat, Kota, Kode pos |
| Pengiriman | Aktifkan pengiriman, Radius (km), Biaya manual |
| Akun | Email, Nomor HP, Ganti sandi |

### Location Picker

```tsx
// app/components/shared/LocationPickerMap.tsx
<LocationPickerMap
    latitude={store.latitude}
    longitude={store.longitude}
    onPick={(lat, lng) => updateStore({ latitude: lat, longitude: lng })}
/>
```

---

## Notifications (`/notifikasi`)

### Types
- Pesanan baru
- Pesanan dibatalkan pembeli
- Ulasan baru
- Produk diverifikasi/ditolak
- Flash Sale dimulai/berakhir
- Langganan akan berakhir

### Features
- Mark as read (individual + all)
- Filter by type
- Deep link to relevant page (order, product, etc.)

---

## Subscription Management (`/langganan`)

### Current Plan Display

```tsx
// Shows:
- Plan name + badge (Basic/Standar/Max)
- Billing cycle (Bulanan/Tahunan)
- Periode berakhir
- Fitur yang didapat
- Tombol "Kelola Paket" → /langganan/pembayaran
```

### Upgrade Flow

```mermaid
flowchart LR
    A[Current Plan] --> B[Click Upgrade]
    B --> C[/langganan/pembayaran?plan=standar&billing=monthly]
    C --> D[Select Plan + Billing]
    D --> E[Click Bayar via Xendit]
    E --> F[Xendit Payment]
    F --> G[Webhook → Activate]
    G --> H[Plan Updated]
```

---

## Data Structures

### SellerProduct (Client)

```typescript
// lib/product-storage.ts
export interface SellerProduct {
    id: string;
    slug: string;
    name: string;
    category: string;
    description: string;
    originalPrice: number;
    surplusPrice: number;
    stock: number;
    image: string;
    isDelivery: boolean;
    weightGram: number | null;
    dimensions: { length: number; width: number; height: number } | null;
    allDay: boolean;
    startTime: string;    // HH:mm
    endTime: string;      // HH:mm
    scheduledStart: string | null;  // ISO
    scheduledEnd: string | null;    // ISO
    featured: boolean;
    verificationStatus: 'approved' | 'pending' | 'rejected';
    rejectionReason: string | null;
    flashSale: FlashSaleConfig | null;
    createdAt: string;
    updatedAt: string;
}

export interface FlashSaleConfig {
    price: number;
    startIso: string;
    endIso: string;
}
```

### SellerEntitlements (Plan)

```typescript
// lib/seller-plan.ts
export interface SellerEntitlements {
    tier: 'basic' | 'standar' | 'premium';
    label: string;
    maxProducts: number | null;  // null = unlimited
    maxHistoryDays: number | null;
    flashSaleSlots: number;
    featuredPromo: boolean;
    priorityMarketplace: boolean;
    detailedReports: boolean;
    verifiedBadge: boolean;
    demandAnalytics: boolean;
    prioritySupport: boolean;
    upgradeSlug: 'standar' | 'premium' | null;
}
```

---

## Client-Side State Management

```typescript
// lib/product-storage.ts (zustand-like but React state)
export function useSellerProducts() {
    // Loaded from server, mutated locally, synced via API
    const [products, setProducts] = useState<SellerProduct[]>([]);
    
    const patchSellerProduct = (id: string, patch: Partial<SellerProduct>) => {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
        // Debounced sync to server
        debouncedSync(patch);
    };
    
    const deleteSellerProduct = (id: string) => {
        setProducts(prev => prev.filter(p => p.id !== id));
        deleteProductAPI(id);
    };
}
```

---

## Performance

| Optimization | Implementation |
|--------------|----------------|
| Lazy load heavy cards | `dynamic(() => import(...), { ssr: false })` |
| Optimistic updates | Local state patch + background sync |
| Realtime subscriptions | Single channel per store |
| Image upload | Direct to Supabase Storage (signed URL) |
| Period selector | Memoized chart data |

---

## Known Issues

| Issue | Location | Workaround |
|-------|----------|------------|
| Image path mismatch | DB `.jpeg/.webp` → files `.avif` | `SmartImage` resolver |
| ESLint warning | `detail/toko` hook deps | Run `npm run lint` separately |
| No drag-drop reorder | Product list | Manual sort via `updated_at` |
| Flash Sale slot conflict | Multiple products same slot | UI shows "Lewat" for past slots |