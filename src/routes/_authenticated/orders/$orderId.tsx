import { useEffect, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, Upload, Trash2, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import i18n from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getStatusLabel, type OrderStatus } from "@/lib/digitron";
import { allowedNextStatuses } from "@/lib/state-machine";

export const Route = createFileRoute("/_authenticated/orders/$orderId")({
  component: OrderDetailPage,
});

const MAX_PHOTOS = 5;

function OrderDetailPage() {
  const { t } = useTranslation();
  const { orderId } = useParams({ from: "/_authenticated/orders/$orderId" });
  const { profile } = useAuth();
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *, clients(id, name, phone, email),
          equipment(id, type, brand, model, serial_number)
        `,
        )
        .eq("id", orderId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: techs = [] } = useQuery({
    queryKey: ["technicians"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: audit = [] } = useQuery({
    queryKey: ["audit", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, action, field_changed, old_value, new_value, created_at, user_id")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["photos", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_photos")
        .select("id, storage_path, uploaded_at")
        .eq("order_id", orderId);
      if (error) throw error;
      const withUrls = await Promise.all(
        (data ?? []).map(async (p) => {
          const { data: signed } = await supabase.storage
            .from("order-photos")
            .createSignedUrl(p.storage_path, 3600);
          return { ...p, url: signed?.signedUrl ?? "" };
        }),
      );
      return withUrls;
    },
  });

  const profileById = new Map(techs.map((tech) => [tech.id, tech.full_name]));

  const isAdmin = profile?.role === "admin";
  const isAssigned = !!order && order.technician_id === profile?.id;

  const nextStatuses = order
    ? allowedNextStatuses(order.status as OrderStatus, profile?.role ?? "technician", isAssigned)
    : [];

  const updateStatus = useMutation({
    mutationFn: async (newStatus: OrderStatus) => {
      const patch =
        newStatus === "waiting_part"
          ? { status: newStatus }
          : { status: newStatus, part_waiting_for: null };
      const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("orders.statusUpdated"));
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["audit", orderId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [partWaiting, setPartWaiting] = useState("");
  const [notes, setNotes] = useState("");
  const [estimated, setEstimated] = useState("");
  const [finalCost, setFinalCost] = useState("");
  const [technicianAssign, setTechnicianAssign] = useState<string>("none");

  useEffect(() => {
    if (order) {
      setPartWaiting(order.part_waiting_for ?? "");
      setNotes(order.notes ?? "");
      setEstimated(order.estimated_cost?.toString() ?? "");
      setFinalCost(order.final_cost?.toString() ?? "");
      setTechnicianAssign(order.technician_id ?? "none");
    }
  }, [order]);

  const saveDetails = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("orders")
        .update({
          part_waiting_for: partWaiting || null,
          notes: notes || null,
          estimated_cost: estimated ? Number(estimated) : null,
          final_cost: finalCost ? Number(finalCost) : null,
        })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("orders.changesSaved"));
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["audit", orderId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignTech = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase
        .from("orders")
        .update({ technician_id: value === "none" ? null : value })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("orders.technicianUpdated"));
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["audit", orderId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      if (photos.length >= MAX_PHOTOS)
        throw new Error(i18n.t("orders.maxPhotos", { max: MAX_PHOTOS }));
      if (file.size > 5 * 1024 * 1024) throw new Error(i18n.t("orders.photoTooLarge"));
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error(i18n.t("orders.photoFormat"));
      }
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${orderId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("order-photos").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("order_photos").insert({
        order_id: orderId,
        storage_path: path,
        uploaded_by: profile?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("orders.photoUploaded"));
      qc.invalidateQueries({ queryKey: ["photos", orderId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePhoto = useMutation({
    mutationFn: async (p: { id: string; storage_path: string }) => {
      await supabase.storage.from("order-photos").remove([p.storage_path]);
      const { error } = await supabase.from("order_photos").delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("orders.photoDeleted"));
      qc.invalidateQueries({ queryKey: ["photos", orderId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (!order) return <p className="text-sm text-muted-foreground">{t("orders.notFound")}</p>;

  const canEditCore =
    isAdmin || (isAssigned && !["delivered", "closed", "warranty"].includes(order.status));

  const auditLabel = (a: (typeof audit)[number]) => {
    if (a.action === "created") return t("orders.orderCreated");
    if (a.action === "status_changed") {
      return t("orders.statusChanged", {
        from: getStatusLabel(a.old_value as OrderStatus, t) || a.old_value,
        to: getStatusLabel(a.new_value as OrderStatus, t) || a.new_value,
      });
    }
    if (a.action === "field_changed") {
      return t("orders.fieldChanged", { field: a.field_changed });
    }
    return a.action;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("orders.back")}
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">
            {t("orders.createdAt", { date: new Date(order.created_at).toLocaleString() })}
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {getStatusLabel(order.status, t)}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("orders.clientAndEquipment")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-xs uppercase text-muted-foreground">{t("common.client")}</p>
                <p className="font-medium">{order.clients?.name}</p>
                <p className="text-muted-foreground">{order.clients?.phone}</p>
                <p className="text-muted-foreground">{order.clients?.email}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">{t("common.equipment")}</p>
                <p className="font-medium">
                  {order.equipment?.brand} {order.equipment?.model}
                </p>
                <p className="text-muted-foreground">{order.equipment?.type}</p>
                <p className="font-mono text-xs">
                  {order.equipment?.serial_number ?? t("common.noData")}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs uppercase text-muted-foreground">
                  {t("orders.reportedProblem")}
                </p>
                <p className="whitespace-pre-wrap">{order.problem_description}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("orders.editableDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("orders.estimatedCost")}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={estimated}
                    onChange={(e) => setEstimated(e.target.value)}
                    disabled={!canEditCore}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("orders.finalCost")}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={finalCost}
                    onChange={(e) => setFinalCost(e.target.value)}
                    disabled={!isAdmin}
                  />
                </div>
              </div>
              {order.status === "waiting_part" && (
                <div className="space-y-2">
                  <Label>{t("orders.pendingPart")}</Label>
                  <Input
                    value={partWaiting}
                    onChange={(e) => setPartWaiting(e.target.value)}
                    placeholder={t("orders.partPlaceholder")}
                    disabled={!canEditCore}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>{t("orders.internalNotes")}</Label>
                <Textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!canEditCore}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => saveDetails.mutate()}
                  disabled={!canEditCore || saveDetails.isPending}
                >
                  {t("orders.saveChanges")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                {t("orders.photos", { current: photos.length, max: MAX_PHOTOS })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {photos.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("orders.noPhotos")}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map((p) => (
                    <div
                      key={p.id}
                      className="group relative aspect-square overflow-hidden rounded border"
                    >
                      {p.url && (
                        <img
                          src={p.url}
                          alt={t("orders.photoAlt")}
                          className="h-full w-full object-cover"
                        />
                      )}
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={() => deletePhoto.mutate(p)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {photos.length < MAX_PHOTOS && (
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="photo-upload"
                    className="cursor-pointer inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
                  >
                    <Upload className="h-4 w-4" />
                    {t("orders.uploadPhoto")}
                  </Label>
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadPhoto.mutate(f);
                      e.target.value = "";
                    }}
                  />
                  <p className="text-xs text-muted-foreground">{t("orders.photoHint")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("orders.actions")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("orders.changeStatus")}</Label>
                {nextStatuses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("orders.noTransitions")}</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {nextStatuses.map((s) => (
                      <Button
                        key={s}
                        variant="outline"
                        size="sm"
                        disabled={updateStatus.isPending}
                        onClick={() => updateStatus.mutate(s)}
                      >
                        → {getStatusLabel(s, t)}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {isAdmin && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>{t("orders.assignTechnician")}</Label>
                    <Select
                      value={technicianAssign}
                      onValueChange={(v) => {
                        setTechnicianAssign(v);
                        assignTech.mutate(v);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("common.unassigned")}</SelectItem>
                        {techs.map((tech) => (
                          <SelectItem key={tech.id} value={tech.id}>
                            {tech.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("orders.history")}</CardTitle>
            </CardHeader>
            <CardContent>
              {audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("orders.noActivity")}</p>
              ) : (
                <ol className="space-y-3">
                  {audit.map((a) => (
                    <li key={a.id} className="border-l-2 border-border pl-3 text-sm">
                      <p className="font-medium">{auditLabel(a)}</p>
                      {a.action === "field_changed" && (
                        <p className="text-xs text-muted-foreground">
                          {a.old_value ?? t("common.noData")} → {a.new_value ?? t("common.noData")}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleString()}
                        {a.user_id && ` · ${profileById.get(a.user_id) ?? t("common.noData")}`}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
