import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useClientsMin } from "@/hooks/use-clients-min";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EquipmentEditing = {
  id: string;
  type: string;
  brand: string;
  model: string;
  serial_number: string | null;
  client_id: string;
};

interface EquipmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select and lock the client when opened from within a client context. */
  lockedClientId?: string;
  /** Pass a row to switch to edit mode; leave undefined for create mode. */
  editing?: EquipmentEditing | null;
  /** Called after a successful save, with the id of the created/updated record. */
  onSuccess?: (id: string) => void;
}

const EMPTY_FORM = { type: "", brand: "", model: "", serial_number: "", client_id: "" };

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

  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          type: editing.type,
          brand: editing.brand,
          model: editing.model,
          serial_number: editing.serial_number ?? "",
          client_id: editing.client_id,
        });
      } else {
        setForm({ ...EMPTY_FORM, client_id: lockedClientId ?? "" });
      }
    }
  }, [open, editing, lockedClientId]);

  const upsert = useMutation({
    mutationFn: async () => {
      if (!form.client_id) throw new Error(i18n.t("equipmentPage.clientRequired"));
      if (!form.type || !form.brand || !form.model)
        throw new Error(i18n.t("equipmentPage.fieldsRequired"));
      const payload = {
        client_id: form.client_id,
        type: form.type.trim(),
        brand: form.brand.trim(),
        model: form.model.trim(),
        serial_number: form.serial_number.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("equipment").update(payload).eq("id", editing.id);
        if (error) throw error;
        return editing.id;
      } else {
        const { data, error } = await supabase
          .from("equipment")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onSuccess: (id) => {
      toast.success(editing ? t("equipmentPage.updated") : t("equipmentPage.created"));
      qc.invalidateQueries({ queryKey: ["equipment"] });
      qc.invalidateQueries({ queryKey: ["equipment-by-client", form.client_id] });
      onOpenChange(false);
      onSuccess?.(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clientIsLocked = !!lockedClientId && !editing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? t("equipmentPage.editEquipment") : t("equipmentPage.newEquipment")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!clientIsLocked && (
            <div className="space-y-2">
              <Label>{t("common.client")} *</Label>
              <Select
                value={form.client_id}
                onValueChange={(v) => setForm({ ...form, client_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("equipmentPage.selectClient")} />
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
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="eq-type">{t("equipmentPage.type")} *</Label>
              <Input
                id="eq-type"
                placeholder={t("equipmentPage.typePlaceholder")}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eq-brand">{t("equipmentPage.brand")} *</Label>
              <Input
                id="eq-brand"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eq-model">{t("equipmentPage.model")} *</Label>
              <Input
                id="eq-model"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eq-serial">{t("equipmentPage.serialNumber")}</Label>
              <Input
                id="eq-serial"
                value={form.serial_number}
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
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
