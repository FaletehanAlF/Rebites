# Environment Variables

> **Complete reference for all environment variables used in ReBites**

---

## Quick Reference

| Variable | Required | Scope | Default | Example |
|----------|----------|-------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Client+Server | — | `https://abc.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Client+Server | — | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server only | — | `eyJ...` |
| `XENDIT_SECRET_KEY` | ✅ | Server only | — | `xst_public_...` |
| `XENDIT_CALLBACK_TOKEN` | ✅ | Server only | — | `a1b2c3...` |
| `BITESHIP_API_KEY` | ✅ | Server only | — | `biteship_...` |
| `BITESHIP_WEBHOOK_SECRET` | ✅ | Server only | — | `d4e5f6...` |
| `GEMINI_API_KEY` | ✅ | Server only | — | `AIza...` |
| `SUPER_ADMIN_USER_ID` | ✅ | Server only | — | `uuid...` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Client+Server | `http://localhost:3000` | `https://rebites.id` |

---

## Full Catalog

### Supabase

| Variable | Required | Scope | Description |
|----------|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Client+Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Client+Server | Public anon key (RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server only | Bypasses RLS — **never in client** |
| `SUPABASE_AUTH_SECRET` | ⚠️ | Server only | Custom auth domain secret |

### Xendit (Payments)

| Variable | Required | Scope | Description |
|----------|----------|-------|-------------|
| `XENDIT_SECRET_KEY` | ✅ | Server only | API secret (Basic auth username) |
| `XENDIT_CALLBACK_TOKEN` | ✅ | Server only | Webhook verification token |
| `XENDIT_WEBHOOK_TOKEN` | ⚠️ | Server only | Fallback if `XENDIT_CALLBACK_TOKEN` not set |
| `XENDIT_TEST_MODE` | ⚠️ | Server only | `true` = sandbox environment |

### Biteship (Logistics)

| Variable | Required | Scope | Description |
|----------|----------|-------|-------------|
| `BITESHIP_API_KEY` | ✅ | Server only | API key for rates & shipments |
| `BITESHIP_WEBHOOK_SECRET` | ✅ | Server only | HMAC-SHA256 secret for webhook |
| `BITESHIP_COURIERS` | ⚠️ | Server only | Comma-separated: `jne,sicepat,ninja` |

### ReBites Courier (In-House)

| Variable | Required | Scope | Default | Description |
|----------|----------|-------|---------|-------------|
| `REBITES_COURIER_CODE` | ⚠️ | Built-in | `rebites` | Courier identifier |
| `REBITES_SERVICE_CODE` | ⚠️ | Built-in | `standard` | Service tier |
| `REBITES_COURIER_NAME` | ⚠️ | Built-in | `ReBites Courier` | Display name |
| `REBITES_SERVICE_NAME` | ⚠️ | Built-in | `Standard` | Display service |

### AI (Google Gemini)

| Variable | Required | Scope | Default | Description |
|----------|----------|-------|---------|-------------|
| `GEMINI_API_KEY` | ✅ | Server only | — | Google AI Studio API key |
| `AI_MODEL` | ⚠️ | Server only | `gemini-1.5-flash` | Model name |
| `AI_MAX_TOKENS` | ⚠️ | Server only | `2048` | Max output tokens |
| `AI_TEMPERATURE` | ⚠️ | Server only | `0.3` | Sampling temperature |

### Admin

| Variable | Required | Scope | Description |
|----------|----------|-------|-------------|
| `SUPER_ADMIN_USER_ID` | ✅ | Server only | UUID of super admin user |

### App

| Variable | Required | Scope | Default | Description |
|----------|----------|-------|---------|-------------|
| `NEXT_PUBLIC_APP_URL` | ✅ | Client+Server | `http://localhost:3000` | Production URL |

### Build / Dev

| Variable | Required | Scope | Default | Description |
|----------|----------|-------|---------|-------------|
| `NODE_ENV` | ⚠️ | Server | `development` | `production` in prod |
| `PORT` | ⚠️ | Server | `3000` | Dev server port |

---

## Security Classification

### Public (Safe in Client Bundle)

```env
NEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://rebites.id
```

**Safe because:** RLS protects data; these are intentionally public.

### Server-Only (Never in Client)

```env
SUPABASE_SERVICE_ROLE_KEY=eyJ...
XENDIT_SECRET_KEY=xst_public_...
XENDIT_CALLBACK_TOKEN=a1b2c3...
BITESHIP_API_KEY=biteship_...
BITESHIP_WEBHOOK_SECRET=d4e5f6...
GEMINI_API_KEY=AIza...
SUPER_ADMIN_USER_ID=uuid...
```

**Danger if leaked:** Full DB access, payment creation, shipment creation, AI costs.

### Sensitive (Rotate Quarterly)

```env
XENDIT_CALLBACK_TOKEN=a1b2c3...
BITESHIP_WEBHOOK_SECRET=d4e5f6...
```

**Rotate if:** Suspected leak, webhook anomalies, quarterly schedule.

---

## Local Development (`.env.local`)

```bash
cp .env.example .env.local
# Fill in all required values
# Get from: Supabase Dashboard, Xendit Dashboard, Biteship Dashboard, Google AI Studio
```

### Get Local Supabase Keys

```bash
supabase start
supabase status
# Shows: API URL, anon key, service role key
```

---

## Production (Vercel)

```
Dashboard → Project → Settings → Environment Variables
```

| Variable | Production | Preview | Development |
|----------|------------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | ❌ |
| `XENDIT_SECRET_KEY` | ✅ | ✅ | ❌ |
| `XENDIT_CALLBACK_TOKEN` | ✅ | ✅ | ❌ |
| `BITESHIP_API_KEY` | ✅ | ✅ | ❌ |
| `BITESHIP_WEBHOOK_SECRET` | ✅ | ✅ | ❌ |
| `GEMINI_API_KEY` | ✅ | ✅ | ❌ |
| `SUPER_ADMIN_USER_ID` | ✅ | ❌ | ❌ |
| `NEXT_PUBLIC_APP_URL` | ✅ | ✅ | ✅ |

---

## Validation

### Startup Check

```typescript
// lib/server/xendit.ts
function getSecretKey(): string {
  const raw = process.env.XENDIT_SECRET_KEY?.trim();
  if (!raw) throw new Error('Missing env: XENDIT_SECRET_KEY');
  return raw;
}
```

**Pattern:** Fail fast on missing required secrets.

### Build-Time Check

```bash
# In CI
if grep -r "SUPABASE_SERVICE_ROLE_KEY" .next/static/; then
  echo "SECRET IN CLIENT BUNDLE!"
  exit 1
fi
```

---

## Migration Checklist

| Action | Steps |
|--------|-------|
| **Add new var** | 1. Add to `.env.example` 2. Add to Vercel 3. Update docs |
| **Rename var** | 1. Update code 2. Add new to Vercel 3. Deploy 4. Remove old from Vercel |
| **Rotate secret** | 1. Generate new in provider 2. Update Vercel 3. Deploy 4. Verify 5. Revoke old |
| **Remove var** | 1. Remove from code 2. Deploy 3. Remove from Vercel |

---

## Related Docs

- [Security: Secrets Management](../security/secrets-management.md) — Rotation procedures
- [Deployment: Overview](../deployment/overview.md) — Deploy process
- [Development: Setup](../development/setup.md) — Local setup
- [Integrations: Supabase](../integrations/supabase.md) — Supabase env
- [Integrations: Xendit](../integrations/xendit.md) — Xendit env
- [Integrations: Biteship](../integrations/biteship.md) — Biteship env