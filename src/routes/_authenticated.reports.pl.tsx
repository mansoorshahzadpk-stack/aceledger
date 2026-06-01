import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getIncomeStatementFn } from "@/lib/financial-functions.server";
import { useApp } from "@/lib/app-context";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { TrendingUp, TrendingDown, Wallet, DollarSign, Download, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/pl")({
  component: PLPage,
  head: () => ({
    meta: [
      { title: "Profit & Loss — Ace Ledger" },
      { name: "description", content: "Income statement including sales revenue, COGS, administrative expenses, and net profit." },
    ],
  }),
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function PLPage() {
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
    queryKey: ["income_statement", activeBusinessId, from, to],
    queryFn: () => {
      if (!activeBusinessId) return null;
      return getIncomeStatementFn({
        businessId: activeBusinessId,
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
          <h1 className="text-2xl font-semibold tracking-tight">Income Statement (Profit &amp; Loss)</h1>
          <p className="text-sm text-muted-foreground">
            Revenue from posted B2B invoices minus cost of inventory goods received (COGS) and operational overhead.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={exportCSV} disabled={!data} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
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
                      <TableCell className="text-right figure text-success">
                        + {formatMoney(data.revenue, c)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold">Cost of Goods Sold (GRNs)</TableCell>
                      <TableCell className="text-right figure text-destructive">
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
                            <TableCell className="text-right figure text-destructive">
                              - {formatMoney(val as number, c)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                      <TableRow className="bg-destructive/5 font-semibold">
                        <TableCell className="text-sm">Total Operating Expenses</TableCell>
                        <TableCell className="text-right figure text-destructive">
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
                            <TableCell className="text-right figure text-success">
                              + {formatMoney(val as number, c)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                      <TableRow className="bg-success/5 font-semibold">
                        <TableCell className="text-sm">Total Indirect Revenues</TableCell>
                        <TableCell className="text-right figure text-success">
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
                  <span className="text-xs uppercase text-muted-foreground block">Net Return</span>
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
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
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
