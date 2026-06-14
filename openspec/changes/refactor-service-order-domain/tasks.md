## 0. Setup

- [x] 0.1 Create and switch to feature branch `feature/refactor-service-order-domain`
- [x] 0.2 Confirm local Supabase runs and capture current schema state (table list) as a baseline note

## 1. Database schema & migrations (full rewrite)

- [x] 1.1 Remove the three legacy migrations and author a fresh baseline migration set under `supabase/migrations/` (English snake_case names per `docs/data-model.md` §D9)
- [x] 1.2 Enums & helpers: `app_role` (`cliente`,`administrativo`,`tecnico`,`super`), `order_stage` (`intake`,`evaluation`,`budget`,`customer_decision`,`on_hold`,`repair`,`payment`,`delivered`,`closed`), `budget_decision` (`approved`,`deferred`,`rejected`); `touch_updated_at()` and `has_role()` (SECURITY DEFINER)
- [x] 1.3 `profiles` (no role column) + `user_roles(user_id, role)`; `handle_new_user()` trigger bootstrapping the first user to `super`
- [x] 1.4 `customers` table with full ER fields (name, tax_id, phone1, phone2, email, address, registered_at)
- [x] 1.5 `equipment` table with full ER fields (client_id, type, brand, model, serial_number, accessories, purchase_invoice, purchase_store, purchase_date)
- [x] 1.6 `parts` table (part_code, description, stock, unit_cost, supplier) with non-negative stock guard
- [x] 1.7 `orders` table (order_number, client_id, equipment_id, technician_id, stage, reported_fault, intake_at, delivery_at, authorized, received_by, closing_notes, `warranty_origin_id` self-FK); order-number generator + `updated_at` triggers
- [x] 1.8 `technical_evaluations` (order_id, technician_id, evaluated_at, diagnosis, technical_notes)
- [x] 1.9 `budgets` (order_id, labor_cost, parts_cost, freight_cost, other_charges, advances, decision, deferred_reason, decided_at, customer_comments, budgeted_at)
- [x] 1.10 `order_parts` (order_id, evaluation_id, part_id, stage `quoted|used`, quantity, unit_cost_at_registration, in_stock_at_registration, supplier_part_number)
- [x] 1.11 `repairs` (order_id, technician_id, started_at, finished_at, work_description, state)
- [x] 1.12 `payments` (order_id, amount, method, reference, paid_at, registered_by)
- [x] 1.13 Generic `audit_log` (change_ts, schema_name, table_name, operation, db_user, app_user, record_pk jsonb, changed_fields jsonb, full_row_old jsonb, full_row_new jsonb) + single SECURITY DEFINER trigger function attached to all operational tables
- [x] 1.14 Stock-consumption DB function (decrement `parts.stock` from `used` order_parts; reject negative) called transactionally on repair completion
- [x] 1.15 Recreate `order-photos` storage bucket + policies
- [x] 1.16 Indexes (orders.stage, orders.technician_id, orders.created_at, equipment.client_id, equipment.serial_number, order_parts.order_id, payments.order_id, audit_log.table_name+record_pk)
- [x] 1.17 Run `supabase db reset` and confirm all migrations apply cleanly

## 2. RLS policies (encode the permission matrix)

- [x] 2.1 `user_roles`/`profiles`: super manages roles; users read own; deny role self-escalation
- [x] 2.2 `customers`, `equipment`: administrativo/super MODIFICACION, tecnico CONSULTA (equipment only), cliente none
- [x] 2.3 `parts`/`order_parts`: administrativo/super MODIFICACION, tecnico CONSULTA + INGRESO of used lines on assigned orders
- [x] 2.4 `orders`: administrativo INGRESO (open) + MODIFICACION of budget/close stages; tecnico CONSULTA + transitions only on assigned orders; super all
- [x] 2.5 `technical_evaluations`: tecnico INGRESO on assigned orders; administrativo CONSULTA; super all
- [x] 2.6 `budgets`: administrativo INGRESO/MODIFICACION; tecnico none; super all
- [x] 2.7 `repairs`: tecnico INGRESO on assigned orders; administrativo CONSULTA; super all
- [x] 2.8 `payments`: administrativo INGRESO; super all; tecnico none
- [x] 2.9 `audit_log`: read-only for super/administrativo; inserts only via trigger; no direct writes

## 3. Types & shared domain logic

- [x] 3.1 Regenerate `src/integrations/supabase/types.ts` from the new schema
- [x] 3.2 Expand `src/lib/digitron.ts`: new `OrderStage`, stage labels/tokens, 4-role labels, `budget_decision`
- [x] 3.3 Rewrite `src/lib/state-machine.ts`: BPMN transitions, customer-decision branch, deferred loop, repair-requires-approved-budget and delivery-requires-paid gates, role gating per stage
- [x] 3.4 Add a single `MODULE_MATRIX` constant (mirrors `docs/data-model.md`) used by UI to scope nav and disable controls
- [x] 3.5 Fix compile fallout across the app from the new types (build must pass)

## 4. Access control (auth, roles, navigation)

