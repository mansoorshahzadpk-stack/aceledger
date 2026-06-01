import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  Truck,
  Users,
  FileText,
  Settings,
  LogOut,
  Sun,
  Moon,
  Eye,
  Palette,
  MoreHorizontal,
  Package,
  Warehouse,
  LineChart,
  BarChart3,
  ShieldAlert,
  ChevronsUpDown,
  Plus,
  BookOpen,
  Coins,
  Scale,
  ClipboardCheck,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { CURRENCY_SYMBOLS, CURRENCY_LABELS, type CurrencyCode } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/vendors", label: "Vendors", icon: Truck },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/materials", label: "Materials", icon: Package },
  { to: "/inventory", label: "Inventory", icon: Warehouse },
  { to: "/ledger", label: "Ledger", icon: BookOpen },
  { to: "/assets", label: "Assets", icon: Coins },
  { to: "/reconciliation", label: "Reconciliation", icon: ClipboardCheck },
  { to: "/reports/pl", label: "P&L Report", icon: LineChart },
  { to: "/reports/balance", label: "Balance Sheet", icon: Scale },
  { to: "/reports/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/amendments", label: "Audit Log", icon: ShieldAlert },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const {
    settings,
    updateSettings,
    signOut,
    user,
    businesses,
    activeBusinessId,
    setActiveBusinessId,
    createBusiness,
  } = useApp();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newBizName, setNewBizName] = useState("");
  const [newBizCurrency, setNewBizCurrency] = useState<CurrencyCode>("PKR");

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  const cycleTheme = () => {
    const order: Array<"light" | "dark" | "contrast" | "lavender" | "maroon" | "green"> = [
      "light",
      "dark",
      "contrast",
      "lavender",
      "maroon",
      "green",
    ];
    const next = order[(order.indexOf(settings.theme) + 1) % order.length];
    updateSettings({ theme: next });
  };

  const ThemeIcon =
    settings.theme === "dark"
      ? Moon
      : settings.theme === "contrast"
        ? Eye
        : settings.theme === "lavender" || settings.theme === "maroon" || settings.theme === "green"
          ? Palette
          : Sun;

  const BusinessSwitcher = ({ isMobile = false }: { isMobile?: boolean }) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-2 text-left rounded-md hover:bg-accent/15 transition-colors p-1.5 focus:outline-none cursor-pointer",
              isMobile ? "max-w-[180px]" : "w-full mx-1"
            )}
          >
            {settings.business_logo_url ? (
              <img
                src={settings.business_logo_url}
                alt="logo"
                className="h-8 w-8 rounded object-contain shrink-0 border bg-white"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground font-bold shrink-0">
                {(settings.business_name || "L").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1 pr-1">
              <div className="text-sm font-semibold leading-tight truncate text-sidebar-foreground">
                {settings.business_name || "Ledger"}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/80 truncate">
                B2B Accounts
              </div>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start">
          <DropdownMenuLabel className="text-xs">Switch Business</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {businesses.map((b) => (
            <DropdownMenuItem
              key={b.id}
              onClick={() => setActiveBusinessId(b.id)}
              className={cn(
                "flex items-center justify-between cursor-pointer",
                activeBusinessId === b.id && "bg-accent font-semibold"
              )}
            >
              <span className="truncate">{b.name}</span>
              <span className="text-[10px] text-muted-foreground uppercase">{b.currency}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setNewBizName("");
              setNewBizCurrency("PKR");
              setShowAddDialog(true);
            }}
            className="cursor-pointer text-primary focus:text-primary font-medium"
            disabled={businesses.length >= 10}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Business {businesses.length >= 10 && "(Max 10)"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar">
        <div className="flex h-16 items-center border-b px-3">
          <BusinessSwitcher />
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
          <div className="md:hidden flex items-center">
            <BusinessSwitcher isMobile />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-xs font-medium">
              <span className="text-muted-foreground">Currency</span>
              <span className="figure">
                {CURRENCY_SYMBOLS[settings.currency]} {settings.currency}
              </span>
            </div>
            <Button variant="outline" size="icon" onClick={cycleTheme} title={`Theme: ${settings.theme}`}>
              <ThemeIcon className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {user?.email?.split("@")[0] ?? "Account"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs text-muted-foreground">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
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
              {NAV.slice(4).map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem key={item.to} asChild>
                    <Link to={item.to}>
                      <Icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuItem onClick={cycleTheme}>
                <ThemeIcon className="mr-2 h-4 w-4" />
                Theme: {settings.theme}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>

      {/* Add Business Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Business</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="biz-name">Business Name</Label>
              <Input
                id="biz-name"
                placeholder="e.g. Acme Corp"
                value={newBizName}
                onChange={(e) => setNewBizName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-currency">Default Currency</Label>
              <Select value={newBizCurrency} onValueChange={(v) => setNewBizCurrency(v as CurrencyCode)}>
                <SelectTrigger id="biz-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CURRENCY_LABELS) as CurrencyCode[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {CURRENCY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!newBizName.trim()) {
                  toast.error("Please enter a business name");
                  return;
                }
                try {
                  await createBusiness(newBizName.trim(), newBizCurrency);
                  toast.success("Business created!");
                  setShowAddDialog(false);
                } catch (err: any) {
                  toast.error(err.message || "Failed to create business");
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
