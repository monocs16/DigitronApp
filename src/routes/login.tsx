import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authService } from "@/lib/auth.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

type LoginSearch = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): LoginSearch => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: LoginPage,
});

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { loading: authLoading, session } = useAuth();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signIn = useMutation({
    mutationFn: (values: LoginValues) => authService.signIn(values.email, values.password),
    onSuccess: ({ error }) => {
      if (error) {
        toast.error(t("login.failed"), { description: error.message });
        return;
      }
      navigate({ to: search.redirect ?? "/dashboard" });
    },
    onError: (e: Error) => toast.error(t("login.failed"), { description: e.message }),
  });

  const onSubmit = form.handleSubmit((values) => signIn.mutate(values));

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (session) {
    return <Navigate to={search.redirect ?? "/dashboard"} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <div className="mb-2 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded bg-primary text-primary-foreground font-bold">
              O
            </div>
            <div>
              <CardTitle className="text-lg leading-tight">Digitron</CardTitle>
              <CardDescription className="text-xs">{t("login.tagline")}</CardDescription>
            </div>
          </div>
          <CardTitle className="text-base">{t("login.title")}</CardTitle>
          <CardDescription>{t("login.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("login.email")}</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("login.password")}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={signIn.isPending}>
                {signIn.isPending ? t("login.signingIn") : t("login.signIn")}
              </Button>
              <p className="text-center text-xs text-muted-foreground">{t("login.adminOnly")}</p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
