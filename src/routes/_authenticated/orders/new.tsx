import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/orders/new")({
  component: NewOrderPage,
});

const SOURCES = ["counter", "phone", "web", "other"] as const;

const newOrderSchema = z.object({
  clientId: z.string().min(1, "Select a client"),
  equipmentId: z.string().min(1, "Select equipment"),
  problem: z.string().min(1, "Describe the problem"),
  technicianId: z.string(),
  source: z.enum(SOURCES),
});

type NewOrderValues = z.infer<typeof newOrderSchema>;

function NewOrderPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);

  const form = useForm<NewOrderValues>({
    resolver: zodResolver(newOrderSchema),
    defaultValues: {
      clientId: "",
      equipmentId: "",
      problem: "",
      technicianId: "none",
      source: "counter",
    },
  });

  const clientId = form.watch("clientId");

  // Reset equipment when client changes
  useEffect(() => {
    form.setValue("equipmentId", "");
  }, [clientId, form]);

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

  const createOrder = useMutation({
    mutationFn: async (values: NewOrderValues) => {
      const { data, error } = await supabase
        .from("orders")
        .insert({
          client_id: values.clientId,
          equipment_id: values.equipmentId,
          reported_fault: values.problem.trim(),
          source: values.source,
          technician_id: values.technicianId === "none" ? null : values.technicianId,
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

  const onSubmit = form.handleSubmit((values) => createOrder.mutate(values));

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title={t("orders.newTitle")} subtitle={t("orders.newSubtitle")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("orders.orderData")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
              {/* Client */}
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>{t("common.client")} *</FormLabel>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("common.select")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Equipment */}
              <FormField
                control={form.control}
                name="equipmentId"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>{t("common.equipment")} *</FormLabel>
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
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!clientId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              clientId ? t("orders.selectEquipment") : t("orders.selectClientFirst")
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {equipment.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.type} — {e.brand} {e.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Reported problem */}
              <FormField
                control={form.control}
                name="problem"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t("orders.problemReported")}</FormLabel>
                    <FormControl>
                      <Textarea rows={4} placeholder={t("orders.problemPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Technician */}
              <FormField
                control={form.control}
                name="technicianId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("orders.assignedTechnician")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">{t("common.unassigned")}</SelectItem>
                        {techs.map((tech) => (
                          <SelectItem key={tech.id} value={tech.id}>
                            {tech.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Source */}
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("orders.origin")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SOURCES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {t(`orders.source_${s}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <Button asChild variant="outline">
                  <Link to="/orders">{t("common.cancel")}</Link>
                </Button>
                <Button type="submit" disabled={createOrder.isPending}>
                  {createOrder.isPending ? t("common.saving") : t("orders.createOrder")}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <ClientFormDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onSuccess={(id) => {
          qc.invalidateQueries({ queryKey: ["clients-min"] });
          form.setValue("clientId", id);
        }}
      />

      <EquipmentFormDialog
        open={equipmentDialogOpen}
        onOpenChange={setEquipmentDialogOpen}
        lockedClientId={clientId}
        onSuccess={(id) => {
          qc.invalidateQueries({ queryKey: ["equipment-by-client", clientId] });
          form.setValue("equipmentId", id);
        }}
      />
    </div>
  );
}
