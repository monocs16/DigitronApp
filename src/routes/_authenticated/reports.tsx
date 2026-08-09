import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ordersRepository } from "@/lib/repositories";
import { useAuth } from "@/hooks/use-auth";
import { canRead } from "@/lib/access";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { OrderReportBuilder } from "@/components/order-report-builder";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const mayView = canRead(roles, "reportes");

  const {
    data: orders = [],
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["orders-reports"],
    enabled: mayView,
    queryFn: () => ordersRepository.getAllForReports(),
  });

  if (!mayView) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("reports.title")} subtitle={t("reports.subtitle")} />

      <OrderReportBuilder
        orders={orders}
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        generatedLine={t("reports.generated", { date: formatDateTime(new Date()) })}
      />
    </div>
  );
}
