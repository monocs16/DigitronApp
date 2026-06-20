## ADDED Requirements

### Requirement: Recorded decision notification

The system SHALL allow an `administrativo` or `super` to record that the customer was notified of
the budget decision, stamping `orders.decision_notified_at`. The system SHALL NOT send an email;
email delivery is deferred and the UI MUST state that sending is pending.

#### Scenario: Record decision notification

- **WHEN** an `administrativo` records the decision notification on an order at the
  `customer_decision` stage
- **THEN** `orders.decision_notified_at` is stored, the order shows when it was notified, and a
  notice states that email sending is pending implementation

#### Scenario: No email is dispatched

- **WHEN** a decision notification is recorded
- **THEN** no email is sent and the change is captured in the audit trail

### Requirement: Recorded delivery notification

The system SHALL allow an `administrativo` or `super` to record that the customer was notified the
equipment is ready/delivered, stamping `orders.delivery_notified_at`, with email delivery deferred.

#### Scenario: Record delivery notification

- **WHEN** an `administrativo` records the delivery notification on an order at the `delivered`
  stage
- **THEN** `orders.delivery_notified_at` is stored and shown, with the same email-pending notice

### Requirement: Notification authorization

The system SHALL restrict recording customer notifications to `administrativo` and `super`.

#### Scenario: Technician cannot notify

- **WHEN** a `tecnico` views an order
- **THEN** no notify action is offered and a server-side attempt to record a notification is
  rejected
