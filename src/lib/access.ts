import type { AppRole } from "./digitron";

// Permission levels (mirrors docs/data-model.md §5):
// none < read (CONSULTA) < edit (MODIFICACION) ; create (INGRESO) implies read.
export type AccessLevel = "none" | "read" | "create" | "edit";

export const MODULES = [
  "publico",
  "clientes",
  "equipo",
  "reportes",
  "inventario",
  "os_apertura",
  "os_evaluacion",
  "os_presupuesto",
  "os_reparacion",
  "os_cierre",
  "tablero",
  "seguridad",
] as const;

export type ModuleKey = (typeof MODULES)[number];

// Source-of-truth permission matrix. Keep in sync with docs/data-model.md §5.
export const MODULE_MATRIX: Record<AppRole, Record<ModuleKey, AccessLevel>> = {
  cliente: {
    publico: "read",
    clientes: "none",
    equipo: "none",
    reportes: "none",
    inventario: "none",
    os_apertura: "none",
    os_evaluacion: "none",
    os_presupuesto: "none",
    os_reparacion: "none",
    os_cierre: "none",
    tablero: "none",
    seguridad: "none",
  },
  administrativo: {
    publico: "read",
    clientes: "edit",
    equipo: "edit",
    reportes: "read",
    inventario: "edit",
    os_apertura: "create",
    os_evaluacion: "read",
    os_presupuesto: "create",
    os_reparacion: "read",
    os_cierre: "create",
    tablero: "read",
    seguridad: "read",
  },
  tecnico: {
    publico: "read",
    clientes: "none",
    equipo: "read",
    reportes: "none",
    inventario: "read",
    os_apertura: "none",
    os_evaluacion: "create",
    os_presupuesto: "none",
    os_reparacion: "create",
    os_cierre: "none",
    tablero: "read",
    seguridad: "none",
  },
  super: {
    publico: "read",
    clientes: "edit",
    equipo: "edit",
    reportes: "read",
    inventario: "edit",
    os_apertura: "edit",
    os_evaluacion: "edit",
    os_presupuesto: "edit",
    os_reparacion: "edit",
    os_cierre: "edit",
    tablero: "read",
    seguridad: "edit",
  },
};

const RANK: Record<AccessLevel, number> = { none: 0, read: 1, create: 2, edit: 3 };

/** Highest access level the given roles have for a module. */
export function levelFor(roles: AppRole[], module: ModuleKey): AccessLevel {
  let best: AccessLevel = "none";
  for (const role of roles) {
    const lvl = MODULE_MATRIX[role]?.[module] ?? "none";
    if (RANK[lvl] > RANK[best]) best = lvl;
  }
  return best;
}

export function canRead(roles: AppRole[], module: ModuleKey): boolean {
  return RANK[levelFor(roles, module)] >= RANK.read;
}

export function canCreate(roles: AppRole[], module: ModuleKey): boolean {
  return RANK[levelFor(roles, module)] >= RANK.create;
}

export function canEdit(roles: AppRole[], module: ModuleKey): boolean {
  return RANK[levelFor(roles, module)] >= RANK.edit;
}
