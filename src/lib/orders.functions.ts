import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { STAGE_ORDER, type AppRole, type OrderStage } from "@/lib/digitron";
import { allowedPreviousStages, canTransition, type TransitionContext } from "@/lib/state-machine";

const WARRANTY_ELIGIBLE_STAGES = ["delivered", "closed"];
const ADMIN_ROLES: AppRole[] = ["administrativo", "super"];

type DbClient = SupabaseClient<Database>;

/** Roles of the acting user (own roles are self-readable under RLS). */
async function loadRoles(supabase: DbClient, userId: string): Promise<AppRole[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as AppRole);
}

/** Load an order's current stage and the transition gate context (budget approval, balance). */
async function loadOrderContext(
  supabase: DbClient,
  userId: string,
  orderId: string,
): Promise<{ stage: OrderStage; ctx: TransitionContext }> {
  const { data: order, error } = await supabase
    .from("orders")
    .select("stage, technician_id, balance_waived")
    .eq("id", orderId)
    .single();
  if (error || !order) throw new Error("Order not found.");
  const { data: budget } = await supabase
    .from("budgets")
    .select("decision, labor_cost, parts_cost, freight_cost, other_charges, advances")
    .eq("order_id", orderId)
    .maybeSingle();
  const { data: pays } = await supabase.from("payments").select("amount").eq("order_id", orderId);
  const total = budget
    ? budget.labor_cost + budget.parts_cost + budget.freight_cost + budget.other_charges
    : 0;
  const paid = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0) + (budget?.advances ?? 0);
  const roles = await loadRoles(supabase, userId);
  return {
    stage: order.stage as OrderStage,
    ctx: {
      roles,
      isAssignedTechnician: order.technician_id === userId,
      budgetApproved: budget?.decision === "approved",
      balanceSettled: order.balance_waived || total - paid <= 0,
    },
  };
}

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

    const { stage, ctx } = await loadOrderContext(supabase, userId, data.order_id);

    if (!canTransition(stage, data.target_stage, ctx)) {
      throw new Error("Transition not allowed.");
    }

    const { error: upErr } = await supabase
      .from("orders")
      .update({ stage: data.target_stage })
      .eq("id", data.order_id);
    if (upErr) throw new Error(upErr.message);

    return { ok: true as const };
  });

/** Moves one step back only when the actor has permission, and records why. */
export const revertOrderStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        order_id: z.string().uuid(),
        target_stage: z.enum(STAGE_ORDER),
        reason: z.string().trim().min(3).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { stage, ctx } = await loadOrderContext(supabase, userId, data.order_id);
    if (!allowedPreviousStages(stage, ctx).includes(data.target_stage)) {
      throw new Error("The requested correction is not allowed.");
    }
    const notes = supabase.from("order_notes" as never) as unknown as {
      insert: (row: {
        order_id: string;
        created_by: string;
        body: string;
      }) => Promise<{ error: Error | null }>;
    };
    const { error: noteError } = await notes.insert({
      order_id: data.order_id,
      created_by: userId,
      body: `Corrección de flujo: ${stage} → ${data.target_stage}. Motivo: ${data.reason}`,
    });
    if (noteError) throw new Error(noteError.message);
    const { error } = await supabase
      .from("orders")
      .update({ stage: data.target_stage })
      .eq("id", data.order_id);
    if (error) throw new Error(error.message);
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
    const roles = await loadRoles(supabase, userId);
    if (!roles.some((r) => ADMIN_ROLES.includes(r))) {
      throw new Error("Only administrativo or super can create warranty orders.");
    }

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

/**
 * Records the customer's budget decision and auto-routes the order along the
 * matching branch (approved → repair, deferred → on_hold, rejected → closed),
 * validated by the state machine. Approved also sets the order's authorized flag.
 */
export const recordBudgetDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        order_id: z.string().uuid(),
        decision: z.enum(["approved", "deferred", "rejected"]),
        deferred_reason: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await loadRoles(supabase, userId);
    if (!roles.some((r) => ADMIN_ROLES.includes(r))) {
      throw new Error("Only administrativo or super can record the customer decision.");
    }
    if (data.decision === "deferred" && !data.deferred_reason?.trim()) {
      throw new Error("A deferred decision requires a reason.");
    }

    const { data: budget, error: bErr } = await supabase
      .from("budgets")
      .select("id")
      .eq("order_id", data.order_id)
      .maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!budget) throw new Error("Create the budget first.");

    const { error: upBudget } = await supabase
      .from("budgets")
      .update({
        decision: data.decision,
        decided_at: new Date().toISOString(),
        deferred_reason: data.decision === "deferred" ? data.deferred_reason!.trim() : null,
      })
      .eq("id", budget.id);
    if (upBudget) throw new Error(upBudget.message);

    const target: OrderStage =
      data.decision === "approved" ? "repair" : data.decision === "deferred" ? "on_hold" : "closed";
    const { stage, ctx } = await loadOrderContext(supabase, userId, data.order_id);
    if (!canTransition(stage, target, ctx)) throw new Error("Transition not allowed.");
    const { error: upStage } = await supabase
      .from("orders")
      .update({
        stage: target,
        ...(data.decision === "approved" ? { authorized: true } : {}),
      })
      .eq("id", data.order_id);
    if (upStage) throw new Error(upStage.message);

    return { ok: true as const, stage: target };
  });

/**
 * Records that the customer was notified (decision or delivery) by stamping the
 * matching timestamp. Email delivery is deferred — only the record is kept.
 */
export const notifyCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ order_id: z.string().uuid(), kind: z.enum(["decision", "delivery"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await loadRoles(supabase, userId);
    if (!roles.some((r) => ADMIN_ROLES.includes(r))) {
      throw new Error("Only administrativo or super can notify the customer.");
    }
    // TODO: actual email delivery is pending implementation; we only record the timestamp.
    const now = new Date().toISOString();
    const patch =
      data.kind === "decision" ? { decision_notified_at: now } : { delivery_notified_at: now };
    const { error } = await supabase.from("orders").update(patch).eq("id", data.order_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Records the receiver and delivery time and advances the order to delivered. */
export const deliverOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ order_id: z.string().uuid(), received_by: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { stage, ctx } = await loadOrderContext(supabase, userId, data.order_id);
    if (!canTransition(stage, "delivered", ctx)) throw new Error("Transition not allowed.");
    const { error } = await supabase
      .from("orders")
      .update({
        received_by: data.received_by.trim(),
        delivery_at: new Date().toISOString(),
        stage: "delivered",
      })
      .eq("id", data.order_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Records closing notes and advances the order to closed. */
export const closeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ order_id: z.string().uuid(), closing_notes: z.string().max(2000).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { stage, ctx } = await loadOrderContext(supabase, userId, data.order_id);
    if (!canTransition(stage, "closed", ctx)) throw new Error("Transition not allowed.");
    const { error } = await supabase
      .from("orders")
      .update({ closing_notes: data.closing_notes?.trim() || null, stage: "closed" })
      .eq("id", data.order_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
