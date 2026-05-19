import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ClipboardList, AlertTriangle, CheckCircle2, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getStatusLabel, STATUS_ORDER, type OrderStatus } from "@/lib/digitron";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const STALE_DAYS = 7;

function DashboardPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();

  const { data: orders = [] } = useQuery({
    queryKey: ["orders-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, status, technician_id, part_waiting_for, created_at, updated_at, clients(name), equipment(brand, model)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const counts = STATUS_ORDER.reduce<Record<OrderStatus, number>>(
    (acc, s) => ({ ...acc, [s]: orders.filter((o) => o.status === s).length }),
    {} as Record<OrderStatus, number>,
  );

  const active = orders.filter((o) => !["delivered", "closed"].includes(o.status));
  const stale = active.filter((o) => {
    const updated = new Date(o.updated_at);
    return (Date.now() - updated.getTime()) / 86_400_000 > STALE_DAYS;
  });
  const mine = orders.filter(
    (o) => o.technician_id === profile?.id && !["delivered", "closed"].includes(o.status),
  );

  const summaryCards = [
    {
      label: t("dashboard.active"),
      value: active.length,
      icon: ClipboardList,
      tone: "text-primary",
    },
    { label: t("dashboard.inRepair"), value: counts.repair, icon: Wrench, tone: "text-amber-500" },
    {
      label: t("dashboard.readyForDelivery"),
      value: counts.ready,
      icon: CheckCircle2,
      tone: "text-emerald-500",
    },
    {
      label: t("dashboard.stale", { days: STALE_DAYS }),
      value: stale.length,
      icon: AlertTriangle,
      tone: "text-destructive",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.welcome", { name: profile?.full_name ?? "" })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                {c.label}
              </CardTitle>
              <c.icon className={`h-4 w-4 ${c.tone}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.staleOrders")}</CardTitle>
          </CardHeader>
          <CardContent>
            {stale.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.allCaughtUp")}</p>
            ) : (
              <ul className="divide-y">
                {stale.slice(0, 6).map((o) => (
                  <li key={o.id} className="py-2 flex items-center justify-between text-sm">
                    <Link
                      to="/orders/$orderId"
                      params={{ orderId: o.id }}
                      className="font-medium hover:underline"
                    >
                      {o.order_number}
                    </Link>
                    <Badge variant="outline">{getStatusLabel(o.status, t)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {profile?.role === "admin" ? t("dashboard.recent") : t("dashboard.assignedToYou")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(profile?.role === "admin" ? orders : mine).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.nothingHere")}</p>
            ) : (
              <ul className="divide-y">
                {(profile?.role === "admin" ? orders : mine).slice(0, 6).map((o) => (
                  <li key={o.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <Link
                        to="/orders/$orderId"
                        params={{ orderId: o.id }}
                        className="font-medium hover:underline"
                      >
                        {o.order_number}
                      </Link>
                      <p className="text-xs text-muted-foreground truncate">
                        {o.clients?.name} · {o.equipment?.brand} {o.equipment?.model}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {o.part_waiting_for && (
                        <Badge variant="destructive" className="text-xs">
                          {t("dashboard.partBadge")}
                        </Badge>
                      )}
                      <Badge variant="secondary">{getStatusLabel(o.status, t)}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
