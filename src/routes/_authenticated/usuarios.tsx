import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { listUsers, createUser, updateUserRole, deleteUser } from "@/lib/users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { APP_ROLES, getRoleLabel, type AppRole } from "@/lib/digitron";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { AsyncCardBody } from "@/components/async-card-body";
import { DeleteConfirmButton } from "@/components/delete-confirm-button";

export const Route = createFileRoute("/_authenticated/usuarios")({
  component: UsersPage,
});

const createSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
  role: z.enum([...APP_ROLES] as [AppRole, ...AppRole[]]),
  password: z.string().min(6),
});

type CreateFields = z.infer<typeof createSchema>;

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

  const createForm = useForm<CreateFields>({
    resolver: zodResolver(createSchema),
    defaultValues: { full_name: "", email: "", role: "tecnico", password: "" },
  });

  const createMut = useMutation({
    mutationFn: (input: CreateFields) => create({ data: input }),
    onSuccess: () => {
      toast.success(t("users.created"));
      qc.invalidateQueries({ queryKey: ["users"] });
      createForm.reset();
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

  return (
    <div className="space-y-6">
      <PageHeader title={t("users.title")} subtitle={t("users.subtitle")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("users.newUser")}</CardTitle>
          <CardDescription>{t("users.passwordHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...createForm}>
            <form
              onSubmit={createForm.handleSubmit((data) => createMut.mutate(data))}
              className="grid gap-4 md:grid-cols-5"
            >
              <FormField
                control={createForm.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem className="space-y-2 md:col-span-2">
                    <FormLabel>{t("users.fullName")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-2 md:col-span-2">
                    <FormLabel>{t("users.email")}</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>{t("users.role")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {APP_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {getRoleLabel(r, t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-2 md:col-span-2">
                    <FormLabel>{t("users.tempPassword")}</FormLabel>
                    <FormControl>
                      <Input type="text" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-end md:col-span-3">
                <Button type="submit" disabled={createMut.isPending}>
                  {createMut.isPending ? t("users.creating") : t("users.createUser")}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("users.existing")}</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncCardBody
            isLoading={isLoading}
            isEmpty={(users ?? []).length === 0}
            emptyMessage={t("users.empty")}
          >
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
                      <DeleteConfirmButton
                        title={t("users.deleteConfirm", { name: u.full_name })}
                        description={t("users.deleteDescription")}
                        onConfirm={() => delMut.mutate(u.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AsyncCardBody>
        </CardContent>
      </Card>
    </div>
  );
}
