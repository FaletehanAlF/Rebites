# Documentation Index

> Cross-reference of all documentation with searchable tags.

---

## Architecture

| File | Tags | Description |
|------|------|-------------|
| [architecture/overview.md](./architecture/overview.md) | `architecture`, `nextjs`, `route-groups`, `shell-pattern` | System architecture, route group map, shell injection pattern |
| [architecture/route-groups.md](./architecture/route-groups.md) | `architecture`, `route-groups`, `url-mapping` | Complete URL-to-path mapping for all route groups |
| [architecture/auth-boundary.md](./architecture/auth-boundary.md) | `architecture`, `auth`, `supabase`, `rbac` | Auth boundary, role system, guard patterns |
| [architecture/data-flow.md](./architecture/data-flow.md) | `architecture`, `data-flow`, `mermaid` | Data flow diagrams: checkout, orders, subscriptions |
| [architecture/components.md](./architecture/components.md) | `architecture`, `components`, `ui` | Component organization, shared vs actor-specific |

---

## Features

| File | Tags | Description |
|------|------|-------------|
| [features/catalog.md](./features/catalog.md) | `feature`, `catalog`, `products`, `filtering` | Product catalog, category pages, search, favorites |
| [features/checkout.md](./features/checkout.md) | `feature`, `checkout`, `idempotency`, `xendit` | Checkout flow, idempotency, stock reservation, payment |
| [features/order-lifecycle.md](./features/order-lifecycle.md) | `feature`, `orders`, `state-machine`, `biteship` | Order state machine, shipping tracking, courier handoff |
| [features/seller-dashboard.md](./features/seller-dashboard.md) | `feature`, `seller`, `dashboard`, `flash-sale` | Seller dashboard, menu management, analytics, Flash Sale |
| [features/admin-dashboard.md](./features/admin-dashboard.md) | `feature`, `admin`, `moderation`, `monitoring` | Admin dashboard, user/product moderation, reporting |
| [features/courier-dashboard.md](./features/courier-dashboard.md) | `feature`, `courier`, `gps`, `assignments` | Courier dashboard, assignment flow, live GPS tracking |
| [features/chatbot.md](./features/chatbot.md) | `feature`, `chatbot`, `ai`, `tools` | AI chatbot, role-based access, pending actions |
| [features/articles.md](./features/articles.md) | `feature`, `articles`, `blog`, `cms` | Articles system, admin CMS, public blog |
| [features/subscriptions.md](./features/subscriptions.md) | `feature`, `subscriptions`, `plans`, `xendit` | 3-tier subscription plans, payment flow, activation |
| [features/notifications.md](./features/notifications.md) | `feature`, `notifications`, `realtime`, `supabase` | Notification system, real-time delivery, types |
| [features/profile.md](./features/profile.md) | `feature`, `profile`, `addresses`, `avatar` | Buyer profile, addresses, avatar upload |
| [features/support.md](./features/support.md) | `feature`, `support`, `appeals`, `reports` | Support system, appeals, product/store reports |

---

## Database

| File | Tags | Description |
|------|------|-------------|
| [database/overview.md](./database/overview.md) | `database`, `schema`, `tables` | All tables with columns, types, constraints |
| [database/relationships.md](./database/relationships.md) | `database`, `relationships`, `foreign-keys` | Table relationships, join patterns |
| [database/rls-policies.md](./database/rls-policies.md) | `database`, `rls`, `security`, `policies` | Row-Level Security policies per table |
| [database/functions.md](./database/functions.md) | `database`, `functions`, `rpc`, `triggers` | Database functions, RPCs, triggers |
| [database/migrations.md](./database/migrations.md) | `database`, `migrations`, `history` | Migration history and conventions |

---

## API

| File | Tags | Description |
|------|------|-------------|
| [api/overview.md](./api/overview.md) | `api`, `endpoints`, `rest` | Complete endpoint catalog with request/response signatures |
| [api/webhooks.md](./api/webhooks.md) | `api`, `webhooks`, `xendit`, `biteship` | Webhook endpoints: Xendit, Biteship |
| [api/auth.md](./api/auth.md) | `api`, `auth`, `supabase`, `oauth` | Auth endpoints, token handling, OAuth flows |
| [api/admin.md](./api/admin.md) | `api`, `admin`, `rbac` | Admin API endpoints, role-based access |
| [api/rate-limits.md](./api/rate-limits.md) | `api`, `rate-limit`, `throttle` | Rate limiting strategies |

---

## Integrations

| File | Tags | Description |
|------|------|-------------|
| [integrations/supabase.md](./integrations/supabase.md) | `integration`, `supabase`, `auth`, `realtime` | Supabase architecture: Auth, Postgres, Realtime, Storage |
| [integrations/xendit.md](./integrations/xendit.md) | `integration`, `xendit`, `payments` | Xendit: invoice creation, webhooks, verification |
| [integrations/biteship.md](./integrations/biteship.md) | `integration`, `biteship`, `shipping` | Biteship: rates API, webhooks, order tracking |
| [integrations/ai-provider.md](./integrations/ai-provider.md) | `integration`, `ai`, `chatbot`, `tools` | AI provider: completions, tool calls, rate limits |
| [integrations/storage.md](./integrations/storage.md) | `integration`, `storage`, `images` | Supabase Storage buckets, image handling |

