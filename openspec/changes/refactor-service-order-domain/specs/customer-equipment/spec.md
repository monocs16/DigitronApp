## ADDED Requirements

### Requirement: Customer records

The system SHALL store customers with name, tax id (CedulaRUC), two phone numbers, email,
address, and registration date. Customers MAY be created and edited by `administrativo` and `super`.

#### Scenario: Create customer with full details

- **WHEN** an `administrativo` saves a customer with name, tax id, phones, email, and address
- **THEN** the customer is persisted with a registration timestamp

#### Scenario: Required field validation

- **WHEN** a customer is submitted without a name
- **THEN** the system rejects it with a validation error (enforced in the form and the server function)

### Requirement: Equipment records

The system SHALL store equipment linked to a customer, with type, brand, model, serial number,
accessories, purchase invoice, store of purchase, and purchase date.

#### Scenario: Register equipment for a customer

- **WHEN** an `administrativo` registers equipment under an existing customer
- **THEN** the equipment is persisted and associated with that customer

#### Scenario: Technician read-only on equipment

- **WHEN** a `tecnico` views equipment
- **THEN** the records are visible but not editable (CONSULTA)

### Requirement: Equipment service history by serial number

The system SHALL allow looking up the full service-order history of an equipment unit by its
serial number, ordered from newest to oldest.

#### Scenario: Lookup history

- **WHEN** a user searches by an equipment serial number that has prior orders
- **THEN** the system returns all related service orders most-recent first
