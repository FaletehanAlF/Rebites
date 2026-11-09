# Git Workflow

> **Repository:** Git-based, GitHub-hosted (or self-hosted)
> **Strategy:** Trunk-based with feature branches

---

## Branch Model

```
main ───────────────────────────────────────────▶
  │                    ▲
  │                    │ (squash merge)
  ├─ feat/checkout ───┘
  │
  ├─ fix/webhook ──────┘
  │
  └─ docs/api ─────────┘
```

### Branches

| Branch | Purpose | Protection |
|--------|---------|------------|
| `main` | Production-ready code | Protected, requires PR + review |
| `develop` | (Optional) Integration branch | Not used in current workflow |
| `feat/*` | New features | No protection |
| `fix/*` | Bug fixes | No protection |
| `hotfix/*` | Production fixes | Fast-track to main |
| `docs/*` | Documentation | No protection |
| `refactor/*` | Code refactoring | No protection |

---

## Workflow

### 1. Create Feature Branch

```bash
# From main
git checkout main
git pull origin main
git checkout -b feat/flash-sale-pricing
```

### 2. Develop & Commit

```bash
# Small, logical commits
git add lib/flash-sale.ts
git commit -m "feat(flash-sale): add scheduled pricing logic"

git add app/api/checkout/xendit/route.ts
git commit -m "feat(checkout): apply flash price when in schedule"

# Run checks before pushing
npm run typecheck
npm test
npm run lint
```

### 3. Push & Create PR

```bash
git push origin feat/flash-sale-pricing
# Open PR on GitHub
```

### 4. PR Process

**PR Checklist:**
- [ ] Title follows conventional commit format
- [ ] Description explains what and why
- [ ] All checks pass (typecheck, tests, lint)
- [ ] At least 1 reviewer approval
- [ ] No merge conflicts
- [ ] Screenshots for UI changes
- [ ] Migration notes if DB changes

**PR Description Template:**
```markdown
## Summary
What does this PR do?

## Changes
- Added: `lib/flash-sale.ts` — scheduled pricing
- Modified: `app/api/checkout/xendit/route.ts` — apply flash price
- Tests: Added 5 test cases in `tests/flash-sale.test.ts`

## Testing
- [ ] Unit tests pass
- [ ] Manual: Create flash sale → verify price in checkout

## Migration
- New migration: `0055_flash_sale_schedule.sql`
- Adds `flash_sale_price`, `flash_sale_start`, `flash_sale_end` columns to `products`

## Screenshots
| Before | After |
|--------|-------|
| | |
```

### 5. Review

**Reviewer checks:**
- Logic correctness (especially money, state machines)
- RLS compliance (service role usage justified?)
- Test coverage for new/changed logic
- No secrets in code
- Accessibility (ARIA, keyboard)
- Performance (N+1 queries, unbounded lists)

### 6. Merge

```bash
# On GitHub: Squash and Merge
# Squash all branch commits into one on main
# Result: clean main history
```

**Post-merge:**
```bash
git checkout main
git pull origin main
git branch -d feat/flash-sale-pricing
```

---

## Commit Conventions

### Format

```
<type>(<scope>): <subject>

[body]

[footer]
```

### Types

| Type | Use |
|------|-----|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, semicolons, no logic change |
| `refactor` | Code restructuring, no behavior change |
| `perf` | Performance improvement |
| `test` | Add/fix tests |
| `chore` | Build, dependencies, tooling |
| `ci` | CI/CD pipeline changes |

### Scopes

| Scope | Coverage |
|-------|----------|
| `auth` | Authentication, sessions |
| `checkout` | Checkout, payment flow |
| `catalog` | Products, categories, filters |
| `orders` | Order lifecycle, status |
| `webhook` | Xendit, Biteship webhooks |
| `admin` | Admin dashboard, RBAC |
| `seller` | Seller dashboard, products |
| `courier` | Courier dashboard, assignments |
| `chat` | AI chatbot |
| `db` | Database, migrations |
| `api` | API routes |
| `ui` | Frontend components |

### Examples

```
feat(checkout): add idempotency key support
fix(webhook): handle Xendit EXPIRED status for unpaid orders
refactor(catalog): extract filter logic to separate module
docs(api): document rate limit headers
test(flash-sale): add edge case tests for timezone handling
chore(deps): upgrade @supabase/supabase-js to 2.x
```

---

## Merge Strategy

| Scenario | Strategy |
|----------|----------|
| Feature branch → main | **Squash** (single commit) |
| Hotfix → main | **Rebase** (preserve history if needed) |
| Release branch → main | **Merge** (create merge commit) |

**Why Squash?**
- Clean main history
- One commit per feature/fix
- Easy revert
- No merge commit noise

---

## Hotfix Process

```bash
# 1. Create hotfix branch from main
git checkout main
git checkout -b hotfix/webhook-crash

# 2. Fix the issue
# 3. Test
# 4. Push & fast-track PR (1 reviewer)
git push origin hotfix/webhook-crash

# 5. Merge to main (squash)
# 6. Tag if release
git tag v1.2.1
git push origin v1.2.1
```

---

## Release Process

```bash
# 1. Create release branch
git checkout main
git checkout -b release/v1.2

# 2. Update version in package.json
# 3. Update CHANGELOG.md
# 4. Merge to main
# 5. Tag
git tag v1.2.0
git push origin v1.2.0
```

**Current state:** No automated release pipeline. Manual deploy after merge to main.

---

## Conflict Resolution

```bash
# 1. Fetch & rebase
git fetch origin main
git rebase origin/main

# 2. Resolve conflicts
# Edit files, then:
git add .
git rebase --continue

# 3. Push (force since rebased)
git push origin feat/your-branch --force-with-lease
```

**Never** `git commit` during rebase (use `git rebase --continue`).

---

## .gitignore

```gitignore
# Dependencies
node_modules/

# Build
.next/
out/
dist/

# Environment
.env.local
.env.production
.env.*.local

# Supabase
.supabase/.temp/

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Logs
*.log

# Test coverage
coverage/

# Biteship (local secrets)
.local-secrets/
```

---

## Related Docs

- [Development: Setup](./setup.md) — Initial setup
- [Deployment: Overview](../deployment/overview.md) — CI/CD (future)
- [Operations: Incident Response](../operations/incident-response.md) — Hotfix process
- [Engineering: Code Organization](../engineering/code-organization.md) — Module boundaries