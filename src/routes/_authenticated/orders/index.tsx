import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PlusCircle, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STATUS_LABELS, STATUS_ORDER, type OrderStatus } from "@/lib/digitron";

type OrdersSearch = { clientId?: string; equipmentId?: string };

export const Route = createFileRoute("/_authenticated/orders/")({
  validateSearch: (s: Record<string, unknown>): OrdersSearch => ({
    clientId: typeof s.clientId === "string" ? s.clientId : undefined,
    equipmentId: typeof s.equipmentId === "string" ? s.equipmentId : undefined,
  }),
  component: OrdersPage,
});

type OrderRow = {
  id: string;
  order_number: string;
  status: OrderStatus;
  technician_id: string | null;
  client_id: string;
  equipment_id: string;
  created_at: string;
  clients: { name: string } | null;
  equipment: { brand: string; model: string } | null;
  technician: { full_name: string } | null;
};

function OrdersPage() {
  const { clientId, equipmentId } = Route.useSearch();
  const [status, setStatus] = useState<string>("all");
  const [technician, setTechnician] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [q, setQ] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id, order_number, status, technician_id, client_id, equipment_id, created_at,
          clients(name), equipment(brand, model),
          technician:profiles!orders_technician_id_fkey(full_name)
        `)
        .order("created_at", { ascending: false });
      if (error) {
        const { data: data2, error: err2 } = await supabase
          .from("orders")
          .select(`id, order_number, status, technician_id, client_id, equipment_id, created_at, clients(name), equipment(brand, model)`)
          .order("created_at", { ascending: false });
        if (err2) throw err2;
        return (data2 ?? []).map((d) => ({ ...d, technician: null })) as unknown as OrderRow[];
      }
      return data as unknown as OrderRow[];
    },
  });

  const { data: techs = [] } = useQuery({
    queryKey: ["technicians"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles").select("id, full_name").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (clientId && o.client_id !== clientId) return false;
      if (equipmentId && o.equipment_id !== equipmentId) return false;
      if (status !== "all" && o.status !== status) return false;
      if (technician !== "all") {
        if (technician === "none" && o.technician_id) return false;
        if (technician !== "none" && o.technician_id !== technician) return false;
      }
      if (fromDate && new Date(o.created_at) < new Date(fromDate)) return false;
      if (toDate && new Date(o.created_at) > new Date(toDate + "T23:59:59")) return false;
      if (q) {
        const hay = `${o.order_number} ${o.clients?.name ?? ""} ${o.equipment?.brand ?? ""} ${o.equipment?.model ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [orders, clientId, equipmentId, status, technician, fromDate, toDate, q]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Órdenes de servicio</h1>
          <p className="text-sm text-muted-foreground">Listado de órdenes activas y recientes.</p>
        </div>
        <Button asChild>
          <Link to="/orders/new"><PlusCircle className="mr-2 h-4 w-4" />Nueva orden</Link>
        </Button>
      </div>

      {(clientId || equipmentId) && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Filtrando por {clientId ? "cliente" : "equipo"}.
          </span>
          <Button asChild variant="link" size="sm" className="h-auto p-0">
            <Link to="/orders" search={{}}>Limpiar</Link>
          </Button>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2 md:col-span-2">
              <Label>Búsqueda</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Código, cliente, equipo…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Técnico</Label>
              <Select value={technician} onValueChange={setTechnician}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {techs.map((t) => (<SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Desde</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Hasta</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{filtered.length} orden(es)</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay órdenes con los filtros aplicados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Equipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Técnico</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow key={o.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link to="/orders/$orderId" params={{ orderId: o.id }} className="hover:underline">
                        {o.order_number}
                      </Link>
                    </TableCell>
                    <TableCell>{o.clients?.name ?? "—"}</TableCell>
                    <TableCell>{o.equipment ? `${o.equipment.brand} ${o.equipment.model}` : "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{STATUS_LABELS[o.status]}</Badge></TableCell>
                    <TableCell>{o.technician?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
