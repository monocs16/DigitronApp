import { useEffect, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTechnicians } from "@/hooks/use-technicians";
import { PageHeader } from "@/components/page-header";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, Upload, Trash2, ImageIcon, CheckCircle2, Lock, Printer } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ordersRepository,
  evaluationsRepository,
  budgetsRepository,
  repairsRepository,
  paymentsRepository,
  orderPartsRepository,
  photosRepository,
  profilesRepository,
  auditRepository,
  orderNotesRepository,
  partsRepository,
} from "@/lib/repositories";
import { useAuth } from "@/hooks/use-auth";
import i18n from "@/lib/i18n";
import { formatAmount, formatDate, formatDateTime } from "@/lib/utils";
import { downloadServiceOrderPdf } from "@/lib/service-order-pdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { getStageLabel, getDecisionLabel, getRoleLabel, type OrderStage } from "@/lib/digitron";
import { allowedPreviousStages } from "@/lib/state-machine";
import { StageBadge } from "@/components/status-badge";
import { OrderStageStepper } from "@/components/order-stage-stepper";
import {
  transitionOrder,
  revertOrderStage,
  recordBudgetDecision,
  notifyCustomer,
  deliverOrder,
  closeOrder,
} from "@/lib/orders.functions";

export const Route = createFileRoute("/_authenticated/orders/$orderId")({
  component: OrderDetailPage,
});

// ─── Schemas ─────────────────────────────────────────────────────────────────

const evalSchema = z.object({
  diagnosis: z.string().min(1, "Diagnosis is required"),
  technical_notes: z.string(),
});

const budgetSchema = z.object({
  labor_cost: z.coerce.number().min(0),
  parts_cost: z.coerce.number().min(0),
  freight_cost: z.coerce.number().min(0),
  other_charges: z.coerce.number().min(0),
  advances: z.coerce.number().min(0),
  customer_comments: z.string(),
});

const repairSchema = z.object({
  work_description: z.string(),
});

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  method: z.enum(["cash", "card", "transfer"]),
  reference: z.string(),
});

type EvalValues = z.infer<typeof evalSchema>;
type BudgetValues = z.infer<typeof budgetSchema>;
type RepairValues = z.infer<typeof repairSchema>;
type PaymentValues = z.infer<typeof paymentSchema>;

// ─── Stage-section state ──────────────────────────────────────────────────────

const ORDER_STAGE_INDEX: Record<OrderStage, number> = {
  intake: 0,
  evaluation: 1,
  budget: 2,
  customer_decision: 3,
  on_hold: 3,
  repair: 4,
  payment: 5,
  delivered: 6,
  closed: 7,
};

type SectionStatus = "future" | "active" | "past";

function sectionStatus(
  activeFrom: number,
  activeTo: number,
  orderStage: OrderStage,
): SectionStatus {
  const idx = ORDER_STAGE_INDEX[orderStage];
  if (idx < activeFrom) return "future";
  if (idx <= activeTo) return "active";
  return "past";
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function OrderDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ─── Section header pill ─────────────────────────────────────────────────────

function SectionPill({
  status,
  t,
}: {
  status: SectionStatus;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary shadow-sm ring-2 ring-primary/10">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        {t("common.active")}
      </span>
    );
  }
  if (status === "past") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 shadow-sm dark:border-emerald-700/40 dark:bg-emerald-950 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        {t("common.complete")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
      <Lock className="h-3 w-3" />
      {t("common.pending")}
    </span>
  );
}

const MAX_PHOTOS = 5;
const PAYMENT_METHODS = ["cash", "card", "transfer"] as const;

type PartLine = {
  id: string;
  part_id: string;
  quantity: number;
  unit_cost_at_registration?: number | null;
  in_stock_at_registration?: boolean;
};

type CatalogPart = {
  id: string;
  part_code: string;
  description: string;
  unit_cost?: number;
  stock?: number;
};

