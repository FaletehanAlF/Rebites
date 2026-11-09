# Build Process

> **Framework:** Next.js 14 App Router + Turbopack
> **Language:** TypeScript 5.2 strict
> **Output:** `.next/` directory (Node.js runtime)

---

## Build Commands

| Command | Purpose | Time |
|---------|---------|------|
| `npm run build` | Full production build | 2-5 min |
| `npm run dev` | Dev server (Turbopack, HMR) | Instant |
| `npm run start` | Serve production build | — |
| `npx tsc --noEmit` | Type check only | 10-30s |
| `npx eslint .` | Lint only | 5-15s |

---

## Build Pipeline

```
┌─────────────────────────────────────────────────────────┐
│  1. Type Check (TypeScript strict)                      │
│     - Validates all .ts/.tsx files                       │
│     - Strict null checks, noImplicitAny, etc.           │
│     - Fails build on type errors                        │
└──────────────────────────┬──────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│  2. ESLint (currently skipped in build)                  │
│     ⚠️ next build skips ESLint by default in Next 14   │
│     Run `npm run lint` separately                       │
└──────────────────────────┬──────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│  3. Turbopack Compilation                                │
│     - Fast, HMR-friendly                                 │
│     - Compiles server + client bundles                   │
│     - Generates static pages (landing, articles)         │
│     - Compiles API route handlers                        │
└──────────────────────────┬──────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│  4. Optimization                                        │
│     - Image optimization (next/image)                    │
│     - CSS extraction + minification                      │
│     - Chunk splitting (vendor, framework, app)          │
│     - Route-based code splitting                         │
└──────────────────────────┬──────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│  5. Output: .next/                                      │
│     - Server chunks (Node.js)                           │
│     - Client chunks (browser)                           │
│     - Static assets (images, fonts, CSS)                │
└─────────────────────────────────────────────────────────┘
```

---

## Next.js Configuration

```javascript
// next.config.js
const nextConfig = {
  // Turbopack enabled (dev only in Next 14)
  // For prod: use `next build` which uses Webpack by default
  // Or: `next build --turbopack` (experimental)

  // Image optimization
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },  // Supabase Storage
    ],
  },

  // Environment
  env: {
    // Explicitly declare public vars (inlined in client)
  },

  // Headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};
```

---

## Output Structure

```
.next/
├── BUILD_ID                  # Unique build identifier
├── next.config.js            # Resolved config
├── react-loadable-manifest.json
├── required-server-files.json
├── server/
│   ├── app/                  # Compiled route handlers
│   │   ├── api/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   └── ...
│   ├── chunks/               # Server-side chunks
│   ├── instrumentation/
│   └── pages/                # Server components
├── static/
│   ├── chunks/               # Client-side JS
│   ├── css/                  # Minified CSS
│   └── media/                # Fonts, images
└── package.json              # Minimal for runtime
```

---

## Build Warnings & Errors

| Warning/Error | Cause | Fix |
|---------------|-------|-----|
| `Module not found` | Missing import | Check path, install dep |
| `Type 'X' is not assignable` | TS strict | Fix type |
| `Supabase client in server` | `createClient` in server route | Use `createAnonServerClient` / `createServiceClient` |
| `NEXT_PUBLIC_* in server` | Inlined at build | OK (public vars) |
| `ESLint not run` | Next.js skips lint in build | Run `npm run lint` separately |

---

## Performance Optimization

### Bundle Size Targets

| Bundle | Target | Notes |
|--------|--------|-------|
| Client JS (initial) | < 150 KB gzipped | Framework + shared |
| Client JS (route) | < 50 KB gzipped | Per-page chunks |
| Total client JS | < 500 KB gzipped | All routes |
| Server bundle | No limit | Node.js |

### Code Splitting

- Route-based (automatic in App Router)
- Dynamic imports for heavy components
- `next/dynamic` for code-splitting

```typescript
// Heavy chart component: lazy load
const Charts = dynamic(() => import('./Charts'), { ssr: false });
```

### Image Optimization

- `next/image` auto-optimizes (AVIF/WebP)
- Supabase Storage: serve AVIF files
- `placeholder="blur"` for LCP

---

## Testing the Build

```bash
# 1. Clean build
rm -rf .next
npm run build

# 2. Check output
ls -la .next/
du -sh .next/static/chunks/

# 3. Start and verify
npm start
curl http://localhost:3000/ -I  # Should return 200

# 4. Type check separately
npm run typecheck

# 5. Lint separately
npm run lint
```

---

## Turbopack Notes

- **Dev:** `npm run dev` uses Turbopack (fast HMR)
- **Prod:** `npm run build` uses Webpack by default in Next 14
- **Future:** `next build --turbopack` (experimental in Next 14)

**Turbopack advantages:**
- 10x faster dev rebuilds
- No HMR restart on config changes
- Better error recovery

**Known issues:**
- Some plugins may not work
- Watch for Turbopack-specific edge cases

---

## Build Secrets (Not in Output)

These are **never** in `.next/`:
- `SUPABASE_SERVICE_ROLE_KEY` (server runtime env)
- `XENDIT_SECRET_KEY` (server runtime env)
- `BITESHIP_API_KEY` (server runtime env)
- `GEMINI_API_KEY` (server runtime env)

`NEXT_PUBLIC_*` vars **are** inlined in client chunks.

---

## Related Docs

- [Deployment: Overview](./overview.md) — Deploy process
- [Deployment: Environment](./environment.md) — Env vars
- [Development: Setup](../development/setup.md) — Local build
- [Engineering: Performance](../engineering/performance.md) — Bundle size
- [Security: Secrets Management](../security/secrets-management.md) — Build-time secret scan