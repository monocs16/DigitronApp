import { useEffect, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTechnicians } from "@/hooks/use-technicians";
import { PageHeader } from "@/components/page-header";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, Upload, Trash2, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import i18n from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getStageLabel, getDecisionLabel, type OrderStage } from "@/lib/digitron";
import { StageBadge } from "@/components/status-badge";
import { allowedNextStages, type TransitionContext } from "@/lib/state-machine";

export const Route = createFileRoute("/_authenticated/orders/$orderId")({
  component: OrderDetailPage,
});

const MAX_PHOTOS = 5;
const PAYMENT_METHODS = ["cash", "card", "transfer"] as const;

function OrderDetailPage() {
  const { t } = useTranslation();
  const { orderId } = useParams({ from: "/_authenticated/orders/$orderId" });
  const { profile, roles } = useAuth();
  const qc = useQueryClient();

  const isSuper = roles.includes("super");
  const isAdministrativo = roles.includes("administrativo");
  const isTecnico = roles.includes("tecnico");

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *, customers(id, name, phone1, email),
          equipment(id, type, brand, model, serial_number)
        `,
        )
        .eq("id", orderId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: evaluation } = useQuery({
    queryKey: ["evaluation", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technical_evaluations")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: budget } = useQuery({
    queryKey: ["budget", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: repair } = useQuery({
    queryKey: ["repair", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repairs")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, method, reference, paid_at, registered_by")
        .eq("order_id", orderId)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: techs = [] } = useTechnicians({ includeRoles: true });

  const { data: people = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: audit = [] } = useQuery({
    queryKey: ["audit", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, operation, change_ts, app_user, changed_fields, full_row_old")
        .eq("table_name", "orders")
        .filter("record_pk->>id", "eq", orderId)
        .order("change_ts", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["photos", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_photos")
        .select("id, storage_path, uploaded_at")
        .eq("order_id", orderId);
      if (error) throw error;
      const withUrls = await Promise.all(
        (data ?? []).map(async (p) => {
          const { data: signed } = await supabase.storage
            .from("order-photos")
            .createSignedUrl(p.storage_path, 3600);
          return { ...p, url: signed?.signedUrl ?? "" };
        }),
      );
      return withUrls;
    },
  });

  const nameById = new Map(people.map((p) => [p.id, p.full_name]));

  const isAssigned = !!order && order.technician_id === profile?.id;

  // Budget totals and gates.
  const budgetTotal = budget
    ? budget.labor_cost + budget.parts_cost + budget.freight_cost + budget.other_charges
    : 0;
  const paidTotal = payments.reduce((s, p) => s + Number(p.amount), 0) + (budget?.advances ?? 0);
  const balance = budgetTotal - paidTotal;
  const balanceSettled = !!order?.balance_waived || balance <= 0;
  const budgetApproved = budget?.decision === "approved";

  // Role-based edit gates (mirrors MODULE_MATRIX).
  const canEditEvaluation = isSuper || (isTecnico && isAssigned);
  const canEditBudget = isSuper || isAdministrativo;
  const canEditRepair = isSuper || (isTecnico && isAssigned);
  const canEditPayments = isSuper || isAdministrativo;
  const canAssignTech = isSuper || isAdministrativo;
  const canEditNotes = isSuper || isAdministrativo || isAssigned;

  const ctx: TransitionContext = {
    roles,
    isAssignedTechnician: isAssigned,
    budgetApproved,
    balanceSettled,
  };
  const nextStages = order ? allowedNextStages(order.stage as OrderStage, ctx) : [];

  // ---- Local form state, hydrated from loaded data ----
  const [diagnosis, setDiagnosis] = useState("");
  const [evalNotes, setEvalNotes] = useState("");
  const [laborCost, setLaborCost] = useState("");
  const [partsCost, setPartsCost] = useState("");
  const [freightCost, setFreightCost] = useState("");
  const [otherCharges, setOtherCharges] = useState("");
  const [advances, setAdvances] = useState("");
  const [deferredReason, setDeferredReason] = useState("");
  const [customerComments, setCustomerComments] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<string>("cash");
  const [payReference, setPayReference] = useState("");
  const [technicianAssign, setTechnicianAssign] = useState<string>("none");

  useEffect(() => {
    if (order) {
      setGeneralNotes(order.general_notes ?? "");
      setTechnicianAssign(order.technician_id ?? "none");
    }
  }, [order]);
  useEffect(() => {
    setDiagnosis(evaluation?.diagnosis ?? "");
    setEvalNotes(evaluation?.technical_notes ?? "");
  }, [evaluation]);
  useEffect(() => {
    if (budget) {
      setLaborCost(String(budget.labor_cost));
      setPartsCost(String(budget.parts_cost));
      setFreightCost(String(budget.freight_cost));
      setOtherCharges(String(budget.other_charges));
      setAdvances(String(budget.advances));
      setDeferredReason(budget.deferred_reason ?? "");
      setCustomerComments(budget.customer_comments ?? "");
    }
  }, [budget]);
  useEffect(() => {
    setWorkDescription(repair?.work_description ?? "");
  }, [repair]);

  const invalidate = (...keys: string[]) => {
    qc.invalidateQueries({ queryKey: ["audit", orderId] });
    for (const k of keys) qc.invalidateQueries({ queryKey: [k, orderId] });
  };

  // ---- Mutations ----
  const changeStage = useMutation({
    mutationFn: async (next: OrderStage) => {
      const { error } = await supabase.from("orders").update({ stage: next }).eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("orders.stageUpdated"));
      invalidate("order");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignTech = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase
        .from("orders")
        .update({ technician_id: value === "none" ? null : value })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("orders.technicianUpdated"));
      invalidate("order");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNotes = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("orders")
        .update({ general_notes: generalNotes || null })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("orders.changesSaved"));
      invalidate("order");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveEvaluation = useMutation({
    mutationFn: async () => {
      if (!diagnosis.trim()) throw new Error(i18n.t("orders.diagnosisRequired"));
      const payload = {
        order_id: orderId,
        diagnosis: diagnosis.trim(),
        technical_notes: evalNotes || null,
        technician_id: profile?.id ?? null,
      };
      const { error } = evaluation
        ? await supabase.from("technical_evaluations").update(payload).eq("id", evaluation.id)
        : await supabase.from("technical_evaluations").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("orders.evaluationSaved"));
      invalidate("evaluation");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveBudget = useMutation({
    mutationFn: async () => {
      const payload = {
        order_id: orderId,
        labor_cost: Number(laborCost) || 0,
        parts_cost: Number(partsCost) || 0,
        freight_cost: Number(freightCost) || 0,
        other_charges: Number(otherCharges) || 0,
        advances: Number(advances) || 0,
        deferred_reason: deferredReason || null,
        customer_comments: customerComments || null,
      };
      const { error } = budget
        ? await supabase.from("budgets").update(payload).eq("id", budget.id)
        : await supabase.from("budgets").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("orders.budgetSaved"));
      invalidate("budget");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decideBudget = useMutation({
    mutationFn: async (decision: "approved" | "deferred" | "rejected") => {
      if (!budget) throw new Error(i18n.t("orders.budgetFirst"));
      const { error } = await supabase
        .from("budgets")
        .update({ decision, decided_at: new Date().toISOString() })
        .eq("id", budget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("orders.budgetSaved"));
      invalidate("budget");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRepair = useMutation({
    mutationFn: async (patch: { state?: string; stamp?: "started_at" | "finished_at" }) => {
      const payload = {
        order_id: orderId,
        work_description: workDescription || null,
        technician_id: profile?.id ?? null,
        ...(patch.state ? { state: patch.state } : {}),
        ...(patch.stamp ? { [patch.stamp]: new Date().toISOString() } : {}),
      };
      const { error } = repair
        ? await supabase.from("repairs").update(payload).eq("id", repair.id)
        : await supabase.from("repairs").insert({ state: "in_progress", ...payload });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("orders.repairSaved"));
      invalidate("repair");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPayment = useMutation({
    mutationFn: async () => {
      const amount = Number(payAmount);
      if (!amount || amount <= 0) throw new Error(i18n.t("orders.invalidAmount"));
      const { error } = await supabase.from("payments").insert({
        order_id: orderId,
        amount,
        method: payMethod,
        reference: payReference || null,
        registered_by: profile?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("orders.paymentAdded"));
      setPayAmount("");
      setPayReference("");
      invalidate("payments");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const waiveBalance = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("orders")
        .update({ balance_waived: true })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("orders.changesSaved"));
      invalidate("order");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      if (photos.length >= MAX_PHOTOS)
        throw new Error(i18n.t("orders.maxPhotos", { max: MAX_PHOTOS }));
      if (file.size > 5 * 1024 * 1024) throw new Error(i18n.t("orders.photoTooLarge"));
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error(i18n.t("orders.photoFormat"));
      }
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${orderId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("order-photos").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("order_photos").insert({
        order_id: orderId,
        storage_path: path,
        uploaded_by: profile?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("orders.photoUploaded"));
      qc.invalidateQueries({ queryKey: ["photos", orderId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePhoto = useMutation({
    mutationFn: async (p: { id: string; storage_path: string }) => {
      await supabase.storage.from("order-photos").remove([p.storage_path]);
      const { error } = await supabase.from("order_photos").delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("orders.photoDeleted"));
      qc.invalidateQueries({ queryKey: ["photos", orderId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (!order) return <p className="text-sm text-muted-foreground">{t("orders.notFound")}</p>;

  const money = (n: number) => n.toFixed(2);

  const auditLabel = (a: (typeof audit)[number]) => {
    if (a.operation === "INSERT") return t("orders.orderCreated");
    const changed = (a.changed_fields ?? {}) as Record<string, unknown>;
    if ("stage" in changed) {
      const oldRow = (a.full_row_old ?? {}) as Record<string, unknown>;
      return t("orders.statusChanged", {
        from: getStageLabel(String(oldRow.stage ?? ""), t),
        to: getStageLabel(String(changed.stage ?? ""), t),
      });
    }
    const keys = Object.keys(changed).filter((k) => k !== "updated_at");
    return t("orders.fieldChanged", { field: keys.join(", ") || a.operation });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("orders.back")}
          </Link>
        </Button>
      </div>

      <PageHeader
        title={order.order_number}
        subtitle={t("orders.createdAt", { date: new Date(order.created_at).toLocaleString() })}
      >
        <StageBadge stage={order.stage} t={t} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("orders.clientAndEquipment")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-xs uppercase text-muted-foreground">{t("common.client")}</p>
                <p className="font-medium">{order.customers?.name}</p>
                <p className="text-muted-foreground">{order.customers?.phone1}</p>
                <p className="text-muted-foreground">{order.customers?.email}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">{t("common.equipment")}</p>
                <p className="font-medium">
                  {order.equipment?.brand} {order.equipment?.model}
                </p>
                <p className="text-muted-foreground">{order.equipment?.type}</p>
                <p className="font-mono text-xs">
                  {order.equipment?.serial_number ?? t("common.noData")}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs uppercase text-muted-foreground">
                  {t("orders.reportedProblem")}
                </p>
                <p className="whitespace-pre-wrap">{order.reported_fault}</p>
              </div>
            </CardContent>
          </Card>

          {/* Evaluation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("orders.evaluation")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("orders.diagnosis")}</Label>
                <Textarea
                  rows={3}
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  disabled={!canEditEvaluation}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("orders.technicalNotes")}</Label>
                <Textarea
                  rows={3}
                  value={evalNotes}
                  onChange={(e) => setEvalNotes(e.target.value)}
                  disabled={!canEditEvaluation}
                />
              </div>
              {canEditEvaluation && (
                <div className="flex justify-end">
                  <Button
                    onClick={() => saveEvaluation.mutate()}
                    disabled={saveEvaluation.isPending}
                  >
                    {t("orders.saveEvaluation")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Budget */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("orders.budget")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["orders.laborCost", laborCost, setLaborCost],
                    ["orders.partsCost", partsCost, setPartsCost],
                    ["orders.freightCost", freightCost, setFreightCost],
                    ["orders.otherCharges", otherCharges, setOtherCharges],
                    ["orders.advances", advances, setAdvances],
                  ] as const
                ).map(([key, val, setter]) => (
                  <div key={key} className="space-y-2">
                    <Label>{t(key)}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={val}
                      onChange={(e) => setter(e.target.value)}
                      disabled={!canEditBudget}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label>{t("orders.customerComments")}</Label>
                <Textarea
                  rows={2}
                  value={customerComments}
                  onChange={(e) => setCustomerComments(e.target.value)}
                  disabled={!canEditBudget}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{t("orders.total")}</span>
                <span className="font-semibold">{money(budgetTotal)}</span>
              </div>
              {canEditBudget && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{t("orders.decision")}:</span>
                    <span className="font-medium">
                      {budget?.decision ? getDecisionLabel(budget.decision, t) : t("common.noData")}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => saveBudget.mutate()} disabled={saveBudget.isPending}>
                      {t("orders.saveBudget")}
                    </Button>
                  </div>
                </div>
              )}
              {canEditBudget && budget && (
                <div className="flex flex-wrap gap-2">
                  {(["approved", "deferred", "rejected"] as const).map((d) => (
                    <Button
                      key={d}
                      variant={budget.decision === d ? "default" : "outline"}
                      size="sm"
                      disabled={decideBudget.isPending}
                      onClick={() => decideBudget.mutate(d)}
                    >
                      {getDecisionLabel(d, t)}
                    </Button>
                  ))}
                </div>
              )}
              {budget?.decision === "deferred" && (
                <div className="space-y-2">
                  <Label>{t("orders.deferredReason")}</Label>
                  <Input
                    value={deferredReason}
                    onChange={(e) => setDeferredReason(e.target.value)}
                    disabled={!canEditBudget}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Repair */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("orders.repair")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("orders.workDescription")}</Label>
                <Textarea
                  rows={3}
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  disabled={!canEditRepair}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {repair?.started_at && (
                  <span>
                    {t("orders.started")}: {new Date(repair.started_at).toLocaleString()}
                  </span>
                )}
                {repair?.finished_at && (
                  <span>
                    {t("orders.finished")}: {new Date(repair.finished_at).toLocaleString()}
                  </span>
                )}
              </div>
              {canEditRepair && (
                <div className="flex flex-wrap justify-end gap-2">
                  {!repair?.started_at && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        saveRepair.mutate({ state: "in_progress", stamp: "started_at" })
                      }
                      disabled={saveRepair.isPending}
                    >
                      {t("orders.startRepair")}
                    </Button>
                  )}
                  {repair?.started_at && !repair?.finished_at && (
                    <Button
                      variant="outline"
                      onClick={() => saveRepair.mutate({ state: "done", stamp: "finished_at" })}
                      disabled={saveRepair.isPending}
                    >
                      {t("orders.finishRepair")}
                    </Button>
                  )}
                  <Button onClick={() => saveRepair.mutate({})} disabled={saveRepair.isPending}>
                    {t("orders.saveRepair")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("orders.payments")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-3 text-sm">
                <div className="rounded-md border px-3 py-2">
                  <p className="text-xs text-muted-foreground">{t("orders.total")}</p>
                  <p className="font-semibold">{money(budgetTotal)}</p>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <p className="text-xs text-muted-foreground">{t("orders.totalPaid")}</p>
                  <p className="font-semibold">{money(paidTotal)}</p>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <p className="text-xs text-muted-foreground">{t("orders.balance")}</p>
                  <p className="font-semibold">{money(balance)}</p>
                </div>
              </div>

              {payments.length > 0 && (
                <ul className="divide-y text-sm">
                  {payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2">
                      <span>
                        {money(Number(p.amount))} · {t(`orders.method_${p.method}`, p.method)}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(p.paid_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {canEditPayments && (
                <>
                  <Separator />
                  <div className="grid gap-2 sm:grid-cols-4 sm:items-end">
                    <div className="space-y-2">
                      <Label>{t("orders.amount")}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("orders.method")}</Label>
                      <Select value={payMethod} onValueChange={setPayMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {t(`orders.method_${m}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("orders.reference")}</Label>
                      <Input
                        value={payReference}
                        onChange={(e) => setPayReference(e.target.value)}
                      />
                    </div>
                    <Button onClick={() => addPayment.mutate()} disabled={addPayment.isPending}>
                      {t("orders.addPayment")}
                    </Button>
                  </div>
                  {!balanceSettled && (
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => waiveBalance.mutate()}
                        disabled={waiveBalance.isPending}
                      >
                        {t("orders.waiveBalance")}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Photos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                {t("orders.photos", { current: photos.length, max: MAX_PHOTOS })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {photos.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("orders.noPhotos")}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map((p) => (
                    <div
                      key={p.id}
                      className="group relative aspect-square overflow-hidden rounded border"
                    >
                      {p.url && (
                        <img
                          src={p.url}
                          alt={t("orders.photoAlt")}
                          className="h-full w-full object-cover"
                        />
                      )}
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={() => deletePhoto.mutate(p)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {photos.length < MAX_PHOTOS && (
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="photo-upload"
                    className="cursor-pointer inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
                  >
                    <Upload className="h-4 w-4" />
                    {t("orders.uploadPhoto")}
                  </Label>
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadPhoto.mutate(f);
                      e.target.value = "";
                    }}
                  />
                  <p className="text-xs text-muted-foreground">{t("orders.photoHint")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: actions + notes + history */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("orders.actions")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("orders.changeStage")}</Label>
                {nextStages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("orders.noTransitions")}</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {nextStages.map((s) => (
                      <Button
                        key={s}
                        variant="outline"
                        size="sm"
                        disabled={changeStage.isPending}
                        onClick={() => changeStage.mutate(s)}
                      >
                        → {getStageLabel(s, t)}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {canAssignTech && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>{t("orders.assignTechnician")}</Label>
                    <Select
                      value={technicianAssign}
                      onValueChange={(v) => {
                        setTechnicianAssign(v);
                        assignTech.mutate(v);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("common.unassigned")}</SelectItem>
                        {techs.map((tech) => (
                          <SelectItem key={tech.id} value={tech.id}>
                            {tech.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("orders.internalNotes")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={4}
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                disabled={!canEditNotes}
              />
              {canEditNotes && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => saveNotes.mutate()}
                    disabled={saveNotes.isPending}
                  >
                    {t("orders.saveChanges")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("orders.history")}</CardTitle>
            </CardHeader>
            <CardContent>
              {audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("orders.noActivity")}</p>
              ) : (
                <ol className="space-y-3">
                  {audit.map((a) => (
                    <li key={a.id} className="border-l-2 border-border pl-3 text-sm">
                      <p className="font-medium">{auditLabel(a)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.change_ts).toLocaleString()}
                        {a.app_user && ` · ${nameById.get(a.app_user) ?? t("common.noData")}`}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
