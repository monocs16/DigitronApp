---
description: Canonical service-order business process for Digitron. All workflow implementations (state machine, UI actions, server functions, RLS policies) must conform to this flow. Update this document first whenever the process changes.
alwaysApply: true
---

# Service Order Business Flow

This is the **single source of truth** for the service-order lifecycle at Digitron. Any code that drives stage transitions, role permissions, or UI actions must match this diagram. Update this document **before** changing implementation.

## Process Diagram

```mermaid
---
config:
  layout: dagre
---
flowchart TD
  subgraph ClienteLane[Cliente]
    CL1[Solicita servicio]
  end

  subgraph AdminLane[Administrativo]
    A1[Registrar orden]
    A2[Registrar cliente y equipo]
    A3[Asignar técnico]
    A4[Generar presupuesto]
    A5[Notificar decisión al cliente]
    A6[Registrar pago]
    A7[Notificar entrega]
    A8[Cerrar orden]
  end

  subgraph TecLane[Técnico]
    T1[Recibir orden]
    T2[Evaluación técnica]
    T3[Generar diagnóstico y lista de piezas]
    T4[Verificar stock]
    T5[Ejecutar reparación]
    T6[Registrar piezas usadas y trabajo]
    T7[Marcar reparación concluida]
  end

  subgraph GarantiaLane[Gestión de Garantía]
    G1[Abrir nueva orden por garantía]
    G2[Consultar historial por serie]
  end

  CL1 --> A1
  A1 --> A2
  A2 --> A3
  A3 --> T1
  T1 --> T2
  T2 --> T3
  T3 --> T4

  T4 -- Hay stock --> A4
  T4 -- No hay stock --> A4

  A4 --> A5
  A5 --> CL_DEC{Cliente decide}

  CL_DEC -- Aprobado --> T5
  CL_DEC -- Aplazado --> A9[Orden en espera por repuesto o autorización]
  CL_DEC -- Reprobado --> A8

  T5 --> T6
  T6 --> T7
  T7 --> A6

  A6 --> A7
  A7 --> A8
  A9 --> CL_DEC

  A8 --> Z[Fin]
  A8 --> G1
  G1 --> G2
  G2 --> A1

  classDef admin fill:#e8f4ff,stroke:#1f78b4;
  classDef tech fill:#fff0d9,stroke:#d97706;
  classDef client fill:#e6ffe6,stroke:#2d7a2d;

  class A1,A2,A3,A4,A5,A6,A7,A8 admin;
  class T1,T2,T3,T4,T5,T6,T7 tech;
  class CL1 client;
```

## Stage-to-Actor Mapping

| Stage (code)        | Owning actor      | Action                                        |
| ------------------- | ----------------- | --------------------------------------------- |
| `intake`            | administrativo    | Register order, assign technician             |
| `evaluation`        | tecnico           | Technical evaluation + parts diagnosis        |
| `budget`            | administrativo    | Generate budget, verify stock                 |
| `customer_decision` | administrativo    | Notify client; capture Approved/Deferred/Rejected |
| `on_hold`           | —                 | Waiting for part or client authorization      |
| `repair`            | tecnico           | Execute repair, log used parts + labor        |
| `payment`           | administrativo    | Register payment(s)                           |
| `delivered`         | administrativo    | Notify client of pickup                       |
| `closed`            | administrativo    | Close order; may open warranty order          |

## Decision Branches

| Decision   | Next stage   | Notes                                              |
| ---------- | ------------ | -------------------------------------------------- |
| Approved   | `repair`     | Budget authorized; technician starts work          |
| Deferred   | `on_hold`    | Waiting for part/auth; loops back to `customer_decision` |
| Rejected   | `closed`     | Order closed without repair                        |

## Warranty Path

After `closed`, administrativo may open a new order linked to the original via `warranty_origin_id`. The warranty flow uses the same stages starting from `intake`, with equipment history visible via serial-number lookup.

## Implementation Constraints

- `src/lib/state-machine.ts` — `STAGE_TRANSITIONS` and `STAGE_ACTOR_ROLES` must match the table above exactly.
- `src/lib/orders.functions.ts` — server-side transition guards enforce role + gate checks before any stage advance.
- RLS policies (`supabase/migrations/*_rls.sql`) encode read/write boundaries per role per stage.
- UI action buttons in `orders/$orderId.tsx` (`currentStepContent`) are gated by `canTransition` and must reflect the owning actor column above.
