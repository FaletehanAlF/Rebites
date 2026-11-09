# Product Catalog Feature

> Product browsing, category pages, search, filtering, and favorites.

---

## Overview

The catalog is the primary discovery interface for buyers. It supports:
- 8 static category pages (SSG)
- Search with debounced input
- Filter by price, rating, delivery, distance
- Favorites (heart icon)
- Store follows
- Flash Sale badge
- Scheduled menu visibility

---

## Routes

| Route | Page | Type | Description |
|-------|------|------|-------------|
| `/makanan` | `app/(app)/makanan/page.tsx` | Server | Category index with all 8 categories |
| `/makanan/[category]` | `app/(app)/makanan/[category]/page.tsx` | SSG | Category product grid (8 static paths) |
| `/toko` | `app/(app)/toko/page.tsx` | Client | Store listing with filters |
| `/detail/product` | `app/(app)/detail/product/page.tsx` | Client | Product detail (shell-injected) |
| `/preview/product` | `app/(preview)/preview/product/page.tsx` | Client | Public product preview |

---

## Category Pages (SSG)

### Static Paths (8 Categories)

Generated at build time via `generateStaticParams`:

```typescript
// app/(app)/makanan/[category]/page.tsx
export async function generateStaticParams() {
    return [
        { category: 'makanan-berat' },
        { category: 'makanan-ringan' },
        { category: 'minuman' },
        { category: 'kue-dan-roti' },
        { category: 'makanan-sehat' },
        { category: 'makanan-jepang' },
        { category: 'makanan-korea' },
        { category: 'makanan-barat' },
    ];
}
```

### Category Metadata

```typescript
// lib/categories.ts
export const CATEGORIES: Category[] = [
    { slug: 'makanan-berat', name: 'Makanan Berat', emoji: '🍚', image: '...' },
    { slug: 'makanan-ringan', name: 'Makanan Ringan', emoji: '🍟', image: '...' },
    { slug: 'minuman', name: 'Minuman', emoji: '🧃', image: '...' },
    { slug: 'kue-dan-roti', name: 'Kue & Roti', emoji: '🍰', image: '...' },
    { slug: 'makanan-sehat', name: 'Makanan Sehat', emoji: '🥗', image: '...' },
    { slug: 'makanan-jepang', name: 'Makanan Jepang', emoji: '🍣', image: '...' },
    { slug: 'makanan-korea', name: 'Makanan Korea', emoji: '🍜', image: '...' },
    { slug: 'makanan-barat', name: 'Makanan Barat', emoji: '🍔', image: '...' },
];
```

### Page Composition

```tsx
// app/(app)/makanan/[category]/page.tsx
export default async function CategoryPage({ params }: { params: { category: string } }) {
    const category = CATEGORIES.find(c => c.slug === params.category);
    if (!category) notFound();
    
    const products = await getProductsByCategory(category.slug); // Server Component
    
    return (
        <CategoryView 
            category={category}
            products={products}
        />
    );
}
```

**CategoryView** (`app/components/buyer/makanan-category/category-view.tsx`):
- Header with category emoji + name
- Filter/sort toolbar (price, rating, delivery, distance)
- Product grid (responsive: 1 col mobile, 2 tablet, 3 desktop)
- Empty state with illustration
- Pagination via infinite scroll

---

## Product Data Fetching

### Server-Side (Category Pages)

```typescript
// lib/catalog.ts
export async function getProductsByCategory(categorySlug: string): Promise<ProductView[]> {
    const supabase = createAnonServerClient();
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
        .from('products')
        .select(`
            id, slug, name, category, surplus_price, original_price,
            stock, image_url, is_delivery, weight_gram,
            scheduled_start, scheduled_end,
            flash_sale, surplus_price,
            umkm_profiles!inner(id, slug, business_name, logo_url, city, rating, review_count)
        `)
        .eq('category', categorySlug)
        .eq('verification_status', 'approved')
        .or(`scheduled_start.is.null,scheduled_start.lte.${now}`)
        .or(`scheduled_end.is.null,scheduled_end.gte.${now}`)
        .gt('stock', 0)
        .order('created_at', { ascending: false });
    
    if (error) throw error;
    return mapProducts(data);
}
```

