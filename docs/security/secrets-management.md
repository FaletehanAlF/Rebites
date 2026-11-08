# Secrets Management

> **Policy:** All secrets in environment variables. No secrets in code, logs, or client bundles.

---

## Secret Inventory

| Secret | Environment Variable | Scope | Rotation |
|--------|---------------------|-------|----------|
| Supabase Service Role | `SUPABASE_SERVICE_ROLE_KEY` | Server only | Quarterly (Supabase Dashboard) |
| Supabase Anon Key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Annual (low risk) |
| Supabase URL | `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Never (project ID) |
| Xendit Secret Key | `XENDIT_SECRET_KEY` | Server only | Quarterly (Xendit Dashboard) |
| Xendit Callback Token | `XENDIT_CALLBACK_TOKEN` | Server only | Quarterly (generate 32+ char random) |
| Xendit Webhook Token (fallback) | `XENDIT_WEBHOOK_TOKEN` | Server only | Same as above |
| Biteship API Key | `BITESHIP_API_KEY` | Server only | Quarterly (Biteship Dashboard) |
| Biteship Webhook Secret | `BITESHIP_WEBHOOK_SECRET` | Server only | Quarterly (generate 32+ char random) |
| Biteship Couriers | `BITESHIP_COURIERS` | Server only | As needed |
| Gemini API Key | `GEMINI_API_KEY` | Server only | Quarterly (Google AI Studio) |
| Super Admin User ID | `SUPER_ADMIN_USER_ID` | Server only | When admin changes |
| App URL | `NEXT_PUBLIC_APP_URL` | Client + Server | On deploy domain change |

---

## Local Development

```bash
# 1. Copy template
cp .env.example .env.local

# 2. Fill in values (get from respective dashboards)
# 3. Never commit .env.local
```

### `.env.example` Template

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Xendit
XENDIT_SECRET_KEY=xst_public_your_key
XENDIT_CALLBACK_TOKEN=your_32char_random_token
XENDIT_WEBHOOK_TOKEN=your_32char_random_token_fallback

# Biteship
BITESHIP_API_KEY=your_biteship_key
BITESHIP_WEBHOOK_SECRET=your_32char_random_secret
BITESHIP_COURIERS=jne,sicepat

# AI
GEMINI_API_KEY=your_gemini_key

# Admin
SUPER_ADMIN_USER_ID=uuid-of-super-admin

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Production (Vercel / Docker)

### Vercel Environment Variables

```
Dashboard → Project → Settings → Environment Variables
```

| Variable | Environment | Secret? |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview | **Yes** |
| `XENDIT_SECRET_KEY` | Production, Preview | **Yes** |
| `XENDIT_CALLBACK_TOKEN` | Production, Preview | **Yes** |
| `XENDIT_WEBHOOK_TOKEN` | Production, Preview | **Yes** |
| `BITESHIP_API_KEY` | Production, Preview | **Yes** |
| `BITESHIP_WEBHOOK_SECRET` | Production, Preview | **Yes** |
| `BITESHIP_COURIERS` | Production, Preview | No |
| `GEMINI_API_KEY` | Production, Preview | **Yes** |
| `SUPER_ADMIN_USER_ID` | Production | **Yes** |
| `NEXT_PUBLIC_APP_URL` | Production, Preview | No |

**Never** use "Development" environment for production secrets.

### Docker

```bash
# Use .env.production (not committed)
docker run --env-file .env.production -p 3000:3000 rebites
```

---

## Secret Generation

### Random Token (32+ chars)

```bash
# OpenSSL
openssl rand -hex 32
# Or Node
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Or Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### Webhook Secrets

```bash
# XENDIT_CALLBACK_TOKEN
openssl rand -hex 32

# BITESHIP_WEBHOOK_SECRET
openssl rand -hex 32
```

---

## Rotation Procedures

### Quarterly Rotation (Recommended)

