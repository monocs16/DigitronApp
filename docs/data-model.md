# Data Model — Digitron

Single source of truth for the domain entities, relationships, business flow, and the
role/permission matrix. Schema is implemented in Supabase (PostgreSQL) SQL migrations;
authorization is enforced with Row Level Security (RLS) policies that mirror the matrix below.

> Entity/attribute names below use the original domain (Spanish) identifiers as captured in the
> ER source. Application code, comments, and new artifacts must be in English per project standards;
> when generating SQL/TypeScript, map these to the agreed physical naming convention.

## 1. Domain overview

Digitron manages the lifecycle of an electronics/equipment **repair service order**. The core
aggregate is the **Service Order** (`ORDENSERVICIO`), which ties together a customer, a piece of
equipment, and an assigned technician, and progresses through evaluation, budgeting, repair,
payment, and closing — with a dedicated warranty path.

## 2. Entities

### CLIENTE (Customer)

| Field         | Type     | Notes         |
| ------------- | -------- | ------------- |
| IdCliente     | int      | PK            |
| Nombre        | string   |               |
| CedulaRUC     | string   | Tax/ID number |
| Telefono1     | string   |               |
| Telefono2     | string   |               |
| Correo        | string   |               |
| Direccion     | string   |               |
| FechaRegistro | datetime |               |

### EQUIPO (Equipment)

| Field         | Type     | Notes                                            |
| ------------- | -------- | ------------------------------------------------ |
| IdEquipo      | int      | PK                                               |
| Marca         | string   | Brand                                            |
| Modelo        | string   | Model                                            |
| NumeroSerie   | string   | Serial number — used for warranty history lookup |
| TipoEquipo    | string   |                                                  |
| FacturaCompra | string   | Purchase invoice                                 |
| TiendaCompra  | string   | Store of purchase                                |
| FechaCompra   | datetime |                                                  |

### ORDENSERVICIO (Service Order) — core aggregate

| Field                  | Type     | Notes                                                |
| ---------------------- | -------- | ---------------------------------------------------- |
| IdOrden                | int      | PK                                                   |
| IdCliente              | int      | FK → CLIENTE                                         |
| IdEquipo               | int      | FK → EQUIPO                                          |
| IdTecnicoAsignado      | int      | FK → USUARIO (assigned technician)                   |
| Procedencia            | string   | Source/origin                                        |
| Atencion               | string   |                                                      |
| ReporteFalla           | string   | Reported fault                                       |
| EstadoEquipo           | string   | Condition of the equipment when received             |
| AccesoriosRecibidos    | string   | Accessories received for this specific visit         |
| EstadoOrden            | string   | Order state (intake → … → closed)                    |
| ObservacionesGenerales | string   |                                                      |
| Garantia               | string   | Warranty flag/notes                                  |
| IdOrdenGarantiaOrigen  | int      | FK → ORDENSERVICIO (self-ref: warranty origin order) |
| FechaIngreso           | datetime | Intake date                                          |
| FechaEntrega           | datetime | Delivery date                                        |
| Autorizado             | boolean  | Customer authorization                               |
| RecibidoPor            | string   |                                                      |
| ObsCierre              | string   | Closing notes                                        |
| UsuarioCreacion        | string   |                                                      |

### EVALUACIONTECNICA (Technical Evaluation)

| Field                 | Type     | Notes              |
| --------------------- | -------- | ------------------ |
| IdEvaluacion          | int      | PK                 |
| IdOrden               | int      | FK → ORDENSERVICIO |
| IdTecnico             | int      | FK → USUARIO       |
| FechaEvaluacion       | datetime |                    |
| Diagnostico           | string   | Diagnosis          |
| ObservacionesTecnicas | string   |                    |

### PIEZA (Part / Inventory item)

| Field         | Type   | Notes            |
| ------------- | ------ | ---------------- |
| IdPieza       | int    | PK               |
| CodigoParte   | string | Part code        |
| Descripcion   | string |                  |
| Stock         | int    | On-hand quantity |
| CostoUnitario | float  | Unit cost        |
| Proveedor     | string | Supplier         |

### ORDENPIEZA (Order ↔ Part line item)