---

## Development

| File | Tags | Description |
|------|------|-------------|
| [development/setup.md](./development/setup.md) | `development`, `setup`, `local` | Local development setup, environment variables |
| [development/coding-standards.md](./development/coding-standards.md) | `development`, `standards`, `typescript` | TypeScript conventions, naming, patterns |
| [development/git-workflow.md](./development/git-workflow.md) | `development`, `git`, `branches` | Git workflow, branching, commit conventions |
| [development/debugging.md](./development/debugging.md) | `development`, `debugging`, `supabase` | Debugging patterns, common issues |

---

## Testing

| File | Tags | Description |
|------|------|-------------|
| [testing/strategy.md](./testing/strategy.md) | `testing`, `strategy`, `node-test` | Testing strategy: `node --test`, offline constraint |
| [testing/test-catalog.md](./testing/test-catalog.md) | `testing`, `catalog`, `suites` | All 96 test suites with coverage mapping |
| [testing/ci-status.md](./testing/ci-status.md) | `testing`, `ci`, `cd` | CI/CD status: no pipeline, ESLint skipped in build |

---

## Security

| File | Tags | Description |
|------|------|-------------|
| [security/overview.md](./security/overview.md) | `security`, `overview` | Security posture, threat model, hardening |
| [security/auth-authorization.md](./security/auth-authorization.md) | `security`, `auth`, `rbac`, `roles` | Auth system, role hierarchy, guard patterns |
| [security/data-protection.md](./security/data-protection.md) | `security`, `data`, `pii` | Data protection: PII handling, soft delete, GDPR |
| [security/input-validation.md](./security/input-validation.md) | `security`, `validation`, `zod` | Input validation strategies, sanitization |
| [security/secrets-management.md](./security/secrets-management.md) | `security`, `secrets`, `env` | Environment variable management, secrets rotation |

---

## Deployment

| File | Tags | Description |
|------|------|-------------|
| [deployment/overview.md](./deployment/overview.md) | `deployment`, `overview` | Deployment architecture, Vercel + Supabase |
| [deployment/environment.md](./deployment/environment.md) | `deployment`, `environment`, `env-vars` | All environment variables with descriptions |
| [deployment/build.md](./deployment/build.md) | `deployment`, `build`, `turbo` | Build process, Turbopack, ESLint skip |
| [deployment/supabase.md](./deployment/supabase.md) | `deployment`, `supabase`, `migrations` | Supabase deployment, migration workflow |

---

## Operations

| File | Tags | Description |
|------|------|-------------|
| [operations/monitoring.md](./operations/monitoring.md) | `operations`, `monitoring`, `logs` | Monitoring: admin dashboard, activity logs, system health |
| [operations/admin-operations.md](./operations/admin-operations.md) | `operations`, `admin`, `rbac` | Admin operations: user management, role changes, approvals |
| [operations/incident-response.md](./operations/incident-response.md) | `operations`, `incidents`, `response` | Incident response procedures |

---

## Engineering

| File | Tags | Description |
|------|------|-------------|
| [engineering/code-organization.md](./engineering/code-organization.md) | `engineering`, `structure`, `lib` | Code organization: `lib/`, `hooks/`, `app/components/` |
| [engineering/performance.md](./engineering/performance.md) | `engineering`, `performance`, `optimization` | Performance patterns, lazy loading, caching |
| [engineering/tech-debt.md](./engineering/tech-debt.md) | `engineering`, `tech-debt`, `known-issues` | Known issues, technical debt, planned improvements |
| [engineering/decisions.md](./engineering/decisions.md) | `engineering`, `decisions`, `adr` | Architecture Decision Records (ADR) |

---

## Diagrams

| File | Format | Description |
|------|--------|-------------|
| [diagrams/architecture.mmd](./diagrams/architecture.mmd) | Mermaid | System architecture overview |
| [diagrams/order-lifecycle.mmd](./diagrams/order-lifecycle.mmd) | Mermaid | Order state machine |
| [diagrams/subscription-flow.mmd](./diagrams/subscription-flow.mmd) | Mermaid | Subscription payment flow |
| [diagrams/courier-flow.mmd](./diagrams/courier-flow.mmd) | Mermaid | Courier assignment and delivery flow |
| [diagrams/data-flow.mmd](./diagrams/data-flow.mmd) | Mermaid | Checkout data flow |
| [diagrams/er-diagram.mmd](./diagrams/er-diagram.mmd) | Mermaid | Entity-relationship diagram |

---

## Reference

| File | Tags | Description |
|------|------|-------------|
| [reference/glossary.md](./reference/glossary.md) | `reference`, `glossary`, `terms` | Domain terminology |
| [reference/environment-variables.md](./reference/environment-variables.md) | `reference`, `env`, `variables` | Complete env var reference |
| [reference/error-codes.md](./reference/error-codes.md) | `reference`, `errors`, `codes` | API error codes and meanings |
| [reference/types.md](./reference/types.md) | `reference`, `types`, `typescript` | Key TypeScript interfaces |
| [reference/scripts.md](./reference/scripts.md) | `reference`, `scripts`, `npm` | All npm scripts and utilities |
