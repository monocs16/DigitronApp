import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import i18n from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ClientEditing = {
  id: string;
  name: string;
  tax_id: string | null;
  phone1: string | null;
  phone2: string | null;
  email: string | null;
  address: string | null;
};

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass a row to switch to edit mode; leave undefined for create mode. */
  editing?: ClientEditing | null;
  /** Called after a successful save, with the id of the created/updated record. */
  onSuccess?: (id: string) => void;
}

const EMPTY_FORM = { name: "", tax_id: "", phone1: "", phone2: "", email: "", address: "" };

export function ClientFormDialog({
  open,
  onOpenChange,
  editing,
  onSuccess,
}: ClientFormDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              name: editing.name,
              tax_id: editing.tax_id ?? "",
              phone1: editing.phone1 ?? "",
              phone2: editing.phone2 ?? "",
              email: editing.email ?? "",
              address: editing.address ?? "",
            }
          : EMPTY_FORM,
      );
    }
  }, [open, editing]);

  const upsert = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      if (!name) throw new Error(i18n.t("clients.nameRequired"));
      const payload = {
        name,
        tax_id: form.tax_id.trim() || null,
        phone1: form.phone1.trim() || null,
        phone2: form.phone2.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t("clients.editClient") : t("clients.newClient")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cl-name">{t("common.name")} *</Label>
              <Input
                id="cl-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cl-tax">{t("clients.taxId")}</Label>
              <Input
                id="cl-tax"
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cl-email">{t("common.email")}</Label>
              <Input
                id="cl-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cl-phone1">{t("clients.phone1")}</Label>
              <Input
                id="cl-phone1"
                value={form.phone1}
                onChange={(e) => setForm({ ...form, phone1: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cl-phone2">{t("clients.phone2")}</Label>
              <Input
                id="cl-phone2"
                value={form.phone2}
                onChange={(e) => setForm({ ...form, phone2: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cl-address">{t("clients.address")}</Label>
              <Textarea
                id="cl-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>
            {upsert.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
