import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ExternalLink, Plus, Pencil } from "lucide-react";
import { partsRepository } from "@/lib/repositories";
import { useAuth } from "@/hooks/use-auth";
import { canCreate, canEdit } from "@/lib/access";
import { formatAmount } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { AsyncCardBody } from "@/components/async-card-body";
import { DeleteConfirmButton } from "@/components/delete-confirm-button";
import { PartFormDialog, type PartEditing } from "@/components/parts-form-dialog";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: InventoryPage,
});

const LOW_STOCK_THRESHOLD = 5;

type PartRow = {
  id: string;
  part_code: string;
  location?: string | null;
  description: string;
  datasheet?: string | null;
  nte_substitute?: string | null;
  image?: string | null;
  unit_cost?: number;
  stock?: number;
  supplier?: string | null;
};

function getSafeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function ExternalResourceLink({ value, label }: { value?: string | null; label: string }) {
  const safeUrl = value ? getSafeExternalUrl(value) : null;

  if (!value) return <span className="text-muted-foreground">—</span>;
  if (!safeUrl) {
    return (
      <span className="block max-w-48 truncate text-muted-foreground" title={value}>
        {value}
      </span>
    );
  }

  return (
    <Button asChild variant="link" size="sm" className="h-auto p-0">
      <a href={safeUrl} target="_blank" rel="noopener noreferrer">
        {label}
        <ExternalLink aria-hidden="true" />
      </a>
    </Button>
  );
}

function InventoryPage() {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const qc = useQueryClient();
  const mayCreate = canCreate(roles, "inventario");
  const mayEdit = canEdit(roles, "inventario");
  const canSeeCommercial = roles.includes("super") || roles.includes("administrativo");

  const { data: parts = [], isLoading } = useQuery({
    queryKey: ["parts"],
    queryFn: () =>
      (canSeeCommercial
        ? partsRepository.getAll()
        : partsRepository.getTechnicianCatalog()) as Promise<PartRow[]>,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PartEditing | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => partsRepository.delete(id),
    onSuccess: () => {
      toast.success(t("inventory.deleted"));
      qc.invalidateQueries({ queryKey: ["parts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stockBadge = (stock: number) => {
    if (stock <= 0) return <Badge variant="destructive">{t("inventory.outOfStock")}</Badge>;
    if (stock <= LOW_STOCK_THRESHOLD)
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-600">
          {t("inventory.lowStock")}
        </Badge>
      );
    return null;
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("inventory.title")} subtitle={t("inventory.subtitle")}>
        {mayCreate && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("inventory.newPart")}
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("inventory.catalog")}</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncCardBody
            isLoading={isLoading}
            isEmpty={parts.length === 0}
            emptyMessage={t("inventory.empty")}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("inventory.partCode")}</TableHead>
                  {canSeeCommercial && (
                    <TableHead className="text-right">{t("inventory.stock")}</TableHead>
                  )}
                  <TableHead>{t("inventory.location")}</TableHead>
                  <TableHead>{t("inventory.description")}</TableHead>
                  <TableHead>{t("inventory.datasheet")}</TableHead>
                  <TableHead>{t("inventory.nteSubstitute")}</TableHead>
                  <TableHead>{t("inventory.image")}</TableHead>
                  {canSeeCommercial && (
                    <TableHead className="text-right">{t("inventory.unitCost")}</TableHead>
                  )}
                  {canSeeCommercial && <TableHead>{t("inventory.supplier")}</TableHead>}
                  <TableHead className="w-[120px] text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.part_code}</TableCell>
                    {canSeeCommercial && (
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-2">
                          {stockBadge(p.stock ?? 0)}
                          {p.stock ?? 0}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="text-muted-foreground">
                      {p.location ?? t("common.noData")}
                    </TableCell>
                    <TableCell className="font-medium">{p.description}</TableCell>
                    <TableCell>
                      <ExternalResourceLink
                        value={p.datasheet}
                        label={t("inventory.openDatasheet")}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.nte_substitute ?? t("common.noData")}
                    </TableCell>
                    <TableCell>
                      <ExternalResourceLink value={p.image} label={t("inventory.openImage")} />
                    </TableCell>
                    {canSeeCommercial && (
                      <TableCell className="text-right">{formatAmount(p.unit_cost ?? 0)}</TableCell>
                    )}
                    {canSeeCommercial && (
                      <TableCell className="text-muted-foreground">
                        {p.supplier ?? t("common.noData")}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      {canSeeCommercial && mayEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("inventory.editPart")}
                          onClick={() => {
                            setEditing(p as PartEditing);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canSeeCommercial && mayEdit && (
                        <DeleteConfirmButton
                          title={t("inventory.deleteTitle")}
                          description={t("common.cannotUndo")}
                          onConfirm={() => del.mutate(p.id)}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AsyncCardBody>
        </CardContent>
      </Card>

      <PartFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
    </div>
  );
}
