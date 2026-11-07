# Constraints

Last reviewed: 2026-10-07 — created during the "landing vs application separation"
task. Apply the floor to every change; the measured dimensions use the
repository's existing scripts only (no new tooling, no new dependencies).

Read this file before writing code. Do not weaken it to make a change pass.

## Floor (always enforced, no setup required)

- No new suppression comments: `@ts-ignore`, `@ts-expect-error`, `eslint-disable`.
- No unimplemented stubs, no empty `catch {}`, no silent failure paths added.
- No skipped or deleted checks without a reason recorded in the change.
- No secrets or server-only environment values in source.
- No fabricated content: no invented stats, testimonials, partners, products,
  prices or reviews (AGENTS.md §11, `docs/PROJECT_CONTEXT.md` §11).
- This file does not get weakened to make a change pass.

## Enforced with numbers

| Dimension | Rule | Checked by | Runs at |
| --- | --- | --- | --- |
| Types | Zero type errors | `npm run typecheck` | every edit |
| Lint | Zero lint errors, and no new warnings above the recorded baseline | `npm run lint` | task end |
| Build | Production build succeeds | `npm run build` | task end |
| Routes | Public and application routes keep their URLs: `/`, `/home`, `/detail/*`, `/makanan/*`, `/auth/*`, `/dashboard/*` | `npm run build` route table + manual route checks | task end |
| Boundary | `app/(landing)/**` must not import application chrome: `components/shared/navbar` (ProfileNavbar), `MobileNavbar`, `MobileBottomNav`, `profile-sidebar-nav`, `lib/current-user`, `lib/supabase`, `hooks/use-*` | import review of `app/(landing)` at review time | every change to `(landing)` |

A dimension with a number and no command in this column is an aspiration, not a
constraint.

## Measured, not yet enforced

| Metric | Today | Direction |
| --- | --- | --- |
| `npm run lint` warnings | 4 (pre-existing: `<img>` in `dashboard-penjual/Topbar.tsx`, `dashboard/penjual/[storeId]/pengaturan/page.tsx`, `dashboard/penjual/[storeId]/ulasan/page.tsx`; hook deps in `app/components/detail-toko` usage via `detail/toko/page.tsx`) | must not grow |
| Test coverage | no test runner configured | none to hold |

## Exceptions

| ID | Rule | Path | Reason | Owner | Expires |
| --- | --- | --- | --- | --- | --- |
| — | none | — | — | — | — |
