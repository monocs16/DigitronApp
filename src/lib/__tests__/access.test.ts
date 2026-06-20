import { describe, it, expect } from "vitest";
import { levelFor, canRead, canCreate, canEdit, MODULES } from "@/lib/access";
import type { ModuleKey } from "@/lib/access";

describe("levelFor — single roles", () => {
  it("administrativo has edit on clientes", () => {
    expect(levelFor(["administrativo"], "clientes")).toBe("edit");
  });

  it("tecnico has read on equipo", () => {
    expect(levelFor(["tecnico"], "equipo")).toBe("read");
  });

  it("tecnico has none on clientes", () => {
    expect(levelFor(["tecnico"], "clientes")).toBe("none");
  });

  it("cliente has read on publico only", () => {
    expect(levelFor(["cliente"], "publico")).toBe("read");
    expect(levelFor(["cliente"], "clientes")).toBe("none");
    expect(levelFor(["cliente"], "inventario")).toBe("none");
  });

  it("super has at least read on all modules", () => {
    for (const mod of MODULES) {
      expect(canRead(["super"], mod as ModuleKey), `super read ${mod}`).toBe(true);
    }
  });

  it("super has edit on all operational modules", () => {
    const editModules: ModuleKey[] = [
      "clientes",
      "equipo",
      "inventario",
      "os_apertura",
      "os_evaluacion",
      "os_presupuesto",
      "os_reparacion",
      "os_cierre",
      "seguridad",
    ];
    for (const mod of editModules) {
      expect(levelFor(["super"], mod), `super on ${mod}`).toBe("edit");
    }
  });
});

describe("levelFor — multi-role composite", () => {
  it("returns highest level when roles differ", () => {
    // cliente = none, tecnico = read → composite = read
    expect(levelFor(["cliente", "tecnico"], "inventario")).toBe("read");
  });

  it("returns edit when one role has edit", () => {
    // tecnico = read, administrativo = edit on inventario
    expect(levelFor(["tecnico", "administrativo"], "inventario")).toBe("edit");
  });

  it("super always wins", () => {
    expect(levelFor(["cliente", "super"], "seguridad")).toBe("edit");
  });
});

describe("levelFor — edge cases", () => {
  it("empty roles returns none", () => {
    expect(levelFor([], "clientes")).toBe("none");
    expect(levelFor([], "publico")).toBe("none");
  });
});

describe("canRead", () => {
  it("administrativo can read clientes", () => {
    expect(canRead(["administrativo"], "clientes")).toBe(true);
  });

  it("tecnico cannot read clientes", () => {
    expect(canRead(["tecnico"], "clientes")).toBe(false);
  });

  it("super can read everything", () => {
    for (const mod of MODULES) {
      expect(canRead(["super"], mod as ModuleKey), `super read ${mod}`).toBe(true);
    }
  });
});

describe("canCreate", () => {
  it("administrativo can create os_apertura", () => {
    expect(canCreate(["administrativo"], "os_apertura")).toBe(true);
  });

  it("tecnico cannot create os_apertura", () => {
    expect(canCreate(["tecnico"], "os_apertura")).toBe(false);
  });

  it("tecnico can create os_evaluacion", () => {
    expect(canCreate(["tecnico"], "os_evaluacion")).toBe(true);
  });
});

describe("canEdit", () => {
  it("super can edit all operational and management modules", () => {
    const editModules: ModuleKey[] = [
      "clientes",
      "equipo",
      "inventario",
      "os_apertura",
      "os_evaluacion",
      "os_presupuesto",
      "os_reparacion",
      "os_cierre",
      "seguridad",
    ];
    for (const mod of editModules) {
      expect(canEdit(["super"], mod as ModuleKey), `super edit ${mod}`).toBe(true);
    }
  });

  it("administrativo cannot edit seguridad", () => {
    expect(canEdit(["administrativo"], "seguridad")).toBe(false);
  });

  it("tecnico cannot edit any module", () => {
    const editableByTech = MODULES.filter((mod) => canEdit(["tecnico"], mod as ModuleKey));
    expect(editableByTech).toHaveLength(0);
  });
});
