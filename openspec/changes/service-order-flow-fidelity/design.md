# Design — service-order-flow-fidelity

## Context
The order detail (`src/routes/_authenticated/orders/$orderId.tsx`) is a flat hub built during the
schema migration: all sections render at once and stage advances via a generic button list. The
schema already models the flow's data (`source`, `authorized`, `received_by`, `delivery_at`,
`closing_notes`, `repairs.state`, `order_parts.in_stock_at_registration`, `warranty_origin_id`),
and `src/lib/state-machine.ts` already encodes the BPMN transitions. This change wires the UX and
server-side behavior to the BPMN flow without re-architecting the data layer.

## Goals / Non-Goals
**Goals**: guided per-role stage UX; customer-decision auto-routing; capture order origin; recorded
(not emailed) customer notifications; surface the unused fields; correct stage ownership per
swimlane; per-role pending-action inbox.
**Non-Goals**: real email/notification infrastructure (deferred); a client self-service portal
(deferred); changes to inventory/stock, audit, or warranty mechanics (already done); reworking RLS.

## Decisions
- **Notifications = recorded timestamps, no email.** Add nullable `orders.decision_notified_at` and
  `orders.delivery_notified_at`; a server function stamps them; UI shows "notified at …" and warns
  email is pending. *Alternative: a `notifications` table or real email (Resend/SMTP) — rejected:
  out of scope, no infra, design already defers the client-comms surface.*
- **Order origin via `orders.source`.** Captured at intake as a simple select. *Alternative: client
  portal that creates the request — rejected: deferred future work.*
- **Decision auto-routing via a server function.** `recordBudgetDecision` sets the budget decision
  (+`deferred_reason`), sets `orders.authorized` on Approved, and advances the stage through the
  existing `canTransition` gates (approved→repair, deferred→on_hold, rejected→closed). *Alternative:
  keep separate manual stage button — rejected: not faithful, error-prone.*
- **Guided UX by reorganizing, not rewriting.** New `order-stage-stepper.tsx` + a current-step
  panel; existing section bodies (evaluation/budget/repair/payments/parts/photos/history) are
  reused, shown read-only when past and locked when future. *Alternative: rewrite sections —
  rejected: wasteful.*
- **Stage ownership in the state machine.** `STAGE_ACTOR_ROLES`: `budget` += `tecnico` (tech
  completes evaluation → budget); `evaluation` = `[administrativo]` (admin completes intake).
- **Privileged steps as server functions; CRUD stays direct client + RLS.** New
  `recordBudgetDecision`, `notifyCustomer`, `deliverOrder`, `closeOrder` in
  `src/lib/orders.functions.ts` reuse `requireSupabaseAuth` + the state machine (like
  `transitionOrder`). Reuse-first pattern unchanged elsewhere.

## Architecture Context
- **Data / migrations + RLS**: additive migration `supabase/migrations/<ts>_flow_notifications.sql`
  (two nullable `timestamptz`); regenerate `src/integrations/supabase/types.ts`
  (`supabase gen types typescript --local`). Existing RLS already authorizes these `orders` updates
  (admin/super; assigned `tecnico`); the audit trigger records the new columns. Server functions
  additionally gate notifications/decision/delivery/close to the owning roles.
- **Server functions** (zod-validated, `requireSupabaseAuth`): `recordBudgetDecision`,
  `notifyCustomer({ kind })`, `deliverOrder({ received_by })`, `closeOrder({ closing_notes })`.
  Contracts documented in `docs/api-spec.yml`.
- **Frontend**: `order-stage-stepper.tsx` (new), `$orderId.tsx` (guided layout), `dashboard.tsx`
  (inbox), `orders/new.tsx` (origin select), `src/locales/{es,en}.ts` (parity).

## Error Response Format
Server functions validate input with zod (`.parse` → thrown error) and throw `Error(message)` on
authorization/state-machine/gate failures; TanStack Start serializes a thrown error as a non-2xx
response whose message is surfaced to the user via `sonner` toast. Representative messages:
- `"Transition not allowed."` (state machine / gate)
- `"Only super users can manage users."` style role checks → `"…only administrativo/super…"`
- zod field errors → surfaced verbatim. No new error envelope is introduced (matches existing
  `orders.functions.ts` / `users.functions.ts`).

## Risks / Trade-offs
- Recorded-but-not-sent notifications could be misread as "email sent" → **Mitigation**: explicit
  "email pending implementation" notice in the toast and near the timestamp.
- Base capability specs are unarchived (in `refactor-service-order-domain`) → **Mitigation**: use
  ADDED requirements; reconcile at sync/archive.
- Guided UX hides actions by stage; a stuck order could feel "locked" → **Mitigation**: `super`
  retains full advance ability; clear current-step labeling.

## Migration Plan
Additive only (two nullable columns); no data backfill, no destructive change. Rollback = drop the
two columns. Apply locally via `supabase db reset`/migration on the dev stack; remote applies on
next deploy. No RLS changes.

## Open Questions
None blocking — the three scoping decisions (notifications, origin, guided UX) are resolved.
