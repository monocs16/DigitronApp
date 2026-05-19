import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface AsyncCardBodyProps {
  isLoading: boolean;
  isEmpty: boolean;
  emptyMessage: string;
  children: ReactNode;
}

export function AsyncCardBody({ isLoading, isEmpty, emptyMessage, children }: AsyncCardBodyProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (isEmpty) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return <>{children}</>;
}
