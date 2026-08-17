import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type QueryErrorAlertProps = {
  error: Error;
  isFetching: boolean;
  onRetry: () => void;
};

export function QueryErrorAlert({ error, isFetching, onRetry }: QueryErrorAlertProps) {
  const { t } = useTranslation();

  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>{t("errorPage.title")}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{error.message}</p>
        <Button type="button" variant="outline" size="sm" disabled={isFetching} onClick={onRetry}>
          {t("common.retry")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
