import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTechnicians } from "@/hooks/use-technicians";
import { useClientsMin } from "@/hooks/use-clients-min";
import { PageHeader } from "@/components/page-header";
import { EquipmentFormDialog } from "@/components/equipment-form-dialog";
import { ClientFormDialog } from "@/components/client-form-dialog";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import i18n from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/orders/new")({
  component: NewOrderPage,
});

function NewOrderPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [clientId, setClientId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [technicianId, setTechnicianId] = useState<string>("none");
  const [problem, setProblem] = useState("");
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);

  const { data: clients = [] } = useClientsMin();

  const { data: equipment = [] } = useQuery({
    queryKey: ["equipment-by-client", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("id, brand, model, type")
        .eq("client_id", clientId);
      if (error) throw error;
      return data;
    },
  });

  const { data: techs = [] } = useTechnicians();

  useEffect(() => {
    setEquipmentId("");
  }, [clientId]);

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error(i18n.t("orders.selectClient"));
      if (!equipmentId) throw new Error(i18n.t("orders.selectEquipmentError"));
      if (!problem.trim()) throw new Error(i18n.t("orders.describeProblem"));
      const { data, error } = await supabase
        .from("orders")
        .insert({
          client_id: clientId,
          equipment_id: equipmentId,
          reported_fault: problem.trim(),
          technician_id: technicianId === "none" ? null : technicianId,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(t("orders.created"));
      navigate({ to: "/orders/$orderId", params: { orderId: data.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title={t("orders.newTitle")} subtitle={t("orders.newSubtitle")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("orders.orderData")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Client select */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("common.client")} *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setClientDialogOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                  {t("clients.newClient")}
                </Button>
              </div>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("common.select")} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Equipment select */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("common.equipment")} *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                  disabled={!clientId}
                  onClick={() => setEquipmentDialogOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                  {t("equipmentPage.newEquipment")}
                </Button>
              </div>
              <Select value={equipmentId} onValueChange={setEquipmentId} disabled={!clientId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      clientId ? t("orders.selectEquipment") : t("orders.selectClientFirst")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {equipment.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.type} — {e.brand} {e.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>{t("orders.problemReported")}</Label>
              <Textarea
                rows={4}
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder={t("orders.problemPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("orders.assignedTechnician")}</Label>
              <Select value={technicianId} onValueChange={setTechnicianId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("common.unassigned")}</SelectItem>
                  {techs.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button asChild variant="outline">
                <Link to="/orders">{t("common.cancel")}</Link>
              </Button>
              <Button onClick={() => createOrder.mutate()} disabled={createOrder.isPending}>
                {createOrder.isPending ? t("common.saving") : t("orders.createOrder")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ClientFormDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onSuccess={(id) => {
          qc.invalidateQueries({ queryKey: ["clients-min"] });
          setClientId(id);
        }}
      />

      <EquipmentFormDialog
        open={equipmentDialogOpen}
        onOpenChange={setEquipmentDialogOpen}
        lockedClientId={clientId}
        onSuccess={(id) => {
          qc.invalidateQueries({ queryKey: ["equipment-by-client", clientId] });
          setEquipmentId(id);
        }}
      />
    </div>
  );
}
