## ADDED Requirements

### Requirement: Repair record

The system SHALL allow the assigned `tecnico` to register a repair for an approved order, capturing
the work description, start and finish dates, the repairing technician, and a repair state.

#### Scenario: Start and complete a repair

- **WHEN** the assigned technician records work performed and marks the repair finished
- **THEN** the repair record is stored with start/finish dates and the order can advance toward payment

#### Scenario: Repair requires approved budget

- **WHEN** a technician attempts to register a repair for an order without an approved budget
- **THEN** the operation is rejected

### Requirement: Used-parts registration and stock consumption

The system SHALL allow the technician to register the parts actually used during repair as
order-part line items in the `used` stage, and SHALL decrement inventory stock accordingly on
repair completion.

#### Scenario: Register used parts decrements stock

- **WHEN** the technician records 2 units of a part as used and completes the repair
- **THEN** a `used` order-part line item is created and the part's stock is reduced by 2

#### Scenario: Prevent negative stock

- **WHEN** the technician records more units used than are in stock
- **THEN** the system rejects the operation or flags it, never producing negative stock
