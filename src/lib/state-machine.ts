import type { AppRole, OrderStage } from "./digitron";

// Allowed transitions per current stage (BPMN service-order flow).
export const STAGE_TRANSITIONS: Record<OrderStage, OrderStage[]> = {
  intake: ["evaluation"],
  evaluation: ["budget"],
  budget: ["customer_decision"],
  // Customer decision branches: approved -> repair, deferred -> on_hold,
  // rejected -> awaiting withdrawal.
  customer_decision: ["repair", "on_hold", "awaiting_withdrawal"],
  // Deferred loop: once the part/authorization arrives, return to the decision
  on_hold: ["customer_decision"],
  repair: ["payment"],
  payment: ["awaiting_withdrawal"],
  awaiting_withdrawal: ["closed"],
  closed: [],
};

/** Direct, auditable corrections allowed when an order was advanced in error. */
export const STAGE_PREVIOUS: Record<OrderStage, OrderStage[]> = {
  intake: [],
  evaluation: ["intake"],
  budget: ["evaluation"],
  customer_decision: ["budget", "on_hold"],
  on_hold: ["customer_decision"],
  repair: ["customer_decision"],
  payment: ["repair"],
  awaiting_withdrawal: ["payment", "customer_decision"],
  closed: ["awaiting_withdrawal"],
};

// Which roles may move an order INTO a given target stage. `super` is always allowed.
export const STAGE_ACTOR_ROLES: Record<OrderStage, AppRole[]> = {
  intake: ["administrativo"],
  // Admin completes intake and hands the order to the technician.
  evaluation: ["administrativo"],
  // Technician completes the evaluation and advances it to budget.
  budget: ["tecnico"],
  customer_decision: ["administrativo"],
  on_hold: ["administrativo"],
  repair: ["administrativo"],
  // Technician marks repair complete and advances to payment.
  payment: ["tecnico"],
  awaiting_withdrawal: ["administrativo"],
  closed: ["administrativo"],
};

export type TransitionContext = {
  roles: AppRole[];
  isAssignedTechnician: boolean;
  /** Whether the order's budget decision is `approved` (gate for entering `repair`). */
  budgetApproved: boolean;
  /** Whether the outstanding balance is settled or waived before leaving `payment`. */
  balanceSettled: boolean;
};

function roleAllowedForStage(target: OrderStage, roles: AppRole[]): boolean {
  if (roles.includes("super")) return true;
  return STAGE_ACTOR_ROLES[target].some((r) => roles.includes(r));
}

/** Business gates that depend on data beyond the stage itself. */
export function gateAllows(
  current: OrderStage,
  target: OrderStage,
  ctx: TransitionContext,
): boolean {
  if (target === "repair" && !ctx.budgetApproved) return false;
  if (current === "payment" && target === "awaiting_withdrawal" && !ctx.balanceSettled) {
    return false;
  }
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
    if (!gateAllows(current, target, ctx)) return false;
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

export function allowedPreviousStages(current: OrderStage, ctx: TransitionContext): OrderStage[] {
  if (ctx.roles.includes("super") || ctx.roles.includes("administrativo")) {
    return STAGE_PREVIOUS[current];
  }
  if (!ctx.roles.includes("tecnico") || !ctx.isAssignedTechnician) return [];
  // A technician may correct the two stages they completed themselves.
  if (current === "budget") return ["evaluation"];
  if (current === "payment") return ["repair"];
  return [];
}
