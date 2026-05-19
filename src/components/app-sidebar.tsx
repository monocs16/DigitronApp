import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Wrench,
  FileBarChart,
  LogOut,
  Moon,
  Sun,
  PlusCircle,
  UserCog,
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
import { useTheme } from "@/hooks/use-theme";
import { ROLE_LABELS } from "@/lib/digitron";

type Role = "admin" | "technician";
const ALL_ITEMS: { title: string; url: string; icon: typeof LayoutDashboard; roles: Role[] }[] = [
  { title: "Panel", url: "/dashboard", icon: LayoutDashboard, roles: ["admin", "technician"] },
  { title: "Órdenes", url: "/orders", icon: ClipboardList, roles: ["admin", "technician"] },
  { title: "Nueva orden", url: "/orders/new", icon: PlusCircle, roles: ["admin", "technician"] },
  { title: "Clientes", url: "/clients", icon: Users, roles: ["admin", "technician"] },
  { title: "Equipos", url: "/equipment", icon: Wrench, roles: ["admin", "technician"] },
  { title: "Reportes", url: "/reports", icon: FileBarChart, roles: ["admin"] },
  { title: "Usuarios", url: "/usuarios", icon: UserCog, roles: ["admin"] },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const role = profile?.role ?? "technician";

  const items = ALL_ITEMS.filter((i) => i.roles.includes(role));
  const isActive = (path: string) =>
    path === "/dashboard" ? currentPath === path : currentPath.startsWith(path);

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [currentPath, isMobile, setOpenMobile]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="grid h-8 w-8 place-items-center rounded bg-primary text-primary-foreground font-bold">
            O
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">Digitron</span>
              <span className="text-xs text-muted-foreground">Digitron</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menú</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
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
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[profile.role]}</p>
          </div>
        )}
        <div className="flex items-center gap-1 px-1 pb-1">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Cambiar tema">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
