import type { AppRole, OrderStage } from "./digitron";

// Allowed transitions per current stage (BPMN service-order flow).
export const STAGE_TRANSITIONS: Record<OrderStage, OrderStage[]> = {
  intake: ["evaluation"],
  evaluation: ["budget"],
  budget: ["customer_decision"],
  // Customer decision branches: approved -> repair, deferred -> on_hold, rejected -> closed
  customer_decision: ["repair", "on_hold", "closed"],
  // Deferred loop: once the part/authorization arrives, return to the decision
  on_hold: ["customer_decision"],
  repair: ["payment"],
  payment: ["delivered"],
  delivered: ["closed"],
  closed: [],
};

// Which roles may move an order INTO a given target stage. `super` is always allowed.
export const STAGE_ACTOR_ROLES: Record<OrderStage, AppRole[]> = {
  intake: ["administrativo"],
  evaluation: ["administrativo", "tecnico"],
  budget: ["administrativo"],
  customer_decision: ["administrativo"],
  on_hold: ["administrativo"],
  repair: ["administrativo"],
  payment: ["administrativo", "tecnico"],
  delivered: ["administrativo"],
  closed: ["administrativo"],
};

export type TransitionContext = {
  roles: AppRole[];
  isAssignedTechnician: boolean;
  /** Whether the order's budget decision is `approved` (gate for entering `repair`). */
  budgetApproved: boolean;
  /** Whether the outstanding balance is settled or waived (gate for `delivered`). */
  balanceSettled: boolean;
};

function roleAllowedForStage(target: OrderStage, roles: AppRole[]): boolean {
  if (roles.includes("super")) return true;
  return STAGE_ACTOR_ROLES[target].some((r) => roles.includes(r));
}

/** Business gates that depend on data beyond the stage itself. */
export function gateAllows(target: OrderStage, ctx: TransitionContext): boolean {
  if (target === "repair" && !ctx.budgetApproved) return false;
  if (target === "delivered" && !ctx.balanceSettled) return false;
  return true;
}

/** Returns the stages the current actor may transition the order to right now. */
export function allowedNextStages(current: OrderStage, ctx: TransitionContext): OrderStage[] {
  const isSuper = ctx.roles.includes("super");
  const isTech = ctx.roles.includes("tecnico");
  return STAGE_TRANSITIONS[current].filter((target) => {
    if (!roleAllowedForStage(target, ctx.roles)) return false;
    // Technicians may only act on orders assigned to them (unless also super).
    if (isTech && !isSuper && !ctx.isAssignedTechnician) return false;
    if (!gateAllows(target, ctx)) return false;
    return true;
  });
}

/** True if a transition from `current` to `target` is valid for the actor and gates. */
export function canTransition(
  current: OrderStage,
  target: OrderStage,
  ctx: TransitionContext,
): boolean {
  return allowedNextStages(current, ctx).includes(target);
}
