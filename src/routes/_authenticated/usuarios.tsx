import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { listUsers, createUser, updateUserRole, deleteUser } from "@/lib/users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { APP_ROLES, getRoleLabel, type AppRole } from "@/lib/digitron";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/usuarios")({
  component: UsersPage,
});

function UsersPage() {
  const { t } = useTranslation();
  const { loading: authLoading, hasRole } = useAuth();
  const qc = useQueryClient();
  const list = useServerFn(listUsers);
  const create = useServerFn(createUser);
  const updRole = useServerFn(updateUserRole);
  const del = useServerFn(deleteUser);

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => list(),
    enabled: hasRole("super"),
  });

  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "tecnico" as AppRole,
  });

  const createMut = useMutation({
    mutationFn: (input: {
      email: string;
      password: string;
      full_name: string;
      role: AppRole;
    }) => create({ data: input }),
    onSuccess: () => {
      toast.success(t("users.created"));
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => toast.error(t("common.error"), { description: e.message }),
  });

  const roleMut = useMutation({
    mutationFn: (input: { user_id: string; role: AppRole }) => updRole({ data: input }),
    onSuccess: () => {
      toast.success(t("users.roleUpdated"));
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => toast.error(t("common.error"), { description: e.message }),
  });

  const delMut = useMutation({
    mutationFn: (user_id: string) => del({ data: { user_id } }),
    onSuccess: () => {
      toast.success(t("users.deleted"));
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => toast.error(t("common.error"), { description: e.message }),
  });

  if (authLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (!hasRole("super")) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    createMut.mutate(form, {
      onSuccess: () => setForm({ email: "", password: "", full_name: "", role: "tecnico" }),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("users.title")} subtitle={t("users.subtitle")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("users.newUser")}</CardTitle>
          <CardDescription>{t("users.passwordHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name">{t("users.fullName")}</Label>
              <Input
                id="name"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="email">{t("users.email")}</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">{t("users.role")}</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as AppRole })}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {getRoleLabel(r, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="pwd">{t("users.tempPassword")}</Label>
              <Input
                id="pwd"
                type="text"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="flex items-end md:col-span-3">
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending ? t("users.creating") : t("users.createUser")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("users.existing")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("users.email")}</TableHead>
                  <TableHead>{t("users.role")}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users ?? []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Select
                        value={u.role ?? undefined}
                        onValueChange={(v) =>
                          roleMut.mutate({
                            user_id: u.id,
                            role: v as AppRole,
                          })
                        }
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue placeholder={t("common.select")} />
                        </SelectTrigger>
                        <SelectContent>
                          {APP_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {getRoleLabel(r, t)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(t("users.deleteConfirm", { name: u.full_name })))
                            delMut.mutate(u.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
