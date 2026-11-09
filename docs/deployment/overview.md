# Deployment Overview

> **Current:** Manual deploy (Vercel or Docker)
> **Target:** Automated CI/CD (GitHub Actions → Vercel)

---

## Deployment Strategy

| Environment | URL | Purpose | Deploy Trigger |
|-------------|-----|---------|----------------|
| **Development** | `localhost:3000` | Local dev | `npm run dev` |
| **Preview** | `*.vercel.app` | PR previews | Auto (Vercel) |
| **Production** | `rebites.id` (or domain) | Live service | Manual / main branch |

---

## Vercel Deployment (Recommended)

### Setup

```bash
# 1. Connect repo to Vercel
# Dashboard → Add New Project → Select GitHub repo
# Vercel auto-detects Next.js

# 2. Configure environment variables
# Settings → Environment Variables
# (All secrets from .env.example, mark sensitive ones as "Production" only)

# 3. Build settings (next.config.js already handles Turbopack)
# No custom build command needed
```

### Vercel Environment Matrix

| Environment | Branch | Env Vars |
|-------------|--------|----------|
| Development | `feat/*`, `fix/*` | Preview vars |
| Preview | PR branches | Preview vars |
| Production | `main` | Production vars (all secrets) |

### Deployment Process

```bash
# 1. Push to main
git push origin main

# 2. Vercel auto-deploys
#    - Build: next build
#    - Upload: .next/ to Vercel CDN
#    - Live: ~2-3 min

# 3. Verify
curl https://rebites.id/api/admin/health
```

---

## Docker Deployment (Alternative)

### Build

```dockerfile
# Dockerfile (multi-stage)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "run", "start"]
```

### Run

```bash
# Build
docker build -t rebites:latest .

# Run
docker run -d -p 3000:3000 \
  --env-file .env.production \
  --name rebites \
  rebites:latest

# Health check
curl http://localhost:3000/api/admin/health
```

### Docker Compose (with Supabase local)

```yaml
# docker-compose.yml
version: '3.8'
services:
  web:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.production
    depends_on:
      - supabase

  supabase:
    image: supabase/studio:latest
    ports:
      - "54323:3000"
    environment:
      - SUPABASE_URL=http://localhost:54321
      - SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
```

---

## Build Process

### `next build` Steps

```
1. Type checking (TypeScript strict)
2. ESLint (currently skipped in build — run separately)
3. Turbopack build (fast, HMR-friendly)
4. Static page generation (landing pages, articles)
5. API route compilation
6. Output: .next/ directory
```

### Build Output

```
.next/
├── BUILD_ID
├── next.config.js
├── server/
│   ├── app/
│   ├── chunks/
│   └── instrumentation/
├── static/
│   ├── chunks/
│   └── css/
└── package.json (for runtime)
```

---

## Environment Configuration

### Production Required Vars

| Variable | Value Source |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard (server only) |
| `XENDIT_SECRET_KEY` | Xendit Dashboard |
| `XENDIT_CALLBACK_TOKEN` | Generate (32+ char) |
| `BITESHIP_API_KEY` | Biteship Dashboard |
| `BITESHIP_WEBHOOK_SECRET` | Generate (32+ char) |
| `GEMINI_API_KEY` | Google AI Studio |
| `SUPER_ADMIN_USER_ID` | Supabase `auth.users` (copy UUID) |
| `NEXT_PUBLIC_APP_URL` | Production domain |

### Webhook URLs (Update in Provider Dashboards)

| Provider | Endpoint | URL |
|----------|----------|-----|
| Xendit | Webhook | `https://your-domain/api/webhooks/xendit` |
| Biteship | Webhook | `https://your-domain/api/webhooks/biteship` |

---

## Pre-Deploy Checklist

```bash
# 1. Type check
npm run typecheck

# 2. Lint
npm run lint

# 3. Tests
npm test

# 4. Build
npm run build

# 5. Check for secrets in client bundle
grep -r "SUPABASE_SERVICE_ROLE_KEY\|XENDIT_SECRET_KEY" .next/static/ || echo "✅ No secrets in client"

# 6. Verify migrations applied
supabase db pull  # or check Supabase Dashboard

# 7. Check Supabase is healthy
curl https://your-supabase.co/rest/v1/health 2>/dev/null || echo "⚠️ Check Supabase"
```

---

## Rollback

### Vercel

```
Dashboard → Deployments → Find previous deploy → "Promote to Production"
```

### Docker

```bash
# Revert to previous image tag
docker run -p 3000:3000 --env-file .env.production rebites:previous-tag
```

### Database Rollback

```bash
# Supabase PITR (Point-in-Time Recovery)
supabase db restore <timestamp>

# Or manual:
# 1. Stop writes
# 2. pg_restore from backup
# 3. Restart
```

**Warning:** DB rollback is destructive. Use PITR only for recent failures (< 7 days).

---

## Post-Deploy Verification

| Check | Command | Expected |
|-------|---------|----------|
| Health check | `curl https://domain/api/admin/health` | `{ supabase: { ok: true } }` |
| Landing page | `curl https://domain/ -I` | 200 |
| Login flow | Browser: `/auth/login` | Session created |
| Catalog | `curl https://domain/api/products` | Product list |
| Webhook endpoint | `curl -X POST https://domain/api/webhooks/xendit -H "X-Callback-Token: test"` | 401 (expected) |

---

## Known Deployment Issues

| Issue | Workaround |
|-------|-----------|
| ESLint skipped in `next build` | Run `npm run lint` manually before deploy |
| Image path mismatch | `normalizeImagePath` handles at runtime |
| Supabase local vs cloud | Ensure `NEXT_PUBLIC_SUPABASE_URL` points to cloud in prod |
| Webhook URLs not updated | Update Xendit/Biteship dashboard after domain change |
| Long builds (> 10min) | Vercel timeout: increase in project settings |

---

## Related Docs

- [Deployment: Environment](./environment.md) — Full env var reference
- [Deployment: Build](./build.md) — Build details
- [Deployment: Supabase](./supabase.md) — DB deployment
- [Operations: Monitoring](../operations/monitoring.md) — Post-deploy health
- [Security: Secrets Management](../security/secrets-management.md) — Env handling
- [Testing: CI Status](../testing/ci-status.md) — CI pipeline