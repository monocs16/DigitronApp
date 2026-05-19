// Shared Digitron constants — Spanish labels for enums.
export const STATUS_LABELS: Record<string, string> = {
  received: "Recibido",
  diagnosis: "En diagnóstico",
  repair: "En reparación",
  waiting_part: "En espera de repuesto",
  ready: "Listo para entrega",
  delivered: "Entregado",
  closed: "Cerrado",
  warranty: "Garantía",
};

export const STATUS_ORDER = [
  "received",
  "diagnosis",
  "repair",
  "waiting_part",
  "ready",
  "delivered",
  "closed",
  "warranty",
] as const;

export type OrderStatus = (typeof STATUS_ORDER)[number];

// Which role is allowed to set each target status (per BR §4.3)
export const STATUS_ROLE: Record<OrderStatus, "admin" | "technician"> = {
  received: "admin",
  diagnosis: "technician",
  repair: "technician",
  waiting_part: "technician",
  ready: "technician",
  delivered: "admin",
  closed: "admin",
  warranty: "admin",
};

export const STATUS_TOKEN: Record<OrderStatus, string> = {
  received: "status-received",
  diagnosis: "status-diagnosis",
  repair: "status-repair",
  waiting_part: "status-waiting",
  ready: "status-ready",
  delivered: "status-delivered",
  closed: "status-closed",
  warranty: "status-warranty",
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  technician: "Técnico",
};
