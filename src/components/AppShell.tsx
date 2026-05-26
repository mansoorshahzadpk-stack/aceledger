import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Truck, Users, FileText, Settings, LogOut, Sun, Moon, Eye, MoreHorizontal, Package } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { CURRENCY_SYMBOLS } from "@/lib/format";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/vendors", label: "Vendors", icon: Truck },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/products", label: "Products", icon: Package },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const { settings, updateSettings, signOut, user } = useApp();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const isActive = (to: string, exact?: boolean) => exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  const cycleTheme = () => {
    const order: Array<"light" | "dark" | "contrast"> = ["light", "dark", "contrast"];
    const next = order[(order.indexOf(settings.theme) + 1) % order.length];
    updateSettings({ theme: next });
  };

  const ThemeIcon = settings.theme === "dark" ? Moon : settings.theme === "contrast" ? Eye : Sun;

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          {settings.business_logo_url ? (
            <img src={settings.business_logo_url} alt="logo" className="h-8 w-8 rounded object-contain" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">L</div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight truncate">{settings.business_name || "Ledger"}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">B2B Accounts</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3 text-xs text-muted-foreground">
          <div className="truncate">{user?.email}</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur md:px-6">
          <div className="md:hidden flex items-center gap-2">
            {settings.business_logo_url ? (
              <img src={settings.business_logo_url} alt="logo" className="h-8 w-8 rounded object-contain" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">L</div>
            )}
            <span className="font-semibold truncate">{settings.business_name || "Ledger"}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-xs font-medium">
              <span className="text-muted-foreground">Currency</span>
              <span className="figure">{CURRENCY_SYMBOLS[settings.currency]} {settings.currency}</span>
            </div>
            <Button variant="outline" size="icon" onClick={cycleTheme} title={`Theme: ${settings.theme}`}>
              <ThemeIcon className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">{user?.email?.split("@")[0] ?? "Account"}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs text-muted-foreground">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/settings"><Settings className="mr-2 h-4 w-4" />Settings</Link></DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t bg-sidebar md:hidden">
          {NAV.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-[11px] font-medium",
                  active ? "text-sidebar-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted-foreground">
              <MoreHorizontal className="h-5 w-5" />
              More
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild><Link to="/products"><Package className="mr-2 h-4 w-4" />Products</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/settings"><Settings className="mr-2 h-4 w-4" />Settings</Link></DropdownMenuItem>
              <DropdownMenuItem onClick={cycleTheme}><ThemeIcon className="mr-2 h-4 w-4" />Theme: {settings.theme}</DropdownMenuItem>
              <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </div>
  );
}
