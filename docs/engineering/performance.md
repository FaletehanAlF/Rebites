# Performance

> **Target:** Lighthouse > 90 on mobile, TTFB < 300ms, LCP < 1.5s

---

## Performance Targets

| Metric | Target | Current (Est.) |
|--------|--------|---------------|
| **LCP** (Largest Contentful Paint) | < 1.5s | ~2s (mobile 4G) |
| **TTFB** (Time to First Byte) | < 300ms | ~200ms (Vercel) |
| **Bundle Size** (client JS) | < 150KB gz | ~120KB |
| **API Latency** (p95) | < 500ms | ~300ms |
| **DB Query** (p95) | < 100ms | ~50ms |
| **Lighthouse Performance** | > 90 | ~85 |
| **Accessibility** | > 90 | ~95 |

---

## Frontend Performance

### Next.js Optimizations

| Technique | Implemented | Notes |
|-----------|-------------|-------|
| App Router (RSC) | ✅ | Server components reduce client JS |
| Image optimization | ✅ | `next/image` + AVIF |
| Route-based code splitting | ✅ | Automatic |
| Turbopack dev | ✅ | Faster HMR |
| Streaming SSR | ⚠️ | Not fully utilized |
| `next/dynamic` for heavy components | ✅ | Charts, maps |
| `placeholder="blur"` for images | ✅ | LCP optimization |
| `priority` for LCP images | ✅ | Above-fold |

### Bundle Analysis

```bash
# Run build with analysis
ANALYZE=true npm run build

# Check .next/static/chunks/ sizes
du -sh .next/static/chunks/*.js | sort -h
```

**Known bundle contributors:**
- `@supabase/supabase-js` (~50KB) — required
- `react` + `react-dom` (~45KB) — required
- `tailwind` CSS (~15KB gz) — required
- Chart libraries (~30KB) — lazy loaded
- Map libraries (~20KB) — lazy loaded

### Component Optimization

| Pattern | Use |
|---------|-----|
| `React.memo` | Static product cards in lists |
| `useMemo` / `useCallback` | Expensive computations, stable refs |
| `React.lazy` | Heavy dashboard components |
| Virtualization | Long order history lists |
| Debounce | Search inputs, shipping rate calculation |

---

## API Performance

### N+1 Query Prevention

| Pattern | Solution |
|---------|----------|
| Product + seller (UMKM) | Single query with `.select('*, umkm:umkm_profiles(...)')` |
| Order + product + buyer | Single query with joins |
| List + counts | `COUNT(*)` in same query with `select: 'count=exact'` |

### Query Optimization

```typescript
// ❌ N+1: Fetch seller per product
const products = await db.from('products').select('*');
for (const p of products) {
  const seller = await db.from('umkm_profiles').select('*').eq('id', p.umkm_id).single();
}

// ✅ Single query with join
const { data } = await db
  .from('products')
  .select('*, umkm:umkm_profiles(id, business_name, city, rating, slug, logo_url)')
  .eq('status', 'available')
  .order('created_at', { ascending: false })
  .range(0, 19);
```

### Pagination

All list endpoints use `page` + `limit`:

```typescript
const page = Math.max(1, parseInt(query.page ?? '1'));
const limit = Math.min(100, parseInt(query.limit ?? '20'));
const offset = (page - 1) * limit;

const { data, count } = await db
  .from('products')
  .select('*', { count: 'exact' })
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1);

return {
  data,
  pagination: { total: count ?? 0, page, limit }
};
```

### Caching Strategy

| Data | Cache | TTL | Reason |
|------|-------|-----|--------|
| Categories | Memory (Next.js ISR) | 1 hour | Rarely changes |
| Product list | Supabase cache (future) | 30s | Frequent changes |
| Shipping rates | Client-side (per session) | N/A | Distance-based |
| Article content | ISR (60s) | 60s | Blog rarely updates |
| Dashboard KPIs | Server memory (future) | 5 min | Analytics |

**Currently:** No caching layer. Supabase handles connection pooling.

---

## Database Performance

### Indexes (Existing)

