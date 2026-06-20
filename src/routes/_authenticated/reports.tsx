import { useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ordersRepository,
  paymentsRepository,
  profilesRepository,
  orderPartsRepository,
} from "@/lib/repositories";
import { useAuth } from "@/hooks/use-auth";
import { canRead } from "@/lib/access";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getStageLabel, STAGE_ORDER, type OrderStage } from "@/lib/digitron";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function exportPdf(title: string, generated: string, head: string[], rows: (string | number)[][]) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(generated, 14, 25);
  autoTable(doc, { head: [head], body: rows, startY: 32, styles: { fontSize: 9 } });
  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}

function ReportsPage() {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const mayView = canRead(roles, "reportes");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data: orders = [] } = useQuery({
    queryKey: ["orders-reports"],
    enabled: mayView,
    queryFn: () => ordersRepository.getAllForReports(),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments-reports"],
    enabled: mayView,
    queryFn: () => paymentsRepository.getAllForReports(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-all"],
    enabled: mayView,
    queryFn: () => profilesRepository.getAllMin(),
  });

  const { data: usedParts = [] } = useQuery({
    queryKey: ["used-parts-reports"],
    enabled: mayView,
    queryFn: () => orderPartsRepository.getAllUsedForReports(),
  });

  const nameById = new Map(profiles.map((p) => [p.id, p.full_name]));
  const generatedLine = t("reports.generated", { date: new Date().toLocaleString() });

  const inRange = (date: string) => {
    if (fromDate && new Date(date) < new Date(fromDate)) return false;
    if (toDate && new Date(date) > new Date(toDate + "T23:59:59")) return false;
    return true;
  };
  const rangedOrders = orders.filter((o) => inRange(o.created_at));
  const rangedPayments = payments.filter((p) => inRange(p.paid_at));
  const rangedUsedParts = usedParts.filter((p) => inRange(p.created_at));

  const byStage = STAGE_ORDER.map((s) => ({
    stage: s,
    count: rangedOrders.filter((o) => o.stage === s).length,
  }));

  const byTech = new Map<string | null, number>();
  for (const o of rangedOrders) {
    if (["delivered", "closed"].includes(o.stage)) continue;
    byTech.set(o.technician_id, (byTech.get(o.technician_id) ?? 0) + 1);
  }
  const techRows = Array.from(byTech.entries())
    .map(([id, count]) => ({
      technician: id ? (nameById.get(id) ?? t("common.noData")) : t("common.unassigned"),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const monthKey = (date: string) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const months = new Map<string, { count: number; revenue: number }>();
  for (const o of rangedOrders) {
    const k = monthKey(o.created_at);
    const cur = months.get(k) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    months.set(k, cur);
  }
  for (const p of rangedPayments) {
    const k = monthKey(p.paid_at);
    const cur = months.get(k) ?? { count: 0, revenue: 0 };
    cur.revenue += Number(p.amount);
    months.set(k, cur);
  }
  const monthRows = Array.from(months.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6)
    .map(([k, v]) => ({ month: k, ...v }));

  const byClient = new Map<string, { name: string; count: number }>();
  for (const o of rangedOrders) {
    if (!o.client_id) continue;
    const cur = byClient.get(o.client_id) ?? {
      name: o.customers?.name ?? t("common.noData"),
      count: 0,
    };
    cur.count += 1;
    byClient.set(o.client_id, cur);
  }
  const topClients = Array.from(byClient.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const partsMap = new Map<string, { label: string; qty: number; cost: number }>();
  for (const p of rangedUsedParts) {
    const cur = partsMap.get(p.part_id) ?? {
      label: p.parts ? `${p.parts.part_code} — ${p.parts.description}` : t("common.noData"),
      qty: 0,
      cost: 0,
    };
    cur.qty += p.quantity;
    cur.cost += Number(p.unit_cost_at_registration) * p.quantity;
    partsMap.set(p.part_id, cur);
  }
  const partsConsumption = Array.from(partsMap.values()).sort((a, b) => b.qty - a.qty);

  const warrantyOrders = rangedOrders.filter((o) => o.warranty_origin_id);

  if (!mayView) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("reports.title")} subtitle={t("reports.subtitle")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("reports.dateRange")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
            <div className="space-y-2">
              <Label>{t("common.from")}</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("common.to")}</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            {(fromDate || toDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
              >
                {t("orders.clearFilter")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("reports.byStatus")}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportPdf(
                  t("reports.byStatus"),
                  generatedLine,
                  [t("common.status"), t("common.total")],
                  byStage.map((r) => [getStageLabel(r.stage as OrderStage, t), r.count]),
                )
              }
            >
              <Download className="mr-2 h-4 w-4" />
              {t("common.pdf")}
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">{t("common.total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byStage.map((r) => (
                  <TableRow key={r.stage}>
                    <TableCell>{getStageLabel(r.stage as OrderStage, t)}</TableCell>
                    <TableCell className="text-right font-medium">{r.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("reports.byTechnician")}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              disabled={techRows.length === 0}
              onClick={() =>
                exportPdf(
                  t("reports.byTechnician"),
                  generatedLine,
                  [t("common.technician"), t("reports.active")],
                  techRows.map((r) => [r.technician, r.count]),
                )
              }
            >
              <Download className="mr-2 h-4 w-4" />
              {t("common.pdf")}
            </Button>
          </CardHeader>
          <CardContent>
            {techRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("common.noResults")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.technician")}</TableHead>
                    <TableHead className="text-right">{t("reports.active")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {techRows.map((r) => (
                    <TableRow key={r.technician}>
                      <TableCell>{r.technician}</TableCell>
                      <TableCell className="text-right font-medium">{r.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("reports.byMonth")}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              disabled={monthRows.length === 0}
              onClick={() =>
                exportPdf(
                  t("reports.byMonth"),
                  generatedLine,
                  [t("common.month"), t("reports.orders"), t("reports.revenue")],
                  monthRows.map((r) => [r.month, r.count, r.revenue.toFixed(2)]),
                )
              }
            >
              <Download className="mr-2 h-4 w-4" />
              {t("common.pdf")}
            </Button>
          </CardHeader>
          <CardContent>
            {monthRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("common.noResults")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.month")}</TableHead>
                    <TableHead className="text-right">{t("reports.orders")}</TableHead>
                    <TableHead className="text-right">{t("reports.revenue")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthRows.map((r) => (
                    <TableRow key={r.month}>
                      <TableCell>{r.month}</TableCell>
                      <TableCell className="text-right font-medium">{r.count}</TableCell>
                      <TableCell className="text-right">{r.revenue.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("reports.topClients")}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              disabled={topClients.length === 0}
              onClick={() =>
                exportPdf(
                  t("reports.topClients"),
                  generatedLine,
                  [t("common.client"), t("reports.orders")],
                  topClients.map((r) => [r.name, r.count]),
                )
              }
            >
              <Download className="mr-2 h-4 w-4" />
              {t("common.pdf")}
            </Button>
          </CardHeader>
          <CardContent>
            {topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("common.noResults")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.client")}</TableHead>
                    <TableHead className="text-right">{t("reports.orders")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topClients.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right font-medium">{r.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("reports.partsConsumption")}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              disabled={partsConsumption.length === 0}
              onClick={() =>
                exportPdf(
                  t("reports.partsConsumption"),
                  generatedLine,
                  [t("inventory.description"), t("reports.quantity"), t("reports.cost")],
                  partsConsumption.map((r) => [r.label, r.qty, r.cost.toFixed(2)]),
                )
              }
            >
              <Download className="mr-2 h-4 w-4" />
              {t("common.pdf")}
            </Button>
          </CardHeader>
          <CardContent>
            {partsConsumption.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("common.noResults")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("inventory.description")}</TableHead>
                    <TableHead className="text-right">{t("reports.quantity")}</TableHead>
                    <TableHead className="text-right">{t("reports.cost")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partsConsumption.map((r) => (
                    <TableRow key={r.label}>
                      <TableCell>{r.label}</TableCell>
                      <TableCell className="text-right font-medium">{r.qty}</TableCell>
                      <TableCell className="text-right">{r.cost.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("reports.warrantyOrders", { count: warrantyOrders.length })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {warrantyOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("common.noResults")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.code")}</TableHead>
                    <TableHead>{t("common.client")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warrantyOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.order_number}</TableCell>
                      <TableCell>{o.customers?.name ?? t("common.noData")}</TableCell>
                      <TableCell>{getStageLabel(o.stage as OrderStage, t)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
