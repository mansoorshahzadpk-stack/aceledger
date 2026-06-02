import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Search, Trash2, Edit, PlusCircle, ArrowUpRight, ArrowDownLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ledger")({
  component: LedgerPage,
  head: () => ({
    meta: [
      { title: "General Ledger — Ace Ledger" },
      { name: "description", content: "Track B2B expenses, salaries, and indirect revenues in Ace Ledger ERP." },
    ],
  }),
});

const CATEGORIES = [
  "Marketing",
  "Administrative Expenses",
  "Employee Salaries",
  "Rent & Utilities",
  "Other Income",
  "Indirect Revenues",
  "Miscellaneous Expense",
];

interface LedgerTransaction {
  id: string;
  transaction_date: string;
  category: string;
  description: string | null;
  type: "debit" | "credit";
  amount: number;
  asset_id: string | null;
  reconciled: boolean;
  assets?: { name: string } | null;
}

function LedgerPage() {
  const { settings, activeBusinessId, user, isReadOnly } = useApp();
  const c = settings.currency;
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [open, setOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<LedgerTransaction | null>(null);

  const [form, setForm] = useState({
    transaction_date: new Date().toISOString().slice(0, 10),
    category: CATEGORIES[0],
    description: "",
    type: "credit" as "debit" | "credit",
    amount: "",
    asset_id: "none",
  });

  // Fetch ledger transactions
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["ledger_transactions", user?.id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId || !user) return [];
      const { data, error } = await supabase
        .from("ledger_transactions" as any)
        .select("*, assets:assets(name)")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user.id)
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as LedgerTransaction[];
    },
    enabled: !!activeBusinessId && !!user,
  });

  // Fetch assets (only bank and cash accounts to link with transactions)
  const { data: bankCashAssets = [] } = useQuery({
    queryKey: ["bank_cash_assets", user?.id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId || !user) return [];
      const { data, error } = await supabase
        .from("assets")
        .select("id, name, type")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user.id)
        .in("type", ["bank_account", "petty_cash"]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeBusinessId && !!user,
  });

  // Log new transaction or save edited
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!user || !activeBusinessId) return;
      if (editingTx) {
        const { error } = await supabase
          .from("ledger_transactions" as any)
          .update(payload)
          .eq("id", editingTx.id)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ledger_transactions" as any)
          .insert({
            user_id: user.id,
            business_id: activeBusinessId,
            ...payload,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingTx ? "Transaction updated" : "Transaction recorded");
      setOpen(false);
      setEditingTx(null);
      setForm({
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
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  // Delete transaction
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) return;
      const { error } = await supabase
        .from("ledger_transactions" as any)
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transaction deleted");
      qc.invalidateQueries({ queryKey: ["ledger_transactions"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["pl"] });
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(form.amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const payload = {
      transaction_date: form.transaction_date,
      category: form.category,
      description: form.description || null,
      type: form.type,
      amount: amountVal,
      asset_id: form.asset_id === "none" ? null : form.asset_id,
    };

    saveMutation.mutate(payload);
  };

  const handleEdit = (tx: LedgerTransaction) => {
    setEditingTx(tx);
    setForm({
      transaction_date: tx.transaction_date,
      category: tx.category,
      description: tx.description || "",
      type: tx.type,
      amount: String(tx.amount),
      asset_id: tx.asset_id || "none",
    });
    setOpen(true);
  };

  const filtered = transactions.filter((tx) => {
    const matchesSearch =
      (tx.description || "").toLowerCase().includes(search.toLowerCase()) ||
      tx.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || tx.category === categoryFilter;
    const matchesType = typeFilter === "all" || tx.type === typeFilter;
    return matchesSearch && matchesCategory && matchesType;
  });

  const totalDebits = filtered
    .filter((tx) => tx.type === "debit")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalCredits = filtered
    .filter((tx) => tx.type === "credit")
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">General Ledger</h1>
          <p className="text-sm text-muted-foreground">
            Track business cash flows including marketing, salaries, administrative expenses, and other minor revenues.
          </p>
        </div>
        <Button
          disabled={isReadOnly}
          onClick={() => {
            setEditingTx(null);
            setForm({
              transaction_date: new Date().toISOString().slice(0, 10),
              category: CATEGORIES[0],
              description: "",
              type: "credit",
              amount: "",
              asset_id: "none",
            });
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Log Transaction
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Inflows (Debits)</p>
                <p className="mt-2 figure text-2xl font-semibold font-serif text-success">
                  {formatMoney(totalDebits, c)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
                <ArrowUpRight className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Outflows (Credits)</p>
                <p className="mt-2 figure text-2xl font-semibold font-serif text-destructive">
                  {formatMoney(totalCredits, c)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <ArrowDownLeft className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Net Ledger Flow</p>
                <p
                  className={`mt-2 figure text-2xl font-semibold font-serif ${
                    totalDebits - totalCredits >= 0 ? "text-success" : "text-destructive"
                  }`}
                >
                  {formatMoney(totalDebits - totalCredits, c)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <PlusCircle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>Filtering & searching through your logged cash flows</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search description or category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-full sm:w-44">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-44">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="debit">Debit (Inflow)</SelectItem>
                  <SelectItem value="credit">Credit (Outflow)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
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
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No ledger transactions found
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="tabular">{tx.transaction_date}</TableCell>
                    <TableCell className="font-medium">{tx.category}</TableCell>
                    <TableCell className="text-muted-foreground">{tx.description || "—"}</TableCell>
                    <TableCell>{tx.assets?.name || <span className="text-muted-foreground italic text-xs">Unlinked</span>}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          tx.type === "debit"
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {tx.type === "debit" ? "Debit" : "Credit"}
                      </span>
                    </TableCell>
                    <TableCell
                      className={`text-right figure font-semibold ${
                        tx.type === "debit" ? "text-success" : "text-destructive"
                      }`}
                    >
                      {tx.type === "debit" ? "+" : "-"} {formatMoney(tx.amount, c)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => handleEdit(tx)}
                          disabled={isReadOnly}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this transaction?")) {
                              deleteMutation.mutate(tx.id);
                            }
                          }}
                          disabled={isReadOnly}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingTx ? "Edit Ledger Transaction" : "Log Ledger Transaction"}</DialogTitle>
              <DialogDescription>
                Record non-inventory business cash flow. Ensure category matches your report requirements.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="date" className="text-right">
                  Date
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={form.transaction_date}
                  onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right">
                  Category
                </Label>
                <Select
                  value={form.category}
                  onValueChange={(val) => setForm({ ...form, category: val })}
                >
                  <SelectTrigger className="col-span-3">
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
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">
                  Flow Type
                </Label>
                <Select
                  value={form.type}
                  onValueChange={(val: "debit" | "credit") => setForm({ ...form, type: val })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Credit (Outgoing Expense)</SelectItem>
                    <SelectItem value="debit">Debit (Incoming Revenue)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">
                  Amount
                </Label>
                <FormattedInput
                  id="amount"
                  mode="currency"
                  rawValue={form.amount}
                  onRawChange={(raw) => setForm({ ...form, amount: raw })}
                  className="col-span-3"
                  placeholder="e.g. 5,000.00"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="asset" className="text-right">
                  Asset Account
                </Label>
                <Select
                  value={form.asset_id}
                  onValueChange={(val) => setForm({ ...form, asset_id: val })}
                >
                  <SelectTrigger className="col-span-3">
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
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Description
                </Label>
                <Input
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g. Salary for office staff"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isReadOnly || saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save Transaction"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
