import { describe, it, expect } from "vitest";
import {
  allowedNextStages,
  canTransition,
  gateAllows,
  STAGE_TRANSITIONS,
  STAGE_ACTOR_ROLES,
  allowedPreviousStages,
} from "@/lib/state-machine";
import type { TransitionContext } from "@/lib/state-machine";
import type { OrderStage } from "@/lib/digitron";

const adminCtx = (overrides: Partial<TransitionContext> = {}): TransitionContext => ({
  roles: ["administrativo"],
  isAssignedTechnician: false,
  budgetApproved: true,
  balanceSettled: true,
  ...overrides,
});

const superCtx = (overrides: Partial<TransitionContext> = {}): TransitionContext => ({
  roles: ["super"],
  isAssignedTechnician: false,
  budgetApproved: true,
  balanceSettled: true,
  ...overrides,
});

const techCtx = (overrides: Partial<TransitionContext> = {}): TransitionContext => ({
  roles: ["tecnico"],
  isAssignedTechnician: true,
  budgetApproved: true,
  balanceSettled: true,
  ...overrides,
});

describe("STAGE_TRANSITIONS completeness", () => {
  it("every stage has an entry", () => {
    const stages: OrderStage[] = [
      "intake",
      "evaluation",
      "budget",
      "customer_decision",
      "on_hold",
      "repair",
      "payment",
      "delivered",
      "closed",
    ];
    for (const s of stages) {
      expect(STAGE_TRANSITIONS).toHaveProperty(s);
    }
  });
});

describe("canTransition — valid progressions", () => {
  it("intake → evaluation (admin)", () => {
    expect(canTransition("intake", "evaluation", adminCtx())).toBe(true);
  });

  it("evaluation → budget (technician)", () => {
    expect(canTransition("evaluation", "budget", techCtx())).toBe(true);
  });

  it("evaluation → budget is rejected for admin", () => {
    expect(canTransition("evaluation", "budget", adminCtx())).toBe(false);
  });

  it("budget → customer_decision (admin)", () => {
    expect(canTransition("budget", "customer_decision", adminCtx())).toBe(true);
  });

  it("customer_decision → repair when budget approved (admin)", () => {
    expect(canTransition("customer_decision", "repair", adminCtx({ budgetApproved: true }))).toBe(
      true,
    );
  });

  it("customer_decision → on_hold (admin)", () => {
    expect(canTransition("customer_decision", "on_hold", adminCtx())).toBe(true);
  });

  it("customer_decision → closed (admin)", () => {
    expect(canTransition("customer_decision", "closed", adminCtx())).toBe(true);
  });

  it("on_hold → customer_decision (admin)", () => {
    expect(canTransition("on_hold", "customer_decision", adminCtx())).toBe(true);
  });

  it("repair → payment (technician)", () => {
    expect(canTransition("repair", "payment", techCtx())).toBe(true);
  });

  it("repair → payment is rejected for admin", () => {
    expect(canTransition("repair", "payment", adminCtx())).toBe(false);
  });

  it("payment → delivered when balance settled (admin)", () => {
    expect(canTransition("payment", "delivered", adminCtx({ balanceSettled: true }))).toBe(true);
  });

  it("delivered → closed (admin)", () => {
    expect(canTransition("delivered", "closed", adminCtx())).toBe(true);
  });
});

describe("canTransition — invalid (skipped) transitions", () => {
  it("intake → budget is rejected", () => {
    expect(canTransition("intake", "budget", adminCtx())).toBe(false);
  });

  it("intake → repair is rejected", () => {
    expect(canTransition("intake", "repair", adminCtx())).toBe(false);
  });

  it("evaluation → payment is rejected", () => {
    expect(canTransition("evaluation", "payment", adminCtx())).toBe(false);
  });

  it("closed → intake is rejected (no reopen)", () => {
    expect(canTransition("closed", "intake", adminCtx())).toBe(false);
  });
});

describe("canTransition — role restrictions", () => {
  it("cliente role cannot transition any stage", () => {
    const ctx: TransitionContext = {
      roles: ["cliente"],
      isAssignedTechnician: false,
      budgetApproved: true,
      balanceSettled: true,
    };
    expect(canTransition("intake", "evaluation", ctx)).toBe(false);
  });

  it("super role bypasses actor restrictions for all valid transitions", () => {
    expect(canTransition("intake", "evaluation", superCtx())).toBe(true);
    expect(canTransition("evaluation", "budget", superCtx())).toBe(true);
    expect(canTransition("repair", "payment", superCtx())).toBe(true);
  });

  it("STAGE_ACTOR_ROLES entry exists for every stage", () => {
    const stages = Object.keys(STAGE_TRANSITIONS) as OrderStage[];
    for (const s of stages) {
      expect(STAGE_ACTOR_ROLES).toHaveProperty(s);
    }
  });
});

describe("canTransition — data gates", () => {
  it("repair gate blocks when budget not approved", () => {
    expect(canTransition("customer_decision", "repair", adminCtx({ budgetApproved: false }))).toBe(
      false,
    );
  });

  it("delivered gate blocks when balance not settled", () => {
    expect(canTransition("payment", "delivered", adminCtx({ balanceSettled: false }))).toBe(false);
  });

  it("gateAllows returns true for stages with no specific gate", () => {
    expect(gateAllows("evaluation", adminCtx())).toBe(true);
    expect(gateAllows("budget", adminCtx())).toBe(true);
    expect(gateAllows("closed", adminCtx())).toBe(true);
  });
});

describe("allowedNextStages — technician restrictions", () => {
  it("unassigned technician gets empty allowed stages", () => {
    const result = allowedNextStages("evaluation", techCtx({ isAssignedTechnician: false }));
    expect(result).toHaveLength(0);
  });

  it("assigned technician can advance evaluation → budget", () => {
    const result = allowedNextStages("evaluation", techCtx({ isAssignedTechnician: true }));
    expect(result).toContain("budget");
  });

  it("technician cannot move intake → evaluation (admin-only stage)", () => {
    const result = allowedNextStages("intake", techCtx({ isAssignedTechnician: true }));
    expect(result).not.toContain("evaluation");
  });
});

describe("allowedNextStages — closed stage", () => {
  it("returns empty for admin on closed order", () => {
    expect(allowedNextStages("closed", adminCtx())).toHaveLength(0);
  });

  it("returns empty for super on closed order", () => {
    expect(allowedNextStages("closed", superCtx())).toHaveLength(0);
  });

  it("returns empty for technician on closed order", () => {
    expect(allowedNextStages("closed", techCtx())).toHaveLength(0);
  });
});

describe("allowedPreviousStages — audited corrections", () => {
  it("allows an administrator to return a directly preceding stage", () => {
    expect(allowedPreviousStages("payment", adminCtx())).toEqual(["repair"]);
  });

  it("limits an assigned technician to correcting their own completed stages", () => {
    expect(allowedPreviousStages("budget", techCtx())).toEqual(["evaluation"]);
    expect(allowedPreviousStages("payment", techCtx())).toEqual(["repair"]);
    expect(allowedPreviousStages("repair", techCtx())).toEqual([]);
  });

  it("does not allow an unassigned technician to revert a stage", () => {
    expect(allowedPreviousStages("budget", techCtx({ isAssignedTechnician: false }))).toEqual([]);
  });
});
