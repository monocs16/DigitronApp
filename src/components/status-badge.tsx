import type { TFunction } from "i18next";
import { getStatusLabel, STATUS_TOKEN, type OrderStatus } from "@/lib/digitron";

interface StatusBadgeProps {
  status: OrderStatus;
  t: TFunction;
}

export function StatusBadge({ status, t }: StatusBadgeProps) {
  const token = STATUS_TOKEN[status] ?? "status-closed";
  const varName = `--${token}`;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        color: `var(${varName})`,
        backgroundColor: `color-mix(in oklch, var(${varName}) 15%, transparent)`,
        border: `1px solid color-mix(in oklch, var(${varName}) 40%, transparent)`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: `var(${varName})` }}
      />
      {getStatusLabel(status, t)}
    </span>
  );
}
