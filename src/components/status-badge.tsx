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
      {getStageLabel(stage, t)}
    </span>
  );
}
