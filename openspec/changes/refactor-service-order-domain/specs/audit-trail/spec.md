## ADDED Requirements

### Requirement: Generic change audit log
The system SHALL maintain a table-agnostic audit log capturing INSERT, UPDATE, and DELETE
operations on all operational tables (customers, equipment, orders, evaluations, budgets, repairs,
payments, parts, order-parts, user_roles), recording timestamp, table name, operation, the acting
application user, the record primary key, changed fields, and old/new row snapshots.

#### Scenario: Update is audited
- **WHEN** any operational row is updated
- **THEN** an audit entry is written with the table name, the changed fields, and old/new values

#### Scenario: Insert and delete are audited
- **WHEN** an operational row is inserted or deleted
- **THEN** an audit entry records the operation, the record primary key, and the full row snapshot

### Requirement: Audit visibility
The system SHALL allow `super` (and `administrativo` per the matrix) to view the audit history of a
given order or record, most-recent first; audit entries SHALL be read-only and never editable.

#### Scenario: View order audit history
- **WHEN** an authorized user opens an order's history
- **THEN** the related audit entries are listed newest-first and cannot be modified
