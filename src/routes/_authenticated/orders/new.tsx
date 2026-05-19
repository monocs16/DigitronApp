import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/orders/new")({
  component: NewOrderPage,
});

function NewOrderPage() {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [technicianId, setTechnicianId] = useState<string>("none");
  const [problem, setProblem] = useState("");
  const [estimated, setEstimated] = useState("");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ["equipment-by-client", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment").select("id, brand, model, type").eq("client_id", clientId);
      if (error) throw error;
      return data;
    },
  });

  const { data: techs = [] } = useQuery({
    queryKey: ["technicians"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Reset equipment when client changes
  useEffect(() => { setEquipmentId(""); }, [clientId]);

  const create = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Seleccione un cliente");
      if (!equipmentId) throw new Error("Seleccione un equipo");
      if (!problem.trim()) throw new Error("Describa el problema");
      const { data, error } = await supabase.from("orders").insert({
        client_id: clientId,
        equipment_id: equipmentId,
        problem_description: problem.trim(),
        technician_id: technicianId === "none" ? null : technicianId,
        estimated_cost: estimated ? Number(estimated) : null,
      }).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Orden creada");
      navigate({ to: "/orders/$orderId", params: { orderId: data.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva orden</h1>
        <p className="text-sm text-muted-foreground">Registre una nueva orden de servicio.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Datos de la orden</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Equipo *</Label>
              <Select value={equipmentId} onValueChange={setEquipmentId} disabled={!clientId}>
                <SelectTrigger>
                  <SelectValue placeholder={clientId ? "Seleccione equipo" : "Elija un cliente primero"} />
                </SelectTrigger>
                <SelectContent>
                  {equipment.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.type} — {e.brand} {e.model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Problema reportado *</Label>
              <Textarea rows={4} value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="Descripción del problema..." />
            </div>
            <div className="space-y-2">
              <Label>Técnico asignado</Label>
              <Select value={technicianId} onValueChange={setTechnicianId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {techs.map((t) => (<SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Costo estimado (Bs)</Label>
              <Input type="number" min="0" step="0.01" value={estimated} onChange={(e) => setEstimated(e.target.value)} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button asChild variant="outline"><Link to="/orders">Cancelar</Link></Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending ? "Guardando…" : "Crear orden"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
