import { describe, it, expect } from "vitest";
import { getStageLabel, getRoleLabel, getDecisionLabel, STAGE_ORDER, APP_ROLES, BUDGET_DECISIONS } from "@/lib/digitron";
import type { TFunction } from "i18next";

// Pass-through mock: returns the key as-is, so we can assert the key is correct.
const t = ((key: string) => key) as unknown as TFunction;

describe("getStageLabel", () => {
  it("returns the i18n key for each known stage", () => {
    for (const stage of STAGE_ORDER) {
      expect(getStageLabel(stage, t)).toBe(`stage.${stage}`);
    }
  });

  it("does not throw for unknown stage and returns a string", () => {
    expect(() => getStageLabel("unknown_stage", t)).not.toThrow();
    expect(typeof getStageLabel("unknown_stage", t)).toBe("string");
  });
});

describe("getRoleLabel", () => {
  it("returns the i18n key for each known role", () => {
    for (const role of APP_ROLES) {
      expect(getRoleLabel(role, t)).toBe(`roles.${role}`);
    }
  });

  it("does not throw for unknown role and returns a string", () => {
    expect(() => getRoleLabel("unknown_role", t)).not.toThrow();
    expect(typeof getRoleLabel("unknown_role", t)).toBe("string");
  });
});

describe("getDecisionLabel", () => {
  it("returns the i18n key for each known decision", () => {
    for (const decision of BUDGET_DECISIONS) {
      expect(getDecisionLabel(decision, t)).toBe(`decision.${decision}`);
    }
  });

  it("does not throw for unknown decision and returns a string", () => {
    expect(() => getDecisionLabel("unknown_decision", t)).not.toThrow();
    expect(typeof getDecisionLabel("unknown_decision", t)).toBe("string");
  });
});
