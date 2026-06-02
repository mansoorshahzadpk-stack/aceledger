import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { getIncomeStatementFn, getBalanceSheetFn } from "@/lib/financial-functions";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  DollarSign,
  Download,
  RefreshCw,
  Scale,
  ShieldCheck,
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  Layers,
  BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Financial Reports — Ace Ledger" },
      { name: "description", content: "Consolidated financial dashboard for Ace Ledger ERP, including Profit & Loss, Balance Sheet, Bank Reconciliation, and Analytics." },
    ],
  }),
});

const ANALYTICS_COLORS = ["#6366f1", "#06b6d4", "#f97316", "#ec4899", "#10b981", "#eab308", "#8b5cf6", "#ef4444"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function ReportsPage() {
  const [activeTab, setActiveTab] = useState("pl");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Financial Reports &amp; Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Consolidated tracking of Profit &amp; Loss, Balance Sheet, Bank Reconciliation, and Business Analytics.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:max-w-2xl bg-muted/60 p-1 rounded-lg">
          <TabsTrigger value="pl" className="flex items-center gap-2 cursor-pointer py-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Profit &amp; Loss</span>
            <span className="sm:hidden">P&amp;L</span>
          </TabsTrigger>
          <TabsTrigger value="balance" className="flex items-center gap-2 cursor-pointer py-2">
            <Scale className="h-4 w-4" />
            <span>Balance Sheet</span>
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="flex items-center gap-2 cursor-pointer py-2">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Reconciliation</span>
            <span className="sm:hidden">Recon</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2 cursor-pointer py-2">
            <BarChart3 className="h-4 w-4" />
            <span>Analytics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pl" className="space-y-6 focus:outline-none">
          <PLTab />
        </TabsContent>

        <TabsContent value="balance" className="space-y-6 focus:outline-none">
          <BalanceTab />
        </TabsContent>

        <TabsContent value="reconciliation" className="space-y-6 focus:outline-none">
          <ReconciliationTab />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6 focus:outline-none">
          <AnalyticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ==========================================
   PROFIT & LOSS TAB
   ========================================== */
function PLTab() {
  const { settings, user, activeBusinessId } = useApp();
  const c = settings.currency;
  const [from, setFrom] = useState(isoDaysAgo(90));
  const [to, setTo] = useState(todayISO());

  const preset = (kind: "month" | "quarter" | "year") => {
    const now = new Date();
    if (kind === "month") {
      setFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
      setTo(todayISO());
    } else if (kind === "quarter") {
      const q = Math.floor(now.getMonth() / 3);
      setFrom(new Date(now.getFullYear(), q * 3, 1).toISOString().slice(0, 10));
      setTo(todayISO());
    } else {
      setFrom(new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10));
      setTo(todayISO());
    }
  };

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["income_statement", user?.id, activeBusinessId, from, to],
    queryFn: () => {
      if (!activeBusinessId || !user) return null;
      return getIncomeStatementFn({
        businessId: activeBusinessId,
        userId: user.id,
        fromDate: from,
        toDate: to,
      });
    },
    enabled: !!activeBusinessId && !!user,
  });

  const exportCSV = () => {
    if (!data) return;

    const rows = [
      ["PROFIT & LOSS STATEMENT (INCOME STATEMENT)", ""],
      ["Business Name", settings.business_name || "My Business"],
      ["Period", `${from} to ${to}`],
      ["Currency", settings.currency],
      [],
      ["REVENUE & COGS", ""],
      ["  Gross Sales Revenue (Invoices)", data.revenue.toFixed(2)],
      ["  Cost of Goods Sold (GRNs)", data.cogs.toFixed(2)],
      ["GROSS PROFIT", data.grossProfit.toFixed(2)],
      [],
      ["OPERATIONAL EXPENSES", ""],
      ...Object.entries(data.expensesByCategory || {}).map(([cat, val]) => [`  ${cat}`, (val as number).toFixed(2)]),
      ["TOTAL OPERATIONAL EXPENSES", data.totalExpenses.toFixed(2)],
      [],
      ["MINOR & INDIRECT INCOMES", ""],
      ...Object.entries(data.minorIncomesByCategory || {}).map(([cat, val]) => [`  ${cat}`, (val as number).toFixed(2)]),
      ["TOTAL MINOR INCOMES", data.totalMinorIncomes.toFixed(2)],
      [],
      ["NET PROFIT / LOSS", data.netProfit.toFixed(2)],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.map(val => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Income_Statement_${from}_to_${to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Income Statement (Profit &amp; Loss)</h2>
          <p className="text-xs text-muted-foreground">
            Revenue from posted B2B invoices minus cost of inventory goods received (COGS) and operational overhead.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={exportCSV} disabled={!data} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Filter Statement Range</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Quick presets</Label>
              <div className="flex gap-1.5 mt-0.5">
                <Button size="sm" variant="outline" onClick={() => preset("month")}>
                  This Month
                </Button>
                <Button size="sm" variant="outline" onClick={() => preset("quarter")}>
                  This Quarter
                </Button>
                <Button size="sm" variant="outline" onClick={() => preset("year")}>
                  This Year
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Loading report data...
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Sales Revenue" value={formatMoney(data.revenue, c)} icon={TrendingUp} tone="success" />
            <Kpi label="COGS (GRNs)" value={formatMoney(data.cogs, c)} icon={TrendingDown} tone="warning" />
            <Kpi label="Gross Profit" value={formatMoney(data.grossProfit, c)} icon={Wallet} tone={data.grossProfit >= 0 ? "success" : "destructive"} />
            <Kpi label="Net Profit" value={formatMoney(data.netProfit, c)} icon={DollarSign} tone={data.netProfit >= 0 ? "success" : "destructive"} />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Trading Income &amp; COGS</CardTitle>
                <CardDescription>Revenue minus directly attributable inventory costs</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-semibold">Gross Sales Revenue (Invoices)</TableCell>
                      <TableCell className="text-right figure text-success font-medium">
                        + {formatMoney(data.revenue, c)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold">Cost of Goods Sold (GRNs)</TableCell>
                      <TableCell className="text-right figure text-destructive font-medium">
                        - {formatMoney(data.cogs, c)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/40 font-bold border-t border-double">
                      <TableCell className="text-base text-foreground">GROSS TRADING PROFIT</TableCell>
                      <TableCell className="text-right figure text-base text-foreground">
                        {formatMoney(data.grossProfit, c)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Overhead &amp; Indirect Revenues</CardTitle>
                <CardDescription>Non-inventory expenses and secondary income streams</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-2">
                    Operating Expenses
                  </h4>
                  <Table>
                    <TableBody>
                      {Object.keys(data.expensesByCategory).length === 0 ? (
                        <TableRow>
                          <TableCell className="text-muted-foreground italic text-center py-4" colSpan={2}>
                            No expenses logged in this range.
                          </TableCell>
                        </TableRow>
                      ) : (
                        Object.entries(data.expensesByCategory).map(([cat, val]) => (
                          <TableRow key={cat}>
                            <TableCell className="text-sm pl-2">{cat}</TableCell>
                            <TableCell className="text-right figure text-destructive font-medium">
                              - {formatMoney(val as number, c)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                      <TableRow className="bg-destructive/5 font-semibold">
                        <TableCell className="text-sm font-semibold">Total Operating Expenses</TableCell>
                        <TableCell className="text-right figure text-destructive font-semibold">
                          {formatMoney(data.totalExpenses, c)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <h4 className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-2">
                    Minor &amp; Indirect Incomes
                  </h4>
                  <Table>
                    <TableBody>
                      {Object.keys(data.minorIncomesByCategory).length === 0 ? (
                        <TableRow>
                          <TableCell className="text-muted-foreground italic text-center py-4" colSpan={2}>
                            No indirect incomes logged in this range.
                          </TableCell>
                        </TableRow>
                      ) : (
                        Object.entries(data.minorIncomesByCategory).map(([cat, val]) => (
                          <TableRow key={cat}>
                            <TableCell className="text-sm pl-2">{cat}</TableCell>
                            <TableCell className="text-right figure text-success font-medium">
                              + {formatMoney(val as number, c)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                      <TableRow className="bg-success/5 font-semibold">
                        <TableCell className="text-sm font-semibold">Total Indirect Revenues</TableCell>
                        <TableCell className="text-right figure text-success font-semibold">
                          {formatMoney(data.totalMinorIncomes, c)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-t-4 border-t-primary">
            <CardHeader className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Net Profit &amp; Bottom Line Summary</CardTitle>
                  <CardDescription>Final net return representing the actual earnings of the business</CardDescription>
                </div>
                <div className="text-right">
                  <span className="text-xs uppercase text-muted-foreground block font-semibold">Net Return</span>
                  <span
                    className={`figure text-3xl font-bold font-serif ${
                      data.netProfit >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {formatMoney(data.netProfit, c)}
                  </span>
                </div>
              </div>
            </CardHeader>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: "success" | "warning" | "destructive" }) {
  const map = {
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/15",
    destructive: "text-destructive bg-destructive/10",
  } as const;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
            <p className="mt-2 figure text-2xl font-semibold font-serif">{value}</p>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${map[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ==========================================
   BALANCE SHEET TAB
   ========================================== */
function BalanceTab() {
  const { settings, activeBusinessId, user } = useApp();
  const c = settings.currency;
  const [asOfDate, setAsOfDate] = useState(todayISO());

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["balance_sheet", user?.id, activeBusinessId, asOfDate],
    queryFn: () => {
      if (!activeBusinessId || !user) return null;
      return getBalanceSheetFn({
        businessId: activeBusinessId,
        userId: user.id,
        asOfDate,
      });
    },
    enabled: !!activeBusinessId && !!user,
  });

  const exportCSV = () => {
    if (!data) return;

    const rows = [
      ["BALANCE SHEET", ""],
      ["Business Name", settings.business_name || "My Business"],
      ["As of Date", asOfDate],
      ["Currency", settings.currency],
      [],
      ["ASSETS", ""],
      ...(data.cashBalances || []).map((b: any) => [`  Cash & Bank: ${b.name}`, b.balance.toFixed(2)]),
      ["  Accounts Receivable", data.totalReceivables.toFixed(2)],
      ["  Warehouse Inventory Value", data.inventoryValue.toFixed(2)],
      ["  Property & Equipment", data.totalProperty.toFixed(2)],
      ["TOTAL ASSETS", data.totalAssets.toFixed(2)],
      [],
      ["LIABILITIES", ""],
      ["  Accounts Payable (Vendors)", data.totalPayables.toFixed(2)],
      ["TOTAL LIABILITIES", data.totalLiabilities.toFixed(2)],
      [],
      ["EQUITY", ""],
      ["  Owner's Equity / Capital", data.equity.toFixed(2)],
      ["TOTAL EQUITY", data.equity.toFixed(2)],
      [],
      ["TOTAL LIABILITIES & EQUITY", (data.totalLiabilities + data.equity).toFixed(2)],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.map(val => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Balance_Sheet_${asOfDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isBalanced = data ? Math.abs(data.totalAssets - (data.totalLiabilities + data.equity)) < 0.01 : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Balance Sheet Statement</h2>
          <p className="text-xs text-muted-foreground">
            A real-time snapshot of what your business owns (Assets), owes (Liabilities), and its net worth (Equity).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={exportCSV} disabled={!data} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Statement Period</CardTitle>
          <CardDescription>Select the date to view statement balances as of that date</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 max-w-sm">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="asOfDate">As of Date</Label>
              <Input
                type="date"
                id="asOfDate"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Loading Balance Sheet...
        </div>
      )}

      {data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Assets</CardTitle>
              <CardDescription>What the business owns</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset Category</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-semibold" colSpan={2}>
                      Cash &amp; Cash Equivalents
                    </TableCell>
                  </TableRow>
                  {(data.cashBalances || []).map((asset: any) => (
                    <TableRow key={asset.id}>
                      <TableCell className="pl-6 text-muted-foreground text-sm">{asset.name}</TableCell>
                      <TableCell className="text-right figure">{formatMoney(asset.balance, c)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-semibold">Accounts Receivable (Client Balances)</TableCell>
                    <TableCell className="text-right figure">{formatMoney(data.totalReceivables, c)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold">Warehouse Inventory Valuation (W.A.C.)</TableCell>
                    <TableCell className="text-right figure">{formatMoney(data.inventoryValue, c)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold">Property &amp; Equipment Valuations</TableCell>
                    <TableCell className="text-right figure">{formatMoney(data.totalProperty, c)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/50 border-t-2">
                    <TableCell className="font-bold text-foreground text-base">TOTAL ASSETS</TableCell>
                    <TableCell className="text-right figure text-base font-bold text-foreground">
                      {formatMoney(data.totalAssets, c)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Liabilities &amp; Equity</CardTitle>
                <CardDescription>What the business owes and owner's net worth</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-semibold" colSpan={2}>
                        Current Liabilities
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6 text-muted-foreground text-sm">
                        Accounts Payable (Vendor Balances)
                      </TableCell>
                      <TableCell className="text-right figure">{formatMoney(data.totalPayables, c)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/30">
                      <TableCell className="font-semibold text-sm">TOTAL LIABILITIES</TableCell>
                      <TableCell className="text-right figure text-sm font-semibold">
                        {formatMoney(data.totalLiabilities, c)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold" colSpan={2}>
                        Equity
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6 text-muted-foreground text-sm">Owner's Capital / Net Assets</TableCell>
                      <TableCell className="text-right figure">{formatMoney(data.equity, c)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/30">
                      <TableCell className="font-semibold text-sm">TOTAL EQUITY</TableCell>
                      <TableCell className="text-right figure text-sm font-semibold">
                        {formatMoney(data.equity, c)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/50 border-t-2">
                      <TableCell className="font-bold text-foreground text-base">TOTAL LIABILITIES &amp; EQUITY</TableCell>
                      <TableCell className="text-right figure text-base font-bold text-foreground">
                        {formatMoney(data.totalLiabilities + data.equity, c)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {isBalanced && (
              <Card className="border-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-950/20">
                <CardContent className="p-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="text-xs text-emerald-800 dark:text-emerald-200">
                    <span className="font-bold">Ledger Balanced.</span> The balance sheet matches standard accounting
                    formula: <code className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100 px-1.5 py-0.5 rounded font-mono font-semibold">Assets ({formatMoney(data.totalAssets, c)}) = Liabilities + Equity ({formatMoney(data.totalLiabilities + data.equity, c)})</code>.
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================
   BANK RECONCILIATION TAB
   ========================================== */
interface ReconcilableTransaction {
  sourceTable: "client_payments" | "vendor_payments" | "ledger_transactions";
  id: string;
  date: string;
  name: string;
  type: "inflow" | "outflow";
  categoryOrMethod: string;
  reference: string | null;
  amount: number;
  reconciled: boolean;
}

function ReconciliationTab() {
  const { settings, activeBusinessId, user } = useApp();
  const c = settings.currency;
  const qc = useQueryClient();

  const [selectedAssetId, setSelectedAssetId] = useState<string>("all");

  // Query assets (only bank/cash)
  const { data: assets = [] } = useQuery({
    queryKey: ["bank_cash_reconciliation_assets", user?.id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId) return [];
      const { data, error } = await supabase
        .from("assets")
        .select("id, name, type, initial_balance")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user?.id || "")
        .in("type", ["bank_account", "petty_cash"]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeBusinessId && !!user,
  });

  // Query transactions linked to the selected asset
  const { data: rawTransactions, isLoading, refetch } = useQuery({
    queryKey: ["reconciliation_transactions", user?.id, activeBusinessId, selectedAssetId],
    queryFn: async () => {
      if (!activeBusinessId) return { clientPays: [], vendorPays: [], ledgerTxs: [] };

      const clientQuery = supabase
        .from("client_payments")
        .select("id, amount, payment_date, method, reference, client_id, clients(name), asset_id, reconciled")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user?.id || "");

      const vendorQuery = supabase
        .from("vendor_payments")
        .select("id, amount, payment_date, method, reference, vendor_id, vendors(name), asset_id, reconciled")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user?.id || "");

      const ledgerQuery = supabase
        .from("ledger_transactions" as any)
        .select("id, amount, transaction_date, category, type, description, asset_id, reconciled")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user?.id || "");

      if (selectedAssetId !== "all") {
        clientQuery.eq("asset_id", selectedAssetId);
        vendorQuery.eq("asset_id", selectedAssetId);
        ledgerQuery.eq("asset_id", selectedAssetId);
      }

      const [{ data: clientPays }, { data: vendorPays }, { data: ledgerTxs }] = await Promise.all([
        clientQuery,
        vendorQuery,
        ledgerQuery,
      ]);

      return {
        clientPays: clientPays || [],
        vendorPays: vendorPays || [],
        ledgerTxs: ledgerTxs || [],
      };
    },
    enabled: !!activeBusinessId && !!selectedAssetId,
  });

  const reconcileMutation = useMutation({
    mutationFn: async ({ sourceTable, id, reconciled }: { sourceTable: string; id: string; reconciled: boolean }) => {
      const { error } = await supabase
        .from(sourceTable as any)
        .update({ reconciled })
        .eq("id", id)
        .eq("user_id", user?.id || "");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transaction reconciliation status updated");
      qc.invalidateQueries({ queryKey: ["reconciliation_transactions"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["asset_flows"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const formattedTxs: ReconcilableTransaction[] = [];

  if (rawTransactions) {
    rawTransactions.clientPays.forEach((p: any) => {
      formattedTxs.push({
        sourceTable: "client_payments",
        id: p.id,
        date: p.payment_date,
        name: `Installment from ${p.clients?.name || "Client"}`,
        type: "inflow",
        categoryOrMethod: p.method,
        reference: p.reference,
        amount: Number(p.amount),
        reconciled: !!p.reconciled,
      });
    });

    rawTransactions.vendorPays.forEach((p: any) => {
      formattedTxs.push({
        sourceTable: "vendor_payments",
        id: p.id,
        date: p.payment_date,
        name: `Payment to ${p.vendors?.name || "Vendor"}`,
        type: "outflow",
        categoryOrMethod: p.method,
        reference: p.reference,
        amount: Number(p.amount),
        reconciled: !!p.reconciled,
      });
    });

    rawTransactions.ledgerTxs.forEach((tx: any) => {
      formattedTxs.push({
        sourceTable: "ledger_transactions",
        id: tx.id,
        date: tx.transaction_date,
        name: tx.description || `${tx.type === "debit" ? "Receipt" : "Payment"}: ${tx.category}`,
        type: tx.type === "debit" ? "inflow" : "outflow",
        categoryOrMethod: tx.category,
        reference: null,
        amount: Number(tx.amount),
        reconciled: !!tx.reconciled,
      });
    });
  }

  formattedTxs.sort((a, b) => b.date.localeCompare(a.date));

  const initialAsset = assets.find((a) => a.id === selectedAssetId);
  const initialBalance = initialAsset ? Number(initialAsset.initial_balance) : 0;

  const chronTxs = [...formattedTxs].reverse();
  let currentBalance = initialBalance;
  const txRunningBalances = new Map<string, number>();

  chronTxs.forEach((tx) => {
    if (tx.type === "inflow") {
      currentBalance += tx.amount;
    } else {
      currentBalance -= tx.amount;
    }
    txRunningBalances.set(`${tx.sourceTable}-${tx.id}`, currentBalance);
  });

  const totalInflows = formattedTxs
    .filter((tx) => tx.type === "inflow")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalOutflows = formattedTxs
    .filter((tx) => tx.type === "outflow")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalRunningBalance = initialBalance + totalInflows - totalOutflows;

  const reconciledInflows = formattedTxs
    .filter((tx) => tx.type === "inflow" && tx.reconciled)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const reconciledOutflows = formattedTxs
    .filter((tx) => tx.type === "outflow" && tx.reconciled)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const reconciledBalance = initialBalance + reconciledInflows - reconciledOutflows;

  const unreconciledItems = formattedTxs.filter((tx) => !tx.reconciled);

  const handleToggleReconcile = (tx: ReconcilableTransaction, checked: boolean) => {
    reconcileMutation.mutate({
      sourceTable: tx.sourceTable,
      id: tx.id,
      reconciled: checked,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Bank &amp; Cash Reconciliation</h2>
          <p className="text-xs text-muted-foreground">
            Verify transaction logs against physical bank statements and check off matched items.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh Logs">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <div className="w-64">
            <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select Asset Account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts (Consolidated)</SelectItem>
                {assets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Initial Balance</p>
                <p className="mt-2 figure text-xl font-semibold font-serif text-muted-foreground">
                  {formatMoney(initialBalance, c)}
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-muted-foreground">
                <Layers className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Running Book Balance</p>
                <p className="mt-2 figure text-xl font-semibold font-serif">
                  {formatMoney(totalRunningBalance, c)}
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-primary">
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Reconciled Statement Bal</p>
                <p className="mt-2 figure text-xl font-semibold font-serif text-success">
                  {formatMoney(reconciledBalance, c)}
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded bg-success/10 text-success">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Unreconciled Items</p>
                <p className="mt-2 figure text-xl font-semibold font-serif text-warning">
                  {unreconciledItems.length}
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded bg-warning/15 text-warning">
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reconciliation Ledger</CardTitle>
          <CardDescription>
            Comparing book records. Checking an item commits its reconciled status in real-time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">Match</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Type/Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Running Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && formattedTxs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No matching transaction logs found for this account.
                    </TableCell>
                  </TableRow>
                )}
                {formattedTxs.map((tx) => {
                  const key = `${tx.sourceTable}-${tx.id}`;
                  const runBal = txRunningBalances.get(key) ?? 0;
                  return (
                    <TableRow key={key} className={tx.reconciled ? "bg-muted/40 text-muted-foreground" : ""}>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={tx.reconciled}
                          onCheckedChange={(checked) => handleToggleReconcile(tx, !!checked)}
                          disabled={reconcileMutation.isPending}
                        />
                      </TableCell>
                      <TableCell className="tabular">{tx.date}</TableCell>
                      <TableCell className="font-medium text-foreground">{tx.name}</TableCell>
                      <TableCell className="capitalize text-xs font-mono">{tx.categoryOrMethod}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{tx.reference || "—"}</TableCell>
                      <TableCell
                        className={`text-right figure font-semibold ${
                          tx.type === "inflow" ? "text-success" : "text-destructive"
                        }`}
                      >
                        {tx.type === "inflow" ? "+" : "-"} {formatMoney(tx.amount, c)}
                      </TableCell>
                      <TableCell className="text-right figure font-semibold text-foreground">
                        {formatMoney(runBal, c)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ==========================================
   ANALYTICS TAB
   ========================================== */
function AnalyticsTab() {
  const { settings, user, activeBusinessId } = useApp();
  const [from, setFrom] = useState(isoDaysAgo(90));
  const [to, setTo] = useState(todayISO());

  const { data } = useQuery({
    queryKey: ["analytics", user?.id, activeBusinessId, from, to],
    queryFn: async () => {
      if (!activeBusinessId) return { grns: [], invs: [], pays: [], vendors: [], clients: [] };
      const [{ data: grns }, { data: invs }, { data: pays }, { data: vendors }, { data: clients }] = await Promise.all([
        supabase.from("vendor_grns").select("*").eq("status", "posted").eq("business_id", activeBusinessId).eq("user_id", user?.id || "").gte("grn_date", from).lte("grn_date", to),
        supabase.from("invoices").select("*").eq("business_id", activeBusinessId).eq("user_id", user?.id || "").gte("issue_date", from).lte("issue_date", to),
        supabase.from("client_payments").select("*").eq("business_id", activeBusinessId).eq("user_id", user?.id || "").gte("payment_date", from).lte("payment_date", to),
        supabase.from("vendors").select("id, name").eq("business_id", activeBusinessId).eq("user_id", user?.id || ""),
        supabase.from("clients").select("id, name").eq("business_id", activeBusinessId).eq("user_id", user?.id || ""),
      ]);
      return { grns: grns ?? [], invs: invs ?? [], pays: pays ?? [], vendors: vendors ?? [], clients: clients ?? [] };
    },
    enabled: !!user && !!activeBusinessId,
  });

  const series = useMemo(() => {
    if (!data) return [];
    const rangeDays = Math.max(1, Math.ceil((+new Date(to) - +new Date(from)) / 86400000));
    const bucket = rangeDays > 365 ? "month" : rangeDays > 60 ? "week" : "day";
    const keyOf = (s: string) => {
      const d = new Date(s);
      if (bucket === "day") return d.toISOString().slice(0, 10);
      if (bucket === "week") {
        const x = new Date(d);
        x.setDate(x.getDate() - x.getDay());
        return x.toISOString().slice(0, 10);
      }
      return d.toISOString().slice(0, 7);
    };
    const map = new Map<string, { date: string; supplies: number; invoiced: number; received: number }>();
    const ensure = (k: string) => {
      if (!map.has(k)) map.set(k, { date: k, supplies: 0, invoiced: 0, received: 0 });
      return map.get(k)!;
    };
    data.grns.forEach((g: any) => {
      ensure(keyOf(g.grn_date)).supplies += Number(g.total_amount);
    });
    data.invs.filter((i: any) => i.status === "posted").forEach((i: any) => {
      ensure(keyOf(i.issue_date)).invoiced += Number(i.total);
    });
    data.pays.forEach((p: any) => {
      ensure(keyOf(p.payment_date)).received += Number(p.amount);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, from, to]);

  const topVendors = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, number>();
    data.grns.forEach((g: any) => m.set(g.vendor_id, (m.get(g.vendor_id) ?? 0) + Number(g.total_amount)));
    return Array.from(m.entries())
      .map(([id, value]) => ({ name: data.vendors.find((v) => v.id === id)?.name ?? "—", value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [data]);

  const topClients = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, number>();
    data.invs.filter((i: any) => i.status === "posted").forEach((i: any) => m.set(i.client_id, (m.get(i.client_id) ?? 0) + Number(i.total)));
    return Array.from(m.entries())
      .map(([id, value]) => ({ name: data.clients.find((c) => c.id === id)?.name ?? "—", value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [data]);

  const materialMix = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, number>();
    data.grns.forEach((g: any) => m.set(g.material, (m.get(g.material) ?? 0) + Number(g.quantity)));
    return Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [data]);

  const totals = useMemo(() => {
    if (!data) return { supplies: 0, invoiced: 0, received: 0 };
    return {
      supplies: data.grns.reduce((s, g: any) => s + Number(g.total_amount), 0),
      invoiced: data.invs.filter((i: any) => i.status === "posted").reduce((s, i: any) => s + Number(i.total), 0),
      received: data.pays.reduce((s, p: any) => s + Number(p.amount), 0),
    };
  }, [data]);

  const tooltipMoney = (v: any) => formatMoney(Number(v), settings.currency);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Analytics Dashboard</h2>
          <p className="text-xs text-muted-foreground">Select a date range to analyze supplies, sales, and money flows.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Date Range</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => { setFrom(isoDaysAgo(30)); setTo(todayISO()); }}>Last 30 days</Button>
            <Button variant="outline" size="sm" onClick={() => { setFrom(isoDaysAgo(90)); setTo(todayISO()); }}>Last 90 days</Button>
            <Button variant="outline" size="sm" onClick={() => { const d = new Date(); setFrom(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)); setTo(todayISO()); }}>This month</Button>
            <Button variant="outline" size="sm" onClick={() => { const d = new Date(); setFrom(new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10)); setTo(todayISO()); }}>This year</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Supplies Received" value={formatMoney(totals.supplies, settings.currency)} />
        <StatCard label="Invoiced (Posted)" value={formatMoney(totals.invoiced, settings.currency)} />
        <StatCard label="Payments Received" value={formatMoney(totals.received, settings.currency)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Money Flow Over Time</CardTitle>
          <CardDescription>Invoiced vs Received</CardDescription>
        </CardHeader>
        <CardContent style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={tooltipMoney} />
              <Legend />
              <Line type="monotone" dataKey="invoiced" stroke="#6366f1" strokeWidth={2} name="Invoiced" />
              <Line type="monotone" dataKey="received" stroke="#10b981" strokeWidth={2} name="Received" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supplies Received</CardTitle>
        </CardHeader>
        <CardContent style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={tooltipMoney} />
              <Bar dataKey="supplies" fill="#f97316" name="Supplies" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Top Vendors (By Supplies)</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topVendors} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                <Tooltip formatter={tooltipMoney} />
                <Bar dataKey="value" fill="#6366f1" name="Supplies Value" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top Clients (By Invoiced)</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topClients} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                <Tooltip formatter={tooltipMoney} />
                <Bar dataKey="value" fill="#06b6d4" name="Invoiced Value" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Material Mix (By Quantity)</CardTitle></CardHeader>
        <CardContent style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={materialMix} dataKey="value" nameKey="name" innerRadius={50} outerRadius={110} label>
                {materialMix.map((_, i) => (
                  <Cell key={i} fill={ANALYTICS_COLORS[i % ANALYTICS_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
        <div className="figure mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
