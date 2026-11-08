# Development Setup

> **Prerequisites:** Node.js 18+, npm/pnpm, Supabase CLI, PostgreSQL (optional for local DB)

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 18.x or 20.x | `node -v` |
| npm | 9+ | `npm -v` |
| pnpm | 8+ (preferred) | `pnpm -v` |
| Git | 2.30+ | `git --version` |
| Supabase CLI | Latest | `supabase -v` |
| TypeScript | 5.2+ (installed by dep) | `npx tsc --version` |

---

## Clone & Install

```bash
# Clone
git clone <repo-url> rebites
cd rebites

# Install dependencies
pnpm install
# or: npm install

# Verify
npx tsc --noEmit  # Type check
```

---

## Environment Setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

### Required Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Supabase (server only)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Xendit
XENDIT_SECRET_KEY=xst_public_your_key
XENDIT_CALLBACK_TOKEN=your_webhook_token

# Biteship
BITESHIP_API_KEY=your_biteship_key
BITESHIP_WEBHOOK_SECRET=your_webhook_secret

# AI (Gemini)
GEMINI_API_KEY=your_gemini_key
AI_MODEL=gemini-1.5-flash

# Admin
SUPER_ADMIN_USER_ID=<uuid of your super admin user>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Optional Variables

```env
# Biteship courier configuration
BITESHIP_COURIERS=jne,sicepat
REBITES_COURIER_CODE=rebites
REBITES_SERVICE_CODE=standard
REBITES_COURIER_NAME=ReBites Courier
REBITES_SERVICE_NAME=Standard

# AI tuning
AI_MAX_TOKENS=2048
AI_TEMPERATURE=0.3

# Xendit test mode
XENDIT_TEST_MODE=true
```

### Local Supabase (Optional)

```bash
# Start local Supabase
supabase start

# Reset database (applies migrations + seeds)
supabase db reset

# Access Supabase Studio
open http://localhost:54323

# Get local keys
supabase status  # Shows URLs and keys
```

---

## Development Server

```bash
# Start Next.js dev server with Turbopack
npm run dev
# or: pnpm dev

# Output: http://localhost:3000
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (Turbopack, HMR) |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript strict check |
| `npm run test` | Run all 96 test suites |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:unit` | Unit tests only |
| `npm run test:integration` | Integration tests only |

---

## Project Structure

```
rebites/
├── app/                    # Next.js App Router
│   ├── (landing)/         # Public marketing pages
│   ├── (app)/             # Authenticated buyer/seller app
│   ├── (preview)/         # Preview routes
│   ├── api/               # Route handlers (API)
│   ├── auth/              # Auth pages (login, register, etc.)
│   ├── dashboard/         # Admin & courier dashboards
│   ├── artikel/           # Blog posts
│   ├── pengaturan/        # Settings (coins, etc.)
│   ├── riwayatPesanan/    # Order history
│   ├── toko-diikuti/      # Followed stores
│   ├── banding/           # Appeal page
│   ├── components/        # React components
│   └── layout.tsx         # Root layout
├── lib/                   # Shared utilities (147+ modules)
│   ├── server/           # Server-only code (Supabase, Xendit, Biteship, AI)
│   ├── chatbot/          # AI chatbot logic
│   ├── catalog/          # Product filtering, sorting
│   ├── flash-sale/       # Flash sale scheduling
│   ├── notifications/    # In-app notifications
│   ├── order-state-machine.ts
│   ├── shipping-tariff.ts
│   └── ...
├── hooks/                 # Custom React hooks
│   ├── buyer/            # Buyer-specific hooks
│   ├── seller/           # Seller-specific hooks
│   ├── courier/          # Courier-specific hooks
│   └── shared/           # Shared hooks (auth, profile, etc.)
├── types/
│   └── index.ts          # TypeScript domain models
├── supabase/
│   ├── migrations/       # 80+ SQL migrations
│   └── config.toml       # Supabase project config
├── public/
│   └── images/           # Placeholder/legacy images
├── docs/                 # This documentation
├── .env.example          # Environment variable template
├── next.config.js        # Next.js config
├── tailwind.config.ts    # Tailwind CSS config
└── tsconfig.json         # TypeScript config
```

