import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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

export type ClientEditing = {
  id: string;
  name: string;
  tax_id: string | null;
  phone1: string | null;
  phone2: string | null;
  email: string | null;
  address: string | null;
};

const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  tax_id: z.string(),
  phone1: z.string(),
  phone2: z.string(),
  email: z.string().email("Invalid email").or(z.literal("")),
  address: z.string(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: ClientEditing | null;
  onSuccess?: (id: string) => void;
}

const EMPTY: ClientFormValues = { name: "", tax_id: "", phone1: "", phone2: "", email: "", address: "" };

export function ClientFormDialog({ open, onOpenChange, editing, onSuccess }: ClientFormDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? {
              name: editing.name,
              tax_id: editing.tax_id ?? "",
              phone1: editing.phone1 ?? "",
              phone2: editing.phone2 ?? "",
              email: editing.email ?? "",
              address: editing.address ?? "",
            }
          : EMPTY,
      );
    }
  }, [open, editing, form]);

  const upsert = useMutation({
    mutationFn: async (values: ClientFormValues) => {
      const payload = {
        name: values.name.trim(),
        tax_id: values.tax_id.trim() || null,
        phone1: values.phone1.trim() || null,
        phone2: values.phone2.trim() || null,
        email: values.email.trim() || null,
        address: values.address.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("customers").update(payload).eq("id", editing.id);
        if (error) throw error;
        return editing.id;
      } else {
        const { data, error } = await supabase
          .from("customers")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onSuccess: (id) => {
      toast.success(editing ? t("clients.updated") : t("clients.created"));
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["clients-min"] });
      onOpenChange(false);
      onSuccess?.(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = form.handleSubmit((values) => upsert.mutate(values));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t("clients.editClient") : t("clients.newClient")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t("common.name")} *</FormLabel>
                    <FormControl>
                      <Input autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tax_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("clients.taxId")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common.email")}</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("clients.phone1")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("clients.phone2")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t("clients.address")}</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
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
