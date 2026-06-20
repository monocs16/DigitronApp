## ADDED Requirements

### Requirement: State machine transitions are validated by unit tests
The system SHALL have unit tests covering all valid and invalid stage transitions defined in
`STAGE_TRANSITIONS`, the role-based actor gates (`STAGE_ACTOR_ROLES`), the data gates
(`gateAllows`), and the composite `allowedNextStages` / `canTransition` functions.

#### Scenario: Valid stage progression is allowed
- **WHEN** `canTransition` is called with a current stage, a target in `STAGE_TRANSITIONS[current]`, and a role authorized for that target
- **THEN** it returns `true`

#### Scenario: Skipping a stage is rejected
- **WHEN** `canTransition` is called with `current = "intake"` and `target = "budget"`
- **THEN** it returns `false` regardless of role

#### Scenario: Unauthorized role is rejected
- **WHEN** `canTransition` is called with `target = "budget"` and a role not in `STAGE_ACTOR_ROLES["budget"]` (e.g., `"cliente"`)
- **THEN** it returns `false`

#### Scenario: super role bypasses actor restrictions
- **WHEN** `canTransition` is called with a `"super"` role for any valid transition
- **THEN** it returns `true` (subject to data gates)

#### Scenario: Repair gate blocks unapproved budget
- **WHEN** `canTransition` is called with `current = "customer_decision"`, `target = "repair"`, and `budgetApproved = false`
- **THEN** it returns `false`

#### Scenario: Delivered gate blocks unsettled balance
- **WHEN** `canTransition` is called with `current = "payment"`, `target = "delivered"`, and `balanceSettled = false`
- **THEN** it returns `false`

#### Scenario: Technician without assignment is rejected
- **WHEN** `allowedNextStages` is called with role `"tecnico"` and `isAssignedTechnician = false`
- **THEN** the returned array is empty (technician cannot act on unassigned orders)

#### Scenario: Closed stage has no transitions
- **WHEN** `allowedNextStages` is called with `current = "closed"`
- **THEN** it returns an empty array for any role

---

### Requirement: Access matrix is validated by unit tests
The system SHALL have unit tests covering `levelFor`, `canRead`, `canCreate`, and `canEdit`
for all roles and a representative set of modules.

#### Scenario: Administrativo has edit access to clientes
- **WHEN** `levelFor(["administrativo"], "clientes")` is called
- **THEN** it returns `"edit"`

#### Scenario: Tecnico has no access to clientes
- **WHEN** `canRead(["tecnico"], "clientes")` is called
- **THEN** it returns `false`

#### Scenario: Multi-role composite returns highest level
- **WHEN** `levelFor(["cliente", "tecnico"], "inventario")` is called (cliente=none, tecnico=read)
- **THEN** it returns `"read"`

#### Scenario: Super has edit on all modules
- **WHEN** `canEdit(["super"], module)` is called for every module in `MODULES`
- **THEN** it returns `true` for all

#### Scenario: Empty roles returns none
- **WHEN** `levelFor([], "clientes")` is called
- **THEN** it returns `"none"`

---

### Requirement: Domain constants and label helpers are validated by unit tests
The system SHALL have unit tests covering `getStageLabel`, `getRoleLabel`, and `getDecisionLabel`
to confirm they return the i18n key fallback when no translation is provided.

#### Scenario: getStageLabel falls back to stage string
- **WHEN** `getStageLabel("intake", mockT)` is called with a `t` function that returns its key unchanged
- **THEN** it returns `"stage.intake"`

#### Scenario: getRoleLabel falls back to role string
- **WHEN** `getRoleLabel("super", mockT)` is called with a pass-through `t`
- **THEN** it returns `"roles.super"`

#### Scenario: getDecisionLabel falls back to decision string
- **WHEN** `getDecisionLabel("approved", mockT)` is called with a pass-through `t`
- **THEN** it returns `"decision.approved"`

#### Scenario: Unknown stage string falls back gracefully
- **WHEN** `getStageLabel("unknown_stage", mockT)` is called
- **THEN** it returns `"unknown_stage"` (the raw string, not an error)

---

### Requirement: Test runner is configured and integrated
The system SHALL have a `vitest.config.ts` that resolves `@/` path aliases and runs all
`src/**/__tests__/**/*.test.ts` files. A `test:unit` npm script SHALL invoke Vitest in run mode.

#### Scenario: Unit tests run with a single command
- **WHEN** `bun run test:unit` is executed
- **THEN** all unit tests pass and the command exits with code 0

#### Scenario: Path alias resolution works in tests
- **WHEN** a test file imports `import { canTransition } from "@/lib/state-machine"`
- **THEN** Vitest resolves the alias without error
