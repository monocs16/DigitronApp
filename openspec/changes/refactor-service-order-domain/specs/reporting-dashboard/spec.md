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
The system SHALL provide reports over a selectable date range covering order throughput, revenue
from payments, parts consumption, and warranty orders, exportable to a printable document.

#### Scenario: Revenue report for a date range
- **WHEN** an authorized user selects a date range and runs the revenue report
- **THEN** the system shows payments totals for that range and offers a printable export

#### Scenario: Reports respect access
- **WHEN** a `tecnico` (no Reportes access per the matrix) attempts to open reports
- **THEN** access is denied