- [x] 4.1 Update `src/hooks/use-auth.tsx` to resolve role from `user_roles`
- [x] 4.2 Role-aware `app-sidebar` / nav: show only modules permitted by `MODULE_MATRIX`
- [x] 4.3 Security/users module (`usuarios.tsx`): super assigns the 4 roles; non-super read/limited per matrix
- [ ] 4.4 Manual verification: log in as each role, confirm visible modules and that forbidden actions are blocked by RLS (not just hidden)

## 5. Customers & equipment

- [x] 5.1 `customers.functions.ts` (list/get/create/update) with zod + `requireSupabaseAuth`; extend `client-form-dialog` to full fields
- [x] 5.2 `equipment.functions.ts` + extend `equipment-form-dialog` to full fields
- [x] 5.3 Equipment service-history-by-serial server function + UI lookup
- [ ] 5.4 Manual verification: create/edit customer & equipment as administrativo; confirm tecnico read-only

## 6. Parts inventory

- [x] 6.1 `parts.functions.ts` (list/get/create/update, stock adjust) with audit on stock change
- [x] 6.2 New `inventory.tsx` route: parts table, create/edit dialog, low/out-of-stock flag
- [ ] 6.3 Manual verification: CRUD as administrativo, read-only as tecnico, low-stock flag shows

## 7. Service order workflow

- [x] 7.1 `orders.functions.ts` (list/get/create/transition) enforcing state-machine + gates server-side
- [x] 7.2 Rework `orders/new.tsx` (Apertura): customer + equipment + technician assignment
- [x] 7.3 Rework `orders/index.tsx`: filter by stage, role-scoped (tecnico sees assigned)
- [x] 7.4 Rebuild `orders/$orderId.tsx` as a stage-driven hub with sections: summary, evaluation, budget, repair, payments, history, and stage-aware action buttons
- [x] 7.5 Warranty: "open warranty order" action creating a linked order (`warranty_origin_id`) reusing customer/equipment
- [ ] 7.6 Manual verification: walk an order through each path — Approved, Deferred (hold→return), Rejected, and Warranty

## 8. Technical evaluation

- [x] 8.1 `evaluations.functions.ts` (create/get) + needed-parts (quoted `order_parts`) with stock availability flag
- [x] 8.2 Evaluation section UI in the order hub (tecnico INGRESO on assigned orders)
- [ ] 8.3 Manual verification: assigned tecnico submits evaluation + needed parts; non-assigned blocked

## 9. Budget & approval

- [x] 9.1 `budgets.functions.ts` (create/update, record decision) with parts_cost defaulting to quoted-lines sum; deferred requires reason
- [x] 9.2 Budget section UI: cost breakdown form + customer decision capture; printable quote via existing `jspdf` path
- [ ] 9.3 Manual verification: generate budget, record each decision type, confirm repair gate blocks until Approved

## 10. Repair execution

- [x] 10.1 `repairs.functions.ts` (start/update/complete) recording used parts and decrementing stock transactionally (uses 1.14)
- [x] 10.2 Repair section UI in the order hub (assigned tecnico)
- [ ] 10.3 Manual verification: complete a repair, confirm stock decremented and negative stock prevented

## 11. Payments

- [ ] 11.1 `payments.functions.ts` (create/list) + order balance computation (budget total − payments)
- [x] 11.2 Payments section UI: register payment, show total paid / outstanding; delivery gate on balance with super/administrativo waiver
- [ ] 11.3 Manual verification: register partial + full payment; delivery blocked until settled or waived

## 12. Audit trail

- [x] 12.1 Order/record history UI reading `audit_log` (newest-first, read-only) in the order hub
- [ ] 12.2 Manual verification: edits across modules produce audit entries with old/new values

## 13. Reporting & dashboard

- [x] 13.1 Rework `dashboard.tsx` (Tablero): role-scoped counters, stage distribution, assigned-to-me, awaiting parts/authorization
- [ ] 13.2 Rework `reports.tsx` (Reportes): date-range throughput, revenue from payments, parts consumption, warranty orders; printable export; deny access to tecnico per matrix
- [ ] 13.3 Manual verification: dashboard scopes per role; reports blocked for tecnico

## 14. i18n & UX polish

- [ ] 14.1 Extend `src/locales/en.ts` and `es.ts` for new stages, modules, roles, and labels
- [ ] 14.2 Consistency pass: status badges, empty states, loading (`async-card-body`), toasts (`sonner`), semantic color tokens (no hardcoded colors), responsive layout

## 15. Mandatory testing & verification

- [ ] 15.1 Add targeted unit tests for `state-machine.ts` (valid/invalid transitions, gates) and key zod validators
- [ ] 15.2 Run the build and any unit tests; record pass/fail summary as a report in the change folder; confirm no regressions
- [ ] 15.3 RLS verification matrix: for each role, exercise each module's read/create/edit and confirm server-side enforcement (agent executes via the running app / Supabase, captures results)
- [ ] 15.4 End-to-end manual walkthrough of all order paths (Approved / Deferred / Rejected / Warranty) with console/network clean in the preview

## 16. Documentation

- [ ] 16.1 Populate `docs/api-spec.yml` with the new server-function contracts
- [ ] 16.2 Keep `docs/data-model.md` authoritative (reconcile any schema deviations discovered during implementation)
- [ ] 16.3 Update `ENGINEERING.md`/`README.md` run/reset notes (e.g., `supabase db reset`) and the docs index where needed
