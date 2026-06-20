import { Fragment } from "react";
import type { TFunction } from "i18next";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStageLabel, type OrderStage } from "@/lib/digitron";

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
  const isOnHold = stage === "on_hold";

  return (
    <>
      {/* ── Desktop: full horizontal stepper ─────────────────────────── */}
      <div className="hidden items-start md:flex">
        {DISPLAY_STAGES.map((s, i) => {
          const done = i < currentIdx;
          const current = i === currentIdx;
          const holdHere = current && isOnHold;

          return (
            <Fragment key={s}>
              <div className="flex min-w-0 flex-col items-center gap-1.5">
                {/* Circle */}
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all",
                    done && "bg-emerald-600 text-white dark:bg-emerald-500",
                    current && !holdHere && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                    holdHere && "bg-amber-500 text-white ring-4 ring-amber-400/25",
                    !done && !current && "border-2 border-border bg-background text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5 stroke-[2.5]" /> : i + 1}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    "max-w-[72px] text-center text-[10.5px] leading-tight",
                    done && "text-emerald-700 dark:text-emerald-400",
                    current && !holdHere && "font-medium text-foreground",
                    holdHere && "font-medium text-foreground",
                    !done && !current && "text-muted-foreground",
                  )}
                >
                  {getStageLabel(s, t)}
                  {holdHere && (
                    <>
                      <br />
                      <span className="text-[9.5px] text-amber-600 dark:text-amber-400">
                        · {getStageLabel("on_hold", t)}
                      </span>
                    </>
                  )}
                </span>
              </div>

              {/* Connector line */}
              {i < DISPLAY_STAGES.length - 1 && (
                <div
                  className={cn(
                    "mt-4 min-w-[4px] flex-1 border-t-2 transition-colors",
                    done ? "border-emerald-500 dark:border-emerald-600" : "border-border",
                  )}
                />
              )}
            </Fragment>
          );
        })}
      </div>

      {/* ── Mobile: compact progress bar ─────────────────────────────── */}
      <div className="flex items-center gap-3 rounded-xl border bg-muted/40 px-3.5 py-2.5 md:hidden">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
            isOnHold ? "bg-amber-500" : "bg-primary",
          )}
        >
          {currentIdx + 1}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {getStageLabel(anchor, t)}
            {isOnHold && (
              <span className="ml-1 text-xs font-normal text-amber-600 dark:text-amber-400">
                · {getStageLabel("on_hold", t)}
              </span>
            )}
          </p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-border">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isOnHold ? "bg-amber-500" : "bg-primary",
              )}
              style={{ width: `${((currentIdx + 1) / DISPLAY_STAGES.length) * 100}%` }}
            />
          </div>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {currentIdx + 1} / {DISPLAY_STAGES.length}
        </span>
      </div>
    </>
  );
}
