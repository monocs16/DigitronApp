## ADDED Requirements

### Requirement: Operational dashboard (Tablero)

The system SHALL present a role-scoped dashboard summarizing orders by workflow stage, orders
assigned to the current technician, orders awaiting parts/authorization, and key counters
(open orders, ready for delivery, overdue).

#### Scenario: Technician dashboard scope

- **WHEN** a `tecnico` opens the dashboard
- **THEN** it highlights orders assigned to them and their pending evaluation/repair work

#### Scenario: Administrative dashboard scope

- **WHEN** an `administrativo` or `super` opens the dashboard
- **THEN** it shows shop-wide counters and stage distribution

### Requirement: Reports (Reportes)

The system SHALL provide an RLS-scoped, configurable service-order list. Authorized users SHALL be
able to select and reorder headers from order and related records, combine typed conditions with
AND/OR logic, and export the filtered result as CSV, Excel, or PDF.

#### Scenario: Configure and filter a report

- **WHEN** an authorized user selects headers, changes their order, and applies text, number, date,
  empty-value, or boolean conditions
- **THEN** the system shows only matching orders with the requested header order

#### Scenario: Export a configured report

- **WHEN** an authorized user exports the current report as CSV, Excel, or PDF
- **THEN** the downloaded file preserves the visible filters and header order

#### Scenario: Reports respect access

- **WHEN** a `tecnico` (no Reportes access per the matrix) attempts to open reports
- **THEN** access is denied
