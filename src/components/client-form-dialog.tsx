import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import i18n from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ClientEditing = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass a row to switch to edit mode; leave undefined for create mode. */
  editing?: ClientEditing | null;
  /** Called after a successful save, with the id of the created/updated record. */
  onSuccess?: (id: string) => void;
}

const EMPTY_FORM = { name: "", phone: "", email: "" };

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
          ? { name: editing.name, phone: editing.phone ?? "", email: editing.email ?? "" }
          : EMPTY_FORM,
      );
    }
  }, [open, editing]);

  const upsert = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      if (!name) throw new Error(i18n.t("clients.nameRequired"));
      const payload = { name, phone: form.phone || null, email: form.email || null };
      if (editing) {
        const { error } = await supabase.from("clients").update(payload).eq("id", editing.id);
        if (error) throw error;
        return editing.id;
      } else {
        const { data, error } = await supabase
          .from("clients")
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
          <div className="space-y-2">
            <Label htmlFor="cl-name">{t("common.name")} *</Label>
            <Input
              id="cl-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cl-phone">{t("common.phone")}</Label>
            <Input
              id="cl-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
