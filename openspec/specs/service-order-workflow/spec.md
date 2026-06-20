## ADDED Requirements

### Requirement: Order origin captured at intake

The system SHALL capture the origin of each service request (`orders.source`) when an order is
opened (e.g. counter, phone, web), representing the customer's request step without a client login.

#### Scenario: Capture origin on open

- **WHEN** an `administrativo` opens an order and selects an origin
- **THEN** `orders.source` is stored and shown in the order summary

#### Scenario: Origin optional but recorded

- **WHEN** an order is opened without choosing an origin
- **THEN** the order is created with no origin and the summary shows it as unspecified

### Requirement: Customer decision routes the order

Recording the budget decision SHALL advance the order automatically along the matching branch,
without a separate manual stage action: Approved → `repair`, Deferred → `on_hold`, Rejected →
`closed`. Deferred SHALL require a reason. Approved SHALL set `orders.authorized` to true.

#### Scenario: Approved routes to repair

- **WHEN** an `administrativo` records the decision as Approved on a budgeted order
- **THEN** `orders.authorized` becomes true and the order moves to `repair`

#### Scenario: Deferred requires a reason and holds

- **WHEN** Deferred is recorded without a reason
- **THEN** the action is rejected
- **WHEN** Deferred is recorded with a reason
- **THEN** the reason is stored and the order moves to `on_hold`

#### Scenario: Rejected closes the order

- **WHEN** an `administrativo` records the decision as Rejected
- **THEN** the order moves to `closed`

### Requirement: Guided stage progression

The order detail SHALL present the workflow as discrete stages where only the current stage's
action is actionable, completed stages are read-only, and stages not yet reached are locked.

#### Scenario: Current step is actionable

- **WHEN** a user opens an order
- **THEN** only the current stage's action is available and earlier stages are shown read-only

#### Scenario: Future stage is locked

- **WHEN** a stage has not yet been reached
- **THEN** its actions are unavailable

### Requirement: Stage ownership by role

The system SHALL restrict who may advance each stage to the role that owns it: `administrativo`
opens intake and advances intake → evaluation; the assigned `tecnico` advances evaluation → budget
and repair → payment; `administrativo` advances budget, customer decision, delivery and close;
`super` may advance any stage.

#### Scenario: Technician advances evaluation to budget

- **WHEN** the assigned `tecnico` completes the evaluation
- **THEN** they advance the order to `budget`

#### Scenario: Non-owner is blocked

- **WHEN** a role that does not own a stage attempts to advance it
- **THEN** the transition is rejected server-side

### Requirement: Delivery and close capture handover details

The system SHALL record `received_by` and `delivery_at` when an order is delivered, and
`closing_notes` when an order is closed.

#### Scenario: Delivery records the receiver

- **WHEN** an `administrativo` delivers an order with a balance settled or waived
- **THEN** `received_by` and `delivery_at` are stored and the order moves to `delivered`

#### Scenario: Close records notes

- **WHEN** an `administrativo` closes an order
- **THEN** `closing_notes` is stored and the order moves to `closed`
