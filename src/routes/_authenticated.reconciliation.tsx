import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, RefreshCw, Layers } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reconciliation")({
  component: ReconciliationPage,
  head: () => ({
    meta: [
      { title: "Bank Reconciliation — Ace Ledger" },
      { name: "description", content: "Reconcile B2B bank and cash cashflows in Ace Ledger ERP." },
    ],
  }),
});

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

function ReconciliationPage() {
  const { settings, activeBusinessId } = useApp();
  const c = settings.currency;
  const qc = useQueryClient();

  const [selectedAssetId, setSelectedAssetId] = useState<string>("all");

  // Query assets (only bank/cash)
  const { data: assets = [] } = useQuery({
    queryKey: ["bank_cash_reconciliation_assets", activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId) return [];
      const { data, error } = await supabase
        .from("assets" as any)
        .select("id, name, type, initial_balance")
        .eq("business_id", activeBusinessId)
        .in("type", ["bank_account", "petty_cash"]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeBusinessId,
  });

  // Query transactions linked to the selected asset
  const { data: rawTransactions, isLoading, refetch } = useQuery({
    queryKey: ["reconciliation_transactions", activeBusinessId, selectedAssetId],
    queryFn: async () => {
      if (!activeBusinessId) return { clientPays: [], vendorPays: [], ledgerTxs: [] };

      // 1. Build queries based on asset selection
      const clientQuery = supabase
        .from("client_payments")
        .select("id, amount, payment_date, method, reference, client_id, clients(name), asset_id, reconciled")
        .eq("business_id", activeBusinessId);

      const vendorQuery = supabase
        .from("vendor_payments")
        .select("id, amount, payment_date, method, reference, vendor_id, vendors(name), asset_id, reconciled")
        .eq("business_id", activeBusinessId);

      const ledgerQuery = supabase
        .from("ledger_transactions" as any)
        .select("id, amount, transaction_date, category, type, description, asset_id, reconciled")
        .eq("business_id", activeBusinessId);

      // Apply asset filtering if not 'all'
      if (selectedAssetId !== "all") {
        clientQuery.eq("asset_id", selectedAssetId);
        vendorQuery.eq("asset_id", selectedAssetId);
        ledgerQuery.eq("asset_id", selectedAssetId);
      } else {
        // If 'all', we might want to filter only those linked to ANY asset
        // (but for B2B accounts, standard is to view everything linked or unlinked, let's pull all)
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

  // Toggle reconcile status mutation
  const reconcileMutation = useMutation({
    mutationFn: async ({ sourceTable, id, reconciled }: { sourceTable: string; id: string; reconciled: boolean }) => {
      const { error } = await supabase
        .from(sourceTable)
        .update({ reconciled })
        .eq("id", id);
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

  // Combine and format transactions into a single chronologically sorted list
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

  // Sort by date descending
  formattedTxs.sort((a, b) => b.date.localeCompare(a.date));

  // Running balance calculation (Initial + inflows - outflows)
  const initialAsset = assets.find((a) => a.id === selectedAssetId);
  const initialBalance = initialAsset ? Number(initialAsset.initial_balance) : 0;

  // Let's compute running balances:
  // Since sorting is descending, running balance builds from oldest to newest.
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

  // Reconciled balance: (Initial + reconciled inflows - reconciled outflows)
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
          <h1 className="text-2xl font-semibold tracking-tight">Bank &amp; Cash Reconciliation</h1>
          <p className="text-sm text-muted-foreground">
            Verify transaction logs against physical bank statements and check off matched items.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh Logs">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <div className="w-64">
            <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
              <SelectTrigger>
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
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Initial balance</p>
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
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Running Book Balance</p>
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
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Reconciled Statement Bal</p>
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
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Unreconciled Items</p>
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
