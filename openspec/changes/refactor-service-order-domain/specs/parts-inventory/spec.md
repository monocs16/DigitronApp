## ADDED Requirements

### Requirement: Parts catalog
The system SHALL maintain a parts catalog where each part has a part code, description, current
stock, unit cost, and supplier. `administrativo` and `super` MAY edit; `tecnico` has read access.

#### Scenario: Create a catalog part
- **WHEN** an `administrativo` creates a part with code, description, unit cost, and supplier
- **THEN** the part is stored with an initial stock value

#### Scenario: Technician read-only
- **WHEN** a `tecnico` opens the inventory module
- **THEN** parts are visible but not editable

### Requirement: Order-part line items
The system SHALL record order-part line items linking a part to an order (and optionally an
evaluation), with a stage (`quoted` or `used`), quantity, the unit cost captured at registration
time, an in-stock-at-registration flag, and an optional supplier part number.

#### Scenario: Quoted line captures historical unit cost
- **WHEN** a part is added to an order as a `quoted` line
- **THEN** the line stores the part's current unit cost so later catalog price changes do not alter it

### Requirement: Stock adjustments
The system SHALL decrement stock when parts are consumed (repair `used` lines) and SHALL allow
`administrativo`/`super` to adjust stock manually, with every change recorded in the audit trail.

#### Scenario: Manual restock
- **WHEN** an `administrativo` increases a part's stock by 10
- **THEN** the new stock is persisted and the change is recorded in the audit trail

#### Scenario: Low-stock visibility
- **WHEN** a part's stock reaches zero or a configured threshold
- **THEN** the inventory view flags the part as low/out of stock
