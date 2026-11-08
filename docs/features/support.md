# Support & Appeals Feature

> User reports, appeals system, and admin moderation workflow.

---

## Overview

Support features allow users to report issues and admins to manage them.

**User side**: `/banding` (appeals), product/store reports
**Admin side**: `/dashboard/admin/monitoring/laporan`, chat threads

---

## User Reports (`/api/reports`)

### Report Types
| Type | Target | Recipients |
|------|--------|------------|
| `product` | Product | Admin + Seller |
| `store` | Store/UMKM | Admin |
| `order` | Order | Admin |
| `user` | User | Admin |

### API: POST `/api/reports`

```typescript
interface ReportRequest {
    type: 'product' | 'store' | 'order' | 'user';
    targetId: string;      // Depends on type
    reason: string;
    details?: string;
}
```

### Response
```json
{
    "reportId": "uuid",
    "status": "open",
    "message": "Laporan berhasil dikirim"
}
```

---

## Appeals System (`/banding`)

Users can appeal sanctions or rejected decisions.

### Routes
| Route | Page |
|-------|------|
| `/banding` | New appeal form |
| `/banding/status` | Check appeal status |

### Appeal Types
| Type | Source |
|------|--------|
| Sanction ban appeal | Store was sanctioned |
| Product rejection appeal | Product was rejected |
| Account appeal | Account blocked/banned |

### API: POST `/api/support/appeal`

```typescript
// Request:
{
    appealType: 'sanction' | 'rejection' | 'account',
    targetId: string,
    reason: string,
    evidence?: string  // File upload to storage
}

// Creates:
- support_appeals table row
- Notifies admin
```

### Status Check: GET `/api/support/appeal/status?id=...`

```json
{
    "status": "open" | "pending_review" | "approved" | "rejected" | "cancelled",
    "reason": "...",
    "response": "...",
    "resolvedAt": "..."
}
```

---

## Admin Moderation (`/dashboard/admin/moderasi`)

### Product Moderation

| Status | Action Required | Location |
|--------|-----------------|----------|
| `pending` | Approve or Reject | `/moderasi` |
| `approved` | Show publicly | Catalog, product detail |
| `rejected` | Notify seller with reason | Seller dashboard |

**Actions:**
- ✅ Approve → `verification_status = approved` + notification
- ❌ Reject → `verification_status = rejected` + reason + notification
- ⚠️ Warn → Create warning record (see Monitoring)

### Store Moderation

| Status | Action Required | Location |
|--------|-----------------|----------|
| `pending` | Verify docs | `/umkm/[id]` |
| `active` | Normal operation | All public pages |
| `inactive` | Manual reactivation | `/umkm/[id]` |

**Actions:**
- ✅ Verify → `umkm_profiles.is_verified = true` + notification
- 🚫 Deactivate → `umkm_profiles.is_active = false` + notification
- 🗑️ Delete → Soft delete with reason

---

## Notifications from Reports

When a report is submitted:

```typescript
// In /api/reports handler:
await createNotification(
    adminUserId,           // Admins who should see
    'report_submitted',
    `Laporan baru: ${report.type}`,
    `Laporan dari ${user.name}: ${report.reason}`,
    { reportId: report.id, targetType: report.type }
);

// Also notify seller for product/store reports
if (report.type === 'product') {
    await createNotification(sellerUserId, 'report_submitted', ...);
}
```

---

## Admin Chat (`/dashboard/admin/chat`)

### Thread List
| Column | Data |
|--------|------|
| User | Name, avatar, role |
| Last message | Preview |
| Unread count | Badge |
| Opened at | Time |
| Actions | View, Close |

### Thread Detail (`/dashboard/admin/chat/[id]`)
- Message history (supabase realtime)
- Reply box (admin only)
- End conversation button

---

## Data Model

### Reports Table
```sql
reports (
    id UUID PRIMARY KEY,
    reporter_id UUID REFERENCES profiles,
    type TEXT NOT NULL,            -- product, store, order, user
    target_type TEXT NOT NULL,     -- 'products', 'umkm_profiles', 'orders', 'profiles'
    target_id UUID NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'open',    -- open, in_review, resolved, closed
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
)
```

### Support Appeals
```sql
support_appeals (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES profiles,
    appeal_type TEXT NOT NULL,     -- sanction, rejection, account
    target_id UUID,
    reason TEXT NOT NULL,
    evidence_url TEXT,             -- Supabase Storage URL
    status TEXT DEFAULT 'open',    -- open, pending_review, approved, rejected, cancelled
    admin_response TEXT,
    resolved_by UUID REFERENCES profiles,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
)
```

### Chat Messages
```sql
messages (
    id UUID PRIMARY KEY,
    thread_id UUID REFERENCES chat_threads,
    sender_id UUID REFERENCES profiles,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
)
```

---

## RLS Policies

### Reports
```sql
-- Users can create their own reports
CREATE POLICY "Users create own reports" ON reports
    FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- Admins can read all reports
CREATE POLICY "Admins view all reports" ON reports
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    ));
```

---

## Testing

```bash
npm run test:support-core
npm run test:support-inbox
npm run test:support-inbox-db
```

---

## Known Issues

| Issue | Location | Workaround |
|-------|----------|------------|
| No email notifications | All types | In-app only |
| No evidence file limit | Upload | 5MB max (Supabase default) |
| Chat persistence | Realtime | Reconnect on page refresh |
| No escalation path | Reports | Admin decides priority |