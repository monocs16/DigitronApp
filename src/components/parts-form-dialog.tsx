import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { partsRepository } from "@/lib/repositories";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export type PartEditing = {
  id: string;
  part_code: string;
  location: string | null;
  description: string;
  datasheet: string | null;
  nte_substitute: string | null;
  image: string | null;
  unit_cost: number;
  stock: number;
  supplier: string | null;
};

const partSchema = z.object({
  part_code: z.string().min(1, "Code is required"),
  location: z.string(),
  description: z.string().min(1, "Description is required"),
  datasheet: z.string(),
  nte_substitute: z.string(),
  image: z.string(),
  unit_cost: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0),
  supplier: z.string(),
});

type PartFormValues = z.infer<typeof partSchema>;

interface PartFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: PartEditing | null;
  onSuccess?: (id: string) => void;
  originOrderId?: string;
  hideCommercialFields?: boolean;
}

const EMPTY: PartFormValues = {
  part_code: "",
  location: "",
  description: "",
  datasheet: "",
  nte_substitute: "",
  image: "",
  unit_cost: 0,
  stock: 0,
  supplier: "",
};

export function PartFormDialog({
  open,
  onOpenChange,
  editing,
  onSuccess,
  originOrderId,
  hideCommercialFields = false,
}: PartFormDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const form = useForm<PartFormValues>({
    resolver: zodResolver(partSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? {
              part_code: editing.part_code,
              location: editing.location ?? "",
              description: editing.description,
              datasheet: editing.datasheet ?? "",
              nte_substitute: editing.nte_substitute ?? "",
              image: editing.image ?? "",
              unit_cost: editing.unit_cost,
              stock: editing.stock,
              supplier: editing.supplier ?? "",
            }
          : EMPTY,
      );
    }
  }, [open, editing, form]);

  const upsert = useMutation({
    mutationFn: async (values: PartFormValues) => {
      const payload = {
        part_code: values.part_code.trim(),
        location: values.location.trim() || null,
        description: values.description.trim(),
        datasheet: values.datasheet.trim() || null,
        nte_substitute: values.nte_substitute.trim() || null,
        image: values.image.trim() || null,
        unit_cost: values.unit_cost,
        stock: values.stock,
        supplier: values.supplier.trim() || null,
      };
      if (editing) {
        await partsRepository.update(editing.id, payload);
        return editing.id;
      }
      return partsRepository.create({
        ...payload,
        created_from_order_id: originOrderId ?? null,
      });
    },
    onSuccess: (id) => {
      toast.success(editing ? t("inventory.updated") : t("inventory.created"));
      qc.invalidateQueries({ queryKey: ["parts"] });
      qc.invalidateQueries({ queryKey: ["parts-catalog"] });
      onOpenChange(false);
      onSuccess?.(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = form.handleSubmit((values) => upsert.mutate(values));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? t("inventory.editPart") : t("inventory.newPart")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="part_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("inventory.partCode")} *</FormLabel>
                    <FormControl>
                      <Input autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!hideCommercialFields && (
                <FormField
                  control={form.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("inventory.stock")}</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("inventory.location")}</FormLabel>
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
                  <FormItem>
                    <FormLabel>{t("inventory.description")} *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="datasheet"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("inventory.datasheet")}</FormLabel>
                    <FormControl>
                      <Input type="url" placeholder="https://…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nte_substitute"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("inventory.nteSubstitute")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="image"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("inventory.image")}</FormLabel>
                    <FormControl>
                      <Input type="url" placeholder="https://…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!hideCommercialFields && (
                <>
                  <FormField
                    control={form.control}
                    name="unit_cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("inventory.unitCost")}</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="supplier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("inventory.supplier")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
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
