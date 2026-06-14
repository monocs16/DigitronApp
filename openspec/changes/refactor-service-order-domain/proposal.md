## Why

The current app implements a thin slice of the Digitron domain: a monolithic `orders` table
with a single status enum, only two roles (`admin`, `technician`), no inventory, and no
first-class entities for evaluation, budget, repair, or payment. The agreed business reality
(see `docs/data-model.md` — ER diagram, BPMN service-order flow, and role/permission matrix)
requires a richer model and a workflow-driven UX. This change realigns the schema, security,
and interface with that target so the product reflects how the repair shop actually operates.

The goal is **reorganization and UX quality**, not a rewrite: reuse the existing TanStack Start
+ Supabase foundation, shadcn UI library, server-function pattern, and current routes wherever
possible.

## What Changes

- **BREAKING**: Rewrite the database schema and migrations from scratch to match the target ER.
  New tables: `technical_evaluations`, `budgets`, `repairs`, `payments`, `parts`, `order_parts`.
  `orders` gains a warranty self-reference and lifecycle fields; `audit_log` becomes a generic,
  table-agnostic change log.
- **BREAKING**: Replace the 2-role model with 4 roles (`cliente`, `administrativo`, `tecnico`,
  `super`) and enforce the module/permission matrix (CONSULTA/MODIFICACION/INGRESO) via RLS.
  Roles move to a dedicated `user_roles` table per `ENGINEERING.md` (currently on `profiles`).
- Replace the single status enum machine with the full BPMN flow: Intake → Technical Evaluation
  → Budget/Approval → **Customer decision (Approved / Deferred / Rejected)** → Repair → Payment
  → Delivery → Close, including the Deferred (waiting part/authorization) loop.
- Add **warranty management**: open a new order linked to the original (`warranty_origin_id`)
  and look up equipment service history by serial number.
- Add **parts inventory**: parts catalog with stock, order-part line items (quoted vs used),
  stock availability checks, and stock consumption on repair completion.
- Add first-class **technical evaluation**, **budget/quote** (labor/parts/freight/other/advances
  with customer decision), **repair record** (work + used parts), and **payment** registration.
- Rework the UX around the workflow: a guided order detail with stage-aware actions, role-scoped
  navigation/modules, inventory screens, budget & payment screens, and refreshed dashboard/reports.
- Extend customer & equipment data (tax ID, second phone, address; equipment accessories,
  purchase invoice/store/date) to match the ER.
- Update `docs/api-spec.yml` and keep `docs/data-model.md` authoritative.

## Capabilities

### New Capabilities
- `access-control`: 4-role model, dedicated `user_roles` table, the module/permission matrix, and
  RLS policies + helper functions that enforce it server-side.
- `customer-equipment`: customer and equipment records with the full ER field set and serial-based
  equipment history.
- `service-order-workflow`: the order aggregate, the BPMN state machine with the customer-decision
  branch and deferred loop, and warranty order linkage.
- `technical-evaluation`: evaluation records with diagnosis, technical notes, and a needed-parts list.
- `budget-approval`: quotes with cost breakdown and the customer decision (approved/deferred/rejected)
  with reason and timestamps.
- `repair-execution`: repair records capturing work performed and parts actually used.
- `payments`: payment registration against an order (amount, method, reference).
- `parts-inventory`: parts catalog, stock levels, order-part line items, stock checks and consumption.
- `audit-trail`: generic, table-agnostic audit log capturing inserts/updates/deletes with old/new values.
- `reporting-dashboard`: role-scoped operational dashboard (Tablero) and reports (Reportes).

### Modified Capabilities
<!-- No previously-archived OpenSpec specs exist (openspec/specs/ is empty); all capabilities above are new. -->

## Impact

- **Database**: full migration rewrite under `supabase/migrations/`; regenerated
  `src/integrations/supabase/types.ts`.
- **Server functions**: new `src/lib/*.functions.ts` for each capability (evaluations, budgets,
  repairs, payments, parts, orders) following the `requireSupabaseAuth` + zod pattern.
- **Domain/UI logic**: `src/lib/digitron.ts`, `src/lib/state-machine.ts` expanded to the new flow
  and roles; new/expanded routes under `src/routes/_authenticated/` (orders flow, inventory,
  budgets, payments, dashboard, reports, security/users).
- **i18n**: `src/locales/{en,es}.ts` extended for new statuses, modules, and labels.
- **Auth/roles**: `src/hooks/use-auth.tsx` and role gates updated for 4 roles + matrix.
- **Docs**: `docs/api-spec.yml` populated; `docs/data-model.md` remains source of truth.
- **No new heavy/native deps** (Cloudflare Workers constraint); reuse existing libraries.
