import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getBalanceSheetFn } from "@/lib/financial-functions.server";
import { useApp } from "@/lib/app-context";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import { Download, RefreshCw, BarChart2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/balance")({
  component: BalanceSheetPage,
  head: () => ({
    meta: [
      { title: "Balance Sheet — Ace Ledger" },
      { name: "description", content: "Statement of B2B assets, liabilities, and equity in Ace Ledger ERP." },
    ],
  }),
});

function BalanceSheetPage() {
  const { settings, activeBusinessId, user } = useApp();
  const c = settings.currency;

  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["balance_sheet", activeBusinessId, asOfDate],
    queryFn: () => {
      if (!activeBusinessId) return null;
      // Invoke the TanStack server function
      return getBalanceSheetFn({
        businessId: activeBusinessId,
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
          <h1 className="text-2xl font-semibold tracking-tight">Balance Sheet</h1>
          <p className="text-sm text-muted-foreground">
            A real-time snapshot of what your business owns (Assets), owes (Liabilities), and its net worth (Equity).
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
          <CardTitle>Reporting Period</CardTitle>
          <CardDescription>Select the date to view statement balances as of that date</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 max-w-sm">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="asOfDate">Statement As of Date</Label>
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
              <Card className="border-success/30 bg-success/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-success shrink-0" />
                  <div className="text-xs text-success-foreground">
                    <span className="font-bold">Ledger Balanced.</span> The balance sheet matches standard accounting
                    formula: <code className="bg-success/10 px-1 py-0.5 rounded">Assets ({formatMoney(data.totalAssets, c)}) = Liabilities + Equity ({formatMoney(data.totalLiabilities + data.equity, c)})</code>.
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