| Field                 | Type    | Notes                                   |
| --------------------- | ------- | --------------------------------------- |
| IdOrdenPieza          | int     | PK                                      |
| IdOrden               | int     | FK → ORDENSERVICIO                      |
| IdEvaluacion          | int     | FK → EVALUACIONTECNICA                  |
| IdPieza               | int     | FK → PIEZA                              |
| Etapa                 | string  | Stage (e.g. quoted vs used)             |
| Cantidad              | int     | Quantity                                |
| CostoUnitarioRegistro | float   | Unit cost captured at registration time |
| DisponibleEnStock     | boolean | In-stock at registration                |
| NumeroParteProveedor  | string  | Supplier part number                    |

### PRESUPUESTO (Budget / Quote)

| Field              | Type     | Notes                          |
| ------------------ | -------- | ------------------------------ |
| IdPresupuesto      | int      | PK                             |
| IdOrden            | int      | FK → ORDENSERVICIO             |
| CostoManoObra      | float    | Labor cost                     |
| CostoRepuestos     | float    | Parts cost                     |
| CostoFlete         | float    | Freight                        |
| OtrosCargos        | float    | Other charges                  |
| Adelantos          | float    | Advances/deposits              |
| DecisionCliente    | string   | Approved / Deferred / Rejected |
| MotivoAplazado     | string   | Reason if deferred             |
| FechaDecision      | datetime |                                |
| ComentariosCliente | string   |                                |
| FechaPresupuesto   | datetime |                                |

### REPARACION (Repair)

| Field              | Type     | Notes              |
| ------------------ | -------- | ------------------ |
| IdReparacion       | int      | PK                 |
| IdOrden            | int      | FK → ORDENSERVICIO |
| IdTecnico          | int      | FK → USUARIO       |
| FechaInicio        | datetime |                    |
| FechaFin           | datetime |                    |
| DescripcionTrabajo | string   | Work description   |
| EstadoReparacion   | string   |                    |

### PAGO (Payment)

| Field           | Type     | Notes              |
| --------------- | -------- | ------------------ |
| IdPago          | int      | PK                 |
| IdOrden         | int      | FK → ORDENSERVICIO |
| Monto           | float    | Amount             |
| MetodoPago      | string   | Method             |
| ReferenciaPago  | string   | Reference          |
| FechaPago       | datetime |                    |
| UsuarioRegistro | string   |                    |

### USUARIO (User / Staff)

| Field          | Type    | Notes                                           |
| -------------- | ------- | ----------------------------------------------- |
| IdUsuario      | int     | PK                                              |
| NombreUsuario  | string  | Username                                        |
| NombreCompleto | string  |                                                 |
| PasswordHash   | string  |                                                 |
| Email          | string  |                                                 |
| Rol            | string  | One of: Cliente, Administrativo, Tecnico, Super |
| Activo         | boolean |                                                 |

### AUDIT_LOG (Change audit)

| Field          | Type        | Notes                    |
| -------------- | ----------- | ------------------------ |
| id             | bigint      | PK                       |
| change_ts      | timestamptz |                          |
| schema_name    | text        |                          |
| table_name     | text        |                          |
| operation      | text        | INSERT / UPDATE / DELETE |
| db_user        | text        |                          |
| app_user       | text        |                          |
| record_pk      | jsonb       |                          |
| column_name    | text        |                          |
| old_value      | text        |                          |
| new_value      | text        |                          |
| changed_fields | jsonb       |                          |
| full_row_old   | jsonb       |                          |
| full_row_new   | jsonb       |                          |

## 3. Relationships

