# Incident Response

> **Severity Levels:** SEV-1 (Critical) → SEV-2 (Major) → SEV-3 (Minor)

---

## Severity Definitions

| Severity | Criteria | Response Time | Escalation |
|----------|----------|---------------|------------|
| **SEV-1** | Complete outage, data loss, payment failure, security breach | Immediate (5 min) | Page on-call, notify stakeholders |
| **SEV-2** | Partial outage, major feature down, high error rate | 15 min | Page on-call |
| **SEV-3** | Minor bug, cosmetic issue, non-critical feature | Next business day | Assign to team |

---

## SEV-1: Critical Incident Response

### Immediate Actions (0-5 min)

```
1. ACKNOWLEDGE: On-call receives alert → acknowledges in PagerDuty
2. ASSESS: Check health endpoints, logs, dashboards
3. COMMUNICATE: Post to #incidents Slack channel
   - "SEV-1: [Description] - Investigating"
4. MITIGATE: Apply quick fix if known (rollback, toggle feature flag)
```

### Investigation (5-30 min)

```
5. DIAGNOSE: Identify root cause
   - Check recent deploys
   - Check external API status (Xendit, Biteship, Supabase)
   - Check database health
   - Check Vercel function logs
6. ESCALATE: If not resolved in 15 min → escalate to team lead
```

### Resolution (30 min+)

```
7. FIX: Deploy fix / rollback / workaround
8. VERIFY: Confirm recovery via health checks
9. COMMUNICATE: "SEV-1 RESOLVED: [Summary]"
10. DOCUMENT: Create incident record
```

---

## Common SEV-1 Scenarios

| Scenario | Detection | Mitigation |
|----------|-----------|------------|
| **Supabase down** | `/api/admin/health` fails, 5xx on all DB calls | Wait for Supabase recovery (check status.supabase.com) |
| **Xendit webhook not processing** | Orders stuck `unpaid`, `[webhook/xendit]` errors | Manual webhook replay, check token |
| **Biteship API down** | Shipping rates fail, shipments not created | Fallback to ReBites Courier (local tariff) |
| **Vercel deployment broken** | 5xx on all routes, build failed | Rollback to previous deployment |
| **Auth broken** | No one can login, middleware redirect loops | Check Supabase Auth status, JWT secret |
| **Data breach suspected** | Unusual DB access, leaked data reports | Rotate all keys, investigate access logs |

---

## Communication Templates

### Internal (Slack #incidents)

```
🚨 SEV-1: [Brief title]
**Impact:** [What's broken, who's affected]
**Started:** [Time WIB]
**Status:** Investigating / Mitigating / Resolved
**Lead:** @on-call
**Updates:** Thread below
```

### External (Status Page / Email)

```
Subject: ReBites Service Disruption - [Date]

We're experiencing issues with [feature]. Our team is investigating.
Expected resolution: [time estimate].
We'll update you at [next update time].
```

---

## Post-Incident Process

### Within 24 Hours

1. **Post-Mortem Meeting** (30 min)
   - All involved parties
   - Blameless culture
   - Timeline reconstruction

2. **Post-Mortem Document**
   - Use template in `docs/operations/incident-response.md`
   - Root cause analysis (5 Whys)
   - Action items with owners

### Within 1 Week

3. **Action Item Tracking**
   - Fixes deployed
   - Monitoring improved
   - Runbooks updated
   - Tests added

---

## Runbooks (Quick Actions)

### Webhook Replay

```bash
# Xendit
curl -X POST https://rebites.id/api/webhooks/xendit \
  -H "X-Callback-Token: $XENDIT_CALLBACK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"inv_...","external_id":"RB-...","status":"PAID","amount":25000,"paid_amount":25000,"payment_channel":"BCA"}'

# Biteship
curl -X POST https://rebites.id/api/webhooks/biteship \
  -H "X-Biteship-Signature: $(echo -n 'payload' | openssl dgst -sha256 -hmac $BITESHIP_WEBHOOK_SECRET)" \
  -H "Content-Type: application/json" \
  -d '{"order_id":"SHP-...","status":"DELIVERED","waybill":"123..."}'
```

### Rollback Deployment

```bash
# Vercel
vercel rollback <deployment-url> --token=$VERCEL_TOKEN

# Or Dashboard → Deployments → "Promote to Production" on previous
```

### Database Rollback (PITR)

```
1. Supabase Dashboard → Database → Backups
2. Select "Point in Time Recovery"
3. Choose timestamp (within 7 days)
4. Click "Restore" → New database branch
5. Verify data → Switch DNS / connection string
```

### Emergency Feature Flag

```typescript
// lib/features.ts (future)
export const features = {
  checkout: process.env.FEATURE_CHECKOUT !== 'false',
  aiChat: process.env.FEATURE_AI_CHAT !== 'false',
  courierTracking: process.env.FEATURE_COURIER_TRACKING !== 'false',
};

// In code:
if (!features.checkout) return NextResponse.json({ error: 'Temporarily unavailable' }, { status: 503 });
```

**Set in Vercel:** `FEATURE_CHECKOUT=false` → auto-redeploy

---

## Contact Escalation

| Role | Contact | When |
|------|---------|------|
| On-call Engineer | PagerDuty / Phone | All SEV |
| Team Lead | Slack DM / Phone | SEV-1 > 15 min |
| Product Manager | Slack / Email | SEV-1 business impact |
| Security Team | Slack / Email | Data breach suspected |
| Legal / Compliance | Email | PDP reportable incident |

---

## Incident Record Template

```markdown
# INC-[YYYYMMDD]-[SEQ]: [Title]

**Severity:** SEV-1/2/3
**Status:** Open / Investigating / Mitigating / Resolved / Closed
**Start:** YYYY-MM-DD HH:MM WIB
**End:** YYYY-MM-DD HH:MM WIB (or Ongoing)
**Duration:** X minutes

## Impact
- **Users affected:** [Count / "All" / "Subset"]
- **Orders impacted:** [Count / "All in progress"]
- **Revenue impact:** [Estimated Rp]
- **Features down:** [List]

## Timeline
| Time (WIB) | Event |
|------------|-------|
| HH:MM | Alert fired / User report |
| HH:MM | On-call acknowledged |
| HH:MM | Root cause hypothesized |
| HH:MM | Mitigation applied |
| HH:MM | Fix deployed |
| HH:MM | Recovery verified |

## Root Cause
[Technical description. Use 5 Whys.]

## Resolution
[What fixed it]

## Action Items
- [ ] **Fix:** [Description] — Owner: @name — Due: YYYY-MM-DD
- [ ] **Monitor:** [Alert/Metric] — Owner: @name — Due: YYYY-MM-DD
- [ ] **Process:** [Runbook/Doc update] — Owner: @name — Due: YYYY-MM-DD
- [ ] **Test:** [Regression test] — Owner: @name — Due: YYYY-MM-DD

## Lessons Learned
[What we learned, how to prevent recurrence]
```

---

## Related Docs

- [Operations: Monitoring](./monitoring.md) — Detection
- [Operations: Admin Operations](./admin-operations.md) — Routine checks
- [Deployment: Overview](../deployment/overview.md) — Rollback
- [Security: Overview](../security/overview.md) — Breach response
- [Engineering: Decisions](../engineering/decisions.md) — Architecture context