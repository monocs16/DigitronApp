import type { OrderStatus } from "./digitron";

// Allowed transitions per current status. Role enforcement lives in STATUS_ROLE.
export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  received: ["diagnosis"],
  diagnosis: ["repair", "waiting_part", "ready"],
  repair: ["waiting_part", "ready"],
  waiting_part: ["repair", "ready"],
  ready: ["delivered"],
  delivered: ["warranty", "closed"],
  warranty: ["repair", "closed"],
  closed: [],
};

export function allowedNextStatuses(
  current: OrderStatus,
  role: "admin" | "technician",
  isAssignedTechnician: boolean,
): OrderStatus[] {
  return STATUS_TRANSITIONS[current].filter((next) => {
    // Admin can always transition
    if (role === "admin") return true;
    // Technician can only transition statuses they own AND only on their orders
    if (!isAssignedTechnician) return false;
    // From STATUS_ROLE: only certain statuses can be set by technician
    return ["diagnosis", "repair", "waiting_part", "ready"].includes(next);
  });
}