### Client-Side (Search, Home, Store Detail)

```typescript
// lib/catalog.ts (client-safe)
export async function searchProducts(query: string, filters?: CatalogFilters): Promise<ProductView[]> {
    const supabase = createAnonServerClient();
    // ... similar query with .ilike() on name
}

// hooks/use-catalog.ts
export function useCatalog(categorySlug?: string) {
    const [products, setProducts] = useState<ProductView[]>([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        let cancelled = false;
        getProductsByCategory(categorySlug || 'all')
            .then(data => !cancelled && setProducts(data))
            .finally(() => !cancelled && setLoading(false));
        return () => { cancelled = true; };
    }, [categorySlug]);
    
    return { products, loading };
}
```

---

## Product Availability Logic

A product is visible/purchasable when **ALL** conditions met:

```typescript
// lib/product-storage.ts
export function isProductAvailable(product: SellerProduct): boolean {
    const now = new Date();
    
    // 1. Approved by admin
    if ((product.verificationStatus ?? 'approved') !== 'approved') return false;
    
    // 2. Stock > 0
    if (product.stock <= 0) return false;
    
    // 3. Within schedule (if set)
    if (product.scheduledStart && new Date(product.scheduledStart) > now) return false;
    if (product.scheduledEnd && new Date(product.scheduledEnd) < now) return false;
    
    // 4. Within selling hours (if not allDay)
    if (!product.allDay) {
        const currentTime = now.toLocaleTimeString('en-GB', { 
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' 
        });
        if (currentTime < product.startTime || currentTime > product.endTime) return false;
    }
    
    return true;
}
```

**Schedule Status** (`lib/menu-schedule.ts`):
```typescript
export function resolveMenuScheduleStatus(product: ProductView): 'none' | 'scheduled' | 'ended' {
    const now = new Date();
    if (product.scheduledStart && new Date(product.scheduledStart) > now) return 'scheduled';
    if (product.scheduledEnd && new Date(product.scheduledEnd) < now) return 'ended';
    return 'none';
}
```

---

## Search & Filter

### Search Input

Debounced client-side search (300ms):

```tsx
// app/components/buyer/makanan-category/category-view.tsx
const [searchQuery, setSearchQuery] = useState('');
const debouncedQuery = useDebounce(searchQuery, 300);

useEffect(() => {
    if (debouncedQuery) {
        searchProducts(debouncedQuery).then(setProducts);
    } else {
        getProductsByCategory(categorySlug).then(setProducts);
    }
}, [debouncedQuery, categorySlug]);
```

### Filter Toolbar

| Filter | Type | Implementation |
|--------|------|----------------|
| Price | Radio: Termurah / Termahal | `.order('surplus_price', { ascending: true/false })` |
| Rating | Radio: Rating tertinggi | `.order('rating', { ascending: false })` |
| Delivery | Checkbox: Hanya yang bisa diantar | `.eq('is_delivery', true)` |
| Distance | Radio: Terdekat | PostGIS `ST_Distance` (not yet implemented) |

---

## Favorites & Store Follows

### Favorites (Product-level)

```typescript
// hooks/buyer/use-buyer-favorites.ts
export function useBuyerFavorites() {
    const { user } = useCurrentUser();
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    
    // Toggle
    const toggleFavorite = async (productId: string) => {
        const supabase = createAnonServerClient();
        const isFav = favorites.has(productId);
        
        if (isFav) {
            await supabase.from('favorites').delete().eq('product_id', productId).eq('user_id', user.id);
        } else {
            await supabase.from('favorites').insert({ product_id: productId, user_id: user.id });
        }
        setFavorites(prev => {
            const next = new Set(prev);
            isFav ? next.delete(productId) : next.add(productId);
            return next;
        });
    };
}
```

### Store Follows (Store-level)

```typescript
// hooks/buyer/use-store-follows.ts
export function useStoreFollows() {
    // Similar pattern with store_follows table
}
```

---

## Flash Sale Integration

Products with active Flash Sale show badge and discounted price:

