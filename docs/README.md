# ReBites Documentation

> **Food Surplus Marketplace** — Connecting UMKM sellers with buyers to reduce food waste in Kota Depok.

This documentation covers the **actual implementation** of the ReBites platform. Every technical claim is verified against source code.

---

## Quick Navigation

| Section | Description |
|---------|-------------|
| [📋 Documentation Index](./DOCUMENTATION_INDEX.md) | Cross-reference of all docs with searchable tags |
| [🎯 Project Context](./PROJECT_CONTEXT.md) | Primary agent context — architecture snapshot, key decisions, conventions |
| [🏗 Architecture](./architecture/) | System architecture, route groups, shell pattern, auth boundary |
| [✨ Features](./features/) | Feature specifications: catalog, checkout, dashboards, chatbot, subscriptions |
| [🗄 Database](./database/) | Schema, relationships, RLS policies, functions, migrations |
| [🔌 API](./api/) | REST endpoints, webhooks, auth, rate limits |
| [🔗 Integrations](./integrations/) | Supabase, Xendit, Biteship, AI provider, Storage |
| [👨‍💻 Development](./development/) | Setup, coding standards, git workflow, testing, debugging |
| [🧪 Testing](./testing/) | Strategy, unit tests, test catalog, CI status |
| [🔒 Security](./security/) | Auth, authorization, data protection, input validation, secrets |
| [🚀 Deployment](./deployment/) | Environment, build, Vercel, Supabase |
| [⚙️ Operations](./operations/) | Monitoring, logging, incident response, admin operations |
| [⚡ Engineering](./engineering/) | Code organization, performance, accessibility, tech debt, decisions |
| [📐 Diagrams](./diagrams/) | Mermaid diagrams: architecture, data flow, order lifecycle |
| [📚 Reference](./reference/) | Glossary, env vars, error codes, types, scripts |

---

## Project Snapshot

| Aspect | Detail |
|--------|--------|
| **Framework** | Next.js 14 (App Router, Turbopack) |
| **Language** | TypeScript 5.2 (strict) |
| **Styling** | Tailwind CSS 3.3 + Radix UI |
| **Backend** | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| **Payments** | Xendit (invoice + webhook) |
| **Logistics** | Biteship (rates + webhook + tracking) |
| **AI** | Custom provider via `VIBE_CODE_URL` / `VIBE_CODE_KEY` |
| **Testing** | 96 suites via `node --test` (offline, no browser/DB) |
| **Service Area** | Kota Depok (static on category pages; data supports multi-city) |

---

## Route Groups (No URL Impact)

```
app/
├── (landing)/     # Public marketing pages
├── (app)/         # Authenticated buyer/seller app
├── (preview)/     # Public preview pages (no auth)
└── [root]/        # Shared: auth, dashboard, articles, etc.
```

---

## Key Architectural Patterns

| Pattern | Description |
|---------|-------------|
| **Shell Injection** | `DetailProductContent` receives `shell` prop to keep auth code out of public bundles |
| **Idempotency Keys** | `invoice_state` machine + `checkout_idempotency` table prevent duplicate orders |
| **Stock Reservation** | Atomic RPC `reserve_stock_for_order` with reservation markers |
| **Admin RBAC** | `super_admin` (env `SUPER_ADMIN_USER_ID`) vs `admin`; role changes require super admin approval |
| **Service Area** | Kota Depok (static on category pages; data supports multi-city) |

---

## External Integrations

| Service | Purpose | Key Files |
|---------|---------|-----------|
| **Supabase** | Auth, DB, Realtime, Storage | `lib/server/supabase.ts`, `lib/supabase.ts` |
| **Xendit** | Payment invoices, webhooks | `lib/server/xendit.ts`, `app/api/webhooks/xendit/route.ts` |
| **Biteship** | Shipping rates, tracking, webhooks | `lib/server/biteship.ts`, `app/api/webhooks/biteship/route.ts` |
| **AI Provider** | Chatbot completions, tool calls | `lib/server/ai-provider.ts`, `lib/chatbot/` |

---

## Development Commands

```bash
# Development
npm run dev              # Next.js with Turbopack
npm run dev:webpack      # Next.js with Webpack

# Quality
npm run lint             # ESLint (skipped in build!)
npm run typecheck        # TypeScript check
npm run typecheck:tests  # TypeScript check for tests

# Testing (96 suites, offline)
npm run test:checkout-idempotency
npm run test:shipping-rates
npm run test:admin-access
# ... see package.json for all 80+ test commands

# Build & Deploy
npm run build            # Production build (skips ESLint)
npm run start            # Production server
```

---

## Known Issues (Verified)

| Issue | Location | Impact |
|-------|----------|--------|
| ESLint skipped in build | `next.config.js` | Lint errors don't block deployment |
| Image path mismatch | DB stores `.jpeg/.webp`, files are `.avif` | Some product images may not load |
| Transparency artifacts | `makanan2/5.avif` | Visual artifacts in specific images |
| Windows EOL sensitivity | One test | Test flakiness on Windows |

---

## Contributing to Documentation

1. **Accuracy over speed** — Verify every claim against source code
2. **Document actual implementation** — Not planned/assumed features
3. **Preserve existing docs** — Don't delete valuable content in `/docs`
4. **No secrets** — Never expose API keys, tokens, or credentials
5. **Minimalist markdown** — Use Mermaid diagrams where helpful

---

## License

Private project — ReBites team only.