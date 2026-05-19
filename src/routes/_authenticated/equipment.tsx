import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import i18n from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/equipment")({
  component: EquipmentPage,
});

type EquipmentRow = {
  id: string;
  type: string;
  brand: string;
  model: string;
  serial_number: string | null;
  client_id: string;
  clients: { name: string } | null;
};

function EquipmentPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const isAdmin = profile?.role === "admin";

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("id, type, brand, model, serial_number, client_id, clients(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as EquipmentRow[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EquipmentRow | null>(null);
  const [form, setForm] = useState({
    type: "",
    brand: "",
    model: "",
    serial_number: "",
    client_id: "",
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ type: "", brand: "", model: "", serial_number: "", client_id: "" });
    setOpen(true);
  };
  const openEdit = (e: EquipmentRow) => {
    setEditing(e);
    setForm({
      type: e.type,
      brand: e.brand,
      model: e.model,
      serial_number: e.serial_number ?? "",
      client_id: e.client_id,
    });
    setOpen(true);
  };

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
      } else {
        const { error } = await supabase.from("equipment").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? t("equipmentPage.updated") : t("equipmentPage.created"));
      qc.invalidateQueries({ queryKey: ["equipment"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("equipmentPage.deleted"));
      qc.invalidateQueries({ queryKey: ["equipment"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("equipmentPage.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("equipmentPage.subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t("equipmentPage.newEquipment")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? t("equipmentPage.editEquipment") : t("equipmentPage.newEquipment")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="type">{t("equipmentPage.type")} *</Label>
                  <Input
                    id="type"
                    placeholder={t("equipmentPage.typePlaceholder")}
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand">{t("equipmentPage.brand")} *</Label>
                  <Input
                    id="brand"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">{t("equipmentPage.model")} *</Label>
                  <Input
                    id="model"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serial">{t("equipmentPage.serialNumber")}</Label>
                  <Input
                    id="serial"
                    value={form.serial_number}
                    onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>
                {upsert.isPending ? t("common.saving") : t("common.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("equipmentPage.inventory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : equipment.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("equipmentPage.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("equipmentPage.type")}</TableHead>
                  <TableHead>{t("equipmentPage.brand")}</TableHead>
                  <TableHead>{t("equipmentPage.model")}</TableHead>
                  <TableHead>{t("equipmentPage.serial")}</TableHead>
                  <TableHead>{t("common.client")}</TableHead>
                  <TableHead className="w-[120px] text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipment.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.type}</TableCell>
                    <TableCell>{e.brand}</TableCell>
                    <TableCell>{e.model}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {e.serial_number ?? t("common.noData")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.clients?.name ?? t("common.noData")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon" title={t("common.viewOrders")}>
                        <Link to="/orders" search={{ equipmentId: e.id }}>
                          <ClipboardList className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("equipmentPage.deleteTitle")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("common.cannotUndo")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => del.mutate(e.id)}>
                                {t("common.delete")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
