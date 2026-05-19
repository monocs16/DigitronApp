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

type Role = "admin" | "technician";
const ALL_ITEMS: {
  titleKey: string;
  url: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
}[] = [
  {
    titleKey: "sidebar.dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "technician"],
  },
  {
    titleKey: "sidebar.orders",
    url: "/orders",
    icon: ClipboardList,
    roles: ["admin", "technician"],
  },
  {
    titleKey: "sidebar.newOrder",
    url: "/orders/new",
    icon: PlusCircle,
    roles: ["admin", "technician"],
  },
  { titleKey: "sidebar.clients", url: "/clients", icon: Users, roles: ["admin", "technician"] },
  {
    titleKey: "sidebar.equipment",
    url: "/equipment",
    icon: Wrench,
    roles: ["admin", "technician"],
  },
  { titleKey: "sidebar.reports", url: "/reports", icon: FileBarChart, roles: ["admin"] },
  { titleKey: "sidebar.users", url: "/usuarios", icon: UserCog, roles: ["admin"] },
  {
    titleKey: "sidebar.settings",
    url: "/configuracion",
    icon: Settings,
    roles: ["admin", "technician"],
  },
];

export function AppSidebar() {
  const { t } = useTranslation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, signOut } = useAuth();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const role = profile?.role ?? "technician";

  const items = ALL_ITEMS.filter((i) => i.roles.includes(role));
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
            <p className="text-xs text-muted-foreground">{getRoleLabel(profile.role, t)}</p>
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
