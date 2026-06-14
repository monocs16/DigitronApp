## ADDED Requirements

### Requirement: Technical evaluation record
The system SHALL allow a `tecnico` to register a technical evaluation for an order, capturing the
diagnosis, technical observations, the evaluating technician, and an evaluation date.

#### Scenario: Technician submits an evaluation
- **WHEN** the assigned `tecnico` submits a diagnosis and notes for an order in `evaluation`
- **THEN** the evaluation is stored linked to the order and technician with a timestamp

#### Scenario: Only assigned technician or admin can evaluate
- **WHEN** a technician who is not assigned to the order attempts to submit an evaluation
- **THEN** the operation is rejected by RLS

### Requirement: Needed-parts list from evaluation
The system SHALL allow the evaluation to produce a list of needed parts (order-part line items in
the `quoted` stage), each referencing a catalog part with a quantity.

#### Scenario: Add needed parts during evaluation
- **WHEN** the technician adds parts to the evaluation
- **THEN** order-part line items are created in the `quoted` stage referencing the order and evaluation

### Requirement: Stock availability check
After the needed-parts list is produced, the system SHALL indicate for each line whether the part
is currently available in stock.

#### Scenario: Mark availability
- **WHEN** the needed-parts list is reviewed against inventory
- **THEN** each line shows whether sufficient stock exists, without blocking budget generation
