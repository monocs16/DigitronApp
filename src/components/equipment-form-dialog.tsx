import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { equipmentRepository } from "@/lib/repositories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  description: string | null;
  serial_number: string | null;
  purchase_invoice: string | null;
  purchase_store: string | null;
  purchase_date: string | null;
};

const equipmentSchema = z.object({
  type: z.string().min(1, "Type is required"),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  description: z.string().max(2000),
  serial_number: z.string(),
  purchase_invoice: z.string(),
  purchase_store: z.string(),
  purchase_date: z.string(),
});

type EquipmentFormValues = z.infer<typeof equipmentSchema>;

interface EquipmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: EquipmentEditing | null;
  onSuccess?: (id: string) => void;
}

const EMPTY: EquipmentFormValues = {
  type: "",
  brand: "",
  model: "",
  description: "",
  serial_number: "",
  purchase_invoice: "",
  purchase_store: "",
  purchase_date: "",
};

export function EquipmentFormDialog({
  open,
  onOpenChange,
  editing,
  onSuccess,
}: EquipmentFormDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: suggestions } = useQuery({
    queryKey: ["equipment-suggestions"],
    queryFn: () => equipmentRepository.getSuggestions(),
    enabled: open,
  });

  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? {
              type: editing.type,
              brand: editing.brand,
              model: editing.model,
              description: editing.description ?? "",
              serial_number: editing.serial_number ?? "",
              purchase_invoice: editing.purchase_invoice ?? "",
              purchase_store: editing.purchase_store ?? "",
              purchase_date: editing.purchase_date ?? "",
            }
          : EMPTY,
      );
    }
  }, [open, editing, form]);

  const upsert = useMutation({
    mutationFn: async (values: EquipmentFormValues) => {
      const payload = {
        type: values.type.trim(),
        brand: values.brand.trim(),
        model: values.model.trim(),
        description: values.description.trim() || null,
        serial_number: values.serial_number.trim() || null,
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
    onSuccess: (id) => {
      toast.success(editing ? t("equipmentPage.updated") : t("equipmentPage.created"));
      qc.invalidateQueries({ queryKey: ["equipment"] });
      onOpenChange(false);
      onSuccess?.(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = form.handleSubmit((values) => upsert.mutate(values));
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
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("equipmentPage.type")} *</FormLabel>
                    <FormControl>
                      <Input
                        autoFocus
                        placeholder={t("equipmentPage.typePlaceholder")}
                        list="equipment-types"
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
                      <Input list="equipment-brands" {...field} />
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
                      <Input list="equipment-models" {...field} />
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
                name="description"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t("equipmentPage.description")}</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
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
            <datalist id="equipment-types">
              {suggestions?.types.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <datalist id="equipment-brands">
              {suggestions?.brands.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <datalist id="equipment-models">
              {suggestions?.models.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
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
