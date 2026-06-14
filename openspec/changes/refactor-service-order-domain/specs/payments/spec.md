## ADDED Requirements

### Requirement: Payment registration
The system SHALL allow an `administrativo` to register one or more payments against an order, each
with amount, payment method, optional reference, payment date, and the registering user.

#### Scenario: Register a payment
- **WHEN** an `administrativo` registers a payment for an order
- **THEN** the payment is stored linked to the order with its method, reference, and date

#### Scenario: Payment total visible on order
- **WHEN** an order has multiple payments
- **THEN** the order view shows the total paid and the outstanding balance against the budget total

### Requirement: Delivery gate on payment
The system SHALL require the order's outstanding balance to be settled (or explicitly waived by a
`super`/`administrativo`) before the order can be marked delivered.

#### Scenario: Block delivery with outstanding balance
- **WHEN** a user attempts to mark an order delivered while a balance remains and no waiver is set
- **THEN** the transition is rejected
