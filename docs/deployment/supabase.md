# Supabase Deployment

> **Supabase** provides: PostgreSQL + Auth + Realtime + Storage + Edge Functions
> **Deployment:** Supabase Cloud (recommended) or Self-hosted

---

## Supabase Cloud (Current)

### Project Setup

```
1. Create project at https://supabase.com/dashboard
2. Select region: Singapore (closest to Depok/Jakarta)
3. Note: Project ID → used in NEXT_PUBLIC_SUPABASE_URL
4. Get keys: Settings → API
```

### Configuration in Vercel

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (anon public) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service role, secret) |

### Migrations

```bash
# Local development
supabase start
supabase migration up

# Push to cloud
supabase link --project-ref <project-id>
supabase db push

# Verify
supabase db diff  # Compare local vs cloud
```

### Migrations Structure

```
supabase/migrations/
├── 0001_initial_schema.sql
├── 0002_rls_policies.sql
├── 0003_rpc_functions.sql
├── ...
├── 0055_flash_sale_schedule.sql
└── ...
```

**80+ migrations** — never edit applied ones. Always create new.

### Seeding

```bash
# Development only
supabase db reset  # Applies all migrations + seeds

# Production: No seeds (data is live)
```

### Realtime

- Enabled by default
- Channels: `orders`, `chat`, `courier-location`, `notifications`
- Limit: 200 concurrent connections (free tier)

### Storage

| Bucket | Public | Size Limit |
|--------|--------|------------|
| `product-images` | Read | 5 MB |
| `avatars` | Read | 2 MB |
| `article-covers` | Read | 5 MB |
| `umkm-logos` | Read | 2 MB |

### Backup & PITR

- **Automated:** Daily snapshot (retained 7 days)
- **PITR:** Point-in-Time Recovery (7 days, 5-min granularity)
- **Restore:** Supabase Dashboard → Database → Backups

### Limits (Free Tier)

| Resource | Limit |
|----------|-------|
| Database size | 500 MB |
| File storage | 1 GB |
| Bandwidth | 2 GB/month |
| Realtime connections | 200 concurrent |
| Edge Functions | 500k invocations/month |
| Auth MAU | 50,000 |

---

## Supabase Local Development

### Start Local Stack

```bash
supabase start
# Output:
#   API URL: http://localhost:54321
#   DB URL: postgresql://postgres:postgres@localhost:54322/postgres
#   Studio: http://localhost:54323
#   Inbucket (email): http://localhost:54324
```

### Local Environment

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<local-service-key>
```

### Reset Database

```bash
supabase db reset
# Applies all migrations + seed.sql
```

### Generate Types

```bash
supabase gen types typescript --local > types/supabase.ts
# Or from cloud:
supabase gen types typescript --project-id <id> > types/supabase.ts
```

---

## Self-Hosted Supabase (Alternative)

### When to Self-Host

- Data residency requirements
- Cost at scale (> 100GB DB)
- Custom extensions

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Kubernetes / Docker Swarm                                  │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Postgres │  │ GoTrue   │  │ Realtime │  │ Storage    │  │
│  │ (Primary)│  │ (Auth)   │  │ (WS)     │  │ (S3/MinIO) │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│         │           │           │             │            │
│         └───────────┼───────────┴─────────────┘            │
│                     ▼                                      │
│              ┌────────────┐                                │
│              │ Kong API   │  (Gateway)                     │
│              │ Gateway    │                                │
│              └────────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

### Quick Start (Docker Compose)

```yaml
# docker-compose.yml (supabase/supabase)
version: '3'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  auth:
    image: supabase/gotrue:v2
    environment:
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgresql://postgres:postgres@postgres:5432/postgres
      GOTRUE_SITE_URL: http://localhost:3000
      GOTRUE_JWT_SECRET: your-jwt-secret
    ports:
      - "9999:9999"

  realtime:
    image: supabase/realtime
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: postgres
      DB_PASSWORD: postgres
      DB_NAME: postgres
    ports:
      - "4000:4000"
```

**Note:** Self-hosted requires significant ops overhead. Use Supabase Cloud unless required.

---

## Migration to New Project

### Checklist

- [ ] Create new Supabase project
- [ ] Run `supabase db push` to new project
- [ ] Update `NEXT_PUBLIC_SUPABASE_URL` and keys in Vercel
- [ ] Update webhook URLs in Xendit/Biteship
- [ ] Migrate storage files (download + upload or `supabase storage cp`)
- [ ] Update DNS if custom domain
- [ ] Test all flows (auth, orders, webhooks)
- [ ] Monitor logs for 24h

### Storage Migration

```bash
# Option 1: supabase storage cp (if both linked)
supabase storage cp --from-project old-ref --to-project new-ref product-images/*

# Option 2: Manual
# 1. Download all from old bucket
# 2. Upload to new bucket (preserve paths)
```

---

## Monitoring Supabase

### Dashboard

- **Database:** Connections, queries, latency, cache hit ratio
- **Auth:** Signups, logins, MFA, providers
- **Realtime:** Channels, messages, connections
- **Storage:** Files, size, bandwidth
- **Logs:** API requests, errors, slow queries

### Key Metrics to Watch

| Metric | Healthy | Alert |
|--------|---------|-------|
| DB connections | < 80% max | > 90% |
| Query p95 latency | < 100ms | > 500ms |
| Cache hit ratio | > 95% | < 90% |
| Auth error rate | < 1% | > 5% |
| Realtime connections | < 150 | > 180 |
| Storage usage | < 70% | > 85% |

---

## Related Docs

- [Deployment: Overview](./overview.md) — Deploy process
- [Deployment: Environment](./environment.md) — Supabase env vars
- [Database: Overview](../database/overview.md) — Schema, tables
- [Database: Migrations](../database/migrations.md) — Migration history
- [Integrations: Supabase](../integrations/supabase.md) — Integration details
- [Operations: Monitoring](../operations/monitoring.md) — Production health