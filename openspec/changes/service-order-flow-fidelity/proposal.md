## Why

The schema migration (`refactor-service-order-domain`) made the app work on the new data model,
but the order detail is a flat **hub** that shows every section at once and advances through
generic stage buttons. It does not embody the shop's BPMN flow (Cliente / Administrativo /
Técnico / Garantía swimlanes): roles are not guided to their step, the customer decision does not
route the order, and several already-modeled fields (`source`, `authorized`, `received_by`,
`delivery_at`, `closing_notes`) go unused. This change makes the order experience faithfully
follow that flow and cleans up the UX.

## What Changes

- **Guided, stage-driven order detail**: a stage stepper plus a "current step" panel that surfaces
  only the active step's action for its owning role; completed stages collapse to read-only and
  future stages are locked.
- **Customer-decision auto-routing**: recording Approved / Deferred / Rejected advances the order
  automatically (approved → `repair`, deferred → `on_hold`, rejected → `closed`) instead of a
  separate manual stage button.
- **Order origin (CL1)**: capture how the request arrived at intake via `orders.source`
  (e.g. counter / phone / web). No client login (client portal stays deferred).
- **Recorded customer notifications (A5/A7)**: an `administrativo` records that the customer was
  notified at the customer-decision step and at delivery; the system stamps the timestamp and
  shows it in the order. **Actual email sending is out of scope (deferred/pending) and the UI
  states it.**
- **Surface existing fields in the flow**: `authorized` (set on approval), `received_by` +
  `delivery_at` (captured at delivery), `closing_notes` (at close), `source` (at intake).
- **Role ownership per swimlane**: `tecnico` advances evaluation → budget (completing the
  evaluation); `administrativo` owns intake → evaluation and the remaining administrative steps.
- **Per-role "pending my action" inbox** on the dashboard (orders awaiting the current user by
  role + stage + assignment).
- Additive nullable columns `orders.decision_notified_at` and `orders.delivery_notified_at`
  (audited by the existing trigger). Not breaking.

## Capabilities

### New Capabilities
- `customer-notifications`: recording customer notifications for the budget decision and for
  delivery (timestamp + history); email delivery is explicitly deferred.

### Modified Capabilities
- `service-order-workflow`: add order origin, customer-decision auto-routing, guided stage
  progression with per-role ownership, and the notification touch-points.
- `reporting-dashboard`: add a role-scoped "pending my action" inbox.

> Note: the base capability specs currently live in the unarchived `refactor-service-order-domain`
> change (`openspec/specs/` is still empty). These delta specs therefore use **ADDED Requirements**
> and will reconcile with the base at sync/archive time.

## Impact

- **Frontend**: `src/routes/_authenticated/orders/$orderId.tsx` (guided UX), new
  `src/components/order-stage-stepper.tsx`, `src/routes/_authenticated/dashboard.tsx` (inbox),
  `src/routes/_authenticated/orders/new.tsx` (origin), `src/locales/{es,en}.ts`.
- **Backend / data**: `src/lib/state-machine.ts` (`STAGE_ACTOR_ROLES`), `src/lib/orders.functions.ts`
  (`recordBudgetDecision`, `notifyCustomer`, `deliverOrder`, `closeOrder`); additive migration in
  `supabase/migrations/` + regenerate `src/integrations/supabase/types.ts`. Existing RLS policies
  already cover the affected updates (admin/super; assigned `tecnico`).
- **APIs**: new zod-validated server functions (contracts documented in `docs/api-spec.yml`).
- **Docs**: `docs/data-model.md` §4 (flow: recorded notifications + origin) and §5 if affected.
- **Dependencies**: none new (reuses `jspdf`, existing UI primitives, audit trigger).