function PartsEditor({
  stage,
  lines,
  canEdit,
  partId,
  setPartId,
  qty,
  setQty,
  catalog,
  onAddPart,
  onRemovePart,
  isAddingPart,
  isRemovingPart,
  showCommercialData,
  t,
}: {
  stage: "quoted" | "used";
  lines: PartLine[];
  canEdit: boolean;
  partId: string;
  setPartId: (v: string) => void;
  qty: string;
  setQty: (v: string) => void;
  catalog: CatalogPart[];
  onAddPart: (args: { stage: "quoted" | "used"; partId: string; qty: number }) => void;
  onRemovePart: (id: string) => void;
  isAddingPart: boolean;
  isRemovingPart: boolean;
  showCommercialData: boolean;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const partLabel = (id: string) => {
    const p = catalog.find((c) => c.id === id);
    return p ? `${p.part_code} — ${p.description}` : t("common.noData");
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">
        {stage === "quoted" ? t("orders.neededParts") : t("orders.usedParts")}
      </Label>
      {lines.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("orders.noParts")}</p>
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {lines.map((l) => (
            <li key={l.id} className="flex items-center justify-between px-3 py-2">
              <span className="text-sm">
                {partLabel(l.part_id)} ×{l.quantity}
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {showCommercialData &&
                  formatAmount(Number(l.unit_cost_at_registration) * l.quantity)}
                {showCommercialData && !l.in_stock_at_registration && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600">
                    {t("orders.notInStock")}
                  </Badge>
                )}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemovePart(l.id)}
                    disabled={isRemovingPart}
                  >
                    {t("common.delete")}
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Select value={partId} onValueChange={setPartId}>
              <SelectTrigger>
                <SelectValue placeholder={t("orders.selectPart")} />
              </SelectTrigger>
              <SelectContent>
                {catalog.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.part_code} — {c.description}
                    {showCommercialData
                      ? ` (${t("orders.stockShort", { count: c.stock ?? 0 })})`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="number"
            min="1"
            step="1"
            className="w-20"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={isAddingPart || !partId}
            onClick={() => onAddPart({ stage, partId, qty: Number(qty) })}
          >
            {t("orders.addPart")}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function OrderDetailPage() {
  const { t } = useTranslation();
  const { orderId } = useParams({ from: "/_authenticated/orders/$orderId" });
  const { profile, roles, session, loading: authLoading, authReady } = useAuth();
  const qc = useQueryClient();
  const transition = useServerFn(transitionOrder);
  const revertStage = useServerFn(revertOrderStage);
  const recordDecision = useServerFn(recordBudgetDecision);
  const notify = useServerFn(notifyCustomer);
  const deliver = useServerFn(deliverOrder);
  const finalize = useServerFn(closeOrder);
  const [isReprinting, setIsReprinting] = useState(false);

  const isSuper = roles.includes("super");
  const isAdministrativo = roles.includes("administrativo");
  const isTecnico = roles.includes("tecnico");
  const canSeeCommercial = isSuper || isAdministrativo;

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: order, isPending: orderPending } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => ordersRepository.getById(orderId),
    enabled: typeof window !== "undefined" && authReady && !!session,
    refetchOnMount: "always",
    retry: 2,
  });

  const { data: evaluation } = useQuery({
    queryKey: ["evaluation", orderId],
    queryFn: () => evaluationsRepository.getByOrderId(orderId),
  });

  const { data: budget, isPending: budgetPending } = useQuery({
    queryKey: ["budget", orderId],
    queryFn: () => budgetsRepository.getByOrderId(orderId),
    enabled: canSeeCommercial,
  });

  const { data: repair } = useQuery({
    queryKey: ["repair", orderId],
    queryFn: () => repairsRepository.getByOrderId(orderId),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments", orderId],
    queryFn: () => paymentsRepository.getByOrderId(orderId),
    enabled: canSeeCommercial,
  });

  const { data: techs = [] } = useTechnicians({ includeRoles: true });

  const { data: people = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: () => profilesRepository.getAllMin(),
  });

  const { data: audit = [] } = useQuery({
    queryKey: ["audit", orderId],
    queryFn: () => auditRepository.getByOrderId(orderId),
    enabled: canSeeCommercial,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["order-notes", orderId],
    queryFn: () => orderNotesRepository.getByOrderId(orderId),
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["photos", orderId],
    queryFn: () => photosRepository.getByOrderId(orderId),
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["parts-catalog"],
    queryFn: () =>
      canSeeCommercial ? partsRepository.getAll() : partsRepository.getTechnicianCatalog(),
  });

  const { data: orderParts = [] } = useQuery({
    queryKey: ["order-parts", orderId],
    queryFn: () => orderPartsRepository.getByOrderId(orderId, canSeeCommercial),
  });

  // ── React Hook Form instances ─────────────────────────────────────────────

  const evalForm = useForm<EvalValues>({
    resolver: zodResolver(evalSchema),
    defaultValues: { diagnosis: "", technical_notes: "" },
  });

  const budgetForm = useForm<BudgetValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      labor_cost: 0,
      parts_cost: 0,
      freight_cost: 0,
      other_charges: 0,
      advances: 0,
      customer_comments: "",
    },
  });

  const repairForm = useForm<RepairValues>({
    resolver: zodResolver(repairSchema),
    defaultValues: { work_description: "" },
  });

  const paymentForm = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 0, method: "cash", reference: "" },
  });

  // Simple local state for action-card-specific fields and part pickers
  const [technicianAssign, setTechnicianAssign] = useState("none");
  const [deferredReason, setDeferredReason] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [newNote, setNewNote] = useState("");
  const [evalPartId, setEvalPartId] = useState("");
  const [evalPartQty, setEvalPartQty] = useState("1");
  const [repairPartId, setRepairPartId] = useState("");
  const [repairPartQty, setRepairPartQty] = useState("1");
  const [revertReason, setRevertReason] = useState("");
  const [revertTarget, setRevertTarget] = useState<OrderStage | "">("");

  // Confirmation dialogs
  const [confirmReject, setConfirmReject] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmWaive, setConfirmWaive] = useState(false);

  // ── Hydrate forms & state when data loads ────────────────────────────────

  useEffect(() => {
    if (order) {
      setTechnicianAssign(order.technician_id ?? "none");
      setReceivedBy(order.received_by ?? "");
      setClosingNotes(order.closing_notes ?? "");
    }
  }, [order]);

  useEffect(() => {
    evalForm.reset({
      diagnosis: evaluation?.diagnosis ?? "",
      technical_notes: evaluation?.technical_notes ?? "",
    });
  }, [evaluation, evalForm]);

  useEffect(() => {
    if (budget) {
      budgetForm.reset({
        labor_cost: Number(budget.labor_cost),
        parts_cost: Number(budget.parts_cost),
        freight_cost: Number(budget.freight_cost),
        other_charges: Number(budget.other_charges),
        advances: Number(budget.advances),
        customer_comments: budget.customer_comments ?? "",
      });
      setDeferredReason(budget.deferred_reason ?? "");
    }
  }, [budget, budgetForm]);

  useEffect(() => {
    repairForm.reset({ work_description: repair?.work_description ?? "" });
  }, [repair, repairForm]);

  // ── Derived values ───────────────────────────────────────────────────────

  const nameById = new Map(people.map((p) => [p.id, p.full_name]));
  const quotedParts = orderParts.filter((p) => p.stage === "quoted");
  const usedParts = orderParts.filter((p) => p.stage === "used");
  const quotedPartsTotal = quotedParts.reduce(
    (s, p) => s + Number(p.unit_cost_at_registration) * p.quantity,
    0,
  );

  const budgetValues = budgetForm.watch();
  const budgetTotal =
    Number(budgetValues.labor_cost || 0) +
    Number(budgetValues.parts_cost || 0) +
    Number(budgetValues.freight_cost || 0) +
    Number(budgetValues.other_charges || 0);

  const isAssigned = !!order && order.technician_id === profile?.id;
  const paidTotal = payments.reduce((s, p) => s + Number(p.amount), 0) + (budget?.advances ?? 0);
  const balance = budgetTotal - paidTotal;
  const balanceSettled = !!order?.balance_waived || balance <= 0;
  const isClosed = order?.stage === "closed";

  // Role gates
  const canEditEvaluation = !isClosed && (isSuper || (isTecnico && isAssigned));
  const canEditBudget = !isClosed && (isSuper || isAdministrativo);
  const canEditRepair = !isClosed && (isSuper || (isTecnico && isAssigned));
  const canEditPayments = !isClosed && (isSuper || isAdministrativo);
  const canAssignTech = !isClosed && (isSuper || isAdministrativo);
  const canEditNotes = !isClosed && (isSuper || isAdministrativo || isAssigned);
  const ownerAdmin = !isClosed && (isSuper || isAdministrativo);
  const ownerTechAssigned = !isClosed && (isSuper || (isTecnico && isAssigned));
  const previousStages =
    order && !isClosed
      ? allowedPreviousStages(order.stage as OrderStage, {
          roles,
          isAssignedTechnician: isAssigned,
          budgetApproved: budget?.decision === "approved",
          balanceSettled,
        })
      : [];

  const invalidate = (...keys: string[]) => {
    qc.invalidateQueries({ queryKey: ["audit", orderId] });
    for (const k of keys) qc.invalidateQueries({ queryKey: [k, orderId] });
  };

  const money = formatAmount;

  // ── Mutations ────────────────────────────────────────────────────────────

  const changeStage = useMutation({
    mutationFn: async (next: OrderStage) => {
      await transition({ data: { order_id: orderId, target_stage: next } });
    },
    onSuccess: () => {
      toast.success(t("orders.stageUpdated"));
      invalidate("order");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revert = useMutation({
    mutationFn: async () => {
      if (!revertTarget || !revertReason.trim()) {
        throw new Error("Indique el motivo de la corrección.");
      }
      await revertStage({
        data: { order_id: orderId, target_stage: revertTarget, reason: revertReason.trim() },
      });
    },
    onSuccess: () => {
      toast.success(t("orders.stageUpdated"));
      setRevertReason("");
      setRevertTarget("");
      invalidate("order");
      qc.invalidateQueries({ queryKey: ["order-notes", orderId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignTech = useMutation({
    mutationFn: (value: string) =>
      ordersRepository.updateTechnician(orderId, value === "none" ? null : value),
    onSuccess: () => {
      toast.success(t("orders.technicianUpdated"));
      invalidate("order");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNote = useMutation({
    mutationFn: () => {
      if (!profile?.id || !newNote.trim()) throw new Error("La nota no puede estar vacía.");
      return orderNotesRepository.create(orderId, newNote, profile.id);
    },
    onSuccess: () => {
      toast.success(t("orders.changesSaved"));
      setNewNote("");
      qc.invalidateQueries({ queryKey: ["order-notes", orderId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveEvaluation = useMutation({
    mutationFn: (data: EvalValues) =>
      evaluationsRepository.upsert(evaluation, {
        order_id: orderId,
        diagnosis: data.diagnosis.trim(),
        technical_notes: data.technical_notes.trim() || null,
        technician_id: profile?.id ?? null,
      }),
    onSuccess: () => {
      toast.success(t("orders.evaluationSaved"));
      invalidate("evaluation");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveBudget = useMutation({
    mutationFn: (data: BudgetValues) =>
      budgetsRepository.upsert(budget, {
        order_id: orderId,
        labor_cost: data.labor_cost,
        parts_cost: data.parts_cost,
        freight_cost: data.freight_cost,
        other_charges: data.other_charges,
        advances: data.advances,
        deferred_reason: deferredReason || null,
        customer_comments: data.customer_comments || null,
      }),
    onSuccess: () => {
      toast.success(t("orders.budgetSaved"));
      invalidate("budget");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async (decision: "approved" | "deferred" | "rejected") =>
      recordDecision({
        data: { order_id: orderId, decision, deferred_reason: deferredReason || undefined },
      }),
    onSuccess: () => {
      toast.success(t("orders.decisionRecorded"));
      invalidate("order", "budget");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const notifyMut = useMutation({
    mutationFn: async (kind: "decision" | "delivery") =>
      notify({ data: { order_id: orderId, kind } }),
    onSuccess: () => {
      toast.success(t("orders.notifyRecorded"), { description: t("orders.emailPending") });
      invalidate("order");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deliverMut = useMutation({
    mutationFn: async () => {
      if (!receivedBy.trim()) throw new Error(i18n.t("orders.receivedByRequired"));
      return deliver({ data: { order_id: orderId, received_by: receivedBy.trim() } });
    },
    onSuccess: () => {
      toast.success(t("orders.stageUpdated"));
      invalidate("order");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeMut = useMutation({
    mutationFn: async () =>
      finalize({ data: { order_id: orderId, closing_notes: closingNotes || undefined } }),
    onSuccess: () => {
      toast.success(t("orders.stageUpdated"));
      invalidate("order");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRepair = useMutation({
    mutationFn: (opts: {
      data?: RepairValues;
      state?: string;
      stamp?: "started_at" | "finished_at";
    }) => {
      const desc = opts.data?.work_description ?? repairForm.getValues("work_description");
      return repairsRepository.upsert(repair, {
        order_id: orderId,
        work_description: desc || null,
        technician_id: profile?.id ?? null,
        ...(opts.state ? { state: opts.state } : {}),
        ...(opts.stamp ? { [opts.stamp]: new Date().toISOString() } : {}),
      });
    },
    onSuccess: () => {
      toast.success(t("orders.repairSaved"));
      invalidate("repair");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const concludeRepair = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      await repairsRepository.upsert(repair, {
        order_id: orderId,
        work_description: repairForm.getValues("work_description") || null,
        technician_id: profile?.id ?? null,
        state: "completed",
        started_at: repair?.started_at ?? now,
        finished_at: now,
      });
      await transition({ data: { order_id: orderId, target_stage: "payment" } });
    },
    onSuccess: () => {
      toast.success(t("orders.stageUpdated"));
      invalidate("repair", "order");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPayment = useMutation({
    mutationFn: (data: PaymentValues) => {
      if (balance <= 0) throw new Error("La orden no tiene saldo pendiente.");
      if (data.amount > balance) throw new Error("El pago no puede exceder el saldo pendiente.");
      return paymentsRepository.create({
        order_id: orderId,
        amount: data.amount,
        method: data.method,
        reference: data.reference || null,
        registered_by: profile?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success(t("orders.paymentAdded"));
      paymentForm.reset({ amount: 0, method: "cash", reference: "" });
      invalidate("payments");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const waiveBalance = useMutation({
    mutationFn: () => ordersRepository.waiveBalance(orderId),
    onSuccess: () => {
      toast.success(t("orders.changesSaved"));
      invalidate("order");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPart = useMutation({
    mutationFn: (args: { stage: "quoted" | "used"; partId: string; qty: number }) => {
      const part = catalog.find((c) => c.id === args.partId);
      if (!part) throw new Error(i18n.t("orders.selectPart"));
      if (args.qty <= 0) throw new Error(i18n.t("orders.invalidQty"));
      return orderPartsRepository.create({
        order_id: orderId,
        part_id: args.partId,
        stage: args.stage,
        quantity: args.qty,
        ...(args.stage === "quoted" && evaluation ? { evaluation_id: evaluation.id } : {}),
      });
    },
    onSuccess: (_res, args) => {
      toast.success(t("orders.partAdded"));
      if (args.stage === "quoted") {
        setEvalPartId("");
        setEvalPartQty("1");
      } else {
        setRepairPartId("");
        setRepairPartQty("1");
        qc.invalidateQueries({ queryKey: ["parts-catalog"] });
        qc.invalidateQueries({ queryKey: ["parts"] });
      }
      qc.invalidateQueries({ queryKey: ["order-parts", orderId] });
      qc.invalidateQueries({ queryKey: ["audit", orderId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePart = useMutation({
    mutationFn: (id: string) => orderPartsRepository.delete(id),
    onSuccess: () => {
      toast.success(t("orders.changesSaved"));
      qc.invalidateQueries({ queryKey: ["order-parts", orderId] });
      qc.invalidateQueries({ queryKey: ["parts-catalog"] });
      qc.invalidateQueries({ queryKey: ["audit", orderId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadPhoto = useMutation({
    mutationFn: (file: File) => {
      if (photos.length >= MAX_PHOTOS)
        throw new Error(i18n.t("orders.maxPhotos", { max: MAX_PHOTOS }));
      if (file.size > 5 * 1024 * 1024) throw new Error(i18n.t("orders.photoTooLarge"));
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
        throw new Error(i18n.t("orders.photoFormat"));
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${orderId}/${crypto.randomUUID()}.${ext}`;
      return photosRepository.upload(orderId, path, file, profile?.id ?? null);
    },
    onSuccess: () => {
      toast.success(t("orders.photoUploaded"));
      qc.invalidateQueries({ queryKey: ["photos", orderId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePhoto = useMutation({
    mutationFn: (p: { id: string; storage_path: string }) =>
      photosRepository.delete(p.id, p.storage_path),
    onSuccess: () => {
      toast.success(t("orders.photoDeleted"));
      qc.invalidateQueries({ queryKey: ["photos", orderId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Loading / not found ───────────────────────────────────────────────────

  if (authLoading || orderPending) return <OrderDetailSkeleton />;
  if (!order) return <p className="text-sm text-muted-foreground">{t("orders.notFound")}</p>;
  const receivedAccessories = order.received_accessories;
  const equipmentCondition = order.equipment_condition;

  // ── Helpers ───────────────────────────────────────────────────────────────

  const downloadQuote = () => {
    const v = budgetForm.getValues();
    const total = v.labor_cost + v.parts_cost + v.freight_cost + v.other_charges;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(t("orders.quoteTitle", { number: order.order_number }), 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(order.customers?.name ?? "", 14, 25);
    doc.text(`${order.equipment?.brand ?? ""} ${order.equipment?.model ?? ""}`.trim(), 14, 30);
    autoTable(doc, {
      head: [[t("orders.concept"), t("orders.amount")]],
      body: [
        [t("orders.laborCost"), money(v.labor_cost)],
        [t("orders.partsCost"), money(v.parts_cost)],
        [t("orders.freightCost"), money(v.freight_cost)],
        [t("orders.otherCharges"), money(v.other_charges)],
        [t("orders.advances"), money(v.advances)],
        [t("orders.total"), money(total)],
      ],
      startY: 36,
      styles: { fontSize: 9 },
    });
    doc.save(`quote-${order.order_number}.pdf`);
  };

  const reprintServiceOrder = async () => {
    setIsReprinting(true);
    try {
      await downloadServiceOrderPdf(order, Number(budget?.advances ?? 0));
      toast.success(t("orders.serviceOrderPdfDownloaded"));
    } catch (error) {
      console.error("Unable to download service order PDF", error);
      toast.error(t("orders.serviceOrderPdfError"));
    } finally {
      setIsReprinting(false);
    }
  };

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
    if ("technician_id" in changed) return t("orders.technicianUpdated");
    if ("general_notes" in changed) return t("orders.changesSaved");
    return t("orders.changesSaved");
  };

  const waiting = (role: string) => (
    <p className="text-sm text-muted-foreground">
      {t("orders.waitingFor", { role: getRoleLabel(role, t) })}
    </p>
  );

  // ── Current step action content ───────────────────────────────────────────

  const currentStepContent = (() => {
    switch (order.stage as OrderStage) {
      case "intake":
        return ownerAdmin ? (
          <Button
            className="w-full"
            onClick={() => changeStage.mutate("evaluation")}
            disabled={changeStage.isPending}
          >
            {t("orders.sendToEvaluation")}
          </Button>
        ) : (
          waiting("administrativo")
        );

      case "evaluation":
        return ownerTechAssigned ? (
          <Button
            className="w-full"
            onClick={() => changeStage.mutate("budget")}
            disabled={changeStage.isPending}
          >
            {t("orders.completeEvaluation")}
          </Button>
        ) : (
          waiting("tecnico")
        );

      case "budget":
        return ownerAdmin ? (
          <Button
            className="w-full"
            onClick={() => changeStage.mutate("customer_decision")}
            disabled={changeStage.isPending}
          >
            {t("orders.sendToDecision")}
          </Button>
        ) : (
          waiting("administrativo")
        );

      case "customer_decision":
        return ownerAdmin ? (
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => notifyMut.mutate("decision")}
              disabled={notifyMut.isPending}
            >
              {t("orders.notifyDecision")}
            </Button>
            {order.decision_notified_at && (
              <p className="text-xs text-muted-foreground">
                {t("orders.decisionNotifiedAt", {
                  date: formatDateTime(order.decision_notified_at),
                })}
              </p>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">{t("orders.deferredReason")}</Label>
              <Input
                value={deferredReason}
                onChange={(e) => setDeferredReason(e.target.value)}
                placeholder={t("orders.deferredReasonHint")}
                className="text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                size="sm"
                onClick={() => decide.mutate("approved")}
                disabled={decide.isPending}
              >
                {getDecisionLabel("approved", t)}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => decide.mutate("deferred")}
                disabled={decide.isPending}
              >
                {getDecisionLabel("deferred", t)}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmReject(true)}
                disabled={decide.isPending}
              >
                {getDecisionLabel("rejected", t)}
              </Button>
            </div>
          </div>
        ) : (
          waiting("administrativo")
        );

      case "on_hold":
        return ownerAdmin ? (
          <Button
            className="w-full"
            onClick={() => changeStage.mutate("customer_decision")}
            disabled={changeStage.isPending}
          >
            {t("orders.backToDecision")}
          </Button>
        ) : (
          waiting("administrativo")
        );

      case "repair":
        return ownerTechAssigned ? (
          <Button
            className="w-full"
            onClick={() => concludeRepair.mutate()}
            disabled={concludeRepair.isPending}
          >
            {t("orders.markRepairComplete")}
          </Button>
        ) : (
          waiting("tecnico")
        );

      case "payment":
        return ownerAdmin ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span className="text-muted-foreground">{t("orders.balance")}</span>
              <span className="font-semibold">{money(balance)}</span>
            </div>
            {!balanceSettled ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t("orders.settleBalanceFirst")}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => setConfirmWaive(true)}
                  disabled={waiveBalance.isPending}
                >
                  {t("orders.waiveBalance")}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs">{t("orders.receivedBy")}</Label>
                <Input
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  className="text-sm"
                />
                <Button
                  className="w-full"
                  onClick={() => deliverMut.mutate()}
                  disabled={deliverMut.isPending}
                >
                  {t("orders.deliver")}
                </Button>
              </div>
            )}
          </div>
        ) : (
          waiting("administrativo")
        );

      case "delivered":
        return ownerAdmin ? (
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => notifyMut.mutate("delivery")}
              disabled={notifyMut.isPending}
            >
              {t("orders.notifyDelivery")}
            </Button>
            {order.delivery_notified_at && (
              <p className="text-xs text-muted-foreground">
                {t("orders.deliveryNotifiedAt", {
                  date: formatDateTime(order.delivery_notified_at),
                })}
              </p>
            )}
            <div className="space-y-2">
              <Label className="text-xs">{t("orders.closingNotes")}</Label>
              <Textarea
                rows={2}
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                className="text-sm"
              />
              <Button
                className="w-full"
                onClick={() => setConfirmClose(true)}
                disabled={closeMut.isPending}
              >
                {t("orders.closeOrder")}
              </Button>
            </div>
          </div>
        ) : (
          waiting("administrativo")
        );

      case "closed":
        return <p className="text-sm text-muted-foreground">{t("orders.orderClosed")}</p>;

      default:
        return null;
    }
  })();

  // ── Section statuses ─────────────────────────────────────────────────────
  const evalStatus = sectionStatus(1, 1, order.stage as OrderStage);
  const budgetStatus = sectionStatus(2, 3, order.stage as OrderStage);
  const repairStatus = sectionStatus(4, 4, order.stage as OrderStage);
  const paymentStatus = sectionStatus(5, 6, order.stage as OrderStage);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Back + header */}
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
        subtitle={t("orders.createdAt", { date: formatDateTime(order.created_at) })}
      >
        <div className="flex flex-wrap items-center gap-2">
          {canSeeCommercial && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={reprintServiceOrder}
              disabled={isReprinting || budgetPending}
            >
              <Printer className="mr-2 h-4 w-4" />
              {isReprinting ? t("orders.generatingPdf") : t("orders.reprintServiceOrder")}
            </Button>
          )}
          <StageBadge stage={order.stage} t={t} />
        </div>
      </PageHeader>

      {/* Progress stepper */}
      <Card>
        <CardContent className="py-4">
          <OrderStageStepper stage={order.stage} t={t} />
        </CardContent>
      </Card>

      {/* ── Action banner ── */}
      <Card className="border-l-4 border-l-primary bg-primary/[0.03]">
        <CardContent className="py-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="shrink-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("orders.currentStep")}
              </p>
              <p className="mt-0.5 text-base font-semibold">{getStageLabel(order.stage, t)}</p>
            </div>
            <div className="flex flex-1 min-w-0 items-start justify-center">
              <div className="w-full sm:max-w-xs">{currentStepContent}</div>
            </div>
            {canAssignTech && (
              <div className="shrink-0 min-w-[180px] space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t("orders.assignTechnician")}
                </Label>
                <Select
                  value={technicianAssign}
                  onValueChange={(v) => {
                    setTechnicianAssign(v);
                    assignTech.mutate(v);
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
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
            )}
            {previousStages.length > 0 && (
              <div className="min-w-[220px] space-y-2 border-t pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                <Label className="text-xs text-muted-foreground">Corregir fase</Label>
                <Select
                  value={revertTarget}
                  onValueChange={(value) => setRevertTarget(value as OrderStage)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Seleccionar fase anterior" />
                  </SelectTrigger>
                  <SelectContent>
                    {previousStages.map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {getStageLabel(stage, t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  rows={2}
                  value={revertReason}
                  onChange={(event) => setRevertReason(event.target.value)}
                  placeholder="Motivo de la corrección"
                  className="text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={!revertTarget || !revertReason.trim() || revert.isPending}
                  onClick={() => revert.mutate()}
                >
                  Regresar a fase anterior
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Main grid ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* Client & equipment summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("orders.clientAndEquipment")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("common.client")}
                </p>
                <p className="mt-1 font-medium">{order.customers?.name}</p>
                <p className="text-muted-foreground">{order.customers?.phone1}</p>
                <p className="text-muted-foreground">{order.customers?.email}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("common.equipment")}
                </p>
                <p className="mt-1 font-medium">
                  {order.equipment?.brand} {order.equipment?.model}
                </p>
                <p className="text-muted-foreground">{order.equipment?.type}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {order.equipment?.serial_number ?? t("common.noData")}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("orders.reportedProblem")}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{order.reported_fault}</p>
              </div>
              {receivedAccessories && (
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("equipmentPage.accessories")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{receivedAccessories}</p>
                </div>
              )}
              {equipmentCondition && (
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("orders.equipmentCondition")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{equipmentCondition}</p>
                </div>
              )}
              <div className="sm:col-span-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {t("orders.origin")}:{" "}
                  {order.source
                    ? t(`orders.source_${order.source}`, { defaultValue: order.source })
                    : t("common.noData")}
                </span>
                {order.authorized && (
                  <span className="text-emerald-600">{t("orders.authorized")}</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Evaluation section ── */}
          <Card
            className={evalStatus === "active" ? "ring-1 ring-primary/25 shadow-sm" : undefined}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">{t("orders.evaluation")}</CardTitle>
              <SectionPill status={evalStatus} t={t} />
            </CardHeader>
            <CardContent className="space-y-4">
              {evalStatus === "future" ? (
                <p className="text-sm text-muted-foreground">{t("orders.sectionPending")}</p>
              ) : (
                <Form {...evalForm}>
                  <form
                    onSubmit={evalForm.handleSubmit((data) => saveEvaluation.mutate(data))}
                    className="space-y-4"
                  >
                    <FormField
                      control={evalForm.control}
                      name="diagnosis"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("orders.diagnosis")} *</FormLabel>
                          <FormControl>
                            <Textarea rows={3} {...field} disabled={!canEditEvaluation} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={evalForm.control}
                      name="technical_notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("orders.technicalNotes")}</FormLabel>
                          <FormControl>
                            <Textarea rows={2} {...field} disabled={!canEditEvaluation} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {canEditEvaluation && (
                      <div className="flex justify-end">
                        <Button type="submit" disabled={saveEvaluation.isPending} size="sm">
                          {t("orders.saveEvaluation")}
                        </Button>
                      </div>
                    )}
                  </form>
                </Form>
              )}
              {evalStatus !== "future" && (
                <>
                  <Separator />
                  <PartsEditor
                    stage="quoted"
                    lines={quotedParts}
                    canEdit={canEditEvaluation && evalStatus === "active"}
                    partId={evalPartId}
                    setPartId={setEvalPartId}
                    qty={evalPartQty}
                    setQty={setEvalPartQty}
                    catalog={catalog}
                    onAddPart={(args) => addPart.mutate(args)}
                    onRemovePart={(id) => removePart.mutate(id)}
                    isAddingPart={addPart.isPending}
                    isRemovingPart={removePart.isPending}
                    showCommercialData={canSeeCommercial}
                    t={t}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Budget section ── */}
          {canSeeCommercial && (
            <Card
              className={budgetStatus === "active" ? "ring-1 ring-primary/25 shadow-sm" : undefined}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">{t("orders.budget")}</CardTitle>
                <SectionPill status={budgetStatus} t={t} />
              </CardHeader>
              <CardContent className="space-y-4">
                {budgetStatus === "future" ? (
                  <p className="text-sm text-muted-foreground">{t("orders.sectionPending")}</p>
                ) : (
                  <Form {...budgetForm}>
                    <form
                      onSubmit={budgetForm.handleSubmit((data) => saveBudget.mutate(data))}
                      className="space-y-4"
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        {(
                          [
                            ["orders.laborCost", "labor_cost"],
                            ["orders.partsCost", "parts_cost"],
                            ["orders.freightCost", "freight_cost"],
                            ["orders.otherCharges", "other_charges"],
                            ["orders.advances", "advances"],
                          ] as const
                        ).map(([labelKey, fieldName]) => (
                          <FormField
                            key={fieldName}
                            control={budgetForm.control}
                            name={fieldName}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t(labelKey)}</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    {...field}
                                    disabled={!canEditBudget}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      {canEditBudget && quotedPartsTotal > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => budgetForm.setValue("parts_cost", quotedPartsTotal)}
                        >
                          {t("orders.usePartsTotal", { total: money(quotedPartsTotal) })}
                        </Button>
                      )}
                      <FormField
                        control={budgetForm.control}
                        name="customer_comments"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("orders.customerComments")}</FormLabel>
                            <FormControl>
                              <Textarea rows={2} {...field} disabled={!canEditBudget} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Running total */}
                      <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                        <span className="text-muted-foreground">{t("orders.total")}</span>
                        <span className="font-semibold">{money(budgetTotal)}</span>
                      </div>

                      {/* Decision display */}
                      {budget?.decision && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">{t("orders.decision")}:</span>
                          <span className="font-medium">
                            {getDecisionLabel(budget.decision, t)}
                          </span>
                          {budget.decision === "deferred" && budget.deferred_reason && (
                            <span className="text-muted-foreground">
                              — {budget.deferred_reason}
                            </span>
                          )}
                        </div>
                      )}

                      {canEditBudget && (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {budget && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={downloadQuote}
                            >
                              {t("orders.downloadQuote")}
                            </Button>
                          )}
                          <Button type="submit" size="sm" disabled={saveBudget.isPending}>
                            {t("orders.saveBudget")}
                          </Button>
                        </div>
                      )}
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Repair section ── */}
          <Card
            className={repairStatus === "active" ? "ring-1 ring-primary/25 shadow-sm" : undefined}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">{t("orders.repair")}</CardTitle>
              <SectionPill status={repairStatus} t={t} />
            </CardHeader>
            <CardContent className="space-y-4">
              {repairStatus === "future" ? (
                <p className="text-sm text-muted-foreground">{t("orders.sectionPending")}</p>
              ) : (
                <Form {...repairForm}>
                  <form
                    onSubmit={repairForm.handleSubmit((data) => saveRepair.mutate({ data }))}
                    className="space-y-4"
                  >
                    <FormField
                      control={repairForm.control}
                      name="work_description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("orders.workDescription")}</FormLabel>
                          <FormControl>
                            <Textarea rows={3} {...field} disabled={!canEditRepair} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {repair?.started_at && (
                        <span>
                          {t("orders.started")}: {formatDateTime(repair.started_at)}
                        </span>
                      )}
                      {repair?.finished_at && (
                        <span>
                          {t("orders.finished")}: {formatDateTime(repair.finished_at)}
                        </span>
                      )}
                    </div>
                    {canEditRepair && repairStatus === "active" && (
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button type="submit" size="sm" disabled={saveRepair.isPending}>
                          {t("orders.saveRepair")}
                        </Button>
                      </div>
                    )}
                  </form>
                </Form>
              )}
              {repairStatus !== "future" && (
                <>
                  <Separator />
                  <PartsEditor
                    stage="used"
                    lines={usedParts}
                    canEdit={canEditRepair && repairStatus === "active"}
                    partId={repairPartId}
                    setPartId={setRepairPartId}
                    qty={repairPartQty}
                    setQty={setRepairPartQty}
                    catalog={catalog}
                    onAddPart={(args) => addPart.mutate(args)}
                    onRemovePart={(id) => removePart.mutate(id)}
                    isAddingPart={addPart.isPending}
                    isRemovingPart={removePart.isPending}
                    showCommercialData={canSeeCommercial}
                    t={t}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Payments section ── */}
          {canSeeCommercial && (
            <Card
              className={
                paymentStatus === "active" ? "ring-1 ring-primary/25 shadow-sm" : undefined
              }
            >
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">{t("orders.payments")}</CardTitle>
                <SectionPill status={paymentStatus} t={t} />
              </CardHeader>
              <CardContent className="space-y-4">
                {paymentStatus === "future" ? (
                  <p className="text-sm text-muted-foreground">{t("orders.sectionPending")}</p>
                ) : (
                  <>
                    {/* Totals row */}
                    <div className="grid gap-2 text-sm sm:grid-cols-3">
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
                        <p
                          className={`font-semibold ${balance > 0 ? "text-destructive" : "text-emerald-600"}`}
                        >
                          {money(balance)}
                        </p>
                      </div>
                    </div>

                    {payments.length > 0 && (
                      <ul className="divide-y rounded-md border text-sm">
                        {payments.map((p) => (
                          <li key={p.id} className="flex items-center justify-between px-3 py-2">
                            <span>
                              {money(Number(p.amount))} · {t(`orders.method_${p.method}`, p.method)}
                              {p.reference ? ` · ${p.reference}` : ""}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(p.paid_at)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {canEditPayments && paymentStatus === "active" && (
                      <>
                        <Separator />
                        <Form {...paymentForm}>
                          <form
                            onSubmit={paymentForm.handleSubmit((data) => addPayment.mutate(data))}
                            className="grid gap-3 sm:grid-cols-4 sm:items-end"
                          >
                            <FormField
                              control={paymentForm.control}
                              name="amount"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t("orders.amount")}</FormLabel>
                                  <FormControl>
                                    <Input type="number" min="0" step="0.01" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={paymentForm.control}
                              name="method"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t("orders.method")}</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {PAYMENT_METHODS.map((m) => (
                                        <SelectItem key={m} value={m}>
                                          {t(`orders.method_${m}`)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={paymentForm.control}
                              name="reference"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t("orders.reference")}</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button type="submit" disabled={addPayment.isPending || balance <= 0}>
                              {t("orders.addPayment")}
                            </Button>
                          </form>
                        </Form>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Photos ── */}
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
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((p) => (
                    <div
                      key={p.id}
                      className="group relative aspect-square overflow-hidden rounded-md border"
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
                        className="absolute right-1 top-1 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => deletePhoto.mutate(p)}
                        disabled={isClosed}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {!isClosed && photos.length < MAX_PHOTOS && (
                <div className="flex items-center gap-3">
                  <Label
                    htmlFor="photo-upload"
                    className="cursor-pointer inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
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

        {/* ── Sidebar ── */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("orders.internalNotes")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={4}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                disabled={!canEditNotes}
                className="text-sm"
              />
              {canEditNotes && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => saveNote.mutate()}
                    disabled={saveNote.isPending || !newNote.trim()}
                  >
                    {t("orders.saveChanges")}
                  </Button>
                </div>
              )}
              {notes.length > 0 && (
                <ol className="space-y-3 border-t pt-3">
                  {notes.map((note) => (
                    <li key={note.id} className="border-l-2 border-border pl-3 text-sm">
                      <p className="whitespace-pre-wrap">{note.body}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(note.created_at)} ·{" "}
                        {nameById.get(note.created_by) ?? t("common.noData")}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {canSeeCommercial && (
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
                        <p className="font-medium leading-snug">{auditLabel(a)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDateTime(a.change_ts)}
                          {a.app_user && ` · ${nameById.get(a.app_user) ?? t("common.noData")}`}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Confirmation dialogs ── */}
      <AlertDialog open={confirmReject} onOpenChange={setConfirmReject}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orders.confirmReject")}</AlertDialogTitle>
            <AlertDialogDescription>{t("orders.confirmRejectDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmReject(false);
                decide.mutate("rejected");
              }}
            >
              {getDecisionLabel("rejected", t)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orders.confirmClose")}</AlertDialogTitle>
            <AlertDialogDescription>{t("orders.confirmCloseDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmClose(false);
                closeMut.mutate();
              }}
            >
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmWaive} onOpenChange={setConfirmWaive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orders.confirmWaive")}</AlertDialogTitle>
            <AlertDialogDescription>{t("orders.confirmWaiveDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmWaive(false);
                waiveBalance.mutate();
              }}
            >
              {t("orders.waiveBalance")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