```tsx
// In ProductCard
{product.flashSale && (
    <Badge variant="destructive" className="animate-pulse">
        <Zap className="h-3 w-3" /> Flash Sale
    </Badge>
)}

{product.flashSale ? (
    <>
        <span className="line-through">{formatRupiah(product.surplusPrice)}</span>
        <span className="text-destructive font-bold">{formatRupiah(product.flashSale.price)}</span>
    </>
) : (
    <span className="font-bold">{formatRupiah(product.surplusPrice)}</span>
)}
```

**Flash Sale Logic** (`lib/flash-sale.ts`):
- Time slots: `09-12`, `12-15`, `15-18`, `18-21` (WIB)
- Standar plan: 1 concurrent slot
- Premium plan: Unlimited
- Auto-expires after slot ends

---

## Store Listing (`/toko`)

```tsx
// app/(app)/toko/page.tsx
export default function TokoPage() {
    const { stores, loading } = useStores(); // Fetches from /api/seller/stores
    const [filters, setFilters] = useState({ category: '', search: '' });
    
    return (
        <StoreFilterToolbar filters={filters} onChange={setFilters} />
        <StoreGrid stores={filteredStores} />
    );
}
```

**Store Data** includes:
- Business name, logo, city
- Rating, review count
- Product count
- Distance (if user location available)
- Follow button

---

## Product Detail (`/detail/product`)

### Shell-Injected (see architecture/components.md)

```tsx
// DetailProductContent receives:
interface ProductDetailData {
    product: ProductView;
    reviews: Review[];
    isFollowing: boolean;
    isFavorite: boolean;
    sellerPlan: SellerEntitlements;
}

// Features:
// - Image gallery (SmartImage)
// - Price: normal vs original (strikethrough)
// - Flash Sale countdown (if active)
// - Schedule display (if scheduled)
// - Stock indicator
// - Delivery/Pickup toggle
// - Quantity selector
// - "Pesan Sekarang" → checkout
// - Reviews with pagination
// - Seller info card (link to store detail)
```

### Delivery Fee Calculation

```typescript
// API: /api/shipping/rates
// Input: { productSlug, quantity, addressId, fulfillment: 'delivery' }
// Output: { options: [{ courierCode, serviceCode, price, distanceLabel, etaLabel }] }

// Calculation:
// 1. Resolve product weight (product.weight_gram or category default)
// 2. Get store coordinates (umkm_profiles.latitude/longitude or city center)
// 3. Get buyer address coordinates
// 4. Haversine distance → road distance estimate
// 5. Fee = base + per_km * distance (clamped to min/max)
```

---

## Data Structures

### ProductView (Public)

```typescript
// lib/types.ts
export interface ProductView {
    id: string;
    slug: string;
    name: string;
    category: string;
    surplusPrice: number;
    originalPrice: number;
    stock: number;
    imageUrl: string;          // Resolved to .avif via lib/image-path.ts
    isDelivery: boolean;
    weightGram: number | null;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    flashSale: FlashSaleView | null;
    verificationStatus: 'approved' | 'pending' | 'rejected';
    rejectionReason: string | null;
    umkm: {
        id: string;
        slug: string;
        businessName: string;
        logoUrl: string | null;
        city: string | null;
        rating: number | null;
        reviewCount: number;
    };
}
```

### FlashSaleView

```typescript
export interface FlashSaleView {
    price: number;
    startIso: string;
    endIso: string;
    discountPercent: number;
}
```

---

## Performance Considerations

| Optimization | Implementation |
|--------------|----------------|
| SSG for categories | `generateStaticParams` with 8 paths |
| Image optimization | `next/image` + AVIF + `SmartImage` resolver |
| Lazy loading | `loading="lazy"` on product images |
| Debounced search | 300ms debounce hook |
| Infinite scroll | IntersectionObserver on grid |
| Server Components | Category pages fetch on server |
| Caching | Supabase PostgREST cache + Next.js cache |

---

## Known Issues

| Issue | Location | Workaround |
|-------|----------|------------|
| Image path mismatch | DB stores `.jpeg/.webp`, files are `.avif` | `SmartImage` + `lib/image-path.ts` resolver |
| Transparency artifacts | `public/makanan2.avif`, `public/makanan5.avif` | Don't use in new UI |
| No distance filter | PostGIS not implemented | Category pages static to Kota Depok |