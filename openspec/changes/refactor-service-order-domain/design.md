## Context

`digitron-app` is a TanStack Start + Supabase (Postgres + Auth + Storage) app deployed as a
Cloudflare Worker. Security lives primarily in Postgres RLS; server functions (`*.functions.ts`)
are the gated entry points. The current schema (3 migrations) models a thin slice: `profiles`
(role enum `admin|technician` on the profile row), `clients`, `equipment`, a monolithic `orders`
table with a single `order_status` enum, `order_photos`, and an order-only `audit_log`.

The target model (`docs/data-model.md`) is materially richer: 4 roles, separate evaluation /
budget / repair / payment entities, a parts inventory with order-part line items, warranty
self-reference, and a generic audit log. This change rebuilds the schema and reorganizes the app
around the BPMN workflow while **reusing** the existing stack, UI kit (shadcn), routing, auth
middleware, and server-function pattern.

Because there is no production data yet (local/dev Supabase, pre-export per `ENGINEERING.md`
roadmap), we can rebuild migrations rather than write incremental ALTERs.

## Goals / Non-Goals

**Goals:**
- Schema + RLS that faithfully implement the ER and the role/permission matrix.
- A workflow-driven order experience: one order detail page with stage-aware actions.
- New modules: inventory, budgets, payments; reworked dashboard/reports; security/users for 4 roles.
- Reuse existing components, hooks, i18n, and the `requireSupabaseAuth` + zod server-function pattern.
- Keep everything Cloudflare-Workers-safe (no native deps).

**Non-Goals:**
- A customer-facing self-service portal (the `cliente` role here is limited to public/read; full
  client portal is future work).
- Real external integrations (WhatsApp/email/Hacienda) — out of scope.
- Electron packaging, offline mode, multi-branch (roadmap items).
- Automated test suite beyond targeted tests for new server functions and the state machine
  (the project has no formal suite yet; we add focused tests, not full coverage).

## Decisions

### D1 — Rebuild migrations as a fresh baseline (BREAKING)
Replace the three existing migrations with a new ordered set (enums & helpers → roles → customers
→ equipment → parts → orders → evaluations → budgets → order_parts → repairs → payments → audit →
storage → indexes/RLS). Rationale: incremental ALTERs from `admin|technician` to the full model
would be larger and riskier than a clean baseline given no prod data.
- Alternative considered: additive migrations preserving current tables → rejected (more churn,
  leaves dead columns like `orders.estimated_cost`/`final_cost` superseded by budgets).

### D2 — Roles in a dedicated `user_roles` table with `app_role` enum
Move role off `profiles` into `user_roles(user_id, role)` with `has_role()` `SECURITY DEFINER`,
matching `ENGINEERING.md` guidance and enabling future multi-role. Enum: `cliente`,
`administrativo`, `tecnico`, `super`. First user bootstraps to `super`.
- Alternative: keep role on `profiles` → rejected (contradicts engineering standard, harder to
  extend, RLS recursion risk).

### D3 — Permission matrix encoded as RLS policies, not a runtime table
Translate each (role, module, level) cell into concrete RLS policies per table/operation. The UI
reads a single source-of-truth matrix constant (mirrored from `docs/data-model.md`) to scope
navigation and disable controls; the server enforces via RLS. Rationale: simplest correct
enforcement; avoids a dynamic-permission engine.
- Alternative: a generic `permissions` table evaluated at runtime → rejected as over-engineering
  for 4 fixed roles and a fixed module set.

### D4 — Workflow stages as an enum + transition table in code
Expand `order_status` to the BPMN stages (`intake`, `evaluation`, `budget`, `customer_decision`,
`on_hold`, `repair`, `payment`, `delivered`, `closed`, plus warranty handled via linkage). Keep
the allowed-transition map and per-stage role gating in `src/lib/state-machine.ts` + `digitron.ts`,
validated again server-side. Gates: cannot enter `repair` without an Approved budget; cannot mark
`delivered` with an outstanding balance unless waived.
- Alternative: model decision/hold purely via budget fields without dedicated stages → rejected
  (the dashboard and RLS need an explicit stage to filter and gate on).

