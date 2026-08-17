import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { getPaginationSummary } from "@/lib/pagination";

type PaginationControlsProps = {
  page: number;
  pageSize: number;
  count: number;
  isFetching?: boolean;
  onPageChange: (page: number) => void;
};

export function PaginationControls({
  page,
  pageSize,
  count,
  isFetching = false,
  onPageChange,
}: PaginationControlsProps) {
  const { t } = useTranslation();
  const summary = getPaginationSummary(page, pageSize, count);

  return (
    <nav
      aria-label={t("pagination.label")}
      aria-busy={isFetching}
      className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
      data-testid="pagination-controls"
    >
      <p className="text-center text-xs text-muted-foreground sm:text-left">
        {t("pagination.summary", {
          from: summary.from,
          to: summary.to,
          count,
        })}
      </p>
      <div className="flex items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          {t("pagination.previous")}
        </Button>
        <span className="min-w-24 text-center text-sm" aria-live="polite">
          {t("pagination.page", { page, totalPages: summary.totalPages })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= summary.totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t("pagination.next")}
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