- `CLIENTE` 1—N `ORDENSERVICIO` (creates)
- `EQUIPO` 1—N `ORDENSERVICIO` (associated with)
- `ORDENSERVICIO` 1—N `ORDENSERVICIO` (warranty of — self reference via `IdOrdenGarantiaOrigen`)
- `ORDENSERVICIO` 1—1 `EVALUACIONTECNICA` (has)
- `ORDENSERVICIO` 1—1 `PRESUPUESTO` (generates)
- `ORDENSERVICIO` 1—1 `REPARACION` (has)
- `ORDENSERVICIO` 1—N `PAGO` (registers)
- `ORDENSERVICIO` 1—N `ORDENPIEZA` (includes)
- `EVALUACIONTECNICA` 1—N `ORDENPIEZA` (quotes)
- `PIEZA` 1—N `ORDENPIEZA` (referenced by)
- `USUARIO` 1—N `EVALUACIONTECNICA` (evaluates)
- `USUARIO` 1—N `REPARACION` (repairs)
- `USUARIO` 1—N `ORDENSERVICIO` (assigned)
- `AUDIT_LOG` records changes for all operational tables (CLIENTE, EQUIPO, ORDENSERVICIO,
  ORDENPIEZA, PIEZA, PRESUPUESTO, REPARACION, PAGO, USUARIO).

## 4. Business flow (lanes: Customer → Admin → Technician → Warranty)

1. Customer requests service. The request **origin** is recorded on the order (`source`:
   counter / phone / web / other); there is no customer self-service portal (deferred).
2. Admin registers the order, the customer & equipment, and assigns a technician.
3. Technician receives the order → technical evaluation → diagnosis + parts list → check stock
   (stock availability is shown as a flag and does **not** block budgeting).
4. Admin generates the budget (regardless of stock availability) and **notifies the customer**.
5. **Customer decision** (recorded by admin; **auto-routes** the order):
   - **Approved** → sets `authorized` → repair → register used parts & work → mark repair complete →
     payment → delivery notification → close order.
   - **Deferred** (reason required) → order on hold (awaiting part/authorization) → returns to
     customer decision.
   - **Rejected** → close order directly.
6. On close, a **warranty order** may be opened: it looks up history by serial number and starts
   a new order linked to the original via `IdOrdenGarantiaOrigen`.

**Presentation & ownership.** The order is presented as a **guided, stage-driven** flow: each
stage exposes a single action for the role that owns it (admin: intake/budget/decision/payment/
delivery/close; assigned technician: evaluation, repair), completed stages are read-only and
future stages are locked. The dashboard gives each role a **pending-action inbox**.

**Notifications.** "Notify customer" at the decision and delivery steps is a **recorded action**:
the system stamps `orders.decision_notified_at` / `orders.delivery_notified_at` (audited) and the
UI shows it. **Actual email delivery is pending implementation** — the UI states this explicitly.

## 5. Role / permission matrix

Permission levels: **CONSULTA** (read) · **MODIFICACION** (edit) · **INGRESO** (create) · blank = no access.
The "Orden Servicio" module is split into the workflow stages Apertura, Evaluación Técnica,
Presupuesto/Aprobación, Reparación, Cierre.

| Module                      | Cliente  | Super        | Administrativo | Técnico  |
| --------------------------- | -------- | ------------ | -------------- | -------- |
| Público                     | Consulta | Consulta     | Consulta       | Consulta |
| Clientes                    | —        | Modificación | Modificación   | —        |
| Equipo                      | —        | Modificación | Modificación   | Consulta |
| Reportes                    | —        | Consulta     | Consulta       | —        |
| Inventario                  | —        | Modificación | Modificación   | Consulta |
| OS · Apertura               | —        | Modificación | Ingreso        | —        |
| OS · Evaluación Técnica     | —        | Modificación | Consulta       | Ingreso  |
| OS · Presupuesto/Aprobación | —        | Modificación | Ingreso        | —        |
| OS · Reparación             | —        | Modificación | Consulta       | Ingreso  |
| OS · Cierre                 | —        | Modificación | Ingreso        | —        |
| Tablero                     | —        | Consulta     | Consulta       | Consulta |
| Seguridad                   | —        | Modificación | Consulta       | —        |

Notes:

- **Super** is the superuser (edit-all; only role with real access to Seguridad).
- **Administrativo** opens, budgets, and closes orders; manages customers/equipment/inventory.
- **Técnico** only _creates_ in Evaluation and Repair (matches the technician lane in the flow);
  read-only on equipment/inventory.
- **Cliente** sees only public content.
- These rules MUST be enforced server-side via Supabase RLS policies, not only in the UI.