### D5 — Money & line-item snapshots
Store monetary values as `NUMERIC(10,2)`. Order-part lines capture `unit_cost_at_registration`
so catalog price changes never rewrite history. Budget `parts_cost` defaults to the sum of quoted
lines but remains editable.

### D6 — Stock consumption transactional via server function + DB trigger
Repair completion that records `used` lines decrements `parts.stock` inside a single server
function call wrapped in a DB function/transaction; a `CHECK`/guard prevents negative stock.
- Alternative: client-side stock math → rejected (race conditions, RLS bypass risk).

### D7 — Generic audit via a single trigger function
One `SECURITY DEFINER` trigger function attached to every operational table writes to
`audit_log(change_ts, table_name, operation, app_user, record_pk jsonb, changed_fields jsonb,
full_row_old jsonb, full_row_new jsonb)`. Rationale: matches the ER's generic audit and removes
the per-column boilerplate of the current order-only trigger.

### D8 — Reuse-first frontend reorganization
Keep `src/components/ui/*` and existing dialogs (`client-form-dialog`, `equipment-form-dialog`,
`status-badge`, `page-header`, `app-sidebar`). Extend rather than replace. New routes:
`inventory.tsx`, `orders/$orderId` becomes the stage-driven hub with sub-sections for evaluation,
budget, repair, payments, and history; `reports.tsx`/`dashboard.tsx` reworked; `usuarios.tsx`
extended to 4 roles; add a security view. i18n keys added to `en.ts`/`es.ts`.

### D9 — Naming convention
Physical schema uses English snake_case (`technical_evaluations`, `order_parts`, `warranty_origin_id`)
per project language standard, mapping from the Spanish ER identifiers documented in
`docs/data-model.md`. Domain/UI labels are localized via i18n.

## Risks / Trade-offs

- **Breaking schema reset wipes existing dev data** → Mitigation: this is pre-export dev; document
  `supabase db reset` in the dev guide; no prod data exists.
- **RLS matrix complexity / mistakes** → Mitigation: per-role manual verification tasks in
  `tasks.md`; test each module against a non-`super` user; keep policies small and explicit.
- **Regenerated `types.ts` breaks many imports at once** → Mitigation: regenerate types early
  (phase 1) so the rest of the work compiles against the final shape; fix import fallout in a
  dedicated step.
- **Stage machine + RLS divergence** (UI allows what RLS blocks or vice-versa) → Mitigation:
  single matrix constant mirrored in docs; server functions re-validate transitions.
- **Cloudflare Workers runtime limits** → Mitigation: no new native deps; keep PDF export on the
  existing `jspdf` client-side path.
- **Scope is large for one change** → Mitigation: `tasks.md` is phased (schema → types/server →
  per-module UX → verification); each phase is independently testable.

## Migration Plan

1. Author the new migration set; `supabase db reset` locally to apply from scratch.
2. Regenerate `src/integrations/supabase/types.ts`; fix compile fallout.
3. Land server functions per capability behind RLS; verify policies per role.
4. Reorganize UI module-by-module against the new functions.
5. Manual verification per role + per workflow path (approved / deferred / rejected / warranty).
6. Rollback strategy: revert the change branch; since migrations are a fresh baseline on dev,
   `supabase db reset` to the previous migration set restores the old schema.

## Open Questions

- `cliente` role scope: read-only public for now; confirm whether any authenticated client view is
  wanted in this change (assumed **no** — deferred to a future client-portal change).
- Partial payments & balance waiver: assumed allowed with a `super`/`administrativo` waiver flag;
  confirm business rule.
- Low-stock threshold: assumed a single configurable threshold (default 0/■); confirm if per-part.
