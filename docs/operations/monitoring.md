# Monitoring & Observability

> **Current State:** Console logs + Supabase Dashboard + Vercel Analytics
> **Target:** Structured logging, alerting, distributed tracing

---

## Current Monitoring Stack

| Layer | Tool | Coverage |
|-------|------|----------|
| **Application Logs** | `console.log/warn/error` (stdout) | API routes, webhooks, server modules |
| **Database** | Supabase Dashboard → Analytics | Queries, connections, latency |
| **Auth** | Supabase Dashboard → Auth | Logins, signups, errors |
| **Storage** | Supabase Dashboard → Storage | Files, bandwidth |
| **Realtime** | Supabase Dashboard → Realtime | Channels, messages |
| **Edge/Host** | Vercel Dashboard → Functions | Invocations, duration, errors |
| **Frontend** | Vercel Analytics (optional) | Page views, Web Vitals |
| **External APIs** | Xendit/Biteship/Google AI Dashboards | API health, quotas |

---

## Log Structure

### Server Logs (Structured)

```typescript
// Pattern: [module/route] action detail
console.log('[checkout/xendit] invoice created', { orderCode: 'RB-...', amount: 25000 });
console.warn('[webhook/xendit] retry detected', { externalId: 'RB-...', attempt: 2 });
console.error('[orders/[code]] fetch failed', error.message, { code: 'RB-...', userId: '...' });

// JSON-friendly for log aggregation
console.log(JSON.stringify({
  level: 'info',
  module: 'checkout/xendit',
  action: 'invoice_created',
  orderCode: 'RB-...',
  amount: 25000,
  timestamp: new Date().toISOString(),
}));
```

### Log Prefixes (Searchable)

| Prefix | Source |
|--------|--------|
| `[checkout/xendit]` | Checkout API |
| `[webhook/xendit]` | Xendit webhook |
| `[webhook/biteship]` | Biteship webhook |
| `[biteship]` | Biteship API calls |
| `[shipping/rates]` | Shipping rates API |
| `[orders/[code]]` | Order detail API |
| `[admin/*]` | Admin APIs |
| `[chat]` | AI chatbot |
| `[courier/*]` | Courier APIs |
| `[subscription/*]` | Subscription APIs |
| `[support/*]` | Support APIs |

---

## Key Metrics to Monitor

### Application Health

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| API 5xx rate | < 0.1% | > 1% for 5 min |
| API latency p95 | < 500ms | > 2s |
| Checkout success rate | > 95% | < 90% |
| Webhook processing time | < 2s | > 10s |
| Webhook failure rate | 0% | > 0% |

### Business Metrics

| Metric | Target | Alert |
|--------|--------|-------|
| Daily orders | Growth | Drop > 50% vs 7d avg |
| GMV (Gross Merchandise Value) | Growth | Drop > 30% |
| Payment success rate | > 95% | < 90% |
| Delivery success rate | > 95% | < 90% |
| Active sellers | Growth | Stagnant > 7d |
| New buyers | Growth | Drop > 30% |

### Infrastructure

| Metric | Target | Alert |
|--------|--------|-------|
| Supabase DB connections | < 80% | > 90% |
| Supabase query p95 | < 100ms | > 500ms |
| Supabase cache hit | > 95% | < 90% |
| Vercel function duration | < 5s | > 25s (timeout) |
| Vercel function errors | < 0.1% | > 1% |
| Xendit API latency | < 2s | > 10s |
| Biteship API latency | < 3s | > 10s |
| AI API latency | < 3s | > 10s |

---

## Alerting (Planned)

### Channels

| Channel | Use Case |
|---------|----------|
| Slack `#alerts` | Non-critical, business metrics |
| PagerDuty / Opsgenie | Critical (5xx, webhook failures, DB down) |
| Email | Daily/weekly reports |

### Alert Rules (Proposed)

