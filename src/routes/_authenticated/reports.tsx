import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  const { data: orders = [] } = useQuery({
    queryKey: ["orders-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, stage, technician_id, client_id, created_at, customers(name)");
      if (error) throw error;
      return data;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments-reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("amount, paid_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data;
    },
  });

  const nameById = new Map(profiles.map((p) => [p.id, p.full_name]));
  const generatedLine = t("reports.generated", { date: new Date().toLocaleString() });

  const byStage = STAGE_ORDER.map((s) => ({
    stage: s,
    count: orders.filter((o) => o.stage === s).length,
  }));

  const byTech = new Map<string | null, number>();
  for (const o of orders) {
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
  for (const o of orders) {
    const k = monthKey(o.created_at);
    const cur = months.get(k) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    months.set(k, cur);
  }
  for (const p of payments) {
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
  for (const o of orders) {
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

  return (
    <div className="space-y-6">
      <PageHeader title={t("reports.title")} subtitle={t("reports.subtitle")} />

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
      </div>
    </div>
  );
}
