## ADDED Requirements

### Requirement: Pending-action inbox

The dashboard SHALL show each user a list of orders awaiting their action, scoped by role, stage
and assignment, so each role sees only what is on their plate in the workflow.

#### Scenario: Administrativo inbox

- **WHEN** an `administrativo` opens the dashboard
- **THEN** they see orders awaiting administrative action (intake, budget, customer_decision,
  payment, delivered)

#### Scenario: Technician inbox

- **WHEN** a `tecnico` opens the dashboard
- **THEN** they see only orders assigned to them at the `evaluation` or `repair` stage

#### Scenario: Super sees all pending actions

- **WHEN** a `super` opens the dashboard
- **THEN** they see all orders awaiting any action

#### Scenario: Inbox entry links to the order

- **WHEN** a user clicks an order in the inbox
- **THEN** they are taken to that order's detail at its current stage
