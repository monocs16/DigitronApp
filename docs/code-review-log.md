---
description: Living journal of code reviews. Each entry is anchored to a commit SHA so future reviews can diff against a known baseline and track SOLID compliance trends over time.
alwaysApply: false
---

# Code Review Log

## Purpose

This file is the project's **code-review memory**. Every time a meaningful review is run (agent or human), an entry is added here so that:

- There is a clear "before" snapshot to compare against on the next review.
- SOLID compliance trends are visible across time.
- Recurring patterns and open action items are never lost between sessions.

> Agents: when you run `/code-review` or `/code-auditing`, append a new entry at the **top** of the [Review Entries](#review-entries) section using the [entry template](#entry-template). Update the [Architecture Baseline](#architecture-baseline) and [SOLID Matrix](#solid-compliance-matrix) only when the structure meaningfully changes.

---

## Architecture Baseline

_Last updated: 2026-06-20 @ `0f454c5`_

### Frontend (React + TanStack Router + Vite)

| Layer | Path | Responsibility |
|---|---|---|
| Routes | `src/routes/` | Page-level components; each route owns its queries and mutations |
| Components | `src/components/` | Shared UI components (dialogs, forms, tables) |
| Hooks | `src/hooks/` | Reusable data-fetching hooks (`use-auth`, `use-technicians`, `use-clients-min`) |
| Repositories | `src/lib/repositories/` | **Single Supabase access layer** — only file allowed to import from `@/integrations/supabase/client` (besides `auth.service.ts`) |
| Auth service | `src/lib/auth.service.ts` | Wraps `supabase.auth.*`; the only non-repository supabase importer |
| Server functions | `src/lib/orders.functions.ts`, `src/lib/users.functions.ts` | Receive supabase via middleware context; explicitly excluded from the repository pattern |
| State machine | `src/lib/state-machine.ts` | Service-order stage transition logic |

### Key architectural constraints (in force as of baseline)

- Zero direct supabase imports outside `src/lib/repositories/` and `src/lib/auth.service.ts` (enforced by grep check in CI).
- Routes use TanStack Query for all data-fetching; no local `useState` for remote data.
- Login page uses `react-hook-form` + `zod` + `useMutation` (no raw `useState` form).
- E2E tests run against a local Supabase instance (Docker); no mock adapters.

---

## SOLID Compliance Matrix

Rated per area: ✅ Strong · ⚠️ Partial · ❌ Violation · — Not applicable

| Principle | Repositories | Routes | Hooks | Components | Notes |
|---|---|---|---|---|---|
| **S** — Single Responsibility | ✅ | ⚠️ | ✅ | ⚠️ | Large route files (`$orderId.tsx`) mix queries, mutations, and UI |
| **O** — Open / Closed | ⚠️ | ⚠️ | — | — | Repositories are closed to query-shape changes but open to new methods |
| **L** — Liskov Substitution | — | — | — | — | No inheritance in use; N/A for current patterns |
| **I** — Interface Segregation | ✅ | ✅ | ✅ | ✅ | Repository methods are narrowly scoped per consumer |
| **D** — Dependency Inversion | ⚠️ | ⚠️ | ⚠️ | — | Routes/hooks depend on concrete repository objects, not interfaces; acceptable for this scale |

_Last updated: 2026-06-20 @ `0f454c5`_

---

## Entry Template

Copy this block and paste it **above** the previous most-recent entry:

```markdown
---

## Review #N — YYYY-MM-DD @ `<commit-sha>`

**Scope:** [whole project / module / feature / files]
**Triggered by:** [agent: code-review | agent: code-auditing | human | pre-PR | scheduled]
**Reviewer:** [Claude Sonnet 4.6 | human | ...]

### Summary

One paragraph describing the overall health and the most important finding.

### Findings

| # | File / Area | Severity | SOLID principle violated | Description |
|---|---|---|---|---|
| 1 | `path/to/file.ts` | High / Medium / Low | S / O / L / I / D / — | Short description |

### Patterns Observed

- **Recurring**: list patterns seen in multiple files
- **New since last review**: patterns that appeared after `<previous-commit-sha>`
- **Resolved since last review**: issues from the previous entry that are now fixed

### Architecture Changes Since Last Review

_Diff from `<previous-commit-sha>` to `<this-commit-sha>`._

- [ ] Change 1
- [ ] Change 2

### Action Items

| Priority | Task | Owner | Linked issue |
|---|---|---|---|
| High | ... | dev / agent | — |

---
```

---

## Review Entries

---

## Review #1 — 2026-06-20 @ `0f454c5`

**Scope:** Whole project — all 110 source files in `src/`
**Triggered by:** agent: code-auditing
**Reviewer:** Claude Sonnet 4.6

### Summary

The codebase is in good structural health. TypeScript compiles clean, ESLint reports zero violations, and the repository abstraction layer is fully applied — no direct Supabase imports outside the intended boundary (except one, see F-01). Business logic (`state-machine.ts`, `access.ts`, `digitron.ts`) is well-isolated and dependency-free. The most significant issue is that `$orderId.tsx` (1,687 lines, 10 queries, 15 mutations, 4 forms, 3 dialogs, a PDF generator, and inline JSX-returning functions) is a clear SRP violation and the dominant technical-debt item. Several medium-severity inconsistencies are documented below.

### Findings

| # | File / Area | Severity | SOLID | Description |
|---|---|---|---|---|
| F-01 | [`src/routes/_authenticated/configuracion.tsx:7`](src/routes/_authenticated/configuracion.tsx) | **Critical** | S, I | Directly imports `supabase` from `@/integrations/supabase/client` in a route file. Breaks the repository boundary rule. The profile update should go through a `profilesRepository.updateDisplayName()` method. |
| F-02 | [`src/routes/_authenticated/orders/$orderId.tsx`](src/routes/_authenticated/orders/$orderId.tsx) | **High** | S | God component: 1,687 lines, 10 queries, 15 mutations, 9 `useState` calls, 4 forms, 3 confirmation dialogs, inline PDF generation. Violates SRP — multiple reasons to change. |
| F-03 | [`src/routes/_authenticated/orders/$orderId.tsx:686`](src/routes/_authenticated/orders/$orderId.tsx) | **High** | S | `partsEditor` is defined as a plain function returning JSX inside the component body (not a React component). Re-created on every render, bypasses React reconciliation. Should be extracted as `<PartsEditor />`. |
| F-04 | [`src/lib/orders.functions.ts:68-105`](src/lib/orders.functions.ts) | **High** | S, DRY | `transitionOrder`'s handler re-implements the same roles + order + budget + payments loading that `loadOrderContext()` already provides. The helper exists for exactly this use case but is not called here. |
| F-05 | [`src/lib/repositories/photos.repository.ts:10-17`](src/lib/repositories/photos.repository.ts) | **High** | — | N-sequential requests pattern inside `Promise.all`: for each photo, one `createSignedUrl` call is issued. Supabase provides `storage.createSignedUrls` (plural) for batch signing — one request instead of N. |
| F-06 | [`src/routes/_authenticated/usuarios.tsx:51-99`](src/routes/_authenticated/usuarios.tsx) | **Medium** | — | User creation form still uses raw `useState` + `FormEvent` pattern. All other forms were migrated to `react-hook-form` + `zod` + `useMutation`. Inconsistent and lacks field-level validation. |
| F-07 | [`src/routes/_authenticated/usuarios.tsx:218`](src/routes/_authenticated/usuarios.tsx) | **Medium** | — | Delete confirmation uses `window.confirm()`. The rest of the app uses `AlertDialog` for the same pattern (see `confirmReject`, `confirmClose`, `confirmWaive` in `$orderId.tsx`). Inconsistent UX. |
| F-08 | [`src/integrations/supabase/auth-middleware.ts:1`](src/integrations/supabase/auth-middleware.ts) | **Medium** | — | File header says "This file is automatically generated. Do not edit it directly." — it is hand-written middleware, not generated. The comment is misleading and should be removed. |
| F-09 | [`tsconfig.json`](tsconfig.json) | **Medium** | — | `noUnusedLocals: false`, `noUnusedParameters: false`, and `@typescript-eslint/no-unused-vars: "off"` are all disabled. Dead local variables are not caught by any automated tool. |
| F-10 | [`src/routes/_authenticated/reports.tsx:86-154`](src/routes/_authenticated/reports.tsx) | **Medium** | — | All aggregations (by-stage, by-technician, by-month, by-client, parts consumption) are computed client-side from a full-table data pull. Will degrade at scale. Consider server-side views or query-level grouping. |
| F-11 | [`src/hooks/use-auth.tsx:97`](src/hooks/use-auth.tsx) | **Low** | — | Bootstrap fallback timeout is 10,000 ms. Users on slow connections see a loading screen for up to 10 s before the app considers auth unresolvable. Typical value is 3–5 s. |
| F-12 | [`src/lib/orders.functions.ts:235`](src/lib/orders.functions.ts) | **Low** | — | `TODO: actual email delivery is pending implementation; we only record the timestamp.` in `notifyCustomer`. Unimplemented feature with no issue tracking link. |
| F-13 | [`src/routes/_authenticated/orders/$orderId.tsx:401`](src/routes/_authenticated/orders/$orderId.tsx) | **Low** | — | `money()` helper is private to `$orderId.tsx` but the same `.toFixed(2)` pattern is used inline in `reports.tsx`. Could live in `src/lib/utils.ts` as `formatAmount`. |
| F-14 | [`src/routes/_authenticated/orders/index.tsx:67`](src/routes/_authenticated/orders/index.tsx) | **Low** | — | `ordersRepository.getAll()` loads the full order list; all filtering is done client-side in `useMemo`. No pagination. Acceptable for a small shop; will need server-side filtering at scale. |

### Patterns Observed

- **Recurring** — Client-side aggregation of complete table data (orders list, reports). Same pattern in `orders/index.tsx`, `dashboard.tsx`, and `reports.tsx`. Works at small scale; will need server-side pagination/filtering as data grows.
- **Recurring** — `toast.error(e.message)` in every `onError` callback, all consistent. Good pattern, keep it.
- **Recurring** — `enabled: !!session` guard on order queries. Prevents unauthenticated fetches. Good pattern.
- **New since last review** — This is the first review entry; no previous baseline.
- **Resolved since last review** — N/A (first review).

### Architecture Changes Since Last Review

_This is the first review. The following describes the current state as of `0f454c5`._

- [x] Repository abstraction layer fully implemented (`src/lib/repositories/` with 13 repositories)
- [x] `auth.service.ts` wraps all `supabase.auth.*` calls
- [x] `login.tsx` migrated from raw `useState` form to `react-hook-form` + `zod`
- [x] E2E testing setup with local Supabase (Docker)
- [x] Auth bootstrap race condition fixed (defers `loading=false` until `INITIAL_SESSION`)
- [ ] **F-01 outstanding**: `configuracion.tsx` still directly imports supabase

### Action Items

| Priority | Task | Owner | Effort |
|---|---|---|---|
| Critical | **F-01** Add `profilesRepository.updateDisplayName()` and update `configuracion.tsx` to use it | dev/agent | S |
| High | **F-04** Replace duplicated load logic in `transitionOrder` with `loadOrderContext()` call | dev/agent | S |
| High | **F-05** Replace N sequential `createSignedUrl` calls with `storage.createSignedUrls` batch API | dev/agent | S |
| High | **F-03** Extract `partsEditor` into a proper `<PartsEditor />` component | dev/agent | M |
| Medium | **F-06** Migrate `usuarios.tsx` user-creation form to `react-hook-form` + `zod` | dev/agent | M |
| Medium | **F-07** Replace `window.confirm()` in `usuarios.tsx` delete action with `AlertDialog` | dev/agent | S |
| Medium | **F-08** Remove misleading "auto-generated" comment from `auth-middleware.ts` | dev/agent | Quick win |
| Medium | **F-09** Enable `noUnusedLocals: true` and `noUnusedParameters: true` in `tsconfig.json`; fix any new errors | dev/agent | M |
| Low | **F-13** Extract `money()`/`formatAmount` to `src/lib/utils.ts` | dev/agent | Quick win |
| Low | **F-11** Reduce auth bootstrap timeout from 10 s to 5 s | dev/agent | Quick win |
| Low | **F-02** Begin phasing `$orderId.tsx` into sub-components (long-term; ship behind a feature branch) | dev | XL |

---
