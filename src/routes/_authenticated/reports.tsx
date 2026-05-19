import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STATUS_LABELS, STATUS_ORDER, type OrderStatus } from "@/lib/digitron";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function exportPdf(title: string, head: string[], rows: (string | number)[][]) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 25);
  autoTable(doc, { head: [head], body: rows, startY: 32, styles: { fontSize: 9 } });
  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}

function ReportsPage() {
  const { data: orders = [] } = useQuery({
    queryKey: ["orders-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, technician_id, client_id, created_at, final_cost, clients(name)");
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

  // By status
  const byStatus = STATUS_ORDER.map((s) => ({
    status: s, count: orders.filter((o) => o.status === s).length,
  }));

  // By technician (active orders only)
  const byTech = new Map<string | null, number>();
  for (const o of orders) {
    if (["delivered", "closed"].includes(o.status)) continue;
    byTech.set(o.technician_id, (byTech.get(o.technician_id) ?? 0) + 1);
  }
  const techRows = Array.from(byTech.entries()).map(([id, count]) => ({
    technician: id ? nameById.get(id) ?? "—" : "Sin asignar", count,
  })).sort((a, b) => b.count - a.count);

  // By month (last 6 months, count + revenue)
  const months = new Map<string, { count: number; revenue: number }>();
  for (const o of orders) {
    const d = new Date(o.created_at);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const cur = months.get(k) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    if (o.final_cost) cur.revenue += Number(o.final_cost);
    months.set(k, cur);
  }
  const monthRows = Array.from(months.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6)
    .map(([k, v]) => ({ month: k, ...v }));

  // Top clients
  const byClient = new Map<string, { name: string; count: number }>();
  for (const o of orders) {
    if (!o.client_id) continue;
    const cur = byClient.get(o.client_id) ?? { name: o.clients?.name ?? "—", count: 0 };
    cur.count += 1;
    byClient.set(o.client_id, cur);
  }
  const topClients = Array.from(byClient.values()).sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
        <p className="text-sm text-muted-foreground">Vistas resumen del sistema.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Órdenes por estado</CardTitle>
            <Button variant="outline" size="sm" onClick={() => exportPdf(
              "Ordenes por estado",
              ["Estado", "Total"],
              byStatus.map((r) => [STATUS_LABELS[r.status as OrderStatus], r.count]),
            )}><Download className="mr-2 h-4 w-4" />PDF</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Estado</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {byStatus.map((r) => (
                  <TableRow key={r.status}>
                    <TableCell>{STATUS_LABELS[r.status as OrderStatus]}</TableCell>
                    <TableCell className="text-right font-medium">{r.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Carga por técnico (activas)</CardTitle>
            <Button variant="outline" size="sm" disabled={techRows.length === 0} onClick={() => exportPdf(
              "Carga por tecnico",
              ["Técnico", "Activas"],
              techRows.map((r) => [r.technician, r.count]),
            )}><Download className="mr-2 h-4 w-4" />PDF</Button>
          </CardHeader>
          <CardContent>
            {techRows.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Técnico</TableHead><TableHead className="text-right">Activas</TableHead></TableRow></TableHeader>
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
            <CardTitle className="text-base">Por mes (últimos 6)</CardTitle>
            <Button variant="outline" size="sm" disabled={monthRows.length === 0} onClick={() => exportPdf(
              "Reporte mensual",
              ["Mes", "Órdenes", "Ingreso (Bs)"],
              monthRows.map((r) => [r.month, r.count, r.revenue.toFixed(2)]),
            )}><Download className="mr-2 h-4 w-4" />PDF</Button>
          </CardHeader>
          <CardContent>
            {monthRows.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Mes</TableHead><TableHead className="text-right">Órdenes</TableHead><TableHead className="text-right">Ingreso (Bs)</TableHead></TableRow></TableHeader>
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
            <CardTitle className="text-base">Top clientes</CardTitle>
            <Button variant="outline" size="sm" disabled={topClients.length === 0} onClick={() => exportPdf(
              "Top clientes",
              ["Cliente", "Órdenes"],
              topClients.map((r) => [r.name, r.count]),
            )}><Download className="mr-2 h-4 w-4" />PDF</Button>
          </CardHeader>
          <CardContent>
            {topClients.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead className="text-right">Órdenes</TableHead></TableRow></TableHeader>
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
