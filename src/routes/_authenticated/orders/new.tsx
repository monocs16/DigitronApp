import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTechnicians } from "@/hooks/use-technicians";
import { PageHeader } from "@/components/page-header";
import { EquipmentFormDialog } from "@/components/equipment-form-dialog";
import { ClientFormDialog } from "@/components/client-form-dialog";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { customersRepository, equipmentRepository, ordersRepository } from "@/lib/repositories";
import { downloadServiceOrderPdf } from "@/lib/service-order-pdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  accessories: z.string(),
  equipmentCondition: z.string().trim().max(100),
  advance: z.coerce.number().min(0),
});

type NewOrderValues = z.infer<typeof newOrderSchema>;

function NewOrderPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

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
      accessories: "",
      equipmentCondition: "",
      advance: 0,
    },
  });

  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const { data: clientResults = [], isFetching: isSearchingClients } = useQuery({
    queryKey: ["client-search", clientSearch],
    queryFn: () => customersRepository.search(clientSearch),
    enabled: clientSearch.trim().length >= 2,
  });

  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<{
    id: string;
    type: string;
    brand: string;
    model: string;
    serial_number: string | null;
  } | null>(null);
  const { data: equipmentResults = [], isFetching: isSearchingEquipment } = useQuery({
    queryKey: ["equipment-search", equipmentSearch],
    queryFn: () => equipmentRepository.searchBySerialNumber(equipmentSearch),
    enabled: equipmentSearch.trim().length >= 2,
  });

  const { data: techs = [] } = useTechnicians();

  const createOrder = useMutation({
    mutationFn: (values: NewOrderValues) =>
      ordersRepository.create({
        client_id: values.clientId,
        equipment_id: values.equipmentId,
        reported_fault: values.problem.trim(),
        source: values.source,
        technician_id: values.technicianId === "none" ? null : values.technicianId,
        received_accessories: values.accessories.trim() || null,
        equipment_condition: values.equipmentCondition.trim(),
        advance: values.advance,
      }),
    onSuccess: async (data, values) => {
      try {
        const order = await ordersRepository.getById(data.id);
        if (order) await downloadServiceOrderPdf(order, values.advance);
      } catch (error) {
        console.error("Could not generate service-order PDF", error);
        toast.error("La orden fue creada, pero no se pudo generar el PDF.");
      }
      toast.success(t("orders.created"));
      navigate({ to: "/orders/$orderId", params: { orderId: data.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = form.handleSubmit((values) => createOrder.mutate(values));

  return (
    <div className="space-y-6">
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
                    {field.value ? (
                      <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <span>{selectedClient?.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            field.onChange("");
                            setSelectedClient(null);
                            setClientSearch("");
                          }}
                        >
                          Borrar campo
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Input
                          value={clientSearch}
                          onChange={(event) => setClientSearch(event.target.value)}
                          placeholder="Buscar por nombre o cédula"
                        />
                        {clientSearch.trim().length > 0 && clientSearch.trim().length < 2 && (
                          <p className="text-xs text-muted-foreground">
                            Escriba al menos 2 caracteres.
                          </p>
                        )}
                        {isSearchingClients && (
                          <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
                        )}
                        {clientResults.length > 0 && (
                          <ul className="max-h-44 overflow-auto rounded-md border">
                            {clientResults.map((client) => (
                              <li key={client.id}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-auto w-full justify-start rounded-none px-3 py-2 text-left"
                                  onClick={() => {
                                    field.onChange(client.id);
                                    setSelectedClient({ id: client.id, name: client.name });
                                    setClientSearch(
                                      `${client.name}${client.tax_id ? ` · ${client.tax_id}` : ""}`,
                                    );
                                  }}
                                >
                                  <span>{client.name}</span>
                                  {client.tax_id && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      {client.tax_id}
                                    </span>
                                  )}
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
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
                        onClick={() => setEquipmentDialogOpen(true)}
                      >
                        <Plus className="h-3 w-3" />
                        {t("equipmentPage.newEquipment")}
                      </Button>
                    </div>
                    {field.value && selectedEquipment ? (
                      <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <span>
                          {selectedEquipment.type} — {selectedEquipment.brand}{" "}
                          {selectedEquipment.model}
                          {selectedEquipment.serial_number
                            ? ` · ${selectedEquipment.serial_number}`
                            : ""}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            field.onChange("");
                            setSelectedEquipment(null);
                            setEquipmentSearch("");
                          }}
                        >
                          Borrar campo
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Input
                          value={equipmentSearch}
                          onChange={(event) => setEquipmentSearch(event.target.value)}
                          placeholder="Buscar por número de serie"
                        />
                        {isSearchingEquipment && (
                          <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
                        )}
                        {equipmentResults.length > 0 && (
                          <ul className="max-h-44 overflow-auto rounded-md border">
                            {equipmentResults.map((equipment) => (
                              <li key={equipment.id}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-auto w-full justify-start rounded-none px-3 py-2 text-left"
                                  onClick={() => {
                                    field.onChange(equipment.id);
                                    setSelectedEquipment(equipment);
                                    setEquipmentSearch(equipment.serial_number ?? "");
                                  }}
                                >
                                  {equipment.type} — {equipment.brand} {equipment.model}
                                  {equipment.serial_number && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      {equipment.serial_number}
                                    </span>
                                  )}
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
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

              <FormField
                control={form.control}
                name="accessories"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t("equipmentPage.accessories")}</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="Accesorios recibidos con esta orden"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="equipmentCondition"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t("orders.equipmentCondition")}</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        maxLength={100}
                        placeholder={t("orders.equipmentConditionPlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {t("orders.equipmentConditionHint", { count: field.value.length })}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="advance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anticipo</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
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
        onSuccess={async (id) => {
          const client = await customersRepository.getById(id);
          form.setValue("clientId", id);
          setSelectedClient(client);
        }}
      />

      <EquipmentFormDialog
        open={equipmentDialogOpen}
        onOpenChange={setEquipmentDialogOpen}
        onSuccess={async (id) => {
          const equipment = await equipmentRepository.getById(id);
          form.setValue("equipmentId", id);
          setSelectedEquipment(equipment);
        }}
      />
    </div>
  );
}
