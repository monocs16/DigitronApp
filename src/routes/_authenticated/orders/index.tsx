import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PlusCircle, Search } from "lucide-react";
import { useTechnicians } from "@/hooks/use-technicians";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/hooks/use-auth";
import { canCreate } from "@/lib/access";
import { formatDate } from "@/lib/utils";
import { ordersRepository } from "@/lib/repositories";
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
import { PaginationControls } from "@/components/pagination-controls";
import { QueryErrorAlert } from "@/components/query-error-alert";
import { clampPageToCount, MAX_PAGE_SIZE } from "@/lib/pagination";

type OrdersSearch = { clientId?: string; equipmentId?: string };

export const Route = createFileRoute("/_authenticated/orders/")({
  validateSearch: (s: Record<string, unknown>): OrdersSearch => ({
    clientId: typeof s.clientId === "string" ? s.clientId : undefined,
    equipmentId: typeof s.equipmentId === "string" ? s.equipmentId : undefined,
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const { t } = useTranslation();
  const { roles, session, authReady } = useAuth();
  const { clientId, equipmentId } = Route.useSearch();
  const navigate = useNavigate();
  const [stage, setStage] = useState<OrderStage | "all">("all");
  const [technician, setTechnician] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: [
      "orders",
      {
        page,
        pageSize: MAX_PAGE_SIZE,
        search: q.trim(),
        stage,
        technician,
        fromDate,
        toDate,
        clientId,
        equipmentId,
      },
    ],
    queryFn: () =>
      ordersRepository.getPage({
        page,
        pageSize: MAX_PAGE_SIZE,
        search: q,
        stage: stage === "all" ? undefined : stage,
        technicianId: technician === "all" ? undefined : technician,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        clientId,
        equipmentId,
      }),
    enabled: typeof window !== "undefined" && authReady && !!session,
    placeholderData: keepPreviousData,
  });
  const orders = query.data?.rows ?? [];
  const count = query.data?.count ?? 0;

  const { data: techs = [] } = useTechnicians();
  const canNewOrder = canCreate(roles, "os_apertura");

  useEffect(() => setPage(1), [clientId, equipmentId]);
  useEffect(() => {
    const validPage = clampPageToCount(page, count, MAX_PAGE_SIZE);
    if (validPage !== page) setPage(validPage);
  }, [count, page]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("orders.title")} subtitle={t("orders.subtitle")}>
        {canNewOrder ? (
          <Button asChild>
            <Link to="/orders/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              {t("orders.newOrder")}
            </Link>
          </Button>
        ) : null}
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
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("common.status")}</Label>
              <Select
                value={stage}
                onValueChange={(value) => {
                  setStage(value as OrderStage | "all");
                  setPage(1);
                }}
              >
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
              <Select
                value={technician}
                onValueChange={(value) => {
                  setTechnician(value);
                  setPage(1);
                }}
              >
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
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("common.to")}</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="orders-list-card">
        <CardHeader>
          <CardTitle className="text-base">{t("orders.count", { count })}</CardTitle>
        </CardHeader>
        <CardContent>
          {query.error ? (
            <QueryErrorAlert
              error={query.error}
              isFetching={query.isFetching}
              onRetry={() => void query.refetch()}
            />
          ) : query.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("orders.emptyFiltered")}</p>
          ) : (
            <>
              <Table aria-busy={query.isFetching}>
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
                  {orders.map((o) => (
                    <TableRow
                      key={o.id}
                      className="cursor-pointer"
                      onClick={() =>
                        navigate({ to: "/orders/$orderId", params: { orderId: o.id } })
                      }
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
                      <TableCell>{o.customer_name ?? t("common.noData")}</TableCell>
                      <TableCell>
                        {o.equipment_brand || o.equipment_model
                          ? `${o.equipment_brand ?? ""} ${o.equipment_model ?? ""}`.trim()
                          : t("common.noData")}
                      </TableCell>
                      <TableCell>
                        <StageBadge stage={o.stage} t={t} />
                      </TableCell>
                      <TableCell>{o.technician_name ?? t("common.noData")}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(o.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls
                page={page}
                pageSize={MAX_PAGE_SIZE}
                count={count}
                isFetching={query.isFetching}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
