import type { TFunction } from "i18next";
import { Check } from "lucide-react";
import { getStageLabel, type OrderStage } from "@/lib/digitron";

// Linear display path; on_hold is shown as a side-state of customer_decision.
const DISPLAY_STAGES: OrderStage[] = [
  "intake",
  "evaluation",
  "budget",
  "customer_decision",
  "repair",
  "payment",
  "delivered",
  "closed",
];

interface OrderStageStepperProps {
  stage: OrderStage;
  t: TFunction;
}

export function OrderStageStepper({ stage, t }: OrderStageStepperProps) {
  const anchor: OrderStage = stage === "on_hold" ? "customer_decision" : stage;
  const currentIdx = DISPLAY_STAGES.indexOf(anchor);

  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-xs">
      {DISPLAY_STAGES.map((s, i) => {
        const done = i < currentIdx;
        const current = i === currentIdx;
        const onHoldHere = current && stage === "on_hold";
        return (
          <li key={s} className="flex items-center gap-1.5">
            <span
              className={[
                "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
                done
                  ? "bg-primary text-primary-foreground"
                  : current
                    ? "border-2 border-primary text-primary"
                    : "border border-border text-muted-foreground",
              ].join(" ")}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className={current ? "font-medium" : "text-muted-foreground"}>
              {getStageLabel(s, t)}
              {onHoldHere ? ` · ${getStageLabel("on_hold", t)}` : ""}
            </span>
            {i < DISPLAY_STAGES.length - 1 && (
              <span className="ml-0.5 text-muted-foreground/60">→</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
