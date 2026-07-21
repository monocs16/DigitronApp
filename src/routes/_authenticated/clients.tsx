import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Pencil, ClipboardList, Search } from "lucide-react";
import { customersRepository } from "@/lib/repositories";
import { useAuth } from "@/hooks/use-auth";
import { canCreate, canEdit } from "@/lib/access";
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
import { ClientFormDialog, type ClientEditing } from "@/components/client-form-dialog";
import { StageBadge } from "@/components/status-badge";
import { type OrderStage } from "@/lib/digitron";
import { formatDate } from "@/lib/utils";

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
    queryFn: () => customersRepository.getAll() as Promise<ClientRow[]>,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");

  const { data: searchResults = [], isFetching: searchLoading } = useQuery({
    queryKey: ["client-history", submittedSearch],
    enabled: submittedSearch.length > 0,
    queryFn: () => customersRepository.searchWithHistory(submittedSearch),
  });

  const del = useMutation({
    mutationFn: (id: string) => customersRepository.delete(id),
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

      <Card data-testid="client-search-card">
        <CardHeader>
          <CardTitle className="text-base">{t("clients.searchTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmittedSearch(searchTerm.trim());
            }}
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="client-search">{t("clients.searchLabel")}</Label>
              <Input
                id="client-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t("clients.searchPlaceholder")}
              />
            </div>
            <Button type="submit">
              <Search className="mr-2 h-4 w-4" />
              {t("common.search")}
            </Button>
          </form>

          {submittedSearch && (
            <AsyncCardBody
              isLoading={searchLoading}
              isEmpty={searchResults.length === 0}
              emptyMessage={t("clients.searchEmpty")}
            >
              <div className="space-y-4">
                {searchResults.map((client) => {
                  const identifiers = [client.tax_id, client.phone1, client.phone2]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <div key={client.id} className="rounded-md border p-3">
                      <div className="mb-2 text-sm">
                        <span className="font-medium">{client.name}</span>
                        {identifiers && (
                          <span className="ml-2 text-xs text-muted-foreground">{identifiers}</span>
                        )}
                      </div>
                      {client.orders.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {t("clients.noServiceOrders")}
                        </p>
                      ) : (
                        <ul className="divide-y text-sm">
                          {client.orders.map((order) => (
                            <li key={order.id} className="flex items-center justify-between py-1.5">
                              <Link
                                to="/orders/$orderId"
                                params={{ orderId: order.id }}
                                className="font-medium hover:underline"
                              >
                                {order.order_number}
                              </Link>
                              <span className="flex items-center gap-3">
                                <StageBadge stage={order.stage as OrderStage} t={t} />
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(order.intake_at)}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </AsyncCardBody>
          )}
        </CardContent>
      </Card>

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
