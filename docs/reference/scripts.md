# Scripts Reference

> **Source:** `package.json` `scripts` field

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `next dev --turbopack` | Start dev server with Turbopack (fast HMR) |
| `build` | `next build` | Production build (TypeScript + Turbopack) |
| `start` | `next start` | Serve production build |
| `lint` | `next lint` | Run ESLint on all files |
| `typecheck` | `npx tsc --noEmit` | TypeScript type check (no emit) |
| `test` | `node --test` | Run all test suites (96) |
| `test:watch` | `node --test --watch` | Tests in watch mode |
| `test:unit` | `node --test tests/unit/` | Unit tests only |
| `test:integration` | `node --test tests/integration/` | Integration tests only |

---

## Usage

### Development

```bash
# Start dev server (port 3000, Turbopack)
npm run dev
# http://localhost:3000
```

### Type Safety

```bash
# Check types without building
npm run typecheck
```

### Testing

```bash
# Run all tests (~30s)
npm test

# Watch mode (re-run on file change)
npm run test:watch

# Run specific test file
node --test tests/checkout-idempotency.test.ts

# Run tests matching pattern
node --test --test-name-pattern="idempotency"
```

### Linting

```bash
# All files
npm run lint

# Specific file
npx eslint app/api/orders/route.ts
```

### Build & Deploy

```bash
# Production build
npm run build

# Serve (after build)
npm start
```

---

## Full `package.json` Scripts

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "npx tsc --noEmit",
    "test": "node --test",
    "test:watch": "node --test --watch",
    "test:unit": "node --test tests/unit/",
    "test:integration": "node --test tests/integration/"
  }
}
```

---

## Pre-Commit / Pre-Push (Manual)

```bash
# 1. Type check
npm run typecheck

# 2. Lint
npm run lint

# 3. Tests
npm test

# 4. Build (optional, slower)
npm run build
```

---

## Custom Commands

### Run a Specific Test Suite

```bash
# By name pattern
node --test --test-name-pattern="pricing"

# By file
node --test tests/pricing.test.ts

# Verbose output
node --test --reporter=spec tests/pricing.test.ts
```

### Clean Build

```bash
rm -rf .next
npm run build
```

### Generate Supabase Types

```bash
supabase gen types typescript --local > types/supabase.ts
# Or from cloud:
supabase gen types typescript --project-id <id> > types/supabase.ts
```

---

## Related Docs

- [Development: Setup](../development/setup.md) — Full setup
- [Testing: Strategy](../testing/strategy.md) — Test architecture
- [Testing: Test Catalog](../testing/test-catalog.md) — All test suites
- [Deployment: Build](../deployment/build.md) — Build details
- [Reference: Environment Variables](./environment-variables.md) — Env config