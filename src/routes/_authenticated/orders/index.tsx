import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PlusCircle, Search } from "lucide-react";
import { useTechnicians } from "@/hooks/use-technicians";
import { PageHeader } from "@/components/page-header";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { getStageLabel, STAGE_ORDER, type OrderStage } from "@/lib/digitron";
import { StageBadge } from "@/components/status-badge";

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
  stage: OrderStage;
  technician_id: string | null;
  client_id: string;
  equipment_id: string;
  created_at: string;
  customers: { name: string } | null;
  equipment: { brand: string; model: string } | null;
  technician: { full_name: string } | null;
};

function OrdersPage() {
  const { t } = useTranslation();
  const { clientId, equipmentId } = Route.useSearch();
  const navigate = useNavigate();
  const [stage, setStage] = useState<string>("all");
  const [technician, setTechnician] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [q, setQ] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          id, order_number, stage, technician_id, client_id, equipment_id, created_at,
          customers(name), equipment(brand, model),
          technician:profiles!orders_technician_id_fkey(full_name)
        `,
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as OrderRow[];
    },
  });

  const { data: techs = [] } = useTechnicians();

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (clientId && o.client_id !== clientId) return false;
      if (equipmentId && o.equipment_id !== equipmentId) return false;
      if (stage !== "all" && o.stage !== stage) return false;
      if (technician !== "all") {
        if (technician === "none" && o.technician_id) return false;
        if (technician !== "none" && o.technician_id !== technician) return false;
      }
      if (fromDate && new Date(o.created_at) < new Date(fromDate)) return false;
      if (toDate && new Date(o.created_at) > new Date(toDate + "T23:59:59")) return false;
      if (q) {
        const hay =
          `${o.order_number} ${o.customers?.name ?? ""} ${o.equipment?.brand ?? ""} ${o.equipment?.model ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [orders, clientId, equipmentId, stage, technician, fromDate, toDate, q]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("orders.title")} subtitle={t("orders.subtitle")}>
        <Button asChild>
          <Link to="/orders/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            {t("orders.newOrder")}
          </Link>
        </Button>
      </PageHeader>

      {(clientId || equipmentId) && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            {clientId ? t("orders.filteringByClient") : t("orders.filteringByEquipment")}
          </span>
          <Button asChild variant="link" size="sm" className="h-auto p-0">
            <Link to="/orders" search={{}}>
              {t("orders.clearFilter")}
            </Link>
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("orders.filters")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2 md:col-span-2">
              <Label>{t("orders.search")}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("orders.searchPlaceholder")}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("common.status")}</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  {STAGE_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {getStageLabel(s, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("common.technician")}</Label>
              <Select value={technician} onValueChange={setTechnician}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  <SelectItem value="none">{t("common.unassigned")}</SelectItem>
                  {techs.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>{t("common.from")}</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("common.to")}</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("orders.count", { count: filtered.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("orders.emptyFiltered")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.code")}</TableHead>
                  <TableHead>{t("common.client")}</TableHead>
                  <TableHead>{t("common.equipment")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("common.technician")}</TableHead>
                  <TableHead>{t("common.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer"
                    onClick={() => navigate({ to: "/orders/$orderId", params: { orderId: o.id } })}
                  >
                    <TableCell className="font-medium">
                      <Link
                        to="/orders/$orderId"
                        params={{ orderId: o.id }}
                        className="hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {o.order_number}
                      </Link>
                    </TableCell>
                    <TableCell>{o.customers?.name ?? t("common.noData")}</TableCell>
                    <TableCell>
                      {o.equipment
                        ? `${o.equipment.brand} ${o.equipment.model}`
                        : t("common.noData")}
                    </TableCell>
                    <TableCell>
                      <StageBadge stage={o.stage} t={t} />
                    </TableCell>
                    <TableCell>{o.technician?.full_name ?? t("common.noData")}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString()}
                    </TableCell>
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
