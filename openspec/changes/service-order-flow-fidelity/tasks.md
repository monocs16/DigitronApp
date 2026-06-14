# Tasks — service-order-flow-fidelity

> Note: no unit-test runner is configured in this project (deferred per the team). The mandatory
> "unit test" gate is satisfied here by `tsc --noEmit` + `eslint`; the **manual (curl)** and
> **E2E (browser)** steps below are executed by the agent and are the primary behavioral
> verification. Reports go to `specs/service-order-flow-fidelity/reports/`.

## 0. Setup: Create Feature Branch (MANDATORY — FIRST STEP)

- [x] 0.1 Create branch `feature/service-order-flow-fidelity` from `feature/refactor-service-order-domain` (the migration work is not yet on main)
- [x] 0.2 Verify current branch

## 1. Data: migration + types (backend)

- [x] 1.1 Add migration `supabase/migrations/<ts>_flow_notifications.sql`: `orders.decision_notified_at`, `orders.delivery_notified_at` (nullable TIMESTAMPTZ)
- [x] 1.2 Apply locally (`supabase db reset` then `bun run seed:admin`, or `supabase migration up`) and regenerate `src/integrations/supabase/types.ts`
- [x] 1.3 `tsc --noEmit` = 0

## 2. State machine: stage ownership

- [x] 2.1 `src/lib/state-machine.ts`: `STAGE_ACTOR_ROLES.budget` += `tecnico`; `evaluation` = `[administrativo]`

## 3. Server functions (backend — zod + requireSupabaseAuth)

- [x] 3.1 `recordBudgetDecision({order_id,decision,deferred_reason?})`: set decision/`decided_at`/`deferred_reason`, set `authorized` on approved, auto-advance via `canTransition` (approved→repair, deferred→on_hold, rejected→closed); admin/super only
- [x] 3.2 `notifyCustomer({order_id,kind:'decision'|'delivery'})`: stamp the matching column; admin/super only; email TODO comment
- [x] 3.3 `deliverOrder({order_id,received_by})`: set `received_by`+`delivery_at`, advance to delivered (balance gate)
- [x] 3.4 `closeOrder({order_id,closing_notes})`: set `closing_notes`, advance to closed
- [x] 3.5 `tsc` + `eslint` clean

## 4. Frontend: guided order detail

- [x] 4.1 New `src/components/order-stage-stepper.tsx` (stage timeline; current highlighted, done checked, future dimmed; on_hold↔decision loop)
- [x] 4.2 Reorganize `orders/$orderId.tsx`: current-step panel with the owning-role action; past stages read-only/collapsed; future stages locked
- [x] 4.3 Decision via `recordBudgetDecision` (remove manual branch buttons); deferred requires reason
- [x] 4.4 Notify buttons (decision/delivery) → `notifyCustomer`; toast "notification recorded — email pending"; show "notified at …"
- [x] 4.5 Delivery captures `received_by`; close captures `closing_notes`; show `source` + `authorized`
- [x] 4.6 `tsc` + `eslint` clean

## 5. Frontend: dashboard pending-action inbox

- [x] 5.1 `dashboard.tsx`: "pending my action" list by role+stage+assignment (admin / assigned tecnico / super); links to the order

## 6. Frontend: order origin at intake

- [x] 6.1 `orders/new.tsx`: Origen select → `orders.source`

## 7. i18n (es/en parity)

- [x] 7.1 Add keys (origin+options, stepper, notify+email-pending, received_by, delivery, closing, inbox); verify es/en key parity

## 8. Documentation (MANDATORY)

- [x] 8.1 `docs/data-model.md` §4 (recorded notifications + origin) and §5 if affected
- [x] 8.2 `docs/api-spec.yml`: contracts for the 4 new server functions

## 9. Review/Update tests (MANDATORY)

- [ ] 9.1 No unit runner configured; record this and rely on `tsc`/`eslint` + manual/E2E (steps 10–12). If a runner is later added, add state-machine tests for the new ownership + decision routing

## 10. Run checks + verify DB state + report (MANDATORY — AGENT MUST EXECUTE)

- [ ] 10.1 Capture pre-test DB baseline (orders/parts counts) on local
- [ ] 10.2 Run `tsc --noEmit` and `eslint` on changed files; record results
- [ ] 10.3 Verify post-test DB state unchanged; create report `specs/service-order-flow-fidelity/reports/YYYY-MM-DD-step-10-checks-and-db-verification.md`

## 11. Manual testing — server functions via curl (MANDATORY — AGENT MUST EXECUTE)

- [ ] 11.1 Start `bun run dev:local`; authenticate to obtain a JWT for an admin and a tecnico
- [ ] 11.2 Exercise `recordBudgetDecision` (approved/deferred/rejected), `notifyCustomer`, `deliverOrder`, `closeOrder`; verify status + state-machine gates + role denials
- [ ] 11.3 Restore DB state; document commands/responses in a report under `reports/`

## 12. E2E testing via browser MCP on dev:local (MANDATORY — AGENT MUST EXECUTE)

- [ ] 12.1 `bun run dev:local:fresh`; seed admin; create administrativo + tecnico
- [ ] 12.2 Walk an order through all paths (Approved, Deferred→hold→return, Rejected, Warranty) confirming guided UX, auto-routing, notify stamps + email-pending notice, origin, received_by/closing
- [ ] 12.3 Confirm per-role inbox + that técnico only sees assigned orders; restore state; report under `reports/`

## 13. Implementation verification

- [ ] 13.1 `opsx:verify` coherent (artifacts ↔ implementation)
- [ ] 13.2 `tsc` = 0, `eslint` clean, es/en parity; all reports present
- [ ] 13.3 Conventional commits per checkpoint; do not archive (left for a separate step)