```yaml
# PagerDuty / Alertmanager rules
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "High 5xx rate on {{ $labels.route }}"

- alert: WebhookFailures
  expr: rate(webhook_failures_total[5m]) > 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Webhook processing failures"

- alert: DatabaseConnectionsHigh
  expr: pg_stat_activity_count / pg_settings.max_connections > 0.9
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "DB connections at {{ $value | humanizePercentage }}"

- alert: OrderVolumeDrop
  expr: orders_last_hour / orders_same_hour_7d_avg < 0.5
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Order volume dropped 50% vs last week"
```

---

## Log Aggregation (Future)

### Options

| Tool | Pros | Cons |
|------|------|------|
| **Datadog** | Full APM, logs, metrics | Cost |
| **Grafana Cloud** | Loki + Prometheus, generous free | Setup effort |
| **Axiom** | Serverless logs, fast queries | Newer |
| **Supabase Logs** | Already have DB logs | Limited app logs |
| **Vercel Logs** | Built-in | 1hr retention, no queries |

### Recommended: Grafana Cloud (Loki + Prometheus)

```yaml
# promtail-config.yml
clients:
  - url: https://logs-prod.grafana.net/loki/api/v1/push
    basic_auth:
      username: <user>
      password: <token>

scrape_configs:
  - job_name: nextjs
    static_configs:
      - targets: ['localhost']
        labels:
          job: rebites
          env: production
```

---

## Distributed Tracing (Future)

### OpenTelemetry Setup

```typescript
// instrumentation.ts (Next.js)
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

const provider = new NodeTracerProvider();
provider.register();

registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
  ],
});
```

**Traces:** API request → Supabase query → Xendit call → webhook

---

## Health Checks

### `/api/admin/health`

```typescript
// Returns:
{
  "supabase": { "ok": true, "latency_ms": 12 },
  "xendit": { "ok": true, "latency_ms": 245 },
  "biteship": { "ok": true, "latency_ms": 180 },
  "ai": { "ok": true, "latency_ms": 890 }
}
```

### Usage

```bash
# Cron (every 5 min)
curl -f https://rebites.id/api/admin/health || alert
```

---

## Debugging Production Issues

### 1. Check Logs

```bash
# Vercel
vercel logs <deployment-url>

# Or Dashboard → Functions → Logs
```

### 2. Check Supabase

```
Dashboard → Database → Logs → Slow queries
Dashboard → Auth → Logs → Failed logins
Dashboard → Realtime → Active channels
```

### 3. Check External APIs

| API | Dashboard |
|-----|-----------|
| Xendit | https://dashboard.xendit.co/logs |
| Biteship | https://dashboard.biteship.com/logs |
| Google AI | https://aistudio.google.com/usage |

### 4. Common Patterns

| Symptom | Likely Cause | Check |
|---------|--------------|-------|
| Orders stuck `unpaid` | Xendit webhook failed | `[webhook/xendit]` logs |
| Shipping fee 0 | Biteship balance empty | `[biteship] rates failed` |
| AI responses slow | Gemini quota/latency | `[chat]` latency logs |
| Auth loops | Supabase cookie issue | Vercel middleware logs |
| DB timeouts | Connection pool exhausted | Supabase connections graph |

---

## Post-Mortem Template

```markdown
# Incident: [Title]

**Date:** YYYY-MM-DD HH:MM (WIB)
**Duration:** X minutes
**Severity:** SEV-1/2/3
**Status:** Resolved / Investigating

## Impact
- Users affected: X
- Orders impacted: Y
- Revenue impact: Rp Z

## Root Cause
[Technical explanation]

## Timeline
- HH:MM - Detection
- HH:MM - Investigation start
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Recovery verified

## Action Items
- [ ] Fix: [Description]
- [ ] Monitor: [Metric/Alert]
- [ ] Process: [Documentation/Runbook update]

## Lessons Learned
[What we learned]
```

---

## Related Docs

- [Operations: Admin Operations](./admin-operations.md) — Operational tasks
- [Operations: Incident Response](./incident-response.md) — Response procedures
- [Deployment: Overview](../deployment/overview.md) — Health checks
- [Security: Overview](../security/overview.md) — Security monitoring
- [Engineering: Performance](../engineering/performance.md) — Perf monitoring