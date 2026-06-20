import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Moon, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLocale, type AppLocale } from "@/hooks/use-locale";
import { useTheme, type Theme } from "@/hooks/use-theme";
import i18n from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/configuracion")({
  component: ConfiguracionPage,
});

function ConfiguracionPage() {
  const { t } = useTranslation();
  const { profile, user, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useLocale();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");

  const updateName = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error(i18n.t("settings.nameEmpty"));
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: trimmed })
        .eq("id", profile!.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await refreshProfile();
      toast.success(t("settings.nameUpdated"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const themeOptions: { value: Theme; labelKey: string; icon: typeof Sun }[] = [
    { value: "light", labelKey: "settings.themeLight", icon: Sun },
    { value: "dark", labelKey: "settings.themeDark", icon: Moon },
  ];

  const languageOptions: { value: AppLocale; labelKey: string }[] = [
    { value: "es", labelKey: "settings.languageEs" },
    { value: "en", labelKey: "settings.languageEn" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.profile")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("settings.email")}</Label>
            <Input id="email" value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="full_name">{t("settings.displayName")}</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("settings.displayNamePlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("settings.displayNameHint")}</p>
          </div>
          <Button
            onClick={() => updateName.mutate(fullName)}
            disabled={updateName.isPending || fullName.trim() === (profile?.full_name ?? "")}
          >
            {updateName.isPending ? t("common.saving") : t("settings.saveName")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.appearance")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {themeOptions.map(({ value, labelKey, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={[
                  "flex flex-1 flex-col items-center gap-2 rounded-lg border p-4 transition-colors",
                  theme === value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{t(labelKey)}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.language")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {languageOptions.map(({ value, labelKey }) => (
              <button
                key={value}
                type="button"
                onClick={() => setLocale(value)}
                className={[
                  "flex flex-1 items-center justify-center rounded-lg border p-4 text-sm font-medium transition-colors",
                  locale === value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50",
                ].join(" ")}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
