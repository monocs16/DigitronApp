## ADDED Requirements

### Requirement: Budget with cost breakdown
The system SHALL allow an `administrativo` to generate a budget for an order with a cost breakdown:
labor, parts, freight, other charges, and advances, plus a budget date.

#### Scenario: Generate a budget
- **WHEN** an `administrativo` generates a budget for an order that has an evaluation
- **THEN** the budget is stored linked to the order with its cost components and date

#### Scenario: Parts cost derived from needed parts
- **WHEN** a budget is generated for an order with quoted order-part line items
- **THEN** the parts cost defaults to the sum of those line items (quantity × registered unit cost)

### Requirement: Customer decision capture
The system SHALL record the customer decision on the budget as one of Approved, Deferred, or
Rejected, with a decision date, optional customer comments, and a reason when Deferred.

#### Scenario: Record approval
- **WHEN** the customer approves the budget
- **THEN** the decision, decision date, and any comments are stored and the order workflow advances per the decision branch

#### Scenario: Deferred requires reason
- **WHEN** the customer defers the budget without a reason
- **THEN** the system rejects the decision until a reason is provided

### Requirement: Budget authorization gate for repair
The system SHALL NOT allow an order to enter `repair` unless its budget decision is Approved.

#### Scenario: Block repair without approval
- **WHEN** a user attempts to advance an order to `repair` while the budget is not Approved
- **THEN** the transition is rejected
