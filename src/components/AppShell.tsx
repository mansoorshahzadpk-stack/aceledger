import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
  Banknote,
  AlertTriangle,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  { to: "/reports", label: "Reports", icon: BarChart3 },
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
    isReadOnly,
    tenantProfile,
  } = useApp();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newBizName, setNewBizName] = useState("");
  const [newBizCurrency, setNewBizCurrency] = useState<CurrencyCode>("PKR");

  const qc = useQueryClient();

  // Dialog triggers
  const [clientPayOpen, setClientPayOpen] = useState(false);
  const [vendorPayOpen, setVendorPayOpen] = useState(false);
  const [ledgerTxOpen, setLedgerTxOpen] = useState(false);

  // 1. Client payment form state
  const [clientPay, setClientPay] = useState({
    client_id: "",
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    method: "cash",
    reference: "",
    asset_id: "",
  });

  // 2. Vendor payment form state
  const [vendorPay, setVendorPay] = useState({
    vendor_id: "",
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    method: "bank",
    reference: "",
    notes: "",
    asset_id: "",
  });

  // 3. Ledger transaction state
  const CATEGORIES = [
    "Marketing",
    "Administrative Expenses",
    "Employee Salaries",
    "Rent & Utilities",
    "Other Income",
    "Indirect Revenues",
    "Miscellaneous Expense",
  ];
  const [ledgerForm, setLedgerForm] = useState({
    transaction_date: new Date().toISOString().slice(0, 10),
    category: CATEGORIES[0],
    description: "",
    type: "credit" as "debit" | "credit",
    amount: "",
    asset_id: "none",
  });

  // Fetch supporting collections for shortcuts
  const { data: bankCashAssets = [] } = useQuery({
    queryKey: ["bank_cash_assets", user?.id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId) return [];
      const { data, error } = await supabase
        .from("assets")
        .select("id, name, type")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user?.id || "")
        .in("type", ["bank_account", "petty_cash"]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeBusinessId && !!user,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients_list", user?.id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId) return [];
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user?.id || "")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeBusinessId && !!user,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors_list", user?.id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId) return [];
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user?.id || "")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeBusinessId && !!user,
  });

  // Synced select defaults
  useEffect(() => {
    if (bankCashAssets.length > 0) {
      if (!clientPay.asset_id) {
        setClientPay(prev => ({ ...prev, asset_id: bankCashAssets[0].id }));
      }
      if (!vendorPay.asset_id) {
        setVendorPay(prev => ({ ...prev, asset_id: bankCashAssets[0].id }));
      }
    }
  }, [bankCashAssets]);

  useEffect(() => {
    if (clients.length > 0 && !clientPay.client_id) {
      setClientPay(prev => ({ ...prev, client_id: clients[0].id }));
    }
  }, [clients]);

  useEffect(() => {
    if (vendors.length > 0 && !vendorPay.vendor_id) {
      setVendorPay(prev => ({ ...prev, vendor_id: vendors[0].id }));
    }
  }, [vendors]);

  // Submission handlers
  const handleClientPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeBusinessId) return;
    if (!clientPay.client_id) {
      toast.error("Please select a client");
      return;
    }
    const { error } = await supabase.from("client_payments").insert({
      user_id: user.id,
      business_id: activeBusinessId,
      client_id: clientPay.client_id,
      amount: parseFloat(clientPay.amount) || 0,
      payment_date: clientPay.payment_date,
      method: clientPay.method as any,
      reference: clientPay.reference || null,
      asset_id: clientPay.asset_id === "" || clientPay.asset_id === "none" ? null : clientPay.asset_id,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Payment Received recorded!");
      setClientPayOpen(false);
      setClientPay(prev => ({
        ...prev,
        amount: "",
        reference: "",
        payment_date: new Date().toISOString().slice(0, 10),
      }));
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
    }
  };

  const handleVendorPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeBusinessId) return;
    if (!vendorPay.vendor_id) {
      toast.error("Please select a vendor");
      return;
    }
    const { error } = await supabase.from("vendor_payments").insert({
      user_id: user.id,
      business_id: activeBusinessId,
      vendor_id: vendorPay.vendor_id,
      amount: parseFloat(vendorPay.amount) || 0,
      payment_date: vendorPay.payment_date,
      method: vendorPay.method as any,
      reference: vendorPay.reference || null,
      notes: vendorPay.notes || null,
      asset_id: vendorPay.asset_id === "" || vendorPay.asset_id === "none" ? null : vendorPay.asset_id,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Payment to vendor logged!");
      setVendorPayOpen(false);
      setVendorPay(prev => ({
        ...prev,
        amount: "",
        reference: "",
        notes: "",
        payment_date: new Date().toISOString().slice(0, 10),
      }));
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["vendor"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
    }
  };

  const handleLedgerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeBusinessId) return;
    const { error } = await supabase.from("ledger_transactions" as any).insert({
      user_id: user.id,
      business_id: activeBusinessId,
      transaction_date: ledgerForm.transaction_date,
      category: ledgerForm.category,
      description: ledgerForm.description || null,
      type: ledgerForm.type,
      amount: parseFloat(ledgerForm.amount) || 0,
      asset_id: ledgerForm.asset_id === "none" || ledgerForm.asset_id === "" ? null : ledgerForm.asset_id,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Ledger transaction logged!");
      setLedgerTxOpen(false);
      setLedgerForm({
        transaction_date: new Date().toISOString().slice(0, 10),
        category: CATEGORIES[0],
        description: "",
        type: "credit",
        amount: "",
        asset_id: "none",
      });
      qc.invalidateQueries({ queryKey: ["ledger_transactions"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["pl"] });
    }
  };

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

  const getTrialDaysRemaining = (trialEndsAt?: string) => {
    if (!trialEndsAt) return 0;
    const trialEnds = new Date(trialEndsAt);
    const diffMs = trialEnds.getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const renderAccountStatus = () => {
    if (!tenantProfile) {
      return (
        <div className="mb-4 px-1">
          <div className="h-[74px] w-full rounded-lg bg-muted/20 animate-pulse border border-muted/50" />
        </div>
      );
    }

    const { status, trial_ends_at } = tenantProfile;

    if (status === "active") {
      return (
        <div className="mb-4 px-1">
          <div className="relative overflow-hidden rounded-lg border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-3 text-xs shadow-sm h-[74px] flex flex-col justify-center">
            <div className="flex items-center justify-between mb-1">
              <span className="text-emerald-800 dark:text-emerald-300 font-bold tracking-wide">Ace Ledger Pro</span>
              <span className="inline-flex items-center rounded bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                Pro Version
              </span>
            </div>
            <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-medium">
              Full unrestricted enterprise features unlocked
            </div>
          </div>
        </div>
      );
    }

    if (status === "trialing") {
      const daysLeft = getTrialDaysRemaining(trial_ends_at);
      return (
        <div className="mb-4 px-1">
          <a
            href="https://wa.me/923210081414"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 p-3 text-xs text-amber-900 dark:text-amber-200 transition-colors shadow-sm cursor-pointer h-[74px]"
          >
            Trial Period: {daysLeft} Days Left. Contact <span className="underline font-bold">WhatsApp +923210081414</span> for upgrading to pro.
          </a>
        </div>
      );
    }

    if (status === "suspended") {
      return (
        <div className="mb-4 px-1">
          <a
            href="https://wa.me/923210081414"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/15 p-3 text-xs text-red-950 dark:text-red-200 transition-colors shadow-sm cursor-pointer h-[74px]"
          >
            Trial Period: Expired. Contact <span className="underline font-bold">WhatsApp +923210081414</span> for upgrading to pro.
          </a>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-background">
      {isReadOnly && (
        <div className="bg-amber-500 dark:bg-amber-600 text-white px-4 py-2 text-center text-xs md:text-sm font-medium flex items-center justify-center gap-2 border-b border-amber-600 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Upgrade your account to continue adding records. You still retain unlimited access to view, customize themes, and print your past records/PDFs. Contact on{" "}
            <a
              href="https://wa.me/923210081414"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-bold hover:text-amber-100 transition-colors"
            >
              WhatsApp (+92 321 0081414)
            </a>{" "}
            to upgrade.
          </span>
        </div>
      )}
      <div className="flex flex-1 min-w-0 w-full bg-background">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar">
          <div className="flex h-16 items-center border-b px-3">
            <BusinessSwitcher />
          </div>
          <nav className="flex-1 space-y-1 p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isReadOnly}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 mb-4 bg-transparent border-sidebar-primary/50 hover:border-sidebar-primary text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-semibold shadow-sm rounded-md transition-colors cursor-pointer"
                >
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>Quick Actions</span>
                </span>
                <ChevronsUpDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-52" align="start">
              <DropdownMenuLabel className="text-xs">Quick Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/invoices/new" className="flex items-center gap-2 cursor-pointer w-full">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span>New Invoice</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setClientPayOpen(true)}
                className="flex items-center gap-2 cursor-pointer w-full"
              >
                <Banknote className="h-4 w-4 shrink-0" />
                <span>Log Payment Received</span>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/vendors/grn/new" className="flex items-center gap-2 cursor-pointer w-full">
                  <Truck className="h-4 w-4 shrink-0" />
                  <span>Log GRN</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setVendorPayOpen(true)}
                className="flex items-center gap-2 cursor-pointer w-full"
              >
                <Coins className="h-4 w-4 shrink-0" />
                <span>Log Payment</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setLedgerTxOpen(true)}
                className="flex items-center gap-2 cursor-pointer w-full"
              >
                <BookOpen className="h-4 w-4 shrink-0" />
                <span>Log Transaction</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {renderAccountStatus()}

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
          {user?.email === "mansoorshahzadpk@gmail.com" && (
            <Link
              to="/super-admin"
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive("/super-admin")
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <ShieldAlert className="h-4 w-4" />
              Super Admin
            </Link>
          )}
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden" title="Quick Actions" disabled={isReadOnly}>
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-52" align="end">
                <DropdownMenuLabel className="text-xs">Quick Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/invoices/new" className="flex items-center gap-2 cursor-pointer w-full">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span>New Invoice</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setClientPayOpen(true)}
                  className="flex items-center gap-2 cursor-pointer w-full"
                >
                  <Banknote className="h-4 w-4 shrink-0" />
                  <span>Log Payment Received</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/vendors/grn/new" className="flex items-center gap-2 cursor-pointer w-full">
                    <Truck className="h-4 w-4 shrink-0" />
                    <span>Log GRN</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setVendorPayOpen(true)}
                  className="flex items-center gap-2 cursor-pointer w-full"
                >
                  <Coins className="h-4 w-4 shrink-0" />
                  <span>Log Payment</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLedgerTxOpen(true)}
                  className="flex items-center gap-2 cursor-pointer w-full"
                >
                  <BookOpen className="h-4 w-4 shrink-0" />
                  <span>Log Transaction</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
              {user?.email === "mansoorshahzadpk@gmail.com" && (
                <DropdownMenuItem asChild>
                  <Link to="/super-admin">
                    <ShieldAlert className="mr-2 h-4 w-4" />
                    Super Admin
                  </Link>
                </DropdownMenuItem>
              )}
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

      {/* Log Payment Received Dialog */}
      <Dialog open={clientPayOpen} onOpenChange={setClientPayOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleClientPaySubmit}>
            <DialogHeader>
              <DialogTitle>Log Payment Received</DialogTitle>
              <DialogDescription>
                Record incoming installment payment from industrial client.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <Field label="Client">
                <Select
                  value={clientPay.client_id}
                  onValueChange={(val) => setClientPay({ ...clientPay, client_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Amount">
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={clientPay.amount}
                  onChange={(e) => setClientPay({ ...clientPay, amount: e.target.value })}
                  placeholder="e.g. 25000"
                  autoFocus
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <Input
                    type="date"
                    required
                    value={clientPay.payment_date}
                    onChange={(e) => setClientPay({ ...clientPay, payment_date: e.target.value })}
                  />
                </Field>
                <Field label="Method">
                  <Select
                    value={clientPay.method}
                    onValueChange={(v) => setClientPay({ ...clientPay, method: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="mobile">Mobile / wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Deposit Account">
                <Select
                  value={clientPay.asset_id}
                  onValueChange={(v) => setClientPay({ ...clientPay, asset_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankCashAssets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name} ({asset.type === "bank_account" ? "Bank" : "Petty Cash"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Reference (optional)">
                <Input
                  value={clientPay.reference}
                  onChange={(e) => setClientPay({ ...clientPay, reference: e.target.value })}
                  placeholder="Cheque # / Trans ID"
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setClientPayOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Subtract from balance
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Log Vendor Payment Dialog */}
      <Dialog open={vendorPayOpen} onOpenChange={setVendorPayOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleVendorPaySubmit}>
            <DialogHeader>
              <DialogTitle>Log Vendor Payment</DialogTitle>
              <DialogDescription>
                Record outgoing payment made to a raw material vendor.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <Field label="Vendor">
                <Select
                  value={vendorPay.vendor_id}
                  onValueChange={(val) => setVendorPay({ ...vendorPay, vendor_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Amount">
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={vendorPay.amount}
                  onChange={(e) => setVendorPay({ ...vendorPay, amount: e.target.value })}
                  placeholder="e.g. 50000"
                  autoFocus
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <Input
                    type="date"
                    required
                    value={vendorPay.payment_date}
                    onChange={(e) => setVendorPay({ ...vendorPay, payment_date: e.target.value })}
                  />
                </Field>
                <Field label="Method">
                  <Select
                    value={vendorPay.method}
                    onValueChange={(v) => setVendorPay({ ...vendorPay, method: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">Bank transfer</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="mobile">Mobile / wallet</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Withdrawal Account">
                <Select
                  value={vendorPay.asset_id}
                  onValueChange={(v) => setVendorPay({ ...vendorPay, asset_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankCashAssets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name} ({asset.type === "bank_account" ? "Bank" : "Petty Cash"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Reference (optional)">
                <Input
                  value={vendorPay.reference}
                  onChange={(e) => setVendorPay({ ...vendorPay, reference: e.target.value })}
                  placeholder="Cheque # / Trans ID"
                />
              </Field>
              <Field label="Notes / Remarks">
                <Textarea
                  value={vendorPay.notes}
                  onChange={(e) => setVendorPay({ ...vendorPay, notes: e.target.value })}
                  placeholder="Additional notes about payment"
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVendorPayOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Log Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Log Ledger Transaction Dialog */}
      <Dialog open={ledgerTxOpen} onOpenChange={setLedgerTxOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleLedgerSubmit}>
            <DialogHeader>
              <DialogTitle>Log Ledger Transaction</DialogTitle>
              <DialogDescription>
                Record non-inventory business cash flow like marketing, utilities, rent or salaries.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <Input
                    type="date"
                    required
                    value={ledgerForm.transaction_date}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, transaction_date: e.target.value })}
                  />
                </Field>
                <Field label="Category">
                  <Select
                    value={ledgerForm.category}
                    onValueChange={(val) => setLedgerForm({ ...ledgerForm, category: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Flow Type">
                  <Select
                    value={ledgerForm.type}
                    onValueChange={(val: "debit" | "credit") => setLedgerForm({ ...ledgerForm, type: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit">Credit (Outgoing Expense)</SelectItem>
                      <SelectItem value="debit">Debit (Incoming Revenue)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Amount">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={ledgerForm.amount}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, amount: e.target.value })}
                    placeholder="e.g. 5000"
                  />
                </Field>
              </div>
              <Field label="Asset Account">
                <Select
                  value={ledgerForm.asset_id}
                  onValueChange={(val) => setLedgerForm({ ...ledgerForm, asset_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select asset account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Asset Account (Unlinked)</SelectItem>
                    {bankCashAssets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name} ({asset.type === "bank_account" ? "Bank" : "Petty Cash"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Description">
                <Input
                  value={ledgerForm.description}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, description: e.target.value })}
                  placeholder="e.g. Office electricity bill"
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLedgerTxOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Save Transaction
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