```sql
-- Performance-critical indexes
CREATE INDEX idx_products_status ON products(status, category);
CREATE INDEX idx_orders_buyer_id ON orders(buyer_id, created_at);
CREATE INDEX idx_orders_umkm_id ON orders(umkm_id, created_at);
CREATE INDEX idx_orders_status ON orders(order_status, payment_status);
CREATE INDEX idx_orders_code ON orders(order_code);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id, created_at);
```

### Slow Query Patterns to Avoid

| Pattern | Fix |
|---------|-----|
| Full table scan on `orders` without index | Use `buyer_id` or `umkm_id` filter |
| `LIKE '%query%'` | Use Supabase full-text search (tsvector) |
| Unindexed JSON field query | Add expression index |
| `SELECT *` on large tables | Explicit column list |
| No `LIMIT` on list queries | Always paginate |

### Monitoring

```sql
-- Check slow queries
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
WHERE calls > 0
ORDER BY mean_exec_time DESC
LIMIT 20;
```

---

## External API Performance

| API | Typical Latency | Timeout | Optimization |
|-----|----------------|---------|-------------|
| Supabase | 5-50ms | 10s | Connection pooling, local (Singapore) |
| Xendit | 200-500ms | 10s | Parallel calls, pre-validation |
| Biteship | 300-800ms | 10s | Cache rates (same distance) |
| Gemini | 800-2000ms | 30s | Stream responses, reduce tokens |
| Vercel CDN | 5-20ms | — | Edge caching |

### Timeout Configuration

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000); // 10s for all external APIs
try {
  res = await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timeout);
}
```

---

## Realtime Performance

### Supabase Realtime Constraints

| Factor | Limit | Mitigation |
|--------|-------|-----------|
| Max connections | 200 (free tier) | Filter by `auth.uid()` |
| Message size | 100KB per message | Only send updated fields |
| Channel topics | Unlimited | Use specific topics per order |

### Best Practices

```typescript
// Only subscribe to relevant changes
supabaseChannel
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'orders', filter: `buyer_id=eq.${user.id}` },
    (payload) => handleOrderUpdate(payload.new)
  )
  .subscribe();
// NOT: subscribe to all orders changes
```

---

## Performance Testing

### Load Testing (Future)

```bash
# k6 (Vercel)
k6 run load-test.js

# or Apache Bench
ab -n 100 -c 10 http://localhost:3000/api/products
```

### Lighthouse CI (Future)

```yaml
# .lighthouserc.json
{
  "ci": {
    "assert": {
      "assertions": {
        "performance": ["error", { "minScore": 0.9 }],
        "accessibility": ["error", { "minScore": 0.9 }],
        "first-contentful-paint": ["warn", { "maxNumericValue": 1500 }]
      }
    }
  }
}
```

### Web Vitals Monitoring

```typescript
// In production (future)
import { report } from 'next/web-vitals';
report(metric => {
  console.log('Web Vital:', metric.name, metric.value);
  // Send to analytics
});
```

---

## Known Performance Issues

| Issue | Impact | Fix |
|-------|--------|-----|
| No Supabase caching | Each query hits DB | Add `pg_cache` or Vercel KV |
| N+1 in seller dashboard | 2-3s load | Combine queries |
| Full product list on mobile | 3s initial load | Pagination + lazy images |
| AI chat latency | 2-3s response | Stream responses |
| No CDN for Supabase | Singapore only | Acceptable for local market |

---

## Performance Checklist

Before each release:

- [ ] Bundle size check (`du -sh .next/static/chunks/`)
- [ ] Lighthouse score > 85
- [ ] No N+1 queries in new features
- [ ] Pagination on all list endpoints
- [ ] Images use `next/image`
- [ ] No unbounded API calls
- [ ] External API timeouts configured

---

## Related Docs

- [Engineering: Code Organization](./code-organization.md) — Module boundaries
- [Engineering: Tech Debt](./tech-debt.md) — Known perf issues
- [Operations: Monitoring](../operations/monitoring.md) — Latency metrics
- [Architecture: Data Flow](../architecture/data-flow.md) — System data paths
- [Database: Overview](../database/overview.md) — Schema, indexes