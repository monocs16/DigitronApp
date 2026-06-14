import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Pencil, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { canCreate, canEdit } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { AsyncCardBody } from "@/components/async-card-body";
import { DeleteConfirmButton } from "@/components/delete-confirm-button";
import { EquipmentFormDialog } from "@/components/equipment-form-dialog";

export const Route = createFileRoute("/_authenticated/equipment")({
  component: EquipmentPage,
});

type EquipmentRow = {
  id: string;
  type: string;
  brand: string;
  model: string;
  serial_number: string | null;
  accessories: string | null;
  purchase_invoice: string | null;
  purchase_store: string | null;
  purchase_date: string | null;
  client_id: string;
  customers: { name: string } | null;
};

function EquipmentPage() {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const qc = useQueryClient();
  const mayCreate = canCreate(roles, "equipo");
  const mayEdit = canEdit(roles, "equipo");

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select(
          "id, type, brand, model, serial_number, accessories, purchase_invoice, purchase_store, purchase_date, client_id, customers(name)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as EquipmentRow[];
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EquipmentRow | null>(null);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipment").delete().eq("id", id);
      if (error) throw error;
    },
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
                  <TableHead>{t("common.client")}</TableHead>
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
                    <TableCell className="text-muted-foreground">
                      {e.customers?.name ?? t("common.noData")}
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

      <EquipmentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
      />
    </div>
  );
}
