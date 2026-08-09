import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ordersRepository } from "@/lib/repositories/orders.repository";
import {
  filterReportRows,
  formatReportValue,
  OPERATORS_BY_TYPE,
  VALUELESS_OPERATORS,
  type FilterConnector,
  type ReportField,
  type ReportFilter,
  type ReportOperator,
  type ReportValue,
} from "@/lib/order-report";
import { buildReportCsv, buildReportExcel, type ReportExportCell } from "@/lib/order-report-export";
import { formatAmount, formatDate, formatDateTime } from "@/lib/utils";
import { getDecisionLabel, getStageLabel } from "@/lib/digitron";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ReportOrder = Awaited<ReturnType<typeof ordersRepository.getAllForReports>>[number];

type OrderReportBuilderProps = {
  orders: ReportOrder[];
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  onRetry: () => void;
  generatedLine: string;
};

const DEFAULT_COLUMNS = [
  "order_number",
  "created_at",
  "stage",
  "client_name",
  "equipment",
  "reported_fault",
  "technician",
  "budget_total",
] as const;

const DEFAULT_FILTER_FIELD = "order_number";

function firstRelated<T>(value: T[] | T | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

function sumPayments(order: ReportOrder) {
  return order.payments.reduce((total, payment) => total + Number(payment.amount), 0);
}

function budgetTotal(order: ReportOrder) {
  const budget = firstRelated(order.budgets);
  if (!budget) return null;
  return (
    Number(budget.labor_cost) +
    Number(budget.parts_cost) +
    Number(budget.freight_cost) +
    Number(budget.other_charges)
  );
}

function sourceLabel(source: ReportValue, t: TFunction) {
  if (!source) return null;
  return t(`orders.source_${String(source)}`, { defaultValue: String(source) });
}

function paymentMethodLabel(method: string, t: TFunction) {
  return t(`orders.method_${method}`, { defaultValue: method });
}

function createReportFields(
  t: TFunction,
  orderNumberById: Map<string, string>,
): ReportField<ReportOrder>[] {
  const groups = {
    order: t("reports.groups.order"),
    client: t("reports.groups.client"),
    equipment: t("reports.groups.equipment"),
    evaluation: t("reports.groups.evaluation"),
    budget: t("reports.groups.budget"),
    repair: t("reports.groups.repair"),
    payment: t("reports.groups.payment"),
  };
  const date = (value: ReportValue) => formatDate(String(value));
  const dateTime = (value: ReportValue) => formatDateTime(String(value));
  const money = (value: ReportValue) => formatAmount(Number(value));
  const yesNo = (value: ReportValue) => (value ? t("reports.yes") : t("reports.no"));

  return [
    {
      id: "order_number",
      label: t("reports.fields.orderNumber"),
      group: groups.order,
      type: "text",
      value: (order) => order.order_number,
    },
    {
      id: "stage",
      label: t("common.status"),
      group: groups.order,
      type: "text",
      value: (order) => getStageLabel(order.stage, t),
    },
    {
      id: "created_at",
      label: t("reports.fields.createdAt"),
      group: groups.order,
      type: "date",
      value: (order) => order.created_at,
      format: dateTime,
    },
    {
      id: "updated_at",
      label: t("reports.fields.updatedAt"),
      group: groups.order,
      type: "date",
      value: (order) => order.updated_at,
      format: dateTime,
    },
    {
      id: "intake_at",
      label: t("reports.fields.intakeAt"),
      group: groups.order,
      type: "date",
      value: (order) => order.intake_at,
      format: dateTime,
    },
    {
      id: "delivery_at",
      label: t("reports.fields.deliveryAt"),
      group: groups.order,
      type: "date",
      value: (order) => order.delivery_at,
      format: dateTime,
    },
    {
      id: "source",
      label: t("reports.fields.source"),
      group: groups.order,
      type: "text",
      value: (order) => sourceLabel(order.source, t),
    },
    {
      id: "technician",
      label: t("common.technician"),
      group: groups.order,
      type: "text",
      value: (order) => order.technician?.full_name,
    },
    {
      id: "reported_fault",
      label: t("reports.fields.reportedFault"),
      group: groups.order,
      type: "text",
      value: (order) => order.reported_fault,
    },
    {
      id: "received_accessories",
      label: t("reports.fields.receivedAccessories"),
      group: groups.order,
      type: "text",
      value: (order) => order.received_accessories,
    },
    {
      id: "equipment_condition",
      label: t("reports.fields.equipmentCondition"),
      group: groups.order,
      type: "text",
      value: (order) => order.equipment_condition,
    },
    {
      id: "general_notes",
      label: t("reports.fields.generalNotes"),
      group: groups.order,
      type: "text",
      value: (order) => order.general_notes,
    },
    {
      id: "authorized",
      label: t("reports.fields.authorized"),
      group: groups.order,
      type: "boolean",
      value: (order) => order.authorized,
      format: yesNo,
    },
    {
      id: "decision_notified_at",
      label: t("reports.fields.decisionNotifiedAt"),
      group: groups.order,
      type: "date",
      value: (order) => order.decision_notified_at,
      format: dateTime,
    },
    {
      id: "delivery_notified_at",
      label: t("reports.fields.deliveryNotifiedAt"),
      group: groups.order,
      type: "date",
      value: (order) => order.delivery_notified_at,
      format: dateTime,
    },
    {
      id: "received_by",
      label: t("reports.fields.receivedBy"),
      group: groups.order,
      type: "text",
      value: (order) => order.received_by,
    },
    {
      id: "closing_notes",
      label: t("reports.fields.closingNotes"),
      group: groups.order,
      type: "text",
      value: (order) => order.closing_notes,
    },
    {
      id: "warranty_origin",
      label: t("reports.fields.warrantyOrigin"),
      group: groups.order,
      type: "text",
      value: (order) =>
        order.warranty_origin_id ? orderNumberById.get(order.warranty_origin_id) : null,
    },
    {
      id: "balance_waived",
      label: t("reports.fields.balanceWaived"),
      group: groups.order,
      type: "boolean",
      value: (order) => order.balance_waived,
      format: yesNo,
    },
    {
      id: "client_name",
      label: t("common.client"),
      group: groups.client,
      type: "text",
      value: (order) => order.customers?.name,
    },
    {
      id: "client_tax_id",
      label: t("reports.fields.clientTaxId"),
      group: groups.client,
      type: "text",
      value: (order) => order.customers?.tax_id,
    },
    {
      id: "client_phone1",
      label: t("reports.fields.clientPhone1"),
      group: groups.client,
      type: "text",
      value: (order) => order.customers?.phone1,
    },
    {
      id: "client_phone2",
      label: t("reports.fields.clientPhone2"),
      group: groups.client,
      type: "text",
      value: (order) => order.customers?.phone2,
    },
    {
      id: "client_email",
      label: t("common.email"),
      group: groups.client,
      type: "text",
      value: (order) => order.customers?.email,
    },
    {
      id: "client_address",
      label: t("reports.fields.clientAddress"),
      group: groups.client,
      type: "text",
      value: (order) => order.customers?.address,
    },
    {
      id: "equipment",
      label: t("common.equipment"),
      group: groups.equipment,
      type: "text",
      value: (order) => [order.equipment?.brand, order.equipment?.model].filter(Boolean).join(" "),
    },
    {
      id: "equipment_type",
      label: t("reports.fields.equipmentType"),
      group: groups.equipment,
      type: "text",
      value: (order) => order.equipment?.type,
    },
    {
      id: "equipment_brand",
      label: t("reports.fields.equipmentBrand"),
      group: groups.equipment,
      type: "text",
      value: (order) => order.equipment?.brand,
    },
    {
      id: "equipment_model",
      label: t("reports.fields.equipmentModel"),
      group: groups.equipment,
      type: "text",
      value: (order) => order.equipment?.model,
    },
    {
      id: "equipment_serial",
      label: t("reports.fields.equipmentSerial"),
      group: groups.equipment,
      type: "text",
      value: (order) => order.equipment?.serial_number,
    },
    {
      id: "equipment_description",
      label: t("reports.fields.equipmentDescription"),
      group: groups.equipment,
      type: "text",
      value: (order) => order.equipment?.description,
    },
    {
      id: "purchase_date",
      label: t("reports.fields.purchaseDate"),
      group: groups.equipment,
      type: "date",
      value: (order) => order.equipment?.purchase_date,
      format: date,
    },
    {
      id: "purchase_invoice",
      label: t("reports.fields.purchaseInvoice"),
      group: groups.equipment,
      type: "text",
      value: (order) => order.equipment?.purchase_invoice,
    },
    {
      id: "purchase_store",
      label: t("reports.fields.purchaseStore"),
      group: groups.equipment,
      type: "text",
      value: (order) => order.equipment?.purchase_store,
    },
    {
      id: "diagnosis",
      label: t("reports.fields.diagnosis"),
      group: groups.evaluation,
      type: "text",
      value: (order) => firstRelated(order.technical_evaluations)?.diagnosis,
    },
    {
      id: "technical_notes",
      label: t("reports.fields.technicalNotes"),
      group: groups.evaluation,
      type: "text",
      value: (order) => firstRelated(order.technical_evaluations)?.technical_notes,
    },
    {
      id: "evaluated_at",
      label: t("reports.fields.evaluatedAt"),
      group: groups.evaluation,
      type: "date",
      value: (order) => firstRelated(order.technical_evaluations)?.evaluated_at,
      format: dateTime,
    },
    {
      id: "labor_cost",
      label: t("reports.fields.laborCost"),
      group: groups.budget,
      type: "number",
      value: (order) => firstRelated(order.budgets)?.labor_cost,
      format: money,
    },
    {
      id: "parts_cost",
      label: t("reports.fields.partsCost"),
      group: groups.budget,
      type: "number",
      value: (order) => firstRelated(order.budgets)?.parts_cost,
      format: money,
    },
    {
      id: "freight_cost",
      label: t("reports.fields.freightCost"),
      group: groups.budget,
      type: "number",
      value: (order) => firstRelated(order.budgets)?.freight_cost,
      format: money,
    },
    {
      id: "other_charges",
      label: t("reports.fields.otherCharges"),
      group: groups.budget,
      type: "number",
      value: (order) => firstRelated(order.budgets)?.other_charges,
      format: money,
    },
    {
      id: "budget_total",
      label: t("reports.fields.budgetTotal"),
      group: groups.budget,
      type: "number",
      value: budgetTotal,
      format: money,
    },
    {
      id: "advances",
      label: t("reports.fields.advances"),
      group: groups.budget,
      type: "number",
      value: (order) => firstRelated(order.budgets)?.advances,
      format: money,
    },
    {
      id: "budget_decision",
      label: t("reports.fields.budgetDecision"),
      group: groups.budget,
      type: "text",
      value: (order) => {
        const decision = firstRelated(order.budgets)?.decision;
        return decision ? getDecisionLabel(decision, t) : null;
      },
    },
    {
      id: "deferred_reason",
      label: t("reports.fields.deferredReason"),
      group: groups.budget,
      type: "text",
      value: (order) => firstRelated(order.budgets)?.deferred_reason,
    },
    {
      id: "customer_comments",
      label: t("reports.fields.customerComments"),
      group: groups.budget,
      type: "text",
      value: (order) => firstRelated(order.budgets)?.customer_comments,
    },
    {
      id: "budgeted_at",
      label: t("reports.fields.budgetedAt"),
      group: groups.budget,
      type: "date",
      value: (order) => firstRelated(order.budgets)?.budgeted_at,
      format: dateTime,
    },
    {
      id: "decided_at",
      label: t("reports.fields.decidedAt"),
      group: groups.budget,
      type: "date",
      value: (order) => firstRelated(order.budgets)?.decided_at,
      format: dateTime,
    },
    {
      id: "repair_state",
      label: t("reports.fields.repairState"),
      group: groups.repair,
      type: "text",
      value: (order) => firstRelated(order.repairs)?.state,
    },
    {
      id: "work_description",
      label: t("reports.fields.workDescription"),
      group: groups.repair,
      type: "text",
      value: (order) => firstRelated(order.repairs)?.work_description,
    },
    {
      id: "repair_started_at",
      label: t("reports.fields.repairStartedAt"),
      group: groups.repair,
      type: "date",
      value: (order) => firstRelated(order.repairs)?.started_at,
      format: dateTime,
    },
    {
      id: "repair_finished_at",
      label: t("reports.fields.repairFinishedAt"),
      group: groups.repair,
      type: "date",
      value: (order) => firstRelated(order.repairs)?.finished_at,
      format: dateTime,
    },
    {
      id: "payments_total",
      label: t("reports.fields.paymentsTotal"),
      group: groups.payment,
      type: "number",
      value: sumPayments,
      format: money,
    },
    {
      id: "balance",
      label: t("reports.fields.balance"),
      group: groups.payment,
      type: "number",
      value: (order) => {
        const total = budgetTotal(order);
        if (total === null) return null;
        return total - sumPayments(order) - Number(firstRelated(order.budgets)?.advances ?? 0);
      },
      format: money,
    },
    {
      id: "payment_count",
      label: t("reports.fields.paymentCount"),
      group: groups.payment,
      type: "number",
      value: (order) => order.payments.length,
    },
    {
      id: "last_payment_at",
      label: t("reports.fields.lastPaymentAt"),
      group: groups.payment,
      type: "date",
      value: (order) =>
        order.payments.reduce<string | null>(
          (latest, payment) => (!latest || payment.paid_at > latest ? payment.paid_at : latest),
          null,
        ),
      format: dateTime,
    },
    {
      id: "payment_methods",
      label: t("reports.fields.paymentMethods"),
      group: groups.payment,
      type: "text",
      value: (order) =>
        [...new Set(order.payments.map((payment) => paymentMethodLabel(payment.method, t)))].join(
          ", ",
        ),
    },
    {
      id: "payment_references",
      label: t("reports.fields.paymentReferences"),
      group: groups.payment,
      type: "text",
      value: (order) =>
        order.payments
          .map((payment) => payment.reference)
          .filter((reference): reference is string => Boolean(reference))
          .join(", "),
    },
  ];
}

function exportListPdf(
  title: string,
  generatedLine: string,
  fields: ReportField<ReportOrder>[],
  orders: ReportOrder[],
  emptyLabel: string,
) {
  const doc = new jsPDF({ orientation: fields.length > 5 ? "landscape" : "portrait" });
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(generatedLine, 14, 25);
  autoTable(doc, {
    head: [fields.map((field) => field.label)],
    body: orders.map((order) => fields.map((field) => formatReportValue(field, order, emptyLabel))),
    startY: 32,
    styles: { fontSize: fields.length > 8 ? 6 : 8, overflow: "linebreak" },
  });
  doc.save("listado-ordenes-de-servicio.pdf");
}

function createExportRows(
  fields: ReportField<ReportOrder>[],
  orders: ReportOrder[],
  emptyLabel: string,
): ReportExportCell[][] {
  return orders.map((order) =>
    fields.map((field) => {
      const value = field.value(order);
      if (field.type === "number" && typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      return formatReportValue(field, order, emptyLabel);
    }),
  );
}

function downloadTextFile(filename: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function operatorLabel(operator: ReportOperator, t: TFunction) {
  return t(`reports.operators.${operator}`);
}

export function OrderReportBuilder({
  orders,
  isPending,
  isError,
  error,
  onRetry,
  generatedLine,
}: OrderReportBuilderProps) {
  const { t } = useTranslation();
  const orderNumberById = useMemo(
    () => new Map(orders.map((order) => [order.id, order.order_number])),
    [orders],
  );
  const fields = useMemo(() => createReportFields(t, orderNumberById), [orderNumberById, t]);
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>([...DEFAULT_COLUMNS]);
  const [columnSearch, setColumnSearch] = useState("");
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const nextFilterId = useRef(1);

  const fieldsById = useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields]);
  const selectedFields = useMemo(
    () =>
      selectedColumnIds.flatMap((fieldId) => {
        const field = fieldsById.get(fieldId);
        return field ? [field] : [];
      }),
    [fieldsById, selectedColumnIds],
  );
  const visibleFields = useMemo(() => {
    const search = columnSearch.trim().toLocaleLowerCase();
    if (!search) return fields;
    return fields.filter((field) =>
      `${field.group} ${field.label}`.toLocaleLowerCase().includes(search),
    );
  }, [columnSearch, fields]);
  const filteredOrders = useMemo(
    () => filterReportRows(orders, fields, filters),
    [fields, filters, orders],
  );
  const selectedSet = useMemo(() => new Set(selectedColumnIds), [selectedColumnIds]);

  const toggleColumn = (fieldId: string, checked: boolean) => {
    setSelectedColumnIds((current) => {
      if (checked) return current.includes(fieldId) ? current : [...current, fieldId];
      return current.filter((id) => id !== fieldId);
    });
  };

  const moveColumn = (fieldId: string, direction: -1 | 1) => {
    setSelectedColumnIds((current) => {
      const currentIndex = current.indexOf(fieldId);
      const nextIndex = currentIndex + direction;
      if (currentIndex === -1 || nextIndex < 0 || nextIndex >= current.length) return current;

      const next = [...current];
      [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
      return next;
    });
  };

  const exportReport = (format: "csv" | "excel" | "pdf") => {
    const title = t("reports.serviceOrderList");
    const emptyLabel = t("common.noData");

    if (format === "pdf") {
      exportListPdf(title, generatedLine, selectedFields, filteredOrders, emptyLabel);
      return;
    }

    const headers = selectedFields.map((field) => field.label);
    const rows = createExportRows(selectedFields, filteredOrders, emptyLabel);
    if (format === "csv") {
      downloadTextFile(
        "listado-ordenes-de-servicio.csv",
        "text/csv;charset=utf-8",
        buildReportCsv(headers, rows),
      );
      return;
    }

    downloadTextFile(
      "listado-ordenes-de-servicio.xls",
      "application/vnd.ms-excel;charset=utf-8",
      buildReportExcel(title, headers, rows),
    );
  };

  const addFilter = (connector: FilterConnector) => {
    setFilters((current) => [
      ...current,
      {
        id: `filter-${nextFilterId.current++}`,
        field: DEFAULT_FILTER_FIELD,
        operator: "contains",
        value: "",
        connector,
      },
    ]);
  };

  const updateFilter = (id: string, patch: Partial<ReportFilter>) => {
    setFilters((current) =>
      current.map((filter) => (filter.id === id ? { ...filter, ...patch } : filter)),
    );
  };

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">{t("reports.listBuilder")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("reports.listBuilderDescription")}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={
                isPending || isError || selectedFields.length === 0 || filteredOrders.length === 0
              }
            >
              <Download className="mr-2 h-4 w-4" />
              {t("reports.exportList")}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => exportReport("csv")}>
              {t("reports.exportCsv")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => exportReport("excel")}>
              {t("reports.exportExcel")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => exportReport("pdf")}>
              {t("reports.exportPdf")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-6">
        <section aria-labelledby="report-columns-title" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 id="report-columns-title" className="text-sm font-medium">
                {t("reports.columns")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("reports.columnsSelected", { count: selectedFields.length })}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedColumnIds(fields.map((field) => field.id))}
              >
                {t("reports.selectAll")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedColumnIds([...DEFAULT_COLUMNS])}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {t("reports.restoreColumns")}
              </Button>
            </div>
          </div>

          <Input
            aria-label={t("reports.searchColumns")}
            placeholder={t("reports.searchColumns")}
            value={columnSearch}
            onChange={(event) => setColumnSearch(event.target.value)}
          />

          <div className="max-h-72 overflow-y-auto rounded-md border p-3">
            {visibleFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("reports.noColumnsFound")}</p>
            ) : (
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleFields.map((field) => {
                  const checkboxId = `report-column-${field.id}`;
                  return (
                    <div key={field.id} className="flex items-start gap-2">
                      <Checkbox
                        id={checkboxId}
                        checked={selectedSet.has(field.id)}
                        onCheckedChange={(checked) => toggleColumn(field.id, checked === true)}
                      />
                      <Label htmlFor={checkboxId} className="min-w-0 cursor-pointer leading-tight">
                        <span className="block truncate text-sm">{field.label}</span>
                        <span className="block text-xs font-normal text-muted-foreground">
                          {field.group}
                        </span>
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedFields.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t("reports.reorderColumns")}</p>
              <div className="flex flex-wrap gap-2" aria-label={t("reports.selectedColumns")}>
                {selectedFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="inline-flex items-center overflow-hidden rounded-md border bg-muted/40"
                  >
                    <span className="px-2 text-xs">
                      <span className="mr-1.5 text-muted-foreground">{index + 1}.</span>
                      {field.label}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-none border-l"
                      disabled={index === 0}
                      aria-label={t("reports.moveColumnLeft", { column: field.label })}
                      onClick={() => moveColumn(field.id, -1)}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-none border-l"
                      disabled={index === selectedFields.length - 1}
                      aria-label={t("reports.moveColumnRight", { column: field.label })}
                      onClick={() => moveColumn(field.id, 1)}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="report-filters-title" className="space-y-3 border-t pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 id="report-filters-title" className="flex items-center gap-2 text-sm font-medium">
                <Filter className="h-4 w-4" />
                {t("reports.conditions")}
              </h3>
              <p className="text-xs text-muted-foreground">{t("reports.conditionsDescription")}</p>
            </div>
            {filters.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setFilters([])}>
                {t("reports.clearConditions")}
              </Button>
            ) : null}
          </div>

          {filters.length === 0 ? (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              {t("reports.noConditions")}
            </p>
          ) : (
            <div className="space-y-2">
              {filters.map((filter, index) => {
                const field = fieldsById.get(filter.field) ?? fields[0];
                const operators = OPERATORS_BY_TYPE[field.type];
                const needsValue = !VALUELESS_OPERATORS.has(filter.operator);
                return (
                  <div
                    key={filter.id}
                    className="grid gap-2 rounded-md border bg-muted/20 p-3 md:grid-cols-[5.5rem_minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(9rem,1fr)_2.25rem]"
                  >
                    {index === 0 ? (
                      <div className="flex h-9 items-center text-xs font-medium text-muted-foreground">
                        {t("reports.where")}
                      </div>
                    ) : (
                      <Select
                        value={filter.connector}
                        onValueChange={(connector) =>
                          updateFilter(filter.id, { connector: connector as FilterConnector })
                        }
                      >
                        <SelectTrigger aria-label={t("reports.logicalConnector")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="and">{t("reports.and")}</SelectItem>
                          <SelectItem value="or">{t("reports.or")}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    <Select
                      value={filter.field}
                      onValueChange={(fieldId) => {
                        const nextField = fieldsById.get(fieldId) ?? fields[0];
                        updateFilter(filter.id, {
                          field: fieldId,
                          operator: OPERATORS_BY_TYPE[nextField.type][0],
                          value: "",
                        });
                      }}
                    >
                      <SelectTrigger aria-label={t("reports.filterField")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fields.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.group} · {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filter.operator}
                      onValueChange={(operator) =>
                        updateFilter(filter.id, { operator: operator as ReportOperator })
                      }
                    >
                      <SelectTrigger aria-label={t("reports.filterOperator")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {operators.map((operator) => (
                          <SelectItem key={operator} value={operator}>
                            {operatorLabel(operator, t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {needsValue ? (
                      <Input
                        aria-label={t("reports.filterValue")}
                        type={
                          field.type === "number"
                            ? "number"
                            : field.type === "date"
                              ? "date"
                              : "text"
                        }
                        step={field.type === "number" ? "any" : undefined}
                        value={filter.value}
                        onChange={(event) => updateFilter(filter.id, { value: event.target.value })}
                        placeholder={t("reports.filterValue")}
                      />
                    ) : (
                      <div className="flex h-9 items-center text-xs text-muted-foreground">
                        {t("reports.noValueRequired")}
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("reports.removeCondition")}
                      onClick={() =>
                        setFilters((current) =>
                          current.filter((condition) => condition.id !== filter.id),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => addFilter("and")}>
              <Plus className="mr-2 h-4 w-4" />
              {t("reports.addCondition")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addFilter("or")}>
              <Plus className="mr-2 h-4 w-4" />
              {t("reports.addOrClause")}
            </Button>
          </div>
        </section>

        <section aria-labelledby="report-results-title" className="space-y-3 border-t pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="report-results-title" className="text-sm font-medium">
              {t("reports.results")}
            </h3>
            <Badge variant="outline">
              {t("reports.resultCount", { count: filteredOrders.length })}
            </Badge>
          </div>

          {isPending ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : isError ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>{t("reports.loadError")}</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{error?.message ?? t("errorPage.description")}</p>
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                  {t("common.retry")}
                </Button>
              </AlertDescription>
            </Alert>
          ) : selectedFields.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              {t("reports.selectColumnPrompt")}
            </p>
          ) : filteredOrders.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              {t("reports.noMatchingOrders")}
            </p>
          ) : (
            <div className="max-h-[38rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    {selectedFields.map((field) => (
                      <TableHead key={field.id} className="min-w-36 whitespace-nowrap">
                        {field.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id} className="[content-visibility:auto]">
                      {selectedFields.map((field) => (
                        <TableCell key={field.id} className="max-w-80 align-top whitespace-normal">
                          {field.id === "order_number" ? (
                            <Button asChild variant="link" className="h-auto p-0">
                              <Link to="/orders/$orderId" params={{ orderId: order.id }}>
                                {formatReportValue(field, order, t("common.noData"))}
                              </Link>
                            </Button>
                          ) : (
                            formatReportValue(field, order, t("common.noData"))
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
