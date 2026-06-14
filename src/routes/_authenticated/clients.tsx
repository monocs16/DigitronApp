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
import { ClientFormDialog, type ClientEditing } from "@/components/client-form-dialog";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsPage,
});

type ClientRow = ClientEditing;

function ClientsPage() {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const qc = useQueryClient();
  const mayCreate = canCreate(roles, "clientes");
  const mayEdit = canEdit(roles, "clientes");

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, tax_id, phone1, phone2, email, address")
        .order("name");
      if (error) throw error;
      return data as ClientRow[];
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("clients.deleted"));
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("clients.title")} subtitle={t("clients.subtitle")}>
        {mayCreate && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("clients.newClient")}
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("clients.allClients")}</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncCardBody
            isLoading={isLoading}
            isEmpty={clients.length === 0}
            emptyMessage={t("clients.empty")}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("clients.taxId")}</TableHead>
                  <TableHead>{t("clients.phone1")}</TableHead>
                  <TableHead>{t("common.email")}</TableHead>
                  <TableHead className="w-[120px] text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.tax_id ?? t("common.noData")}</TableCell>
                    <TableCell>{c.phone1 ?? t("common.noData")}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.email ?? t("common.noData")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon" title={t("common.viewOrders")}>
                        <Link to="/orders" search={{ clientId: c.id }}>
                          <ClipboardList className="h-4 w-4" />
                        </Link>
                      </Button>
                      {mayEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(c);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {mayEdit && (
                        <DeleteConfirmButton
                          title={t("clients.deleteTitle")}
                          description={t("clients.deleteDescription")}
                          onConfirm={() => del.mutate(c.id)}
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

      <ClientFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
    </div>
  );
}
