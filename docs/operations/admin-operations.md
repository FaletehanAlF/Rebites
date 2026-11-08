# Admin Operations

> **Routine operational tasks for platform admins**

---

## Daily Operations

### Order Monitoring

| Task | Frequency | Tool |
|------|-----------|------|
| Check stuck orders (`unpaid` > 1hr, `processing` > 2hr) | Hourly | Admin dashboard `/dashboard/admin/pesanan` |
| Verify payment webhook processing | Real-time | `[webhook/xendit]` logs |
| Monitor delivery completion rate | Daily | Admin dashboard analytics |
| Check failed shipments | Daily | `/dashboard/admin/pengiriman` |

### User Management

| Task | Frequency | Tool |
|------|-----------|------|
| Review new user registrations | Daily | `/dashboard/admin/pengguna` |
| Check pending role requests | Daily | `/dashboard/admin/permintaan-role` |
| Review user reports/warnings | Daily | `/dashboard/admin/moderasi` |
| Monitor banned/suspended accounts | Weekly | `/dashboard/admin/sanksi` |

### Content Moderation

| Task | Frequency | Tool |
|------|-----------|------|
| Moderate new products | Real-time | `/dashboard/admin/produk` (verification_status=pending) |
| Review flagged products | Daily | `/dashboard/admin/produk` |
| Moderate articles | On publish | `/dashboard/admin/artikel` |

### Financial

| Task | Frequency | Tool |
|------|-----------|------|
| Review payout requests | Weekly | `/dashboard/admin/riwayat` |
| Check Xendit balance | Daily | Xendit Dashboard |
| Check Biteship balance | Daily | Biteship Dashboard |
| Reconcile coin earnings | Weekly | Admin analytics |

---

## Weekly Operations

### Analytics Review

```bash
# Dashboard checks:
# 1. GMV trend (7d, 30d)
# 2. Conversion funnel: visit → product → cart → checkout → paid
# 3. Top categories, top sellers
# 4. Geographic distribution (Kota Depok sub-districts)
# 5. Courier performance (on-time, failed rate)
```

### System Health

| Check | Tool |
|-------|------|
| Supabase DB size / connections | Supabase Dashboard |
| Vercel function errors / duration | Vercel Dashboard |
| Xendit webhook success rate | Xendit Dashboard → Webhooks |
| Biteship shipment success rate | Biteship Dashboard |
| AI API usage / cost | Google AI Studio |

### Security Audit

| Check | Tool |
|-------|------|
| Failed login attempts | Supabase Auth logs |
| Admin audit log review | `/dashboard/admin/riwayat` (audit logs) |
| Suspicious activity (multiple IPs, bulk actions) | Activity logs |
| Expired API keys | Provider dashboards |

---

## Monthly Operations

### Data Hygiene

| Task | Description |
|------|-------------|
| Archive old orders | Move > 1yr orders to cold storage (future) |
| Clean expired promo codes | Deactivate `is_valid=false` |
| Remove unused images | Storage cleanup |
| Review user retention cohorts | Admin analytics |

### Capacity Planning

| Resource | Threshold | Action |
|----------|-----------|--------|
| Supabase DB size | > 400 MB (80% free tier) | Upgrade plan or archive |
| Supabase storage | > 800 MB (80% free tier) | Cleanup / upgrade |
| Vercel function invocations | > 80% quota | Optimize / upgrade |
| Xendit transaction volume | Near limit | Request limit increase |

### Compliance

| Task | Frequency |
|------|-----------|
| PDP compliance review | Quarterly |
| Data backup verification | Monthly (test restore) |
| Access control audit | Quarterly |

---

## Emergency Procedures

### Stuck Order Resolution

```sql
-- 1. Find stuck orders
SELECT order_code, payment_status, order_status, invoice_state, created_at
FROM orders
WHERE payment_status = 'unpaid'
  AND created_at < NOW() - INTERVAL '1 hour'
  AND invoice_state = 'pending';

-- 2. If Xendit invoice expired → manually cancel
UPDATE orders
SET payment_status = 'failed',
    order_status = 'cancelled',
    invoice_state = 'failed'
WHERE order_code = 'RB-...';
```

### Webhook Replay

```bash
# Xendit: Dashboard → Webhooks → "Resend"
# Biteship: Dashboard → Webhooks → "Retry"
# Or manual curl:
curl -X POST https://rebites.id/api/webhooks/xendit \
  -H "X-Callback-Token: $XENDIT_CALLBACK_TOKEN" \
  -d '{"id":"inv_...","external_id":"RB-...","status":"PAID","amount":25000,"paid_amount":25000,"payment_channel":"BCA"}'
```

### Database Emergency

| Scenario | Action |
|----------|--------|
| DB connection pool exhausted | Supabase Dashboard → Kill long queries |
| Slow query blocking | `pg_cancel_backend(pid)` |
| Accidental data loss | PITR restore (Supabase Dashboard) |
| Migration failed | `supabase db reset` (local) / manual rollback |

### API Key Compromise

```
1. Generate new key in provider dashboard
2. Update Vercel env var (auto-deploys)
3. Revoke old key
4. Check logs for unauthorized usage
```

---

## Common Admin Queries

### Find User by Email

```sql
SELECT p.*, u.email
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'user@example.com';
```

### Find Order by Code

```sql
SELECT o.*, p.name as product_name, u.business_name as seller_name
FROM orders o
LEFT JOIN products p ON p.id = o.product_id
LEFT JOIN umkm_profiles u ON u.id = o.umkm_id
WHERE o.order_code = 'RB-...';
```

### Seller Sales Report

```sql
SELECT 
  u.business_name,
  COUNT(o.id) as total_orders,
  SUM(o.total_price) as gmv,
  SUM(o.coin_earned) as coins_earned
FROM orders o
JOIN umkm_profiles u ON u.id = o.umkm_id
WHERE o.payment_status = 'paid'
  AND o.created_at >= '2025-01-01'
GROUP BY u.business_name
ORDER BY gmv DESC;
```

### Promo Code Usage

```sql
SELECT code, percent_off, used_count, max_uses, expires_at, is_valid
FROM promo_codes
ORDER BY created_at DESC;
```

---

## Runbooks (Quick Reference)

### "Order not paid but customer says they paid"

1. Check Xendit Dashboard → Invoices → Search by external_id
2. If PAID: trigger webhook manually (see Webhook Replay)
3. If PENDING: Wait or ask customer to retry
4. If EXPIRED/FAILED: Order cancelled, customer must retry

### "Seller says delivery not picked up"

1. Check Biteship Dashboard → Shipments → Search by waybill
2. If `PICKUP_REQUESTED`: Courier hasn't accepted
3. If `PICKED_UP`: In transit
4. If failed: Contact Biteship support or assign ReBites courier

### "Customer reports wrong order delivered"

1. Check order detail → `address_snapshot`
2. Check Biteship tracking → delivery photo (if available)
3. If courier error: Issue refund, sanction courier
4. If customer error: Document, no refund

### "AI chatbot giving wrong info"

1. Check `[chat]` logs for tool calls
2. Verify context injection (buyer/seller profile)
3. Test in `/preview` route
4. If persistent: Adjust system prompt or disable tool

---

## Related Docs

- [Operations: Monitoring](./monitoring.md) — Metrics & alerts
- [Operations: Incident Response](./incident-response.md) — SEV procedures
- [Features: Admin Dashboard](../features/admin-dashboard.md) — UI workflows
- [API: Admin](../api/admin.md) — Admin endpoints
- [Security: Overview](../security/overview.md) — Security operations