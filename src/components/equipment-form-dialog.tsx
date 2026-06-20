import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { equipmentRepository } from "@/lib/repositories";
import { useClientsMin } from "@/hooks/use-clients-min";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export type EquipmentEditing = {
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
};

const equipmentSchema = z.object({
  client_id: z.string().min(1, "Select a client"),
  type: z.string().min(1, "Type is required"),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  serial_number: z.string(),
  accessories: z.string(),
  purchase_invoice: z.string(),
  purchase_store: z.string(),
  purchase_date: z.string(),
});

type EquipmentFormValues = z.infer<typeof equipmentSchema>;

interface EquipmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lockedClientId?: string;
  editing?: EquipmentEditing | null;
  onSuccess?: (id: string) => void;
}

const EMPTY: EquipmentFormValues = {
  client_id: "",
  type: "",
  brand: "",
  model: "",
  serial_number: "",
  accessories: "",
  purchase_invoice: "",
  purchase_store: "",
  purchase_date: "",
};

export function EquipmentFormDialog({
  open,
  onOpenChange,
  lockedClientId,
  editing,
  onSuccess,
}: EquipmentFormDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: clients = [] } = useClientsMin();

  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? {
              client_id: editing.client_id,
              type: editing.type,
              brand: editing.brand,
              model: editing.model,
              serial_number: editing.serial_number ?? "",
              accessories: editing.accessories ?? "",
              purchase_invoice: editing.purchase_invoice ?? "",
              purchase_store: editing.purchase_store ?? "",
              purchase_date: editing.purchase_date ?? "",
            }
          : { ...EMPTY, client_id: lockedClientId ?? "" },
      );
    }
  }, [open, editing, lockedClientId, form]);

  const upsert = useMutation({
    mutationFn: async (values: EquipmentFormValues) => {
      const payload = {
        client_id: values.client_id,
        type: values.type.trim(),
        brand: values.brand.trim(),
        model: values.model.trim(),
        serial_number: values.serial_number.trim() || null,
        accessories: values.accessories.trim() || null,
        purchase_invoice: values.purchase_invoice.trim() || null,
        purchase_store: values.purchase_store.trim() || null,
        purchase_date: values.purchase_date || null,
      };
      if (editing) {
        await equipmentRepository.update(editing.id, payload);
        return editing.id;
      }
      return equipmentRepository.create(payload);
    },
    onSuccess: (id, values) => {
      toast.success(editing ? t("equipmentPage.updated") : t("equipmentPage.created"));
      qc.invalidateQueries({ queryKey: ["equipment"] });
      qc.invalidateQueries({ queryKey: ["equipment-by-client", values.client_id] });
      onOpenChange(false);
      onSuccess?.(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = form.handleSubmit((values) => upsert.mutate(values));
  const clientIsLocked = !!lockedClientId && !editing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? t("equipmentPage.editEquipment") : t("equipmentPage.newEquipment")}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4 py-2">
            {!clientIsLocked && (
              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common.client")} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("equipmentPage.selectClient")} />
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
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("equipmentPage.type")} *</FormLabel>
                    <FormControl>
                      <Input
                        autoFocus={!clientIsLocked ? false : true}
                        placeholder={t("equipmentPage.typePlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("equipmentPage.brand")} *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("equipmentPage.model")} *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="serial_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("equipmentPage.serialNumber")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
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
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="purchase_invoice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("equipmentPage.purchaseInvoice")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="purchase_store"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("equipmentPage.purchaseStore")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="purchase_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("equipmentPage.purchaseDate")}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending ? t("common.saving") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
