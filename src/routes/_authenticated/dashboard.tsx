import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ClipboardList, AlertTriangle, CheckCircle2, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STAGE_ORDER, type OrderStage } from "@/lib/digitron";
import { StageBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const STALE_DAYS = 7;

function DashboardPage() {
  const { t } = useTranslation();
  const { profile, hasRole } = useAuth();
  const canSeeAll = hasRole("super") || hasRole("administrativo");

  const { data: orders = [] } = useQuery({
    queryKey: ["orders-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, stage, technician_id, created_at, updated_at, customers(name), equipment(brand, model)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const counts = STAGE_ORDER.reduce<Record<OrderStage, number>>(
    (acc, s) => ({ ...acc, [s]: orders.filter((o) => o.stage === s).length }),
    {} as Record<OrderStage, number>,
  );

  const active = orders.filter((o) => !["delivered", "closed"].includes(o.stage));
  const stale = active.filter((o) => {
    const updated = new Date(o.updated_at);
    return (Date.now() - updated.getTime()) / 86_400_000 > STALE_DAYS;
  });
  const mine = orders.filter(
    (o) => o.technician_id === profile?.id && !["delivered", "closed"].includes(o.stage),
  );

  // Pending-action inbox: orders awaiting THIS user by role + stage + assignment.
  const isSuper = hasRole("super");
  const isAdmin = hasRole("administrativo");
  const isTech = hasRole("tecnico");
  const ADMIN_STAGES = ["intake", "budget", "customer_decision", "payment", "delivered"];
  const TECH_STAGES = ["evaluation", "repair"];
  const inbox = orders.filter((o) => {
    const adminMatch = (isSuper || isAdmin) && ADMIN_STAGES.includes(o.stage);
    const techMatch =
      (isSuper || isTech) &&
      TECH_STAGES.includes(o.stage) &&
      (isSuper || o.technician_id === profile?.id);
    return adminMatch || techMatch;
  });

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
      value: counts.payment,
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
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.welcome", { name: profile?.full_name ?? "" })}
      />

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("dashboard.pendingInbox", { count: inbox.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {inbox.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.inboxEmpty")}</p>
          ) : (
            <ul className="divide-y">
              {inbox.slice(0, 8).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <Link
                      to="/orders/$orderId"
                      params={{ orderId: o.id }}
                      className="font-medium hover:underline"
                    >
                      {o.order_number}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {o.customers?.name} · {o.equipment?.brand} {o.equipment?.model}
                    </p>
                  </div>
                  <StageBadge stage={o.stage} t={t} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
                    <StageBadge stage={o.stage} t={t} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {canSeeAll ? t("dashboard.recent") : t("dashboard.assignedToYou")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(canSeeAll ? orders : mine).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.nothingHere")}</p>
            ) : (
              <ul className="divide-y">
                {(canSeeAll ? orders : mine).slice(0, 6).map((o) => (
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
                        {o.customers?.name} · {o.equipment?.brand} {o.equipment?.model}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {o.stage === "on_hold" && (
                        <Badge variant="destructive" className="text-xs">
                          {t("dashboard.partBadge")}
                        </Badge>
                      )}
                      <StageBadge stage={o.stage} t={t} />
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
