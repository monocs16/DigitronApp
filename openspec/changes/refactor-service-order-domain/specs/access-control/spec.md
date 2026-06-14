## ADDED Requirements

### Requirement: Four-role model
The system SHALL support exactly four roles — `cliente`, `administrativo`, `tecnico`, and `super` —
stored in a dedicated `user_roles` table (not on `profiles`), resolved through a
`SECURITY DEFINER` helper function `has_role(user_id, role)`.

#### Scenario: Role assignment persists
- **WHEN** a `super` user assigns the role `tecnico` to a user
- **THEN** the user's role is stored in `user_roles` and `has_role(user, 'tecnico')` returns true

#### Scenario: First user bootstrap
- **WHEN** the very first user is created and no roles exist yet
- **THEN** the system assigns that user the `super` role automatically

### Requirement: Module permission matrix
The system SHALL enforce the module/permission matrix from `docs/data-model.md`, where each
(role, module) pair grants one of: no access, CONSULTA (read), MODIFICACION (read+edit),
or INGRESO (read+create). Enforcement MUST occur server-side via RLS policies, not only in the UI.

#### Scenario: Technician creates an evaluation
- **WHEN** a `tecnico` submits a technical evaluation (INGRESO on the Evaluation module)
- **THEN** the insert succeeds

#### Scenario: Technician cannot open or close orders
- **WHEN** a `tecnico` attempts to create an order (Apertura) or close an order (Cierre)
- **THEN** the operation is rejected by RLS

#### Scenario: Administrative cannot manage security
- **WHEN** an `administrativo` attempts to modify roles or security settings
- **THEN** the operation is rejected; only `super` may modify the Security module

#### Scenario: Client sees only public content
- **WHEN** a `cliente` requests any operational module beyond public content
- **THEN** access is denied

### Requirement: Authenticated route protection
The system SHALL redirect unauthenticated users to `/login` for any route under `_authenticated`,
and SHALL scope visible navigation modules to the current user's role per the matrix.

#### Scenario: Unauthenticated access redirected
- **WHEN** an unauthenticated user navigates to a protected route
- **THEN** they are redirected to `/login`

#### Scenario: Navigation reflects role
- **WHEN** a `tecnico` loads the app shell
- **THEN** the sidebar shows only modules the technician role can access
