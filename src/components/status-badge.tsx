import type { TFunction } from "i18next";
import { getStageLabel, STAGE_TOKEN, type OrderStage } from "@/lib/digitron";

interface StageBadgeProps {
  stage: OrderStage;
  t: TFunction;
}

export function StageBadge({ stage, t }: StageBadgeProps) {
  const token = STAGE_TOKEN[stage] ?? "stage-closed";
  const varName = `--${token}`;

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-wide shadow-sm"
      style={{
        color: `var(${varName})`,
        backgroundColor: `color-mix(in oklch, var(${varName}) 12%, transparent)`,
        border: `1.5px solid color-mix(in oklch, var(${varName}) 50%, transparent)`,
        boxShadow: `0 0 0 3px color-mix(in oklch, var(${varName}) 8%, transparent)`,
      }}
    >
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{
          backgroundColor: `var(${varName})`,
          boxShadow: `0 0 4px 1px color-mix(in oklch, var(${varName}) 60%, transparent)`,
        }}
      />
      {getStageLabel(stage, t)}
    </span>
  );
}
