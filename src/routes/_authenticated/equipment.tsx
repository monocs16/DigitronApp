import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Pencil, ClipboardList, Search } from "lucide-react";
import { equipmentRepository } from "@/lib/repositories";
import { useAuth } from "@/hooks/use-auth";
import { canCreate, canEdit } from "@/lib/access";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { EquipmentFormDialog } from "@/components/equipment-form-dialog";
import { StageBadge } from "@/components/status-badge";
import { type OrderStage } from "@/lib/digitron";

export const Route = createFileRoute("/_authenticated/equipment")({
  component: EquipmentPage,
});

type EquipmentRow = {
  id: string;
  type: string;
  brand: string;
  model: string;
  serial_number: string | null;
  purchase_invoice: string | null;
  purchase_store: string | null;
  purchase_date: string | null;
};

function EquipmentPage() {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const qc = useQueryClient();
  const mayCreate = canCreate(roles, "equipo");
  const mayEdit = canEdit(roles, "equipo");

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ["equipment"],
    queryFn: () => equipmentRepository.getAll() as Promise<EquipmentRow[]>,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EquipmentRow | null>(null);

  const [serial, setSerial] = useState("");
  const [searchedSerial, setSearchedSerial] = useState("");

  const { data: history = [], isFetching: historyLoading } = useQuery({
    queryKey: ["equipment-history", searchedSerial],
    enabled: searchedSerial.length > 0,
    queryFn: () => equipmentRepository.getBySerialNumber(searchedSerial),
  });

  const del = useMutation({
    mutationFn: (id: string) => equipmentRepository.delete(id),
    onSuccess: () => {
      toast.success(t("equipmentPage.deleted"));
      qc.invalidateQueries({ queryKey: ["equipment"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("equipmentPage.title")} subtitle={t("equipmentPage.subtitle")}>
        {mayCreate && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("equipmentPage.newEquipment")}
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("equipmentPage.historyLookup")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSearchedSerial(serial.trim());
            }}
          >
            <div className="flex-1 space-y-2">
              <Label>{t("equipmentPage.serialNumber")}</Label>
              <Input
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder={t("equipmentPage.serialLookupPlaceholder")}
              />
            </div>
            <Button type="submit">
              <Search className="mr-2 h-4 w-4" />
              {t("common.search")}
            </Button>
          </form>

          {searchedSerial && (
            <AsyncCardBody
              isLoading={historyLoading}
              isEmpty={history.length === 0}
              emptyMessage={t("equipmentPage.historyEmpty")}
            >
              <div className="space-y-4">
                {history.map((eq) => (
                  <div key={eq.id} className="rounded-md border p-3">
                    <div className="mb-2 text-sm">
                      <span className="font-medium">
                        {eq.brand} {eq.model}
                      </span>{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        {eq.serial_number}
                      </span>
                    </div>
                    {eq.orders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("equipmentPage.noServiceOrders")}
                      </p>
                    ) : (
                      <ul className="divide-y text-sm">
                        {eq.orders.map((o) => (
                          <li key={o.id} className="flex items-center justify-between py-1.5">
                            <Link
                              to="/orders/$orderId"
                              params={{ orderId: o.id }}
                              className="font-medium hover:underline"
                            >
                              {o.order_number}
                            </Link>
                            <span className="flex items-center gap-3">
                              <StageBadge stage={o.stage as OrderStage} t={t} />
                              <span className="text-xs text-muted-foreground">
                                {formatDate(o.intake_at)}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </AsyncCardBody>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("equipmentPage.inventory")}</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncCardBody
            isLoading={isLoading}
            isEmpty={equipment.length === 0}
            emptyMessage={t("equipmentPage.empty")}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("equipmentPage.type")}</TableHead>
                  <TableHead>{t("equipmentPage.brand")}</TableHead>
                  <TableHead>{t("equipmentPage.model")}</TableHead>
                  <TableHead>{t("equipmentPage.serial")}</TableHead>
                  <TableHead className="w-[120px] text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipment.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.type}</TableCell>
                    <TableCell>{e.brand}</TableCell>
                    <TableCell>{e.model}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {e.serial_number ?? t("common.noData")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon" title={t("common.viewOrders")}>
                        <Link to="/orders" search={{ equipmentId: e.id }}>
                          <ClipboardList className="h-4 w-4" />
                        </Link>
                      </Button>
                      {mayEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(e);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {mayEdit && (
                        <DeleteConfirmButton
                          title={t("equipmentPage.deleteTitle")}
                          description={t("common.cannotUndo")}
                          onConfirm={() => del.mutate(e.id)}
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

      <EquipmentFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
    </div>
  );
}
