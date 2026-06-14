import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STAGE_ORDER, type AppRole } from "@/lib/digitron";
import { canTransition, type TransitionContext } from "@/lib/state-machine";

const WARRANTY_ELIGIBLE_STAGES = ["delivered", "closed"];

/**
 * Server-side stage transition. Enforces the BPMN state machine (the part RLS
 * cannot express) on top of RLS, which already gates who may update an order.
 */
export const transitionOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        order_id: z.string().uuid(),
        target_stage: z.enum(STAGE_ORDER),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (roleRows ?? []).map((r) => r.role as AppRole);

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, stage, technician_id, balance_waived")
      .eq("id", data.order_id)
      .single();
    if (orderErr || !order) throw new Error("Order not found.");

    const { data: budget } = await supabase
      .from("budgets")
      .select("decision, labor_cost, parts_cost, freight_cost, other_charges, advances")
      .eq("order_id", data.order_id)
      .maybeSingle();
    const { data: pays } = await supabase
      .from("payments")
      .select("amount")
      .eq("order_id", data.order_id);

    const budgetTotal = budget
      ? budget.labor_cost + budget.parts_cost + budget.freight_cost + budget.other_charges
      : 0;
    const paidTotal =
      (pays ?? []).reduce((s, p) => s + Number(p.amount), 0) + (budget?.advances ?? 0);

    const ctx: TransitionContext = {
      roles,
      isAssignedTechnician: order.technician_id === userId,
      budgetApproved: budget?.decision === "approved",
      balanceSettled: order.balance_waived || budgetTotal - paidTotal <= 0,
    };

    if (!canTransition(order.stage, data.target_stage, ctx)) {
      throw new Error("Transition not allowed.");
    }

    const { error: upErr } = await supabase
      .from("orders")
      .update({ stage: data.target_stage })
      .eq("id", data.order_id);
    if (upErr) throw new Error(upErr.message);

    return { ok: true as const };
  });

/**
 * Opens a new warranty order from a delivered/closed order, reusing the
 * original customer, equipment and reported fault, linked via warranty_origin_id.
 */
export const createWarrantyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ origin_order_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: origin, error: originErr } = await supabase
      .from("orders")
      .select("client_id, equipment_id, reported_fault, stage")
      .eq("id", data.origin_order_id)
      .single();
    if (originErr || !origin) throw new Error("Order not found.");
    if (!WARRANTY_ELIGIBLE_STAGES.includes(origin.stage)) {
      throw new Error("Only delivered or closed orders can open a warranty order.");
    }

    const { data: created, error: insErr } = await supabase
      .from("orders")
      .insert({
        client_id: origin.client_id,
        equipment_id: origin.equipment_id,
        warranty_origin_id: data.origin_order_id,
        reported_fault: origin.reported_fault,
        created_by: userId,
      })
      .select("id")
      .single();
    if (insErr || !created) throw new Error(insErr?.message ?? "Could not create warranty order.");

    return { id: created.id as string };
  });
