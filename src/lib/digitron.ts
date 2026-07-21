import type { TFunction } from "i18next";

// ============ ROLES ============
export const APP_ROLES = ["cliente", "administrativo", "tecnico", "super"] as const;
export type AppRole = (typeof APP_ROLES)[number];

// ============ ORDER WORKFLOW STAGES (BPMN) ============
export const STAGE_ORDER = [
  "intake",
  "evaluation",
  "budget",
  "customer_decision",
  "on_hold",
  "repair",
  "payment",
  "awaiting_withdrawal",
  "closed",
] as const;

export type OrderStage = (typeof STAGE_ORDER)[number];

// ============ BUDGET DECISION ============
export const BUDGET_DECISIONS = ["approved", "deferred", "rejected"] as const;
export type BudgetDecision = (typeof BUDGET_DECISIONS)[number];

// Visual token per stage (maps to semantic classes / badge variants).
export const STAGE_TOKEN: Record<OrderStage, string> = {
  intake: "stage-intake",
  evaluation: "stage-evaluation",
  budget: "stage-budget",
  customer_decision: "stage-decision",
  on_hold: "stage-hold",
  repair: "stage-repair",
  payment: "stage-payment",
  awaiting_withdrawal: "stage-awaiting-withdrawal",
  closed: "stage-closed",
};

export function getStageLabel(stage: OrderStage | string, t: TFunction): string {
  return t(`stage.${stage}`, { defaultValue: String(stage) });
}

export function getRoleLabel(role: AppRole | string, t: TFunction): string {
  return t(`roles.${role}`, { defaultValue: String(role) });
}

export function getDecisionLabel(decision: BudgetDecision | string, t: TFunction): string {
  return t(`decision.${decision}`, { defaultValue: String(decision) });
}
