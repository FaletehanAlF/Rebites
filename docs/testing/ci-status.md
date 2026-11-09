# CI Status

> **Current State:** No CI/CD pipeline configured
> **Runs:** Locally via `npm test`, `npm run typecheck`, `npm run lint`

---

## Pipeline Status

| Stage | Status | Notes |
|-------|--------|-------|
| **Type Check** | ✅ Local only | `npm run typecheck` (`npx tsc --noEmit`) |
| **Lint** | ✅ Local only | `npm run lint` (ESLint) |
| **Unit Tests** | ✅ Local only | `npm test` (96 suites) |
| **Integration Tests** | ✅ Local only | Requires local Supabase |
| **Build** | ✅ Local only | `npm run build` (skips ESLint) |
| **Deploy Preview** | ❌ Not configured | Vercel/Netlify not connected |
| **Deploy Production** | ❌ Not configured | Manual deploy |
| **Security Scan** | ❌ Not configured | `npm audit` not automated |

---

## Known Build Issues

| Issue | Impact | Workaround |
|-------|--------|------------|
| ESLint skipped in `next build` | Build passes with lint errors | Run `npm run lint` manually before deploy |
| Image path mismatch | Runtime fallback handles | DB paths `.jpeg`/`.webp`, files `.avif` |
| Transparency artifacts | `makanan2/5.avif` have artifacts | Re-export from source |
| Windows EOL in one test | Test fails on Windows CI | Fix line endings or run on Linux |

---

## Recommended CI Pipeline

### GitHub Actions (Proposed)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
  SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
  XENDIT_SECRET_KEY: ${{ secrets.XENDIT_SECRET_KEY }}
  XENDIT_CALLBACK_TOKEN: ${{ secrets.XENDIT_CALLBACK_TOKEN }}
  BITESHIP_API_KEY: ${{ secrets.BITESHIP_API_KEY }}
  BITESHIP_WEBHOOK_SECRET: ${{ secrets.BITESHIP_WEBHOOK_SECRET }}
  GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  SUPER_ADMIN_USER_ID: ${{ secrets.SUPER_ADMIN_USER_ID }}

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      # Start Supabase locally
      - uses: supabase/setup-cli@v1
      - run: supabase start
      - run: npm test

  build:
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      # Upload build artifact for deploy
      - uses: actions/upload-artifact@v4
        with:
          name: nextjs-build
          path: .next/
          retention-days: 1
```

---

## Pre-Merge Checklist (Manual)

Before merging any PR, run locally:

```bash
# 1. Type check
npm run typecheck

# 2. Lint
npm run lint

# 3. Tests
npm test

# 4. Build
npm run build

# 5. Check for console.log in production code
grep -r "console\.log" --include="*.ts" --include="*.tsx" app/ lib/ | grep -v test | grep -v ".test."
```

---

## Deployment (Current Manual Process)

### Vercel (Recommended)

```bash
# 1. Push to main
git push origin main

# 2. Vercel auto-detects Next.js
# 3. Set env vars in Vercel Dashboard:
#    - All variables from .env.example
# 4. Deploy
```

### Docker (Alternative)

```dockerfile
# Dockerfile
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

```bash
docker build -t rebites .
docker run -p 3000:3000 --env-file .env.production rebites
```

---

## Environment Variables for CI/CD

| Variable | Required | Source |
|----------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase Dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase Dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase Dashboard |
| `XENDIT_SECRET_KEY` | ✅ | Xendit Dashboard |
| `XENDIT_CALLBACK_TOKEN` | ✅ | Generate random string |
| `BITESHIP_API_KEY` | ✅ | Biteship Dashboard |
| `BITESHIP_WEBHOOK_SECRET` | ✅ | Generate random string |
| `GEMINI_API_KEY` | ✅ | Google AI Studio |
| `SUPER_ADMIN_USER_ID` | ✅ | Copy from Supabase `auth.users` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Production URL |

---

## Monitoring CI Health

| Metric | Target | Current |
|--------|--------|---------|
| Build success rate | 100% | Manual |
| Test pass rate | 100% | 96/96 locally |
| Lint errors | 0 | Run manually |
| Type errors | 0 | Run manually |
| Deploy frequency | On merge | Manual |

---

## Related Docs

- [Testing: Strategy](./strategy.md) — Test architecture
- [Testing: Test Catalog](./test-catalog.md) — Full suite list
- [Deployment: Overview](../deployment/overview.md) — Deployment strategy
- [Operations: Monitoring](../operations/monitoring.md) — Production health
- [Security: Secrets Management](../security/secrets-management.md) — CI secret handling