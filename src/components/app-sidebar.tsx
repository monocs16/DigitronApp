import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Wrench,
  FileBarChart,
  LogOut,
  PlusCircle,
  UserCog,
  Settings,
  Package,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getRoleLabel } from "@/lib/digitron";
import { canRead, type ModuleKey } from "@/lib/access";
import type { AppRole } from "@/lib/digitron";

// Each nav item maps to a permission module; `null` means always visible to authenticated users.
const ALL_ITEMS: {
  titleKey: string;
  url: string;
  icon: typeof LayoutDashboard;
  module: ModuleKey | null;
}[] = [
  { titleKey: "sidebar.dashboard", url: "/dashboard", icon: LayoutDashboard, module: "tablero" },
  { titleKey: "sidebar.orders", url: "/orders", icon: ClipboardList, module: "os_evaluacion" },
  { titleKey: "sidebar.newOrder", url: "/orders/new", icon: PlusCircle, module: "os_apertura" },
  { titleKey: "sidebar.clients", url: "/clients", icon: Users, module: "clientes" },
  { titleKey: "sidebar.equipment", url: "/equipment", icon: Wrench, module: "equipo" },
  { titleKey: "sidebar.inventory", url: "/inventory", icon: Package, module: "inventario" },
  { titleKey: "sidebar.reports", url: "/reports", icon: FileBarChart, module: "reportes" },
  { titleKey: "sidebar.users", url: "/usuarios", icon: UserCog, module: "seguridad" },
  { titleKey: "sidebar.settings", url: "/configuracion", icon: Settings, module: null },
];

function visibleFor(roles: AppRole[]) {
  return ALL_ITEMS.filter((i) => i.module === null || canRead(roles, i.module));
}

export function AppSidebar() {
  const { t } = useTranslation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, roles, signOut } = useAuth();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  const items = visibleFor(roles);
  const isActive = (path: string) => {
    if (path === "/dashboard") return currentPath === path;
    const hasMoreSpecificMatch = items.some(
      (i) => i.url !== path && i.url.startsWith(path + "/") && currentPath.startsWith(i.url),
    );
    if (hasMoreSpecificMatch) return false;
    return currentPath.startsWith(path);
  };

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [currentPath, isMobile, setOpenMobile]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div
          className={["flex items-center gap-2 py-3", collapsed ? "justify-center" : "px-2"].join(
            " ",
          )}
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded bg-primary text-primary-foreground font-bold">
            O
          </div>
          {!collapsed && <span className="text-sm font-semibold">Digitron</span>}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebar.menu")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{t(item.titleKey)}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        {!collapsed && profile && (
          <div className="px-2 pb-2">
            <p className="truncate text-sm font-medium">{profile.full_name}</p>
            <p className="text-xs text-muted-foreground">
              {roles.map((r) => getRoleLabel(r, t)).join(", ")}
            </p>
          </div>
        )}
        <div className="flex items-center gap-1 px-1 pb-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void signOut()}
            aria-label={t("sidebar.logout")}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
