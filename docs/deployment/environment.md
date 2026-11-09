# Environment Variables

> **Source:** `.env.example`, `lib/server/supabase.ts`, `lib/server/xendit.ts`, `lib/server/biteship.ts`

---

## Complete Variable Reference

### Supabase

| Variable | Required | Scope | Description |
|----------|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Client + Server | Public anon key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server only | Bypasses RLS. Never in client. |
| `SUPABASE_AUTH_SECRET` | ⚠️ | Server only | For custom domain auth token validation |

### Xendit (Payments)

| Variable | Required | Scope | Description |
|----------|----------|-------|-------------|
| `XENDIT_SECRET_KEY` | ✅ | Server only | API secret (Basic auth) |
| `XENDIT_CALLBACK_TOKEN` | ✅ | Server only | Webhook verification token |
| `XENDIT_WEBHOOK_TOKEN` | ⚠️ | Server only | Fallback if `XENDIT_CALLBACK_TOKEN` not set |
| `XENDIT_TEST_MODE` | ⚠️ | Server only | `true` = sandbox |

### Biteship (Logistics)

| Variable | Required | Scope | Description |
|----------|----------|-------|-------------|
| `BITESHIP_API_KEY` | ✅ | Server only | API key for rates & shipments |
| `BITESHIP_WEBHOOK_SECRET` | ✅ | Server only | HMAC secret for webhook verification |
| `BITESHIP_COURIERS` | ⚠️ | Server only | Comma-separated: `jne,sicepat,ninja` |

### ReBites Courier (In-House)

| Variable | Default | Scope | Description |
|----------|---------|-------|-------------|
| `REBITES_COURIER_CODE` | `rebites` | Built-in | Courier identifier in DB |
| `REBITES_SERVICE_CODE` | `standard` | Built-in | Service tier |
| `REBITES_COURIER_NAME` | `ReBites Courier` | Built-in | Display name |
| `REBITES_SERVICE_NAME` | `Standard` | Built-in | Display service name |

### AI (Gemini)

| Variable | Default | Scope | Description |
|----------|---------|-------|-------------|
| `GEMINI_API_KEY` | — | Server only | Google AI Studio API key |
| `AI_MODEL` | `gemini-1.5-flash` | Server only | Model name |
| `AI_MAX_TOKENS` | `2048` | Server only | Max output tokens |
| `AI_TEMPERATURE` | `0.3` | Server only | Sampling temperature |

### Admin

| Variable | Required | Scope | Description |
|----------|----------|-------|-------------|
| `SUPER_ADMIN_USER_ID` | ✅ | Server only | UUID of super admin user |

### App

| Variable | Default | Scope | Description |
|----------|---------|-------|-------------|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Client + Server | Production URL (for callbacks, OG tags) |

### Build / Dev

| Variable | Default | Scope | Description |
|----------|---------|-------|-------------|
| `NODE_ENV` | `development` | Server | `development` / `production` |
| `PORT` | `3000` | Server | Dev server port |

---

## Security Classification

### Public (Safe in Client Bundle)

| Variable | Risk if Exposed |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | None (project ID) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Low (RLS protects data) |
| `NEXT_PUBLIC_APP_URL` | None |
| `REBITES_*` | None (built-in defaults) |

### Internal (Server-Only)

| Variable | Risk if Exposed |
|----------|-----------------|
| `SUPABASE_SERVICE_ROLE_KEY` | **Critical** — Full DB access |
| `XENDIT_SECRET_KEY` | **Critical** — Create invoices, view payments |
| `BITESHIP_API_KEY` | **High** — Create shipments, get rates |
| `GEMINI_API_KEY` | **Medium** — AI costs, token limits |

### Sensitive (Rotate Quarterly)

| Variable | Risk if Exposed |
|----------|-----------------|
| `XENDIT_CALLBACK_TOKEN` | **High** — Fake webhooks → free orders |
| `BITESHIP_WEBHOOK_SECRET` | **High** — Fake delivery confirmations |
| `SUPER_ADMIN_USER_ID` | **Medium** — Target for privilege escalation |

---

## Environment Templates

### `.env.example`

```env
# ===== Supabase =====
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# ===== Xendit =====
XENDIT_SECRET_KEY=xst_public_your_key
XENDIT_CALLBACK_TOKEN=your_32char_random_token
# XENDIT_WEBHOOK_TOKEN=your_fallback_token
# XENDIT_TEST_MODE=true

# ===== Biteship =====
BITESHIP_API_KEY=your_biteship_key
BITESHIP_WEBHOOK_SECRET=your_32char_random_secret
# BITESHIP_COURIERS=jne,sicepat

# ===== ReBites Courier (optional overrides) =====
# REBITES_COURIER_CODE=rebites
# REBITES_SERVICE_CODE=standard
# REBITES_COURIER_NAME=ReBites Courier
# REBITES_SERVICE_NAME=Standard

# ===== AI =====
GEMINI_API_KEY=your_gemini_key
# AI_MODEL=gemini-1.5-flash
# AI_MAX_TOKENS=2048
# AI_TEMPERATURE=0.3

# ===== Admin =====
SUPER_ADMIN_USER_ID=uuid-of-super-admin

# ===== App =====
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### `.env.production` (Docker)

```env
# Copy from .env.example, fill in production values
# Ensure all NEXT_PUBLIC_* point to production URLs
# Ensure all secrets are set
```

---

## Loading Behavior

### Next.js / Node.js

```typescript
// In server code
const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // Loaded from .env.local (dev) or system env (prod)

// In client code
const url = process.env.NEXT_PUBLIC_SUPABASE_URL; // Inlined at build time
```

**Important:** `NEXT_PUBLIC_*` vars are inlined at **build time**. Changing them requires rebuild.

### Validation on Startup

```typescript
// lib/server/xendit.ts
function getSecretKey(): string {
  const raw = process.env.XENDIT_SECRET_KEY?.trim();
  if (!raw) throw new Error('Missing env: XENDIT_SECRET_KEY');
  return raw;
}
```

**Pattern:** Throw on missing required secrets (fail fast, not silent).

---

## Vercel Environment Variable Setup

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

**Rule:** Secrets only in Production + Preview. Never in Development.

---

## Migration Notes

| Change | Action |
|--------|--------|
| Add new env var | Update `.env.example` + Vercel + local `.env.local` |
| Rename variable | Update all references, deploy, then remove old |
| Remove variable | Update code, deploy, then remove from Vercel |
| Rotate secret | Generate new → update Vercel → deploy → verify |

---

## Troubleshooting

| Symptom | Likely Cause |
|---------|-------------|
| `Missing env: XENDIT_SECRET_KEY` | Not set in Vercel / .env.local |
| 401 on all Supabase calls | `NEXT_PUBLIC_SUPABASE_URL` wrong |
| RLS errors with service client | `SUPABASE_SERVICE_ROLE_KEY` invalid/expired |
| Webhook 401 | Token mismatch (check `XENDIT_CALLBACK_TOKEN`) |
| AI 401 | `GEMINI_API_KEY` invalid/expired |
| `NEXT_PUBLIC_*` not updated | Need rebuild (inlined at build time) |

---

## Related Docs

- [Security: Secrets Management](../security/secrets-management.md) — Rotation procedures
- [Deployment: Overview](./overview.md) — Deploy process
- [Development: Setup](../development/setup.md) — Local setup
- [Integrations: Supabase](../integrations/supabase.md) — Supabase env details
- [Integrations: Xendit](../integrations/xendit.md) — Xendit env details
- [Integrations: Biteship](../integrations/biteship.md) — Biteship env details