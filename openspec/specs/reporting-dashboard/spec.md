## ADDED Requirements

### Requirement: Pending-action inbox

The dashboard SHALL show each user a list of orders awaiting their action, scoped by role, stage
and assignment, so each role sees only what is on their plate in the workflow.

#### Scenario: Administrativo inbox

- **WHEN** an `administrativo` opens the dashboard
- **THEN** they see orders awaiting administrative action (intake, budget, customer_decision,
  payment, awaiting_withdrawal)

#### Scenario: Technician inbox

- **WHEN** a `tecnico` opens the dashboard
- **THEN** they see only orders assigned to them at the `evaluation` or `repair` stage

#### Scenario: Super sees all pending actions

- **WHEN** a `super` opens the dashboard
- **THEN** they see all orders awaiting any action

#### Scenario: Inbox entry links to the order

- **WHEN** a user clicks an order in the inbox
- **THEN** they are taken to that order's detail at its current stage

### Requirement: Configurable service-order reports

The system SHALL provide authorized users with an RLS-scoped service-order list whose headers can
be selected from order, customer, equipment, evaluation, budget, repair, and payment data.

#### Scenario: Select and reorder report headers

- **WHEN** an authorized user selects report headers and changes their order
- **THEN** the result table shows exactly those headers in the requested order

#### Scenario: Apply typed logical filters

- **WHEN** an authorized user combines text, number, date, empty-value, or boolean conditions with
  AND groups and OR alternatives
- **THEN** only orders satisfying the logical expression remain in the list

### Requirement: Ordered report exports

The system SHALL export the currently filtered list with the selected header order as CSV, Excel,
or PDF.

#### Scenario: Export the current report

- **WHEN** an authorized user chooses CSV, Excel, or PDF
- **THEN** the downloaded file contains the filtered rows and the headers in the same order as the
  visible table

#### Scenario: Spreadsheet text is exported safely

- **WHEN** a CSV or Excel text value resembles a spreadsheet formula
- **THEN** the export treats it as literal text rather than an executable formula

### Requirement: Reports respect access

#### Scenario: Technician cannot open reports

- **WHEN** a `tecnico` without Reportes access attempts to open `/reports`
- **THEN** the application redirects them away and database RLS remains the data boundary
