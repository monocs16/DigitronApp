## ADDED Requirements

### Requirement: Service order aggregate
The system SHALL represent a service order linking a customer, an equipment unit, and an assigned
technician, with a human-readable order number, reported fault, current stage, intake date,
delivery date, authorization flag, and closing notes.

#### Scenario: Open a new order
- **WHEN** an `administrativo` opens an order for a customer + equipment and assigns a technician
- **THEN** the order is created with a generated order number and stage `intake`

#### Scenario: Order number is generated
- **WHEN** an order is created without an explicit order number
- **THEN** the system assigns a unique sequential number scoped to the current year

### Requirement: BPMN workflow state machine
The system SHALL move an order through the stages Intake → Technical Evaluation → Budget/Approval
→ Customer Decision → Repair → Payment → Delivery → Close, only allowing transitions defined by
the workflow, and SHALL record each stage change in the audit trail.

#### Scenario: Valid forward transition
- **WHEN** an order in `evaluation` has a completed evaluation and a budget is generated
- **THEN** the order may advance to the `customer_decision` stage

#### Scenario: Invalid transition blocked
- **WHEN** a user attempts to move an order directly from `intake` to `repair`
- **THEN** the transition is rejected

### Requirement: Customer decision branch
On the budget, the system SHALL capture the customer decision as Approved, Deferred, or Rejected,
and route the order accordingly: Approved → repair; Deferred → on-hold loop awaiting part or
authorization, returning to the decision; Rejected → close.

#### Scenario: Approved proceeds to repair
- **WHEN** the customer decision is recorded as Approved
- **THEN** the order advances to `repair`

#### Scenario: Deferred holds the order
- **WHEN** the customer decision is recorded as Deferred with a reason
- **THEN** the order is placed on hold and can later return to the decision step

#### Scenario: Rejected closes the order
- **WHEN** the customer decision is recorded as Rejected
- **THEN** the order advances directly to `close`

### Requirement: Warranty order linkage
The system SHALL allow opening a new warranty order linked to an originating order via
`warranty_origin_id`, reusing the original customer and equipment.

#### Scenario: Open warranty order from a closed order
- **WHEN** a user opens a warranty order from a closed order
- **THEN** a new order is created referencing the original order, customer, and equipment