| Secret | How to Rotate | Downtime |
|--------|---------------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → Regenerate | < 1 min (update Vercel) |
| `XENDIT_SECRET_KEY` | Xendit Dashboard → Settings → API Keys → Regenerate | < 1 min |
| `XENDIT_CALLBACK_TOKEN` | Generate new → Update Xendit webhook config → Update Vercel | < 5 min |
| `BITESHIP_API_KEY` | Biteship Dashboard → Settings → API → Regenerate | < 1 min |
| `BITESHIP_WEBHOOK_SECRET` | Generate new → Update Biteship webhook config → Update Vercel | < 5 min |
| `GEMINI_API_KEY` | Google AI Studio → API Keys → Regenerate | < 1 min |

### Emergency Rotation (Compromise Suspected)

```bash
# 1. Generate new secrets immediately
# 2. Update all environments (Vercel, local .env.local)
# 3. Revoke old keys in provider dashboards
# 4. Deploy (Vercel auto-deploys on env change)
# 5. Verify webhooks work
# 6. Check logs for auth failures
```

---

## Security Controls

### Code Scanning

```bash
# Pre-commit hook (recommended)
# .husky/pre-commit
#!/bin/bash
if grep -r "SUPABASE_SERVICE_ROLE_KEY\|XENDIT_SECRET_KEY\|BITESHIP_API_KEY\|GEMINI_API_KEY" --include="*.ts" --include="*.tsx" app/ lib/; then
  echo "ERROR: Secret found in code!"
  exit 1
fi
```

### Build-Time Check

```bash
# In CI (GitHub Actions)
- run: |
    if grep -r "SUPABASE_SERVICE_ROLE_KEY\|XENDIT_SECRET_KEY\|BITESHIP_API_KEY\|GEMINI_API_KEY" .next/ 2>/dev/null; then
      echo "ERROR: Secret in client bundle!"
      exit 1
    fi
```

### Runtime Check

```typescript
// lib/server/supabase.ts - validates on first use
function getSecretKey(): string {
  const raw = process.env.XENDIT_SECRET_KEY?.trim();
  if (!raw) throw new Error('Missing env: XENDIT_SECRET_KEY');
  return raw;
}
```

---

## Secret Access Patterns

### ✅ Correct: Server-only modules

```typescript
// lib/server/xendit.ts
function getSecretKey(): string {
  const raw = process.env.XENDIT_SECRET_KEY?.trim();
  if (!raw) throw new Error('Missing env: XENDIT_SECRET_KEY');
  return raw;
}
```

### ✅ Correct: Server route handlers (after auth check)

```typescript
// app/api/admin/health/route.ts
import { createServiceClient } from '@/lib/server/supabase'; // Uses service role
```

### ❌ Wrong: Client components

```typescript
// NEVER do this:
'use client';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // OK (public)
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;  // ❌ BUNDLED TO CLIENT
```

### ❌ Wrong: Public API routes without auth

```typescript
// NEVER use service role in public endpoints
export async function GET() {
  const service = createServiceClient(); // ❌ RLS bypassed without auth
  const { data } = await service.from('orders').select('*');
  return NextResponse.json(data);
}
```

---

## Monitoring & Alerts

| Check | Tool | Alert |
|-------|------|-------|
| Secrets in client bundle | Build scan | Fail build |
| Secrets in code | Pre-commit / CI | Fail PR |
| Expired API keys | Provider webhooks / 401 logs | PagerDuty |
| Webhook signature failures | Log monitoring | PagerDuty |
| Missing env vars | Startup check | Crash (fail fast) |

---

## Incident Response: Secret Leak

```
1. ROTATE: Generate new secret immediately
2. REVOKE: Disable old key in provider dashboard
3. DEPLOY: Update Vercel env → auto-deploy
4. VERIFY: Check webhook logs, API health
5. AUDIT: Check logs for unauthorized access
6. REPORT: If PII exposed → PDP notification
7. POSTMORTEM: Document root cause, improve controls
```

---

## Related Docs

- [Security: Overview](./overview.md) — Threat model
- [Security: Data Protection](./data-protection.md) — PII handling
- [Development: Setup](../development/setup.md) — Local env
- [Deployment: Environment](../deployment/environment.md) — Production env
- [Operations: Incident Response](../operations/incident-response.md) — Breach response
- [Integrations: Xendit](../integrations/xendit.md) — Key usage
- [Integrations: Biteship](../integrations/biteship.md) — Key usage