---

## Code Conventions

### TypeScript

- **Strict mode** enabled (`strict: true`)
- No `any` without `as` cast comment
- Use `unknown` for untrusted inputs, narrow with type guards
- Domain types in `types/index.ts`
- Utility types in `lib/types.ts`

### File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Component | PascalCase.tsx | `ProductCard.tsx` |
| Hook | `use` prefix | `useCurrentUser.ts` |
| Utility | kebab-case.ts | `shipping-tariff.ts` |
| Server-only | `lib/server/` | `lib/server/xendit.ts` |
| API route | `route.ts` | `app/api/orders/route.ts` |

### Import Conventions

```typescript
// Path aliases (tsconfig.json)
import { Product } from '@/types';
import { createClient } from '@/lib/supabase';
import { useUser } from '@/hooks/shared/useUser';
import { ProductCard } from '@/app/components/buyer/ProductCard';

// Server-only imports (not in client bundles)
import { createServiceClient } from '@/lib/server/supabase';
```

### React Patterns

```typescript
// Server components (default) — can use Supabase service role
export default async function ProductPage({ params }) {
  const service = createServiceClient();
  const { data: product } = await service.from('products').select('*').eq('slug', params.slug).single();
  return <ProductDetails product={product} />;
}

// Client components — use hooks
'use client';
export function AddToCart() {
  const { data: { session } } = useUser();
  const [quantity, setQuantity] = useState(1);
  // ...
}
```

---

## Linting & Formatting

```bash
# ESLint
npx eslint . --ext .ts,.tsx

# Prettier (if configured)
npx prettier --check .

# Type check
npx tsc --noEmit
```

**Note:** `next build` currently **skips ESLint** (known issue). Run `npm run lint` separately in CI.

---

## Git Workflow

```bash
# Branch
git checkout -b feat/checkout-idempotency

# Commit (Conventional Commits)
git commit -m "feat(checkout): add idempotency key support"

# Types: feat, fix, docs, style, refactor, test, chore, perf
# Scope: optional, in parentheses

# Push & PR
git push origin feat/checkout-idempotency
# Create PR on GitHub
```

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

Examples:
- `feat(catalog): add category filtering with counts`
- `fix(webhook): handle Xendit EXPIRED status for unpaid orders`
- `docs(api): document rate limit headers`

---

## Testing

```bash
# Run all tests (96 suites, ~30s)
npm test

# Watch mode
npm run test:watch

# Specific test
node --test tests/checkout-idempotency.test.ts

# Integration only
npm run test:integration
```

See [Testing: Strategy](../testing/strategy.md) for details.

---

## Local Supabase & Migrations

```bash
# Apply pending migrations locally
supabase migration up

# Create new migration
supabase migration new add_new_feature

# Push to production
supabase db push

# Reset (applies all migrations + seeds)
supabase db reset
```

**Migration ordering:** Migrations are numbered (`0001_`, `0002_`, ...). Never edit applied migrations. Create new ones.

---

## Common Issues

| Issue | Solution |
|-------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` not set | Copy from Supabase Dashboard → Settings → API |
| Images not showing locally | Ensure `product-images` bucket is public in local Supabase |
| `supabase start` port conflict | `supabase start -o 54324` (change port) |
| TypeScript errors on `any` | Use `as Record<string, unknown>` pattern |
| Turbopack HMR not working | Restart dev server; clear `.next` cache |
| Test fails on Windows (EOL) | One test sensitive to CRLF; run on Linux CI or fix |

---

## IDE Setup

```json
// .vscode/settings.json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.validate": ["typescript", "typescriptreact"]
}
```

**Recommended VS Code extensions:**
- Vite: `dbaeumer.vscode-eslint`
- `bradlc.vscode-tailwindcss`
- `supabase-community.vscode-supabase`
- `ms-vscode.js-debug`

---

## Related Docs

- [Development: Coding Standards](./coding-standards.md) — Detailed style guide
- [Development: Git Workflow](./git-workflow.md) — Branching strategy
- [Testing: Strategy](../testing/strategy.md) — Test architecture
- [Security: Secrets Management](../security/secrets-management.md) — Env var handling
- [Deployment: Build](../deployment/build.md) — Production build