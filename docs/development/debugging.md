# Debugging Guide

> **Tools:** Chrome DevTools, VS Code debugger, Supabase Dashboard, structured logs

---

## Local Debugging

### VS Code Debug Configuration

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: Debug Server",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev"
    },
    {
      "name": "Next.js: Debug Client",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}"
    },
    {
      "name": "Tests: Debug",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "node",
      "runtimeArgs": ["--test", "${file}"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Server-Side Debugging

```bash
# Add breakpoints in VS Code, then run:
npm run dev

# Or with inspector:
node --inspect-brk node_modules/.bin/next dev
```

### Client-Side Debugging

1. Open Chrome DevTools (F12)
2. Sources → Filesystem → Add workspace folder
3. Enable "Pause on caught exceptions" for React errors

---

## Common Issues & Solutions

### 1. Supabase Connection Failed

**Symptom:** `ECONNREFUSED` or `fetch failed` in server logs

**Check:**
```bash
# Local Supabase running?
supabase status

# Correct env vars?
cat .env.local | grep SUPABASE

# Network?
curl http://localhost:54321/health
```

**Fix:** Start `supabase start` or verify cloud credentials.

---

### 2. RLS Policy Blocking Query

**Symptom:** Empty results or "permission denied" in API routes

**Debug:**
```typescript
// Temporarily use service client to verify data exists
const service = createServiceClient();
const { data } = await service.from('orders').select('*').eq('id', id);
console.log('Service role sees:', data);

// Check RLS policies in Supabase Dashboard → Authentication → Policies
```

**Common causes:**
- Using anon client when service role needed (webhooks, admin)
- User not authenticated (no JWT in request)
- Policy condition mismatch (e.g., `umkm_id` vs `user_id`)

---

### 3. Xendit Webhook Not Received

**Symptom:** Payment completes but order stays `unpaid`

**Debug:**
```bash
# Check ngrok tunnel
curl https://your-ngrok-url/api/webhooks/xendit \
  -H "X-Callback-Token: your_token" \
  -d '{"id":"test","external_id":"RB-TEST","status":"PAID","amount":1000}'

# Check Supabase: order.invoice_state = 'pending'?
```

**Fix:**
- Verify `XENDIT_CALLBACK_TOKEN` matches Xendit dashboard
- Ensure webhook URL is HTTPS (ngrok works)
- Check `[webhook/xendit]` logs in terminal

---

### 4. Biteship Rate Calculation Fails

**Symptom:** Shipping fee shows "Gagal menghitung ongkir"

**Debug:**
```typescript
// Check service client has balance
const result = await getBiteshipRates(payload);
console.log('[biteship] rates:', result);

// Or check local fallback
const fee = calculateDeliveryFee(roadKm);
console.log('Local fee:', fee);
```

**Fix:**
- Add `BITESHIP_API_KEY` with sufficient balance
- Check `BITESHIP_COURIERS` list
- Local fallback always works if coordinates available

---

### 5. TypeScript Errors After Pull

**Symptom:** `npx tsc --noEmit` fails with new errors

**Fix:**
```bash
# 1. Install deps
npm install

# 2. Check for @types mismatches
npx tsc --noEmit 2>&1 | head -50

# 3. Common: Supabase generated types out of sync
supabase gen types typescript --project-id <id> > types/supabase.ts
```

---

### 6. Image Not Loading (Extension Mismatch)

**Symptom:** Product images 404, DB shows `.jpeg` but file is `.avif`

**Debug:**
```typescript
// lib/image-path.ts handles this:
const url = getProductImageUrl(product.image_url);
console.log('Normalized:', url);
```

**Fix:** The `normalizeImagePath` function handles this at runtime. For permanent fix, migrate DB paths.

---

### 7. Test Failures

**Symptom:** `npm test` fails

**Debug:**
```bash
# Run specific test
node --test tests/checkout-idempotency.test.ts

# Check for Windows EOL issue (one test)
# Fix: ensure LF line endings in test file
```

---

## Logging Best Practices

### Server Logs

```typescript
// Prefix convention: [module/route]
console.log('[checkout/xendit] order created', { orderCode, amount });
console.warn('[webhook/xendit] retry detected', { externalId, attempt: 2 });
console.error('[orders/[code]] fetch failed', error.message);

// Structured: key-value pairs for log aggregation
```

### Client Logs

```typescript
// Only in development
if (process.env.NODE_ENV === 'development') {
  console.log('[chat] sending message', { length: msg.length });
}
```

---

## Debugging Checklist

| Issue | Check First |
|-------|-------------|
| API 401 | `Authorization` header present? Token valid? |
| API 403 | User role correct? `account_status='active'`? |
| API 404 | Resource exists? Correct ID format? |
| API 500 | Server logs? Supabase error? External API down? |
| Webhook not firing | Tunnel URL correct? Token matches? 2xx response? |
| DB query empty | RLS policy? Correct client (anon vs service)? |
| Image 404 | Path in DB? Extension mismatch? Bucket public? |
| Realtime not working | Channel name? Filter by `auth.uid()`? Connection limit? |

---

## Production Debugging

### Accessing Logs

| Platform | Method |
|----------|--------|
| Vercel | Dashboard → Functions → Logs |
| Railway/Render | Dashboard → Logs |
| Docker | `docker logs <container>` |
| PM2 | `pm2 logs` |

### Database Inspection

```bash
# Supabase Dashboard → SQL Editor
SELECT * FROM orders WHERE order_code = 'RB-...';

# Or via psql
supabase db connect
```

### Realtime Monitoring

Supabase Dashboard → Realtime → Active channels, messages/sec

---

## Debugging Tools

| Tool | Use |
|------|-----|
| Chrome DevTools | Network, Console, React Components, Performance |
| Supabase Dashboard | Auth users, DB data, Logs, Realtime, Storage |
| Xendit Dashboard | Invoice status, Webhook logs |
| Biteship Dashboard | Shipments, Tracking, Webhook logs |
| VS Code Debugger | Breakpoints, Call stack, Variables |
| `curl` / `httpie` | Manual API testing |
| `jq` | JSON pretty-print in terminal |

---

## Related Docs

- [Development: Setup](./setup.md) — Local environment
- [Testing: Strategy](../testing/strategy.md) — Test debugging
- [Operations: Monitoring](../operations/monitoring.md) — Production observability
- [Operations: Incident Response](../operations/incident-response.md) — Production debugging
- [Security: Secrets Management](../security/secrets-management.md) — Debug without leaking secrets