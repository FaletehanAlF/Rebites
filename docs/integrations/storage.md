# Storage Integration (Supabase Storage)

> **Implementation:** `lib/image-path.ts`, `lib/product-storage.ts`, `lib/article-cover.ts`, `lib/admin-avatar.ts`, Supabase Storage buckets

---

## Role

Supabase Storage handles all file uploads for ReBites:

| Bucket | Purpose | Access |
|--------|---------|--------|
| `product-images` | Product photos (food images) | Public read, authenticated write (seller) |
| `avatars` | User profile pictures | Public read, authenticated write |
| `article-covers` | Blog/article cover images | Public read, admin write |
| `umkm-logos` | Seller store logos | Public read, seller write |

---

## Bucket Configuration

```sql
-- All buckets created via Supabase Dashboard or migration
-- Public read policies:
CREATE POLICY "public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');
```

| Bucket | Max File Size | Allowed MIME Types |
|--------|---------------|-------------------|
| `product-images` | 5 MB | `image/avif`, `image/jpeg`, `image/webp`, `image/png` |
| `avatars` | 2 MB | `image/jpeg`, `image/png`, `image/webp`, `image/avif` |
| `article-covers` | 5 MB | `image/jpeg`, `image/png`, `image/webp`, `image/avif` |
| `umkm-logos` | 2 MB | `image/jpeg`, `image/png`, `image/webp`, `image/avif` |

---

## Upload Flow

### Product Images — `lib/product-storage.ts`

```typescript
export async function uploadProductImages(
  files: File[],
  umkmId: string,
  productId: string
): Promise<string[]> {
  const paths = files.map((file, i) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'avif';
    return `${umkmId}/${productId}/${i}.${ext}`;
  });

  const results = await Promise.all(
    paths.map((path, i) =>
      supabase.storage
        .from('product-images')
        .upload(path, files[i], { upsert: true, contentType: files[i].type })
    )
  );

  return paths; // Store paths in DB, not full URLs
}
```

### Avatars — `lib/admin-avatar.ts`

```typescript
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'avif';
  const path = `${userId}/avatar.${ext}`;

  await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true });

  return path;
}
```

---

## Path Normalization — `lib/image-path.ts`

**Known issue:** Database stores paths with `.jpeg`/`.webp` extensions, but actual files are `.avif` (converted on upload).

```typescript
export function normalizeImagePath(path: string | null): string | null {
  if (!path) return null;
  // Replace .jpeg, .webp, .png with .avif if file doesn't exist
  return path.replace(/\.(jpeg|jpg|webp|png)$/i, '.avif');
}

export function getProductImageUrl(path: string | null): string {
  const normalized = normalizeImagePath(path);
  if (!normalized) return '/placeholder-product.avif';
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${normalized}`;
}
```

**Shortcut:** Extension mismatch handled at read time. When DB schema stabilizes, migrate stored paths to `.avif`.

---

## Public URL Generation

```typescript
// Client-side
const { data: { publicUrl } } = supabase.storage
  .from('product-images')
  .getPublicUrl(path);

// Server-side (for SSR)
const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
```

---

## Image Processing

| Feature | Status | Notes |
|---------|--------|-------|
| Auto-resize | ❌ | Client-side resize before upload |
| Auto-convert to AVIF | ✅ | Client converts via `canvas.toBlob()` |
| Thumbnails | ❌ | On-demand via `imgix` params (future) |
| CDN | ✅ | Supabase Storage uses Cloudflare CDN |

### Client-Side Conversion (Product Upload)

```typescript
// In app/components/seller/tambahMenu/UploadImages.tsx
const convertToAvif = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const maxDim = 1200;
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(new File([blob!], file.name.replace(/\.[^.]+$/, '.avif'), { type: 'image/avif' })),
        'image/avif',
        0.8
      );
    };
  });
};
```

---

## Storage Path Structure

```
product-images/
  {umkm_id}/
    {product_id}/
      0.avif          # Main image
      1.avif          # Additional
      2.avif

avatars/
  {user_id}/
    avatar.avif

article-covers/
  {article_slug}.avif

umkm-logos/
  {umkm_id}/
    logo.avif
```

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `403 Forbidden` | RLS policy / not authenticated | Ensure user owns resource |
| `413 Payload Too Large` | File > max size | Client-side validation |
| `400 Invalid MIME` | Unsupported format | Client-side type check |
| `404 Not Found` | Path doesn't exist | Use `normalizeImagePath` fallback |

---

## Local Development

```bash
# Supabase local storage runs on port 54321
# Files stored in .supabase/storage/
# Access via http://localhost:54321/storage/v1/object/public/...
```

---

## Migration Notes

| Bucket | Migrated From | Status |
|--------|---------------|--------|
| `product-images` | Local `public/images/` | Complete |
| `avatars` | Local `public/avatars/` | Complete |
| `article-covers` | New | Complete |
| `umkm-logos` | New | Complete |

Old local images removed from repo. All images now in Supabase Storage.

---

## Monitoring

| Metric | Alert |
|--------|-------|
| Storage usage > 80% quota | Cleanup / upgrade plan |
| Upload failure rate > 2% | Check RLS / client validation |
| 404 rate on images > 5% | Path normalization issue |

---

## Related Docs

- [Database: Overview](../database/overview.md) — Schema referencing storage paths
- [Features: Seller Dashboard](../features/seller-dashboard.md) — Product image upload UI
- [Features: Articles](../features/articles.md) — Cover upload
- [Features: Profile](../features/profile.md) — Avatar upload
- [Security: Data Protection](../security/data-protection.md) — File access control