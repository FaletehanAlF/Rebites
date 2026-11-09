# Flash Sale Feature

> Time-limited promotional slots for sellers to offer discounted products.

---

## Overview

Flash Sale allows sellers to promote products at a discount during specific time slots on the homepage.

**Availability**: Standar plan (1 slot), Premium/Max plan (unlimited)
**Slots**: 4 daily windows (WIB)
**Placement**: Homepage promotional section

---

## Time Slots (WIB)

| Slot Key | Label | Time Range |
|----------|-------|------------|
| `09-12` | Pagi | 09:00 – 12:00 |
| `12-15` | Siang | 12:00 – 15:00 |
| `15-18` | Sore | 15:00 – 18:00 |
| `18-21` | Malam | 18:00 – 21:00 |

---

## Seller Quota by Plan

| Plan | Concurrent Slots | Products |
|------|------------------|----------|
| Basic | 0 | 0 |
| Standar | 1 | 1 |
| Premium/Max | 999 (unlimited) | Unlimited |

---

## UI in Seller Dashboard

### Menu Management (`/dashboard/penjual/[storeId]/menu`)

**Per Product Panel:**

```tsx
// FlashSalePanel component:
- Toggle switch (disabled if quota exceeded)
- Edit dialog:
  - Harga Flash Sale (must be < surplusPrice)
  - Tanggal: Hari ini / Besok / Custom
  - Slot: 4 buttons (disabled if past)
  - Live preview: discount %, schedule
  - Validation: price < surplusPrice, slot not past, within product schedule
- Active state: Shows price, discount, schedule
- Expired state: Shows "Berakhir"
```

### Quota Indicator

```tsx
// FlashSaleSummaryRow at top of menu page:
- Shows used/total quota
- Links to upgrade if Basic
- Shows "Kuota Flash Sale paket Standar sudah digunakan" if blocked
```

---

## Validation Logic (`lib/flash-sale.ts`)

### Schedule Validation

```typescript
export function validateFlashSaleSchedule({
    startIso,
    endIso,
    scheduledStart,
    scheduledEnd,
}): string | null {
    // 1. Flash Sale within product schedule
    if (scheduledStart && new Date(startIso) < new Date(scheduledStart)) {
        return 'Flash Sale tidak boleh dimulai sebelum jadwal produk tayang';
    }
    if (scheduledEnd && new Date(endIso) > new Date(scheduledEnd)) {
        return 'Flash Sale tidak boleh berakhir setelah jadwal produk berakhir';
    }
    
    // 2. Not in past
    if (new Date(startIso) < new Date()) {
        return 'Waktu mulai sudah lewat';
    }
    
    return null; // Valid
}
```

### Slot Helpers

```typescript
// FLASH_SLOTS array with key, label, range
// isFlashSlotPast(date, slotKey) → boolean
// flashSlotRange(date, slotKey) → { startIso, endIso } | null
// slotFromStartIso(iso) → slotKey
// firstAvailableSlot(date) → slotKey | null
```

---

## Data Model

### Product Flash Sale Config

```typescript
// In SellerProduct / products table
flashSale: {
    price: number;        // Discounted price
    startIso: string;     // ISO timestamp (e.g. "2024-01-15T09:00:00+07:00")
    endIso: string;       // ISO timestamp (e.g. "2024-01-15T12:00:00+07:00")
} | null
```

### Flash Sale Status

```typescript
export function resolveFlashSaleStatus(product: ProductView): FlashSaleStatus {
    const now = new Date();
    if (!product.flashSale) return 'inactive';
    
    const start = new Date(product.flashSale.startIso);
    const end = new Date(product.flashSale.endIso);
    
    if (now < start) return 'scheduled';
    if (now >= start && now <= end) return 'active';
    return 'ended';
}
```

**Statuses**: `inactive` | `scheduled` | `active` | `ended`

---

## Client-Side Operations

```typescript
// lib/flash-sale.ts (client)
export function setFlashSale(
    productId: string,
    config: { price: number; startIso: string; endIso: string }
): Promise<{ ok: boolean; error?: string }>

export function removeFlashSale(productId: string): Promise<void>

export function countFlashSaleProducts(products: SellerProduct[]): number
```

---

## Homepage Display

### Public Homepage (`/`)

```tsx
// FoodDiscoverySection or dedicated FlashSaleSection
// Filters: products.flashSale is active NOW
// Shows: product card with discount badge, countdown timer
```

### In-App Home (`/home`)

```tsx
// Similar but with buyer context
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| (client-side only) | - | Uses `lib/flash-sale.ts` mutations |
| (server sync) | PATCH | Updates `products.flash_sale` column |

---

## RLS Policies

```sql
-- Seller can update own products' flash_sale
CREATE POLICY "Seller manage own flash sale" ON products
    FOR UPDATE USING (
        umkm_id IN (SELECT id FROM umkm_profiles WHERE user_id = auth.uid())
    )
    WITH CHECK (umkm_id IN (SELECT id FROM umkm_profiles WHERE user_id = auth.uid()));
```

---

## Countdown Timer

```tsx
// In product card during Flash Sale:
const timeLeft = endIso - now();
// Format: "HH:mm:ss" or "Selesai dalam X menit"
```

---

## Testing

```bash
npm run test:flash-sale-schedule
```

---

## Known Issues

| Issue | Location | Workaround |
|-------|----------|------------|
| No admin override | Admin dashboard | Direct DB update |
| Slot conflict UI | Multiple products | Shows "Lewat" for past slots |
| Timezone handling | WIB hardcoded | Use Asia/Jakarta consistently |
| No recurring schedules | Daily/weekly | Manual re-create |
| No analytics | Admin | Not tracked |