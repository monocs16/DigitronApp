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

export type PartEditing = {
  id: string;
  part_code: string;
  description: string;
  unit_cost: number;
  stock: number;
  supplier: string | null;
};

interface PartFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass a row to switch to edit mode; leave undefined for create mode. */
  editing?: PartEditing | null;
  /** Called after a successful save, with the id of the created/updated record. */
  onSuccess?: (id: string) => void;
}

const EMPTY_FORM = {
  part_code: "",
  description: "",
  unit_cost: "",
  stock: "",
  supplier: "",
};

export function PartFormDialog({ open, onOpenChange, editing, onSuccess }: PartFormDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          part_code: editing.part_code,
          description: editing.description,
          unit_cost: String(editing.unit_cost),
          stock: String(editing.stock),
          supplier: editing.supplier ?? "",
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, editing]);

  const upsert = useMutation({
    mutationFn: async () => {
      if (!form.part_code.trim() || !form.description.trim())
        throw new Error(i18n.t("inventory.fieldsRequired"));
      const payload = {
        part_code: form.part_code.trim(),
        description: form.description.trim(),
        unit_cost: Number(form.unit_cost) || 0,
        stock: Number(form.stock) || 0,
        supplier: form.supplier.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("parts").update(payload).eq("id", editing.id);
        if (error) throw error;
        return editing.id;
      } else {
        const { data, error } = await supabase.from("parts").insert(payload).select("id").single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onSuccess: (id) => {
      toast.success(editing ? t("inventory.updated") : t("inventory.created"));
      qc.invalidateQueries({ queryKey: ["parts"] });
      onOpenChange(false);
      onSuccess?.(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t("inventory.editPart") : t("inventory.newPart")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="part-code">{t("inventory.partCode")} *</Label>
              <Input
                id="part-code"
                value={form.part_code}
                onChange={(e) => setForm({ ...form, part_code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="part-supplier">{t("inventory.supplier")}</Label>
              <Input
                id="part-supplier"
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="part-desc">{t("inventory.description")} *</Label>
              <Input
                id="part-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="part-cost">{t("inventory.unitCost")}</Label>
              <Input
                id="part-cost"
                type="number"
                min="0"
                step="0.01"
                value={form.unit_cost}
                onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="part-stock">{t("inventory.stock")}</Label>
              <Input
                id="part-stock"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
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
