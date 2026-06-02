import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Wallet, Landmark, Home, ArrowUpRight, ArrowDownLeft, ReceiptText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assets")({
  component: AssetsPage,
  head: () => ({
    meta: [
      { title: "Asset Management — Ace Ledger" },
      { name: "description", content: "Manage Bank Accounts, Petty Cash, and Property & Equipment in Ace Ledger ERP." },
    ],
  }),
});

interface Asset {
  id: string;
  name: string;
  type: "bank_account" | "petty_cash" | "property_equipment";
  initial_balance: number;
  current_valuation: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function AssetsPage() {
  const { settings, activeBusinessId, user, isReadOnly } = useApp();
  const c = settings.currency;
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  const [form, setForm] = useState({
    name: "",
    type: "bank_account" as Asset["type"],
    initial_balance: "0",
    current_valuation: "0",
    notes: "",
  });

  // Query assets
  const { data: assets = [], isLoading, isSuccess } = useQuery({
    queryKey: ["assets", user?.id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId || !user) return [];
      const { data, error } = await supabase
        .from("assets" as any)
        .select("*")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user.id)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as Asset[];
    },
    enabled: !!activeBusinessId && !!user,
  });

  // Query related flows to compute balances on the client dynamically
  const { data: flows } = useQuery({
    queryKey: ["asset_flows", user?.id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId || !user) return { clientPays: [], vendorPays: [], ledgerTxs: [] };
      const [{ data: clientPays }, { data: vendorPays }, { data: ledgerTxs }] = await Promise.all([
        supabase.from("client_payments").select("amount, asset_id").eq("business_id", activeBusinessId).eq("user_id", user.id),
        supabase.from("vendor_payments").select("amount, asset_id").eq("business_id", activeBusinessId).eq("user_id", user.id),
        supabase.from("ledger_transactions" as any).select("amount, asset_id, type").eq("business_id", activeBusinessId).eq("user_id", user.id),
      ]);
      return {
        clientPays: clientPays || [],
        vendorPays: vendorPays || [],
        ledgerTxs: ledgerTxs || [],
      };
    },
    enabled: !!activeBusinessId && !!user,
  });

  // Provision defaults mutation
  const provisionMutation = useMutation({
    mutationFn: async () => {
      if (!user || !activeBusinessId) return;
      const defaults = [
        {
          user_id: user.id,
          business_id: activeBusinessId,
          name: "Main Bank Account",
          type: "bank_account",
          initial_balance: 0,
          current_valuation: 0,
          notes: "Primary account for B2B client installments",
        },
        {
          user_id: user.id,
          business_id: activeBusinessId,
          name: "Petty Cash",
          type: "petty_cash",
          initial_balance: 0,
          current_valuation: 0,
          notes: "Cash on hand for minor daily office expenses",
        },
      ];
      const { error } = await supabase.from("assets" as any).insert(defaults);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Default accounts provisioned");
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });

  useEffect(() => {
    if (isSuccess && assets.length === 0 && activeBusinessId && user && !isLoading && !provisionMutation.isPending && !isReadOnly) {
      provisionMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, assets.length, activeBusinessId, user, isLoading, isReadOnly]);

  // Save/Create Asset
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!user || !activeBusinessId) return;
      if (editingAsset) {
        const { error } = await supabase
          .from("assets" as any)
          .update(payload)
          .eq("id", editingAsset.id)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("assets" as any)
          .insert({
            user_id: user.id,
            business_id: activeBusinessId,
            ...payload,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingAsset ? "Asset updated" : "Asset created");
      setOpen(false);
      setEditingAsset(null);
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["asset_flows"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  // Delete Asset
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) return;
      const { error } = await supabase
        .from("assets" as any)
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Asset deleted");
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["asset_flows"] });
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Asset name is required");
      return;
    }

    const payload = {
      name: form.name,
      type: form.type,
      initial_balance: form.type === "property_equipment" ? 0 : parseFloat(form.initial_balance) || 0,
      current_valuation: form.type === "property_equipment" ? parseFloat(form.current_valuation) || 0 : 0,
      notes: form.notes || null,
    };

    saveMutation.mutate(payload);
  };

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setForm({
      name: asset.name,
      type: asset.type,
      initial_balance: String(asset.initial_balance),
      current_valuation: String(asset.current_valuation),
      notes: asset.notes || "",
    });
    setOpen(true);
  };

  // Process and compute balance for each asset
  const computedAssets = assets.map((asset) => {
    let balance = 0;
    let inflow = 0;
    let outflow = 0;

    if (asset.type === "property_equipment") {
      balance = asset.current_valuation;
    } else if (flows) {
      const clientInflow = flows.clientPays
        .filter((p) => p.asset_id === asset.id)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const ledgerInflow = flows.ledgerTxs
        .filter((tx: any) => tx.asset_id === asset.id && tx.type === "debit")
        .reduce((sum, tx: any) => sum + Number(tx.amount), 0);
      const vendorOutflow = flows.vendorPays
        .filter((p) => p.asset_id === asset.id)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const ledgerOutflow = flows.ledgerTxs
        .filter((tx: any) => tx.asset_id === asset.id && tx.type === "credit")
        .reduce((sum, tx: any) => sum + Number(tx.amount), 0);

      inflow = clientInflow + ledgerInflow;
      outflow = vendorOutflow + ledgerOutflow;
      balance = Number(asset.initial_balance) + inflow - outflow;
    }

    return {
      ...asset,
      inflow,
      outflow,
      balance,
    };
  });

  const totalBankCash = computedAssets
    .filter((a) => a.type === "bank_account" || a.type === "petty_cash")
    .reduce((sum, a) => sum + a.balance, 0);

  const totalProperty = computedAssets
    .filter((a) => a.type === "property_equipment")
    .reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Asset Management</h1>
          <p className="text-sm text-muted-foreground">
            Track bank accounts, petty cash funds, and property/equipment valuations to represent your business capital.
          </p>
        </div>
        <Button
          disabled={isReadOnly}
          onClick={() => {
            setEditingAsset(null);
            setForm({
              name: "",
              type: "bank_account",
              initial_balance: "0",
              current_valuation: "0",
              notes: "",
            });
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Asset Account
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Cash &amp; Bank Holdings</p>
                <p className="mt-2 figure text-2xl font-semibold font-serif text-success">
                  {formatMoney(totalBankCash, c)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Property &amp; Equipment Val</p>
                <p className="mt-2 figure text-2xl font-semibold font-serif text-primary">
                  {formatMoney(totalProperty, c)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Home className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Assets capital</p>
                <p className="mt-2 figure text-2xl font-semibold font-serif text-foreground">
                  {formatMoney(totalBankCash + totalProperty, c)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted border text-muted-foreground">
                <Landmark className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Asset Accounts &amp; Properties</CardTitle>
          <CardDescription>Capital accounts linked to client receivables and vendor payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Initial balance</TableHead>
                  <TableHead className="text-right">Inflow (Debits)</TableHead>
                  <TableHead className="text-right">Outflow (Credits)</TableHead>
                  <TableHead className="text-right">Running Balance / Valuation</TableHead>
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
                {!isLoading && computedAssets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No assets found. Creating defaults...
                    </TableCell>
                  </TableRow>
                )}
                {computedAssets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-semibold">{asset.name}</TableCell>
                    <TableCell>
                      <span className="capitalize">
                        {asset.type === "bank_account"
                          ? "Bank Account"
                          : asset.type === "petty_cash"
                            ? "Petty Cash"
                            : "Property & Equipment"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right figure">
                      {asset.type === "property_equipment" ? "—" : formatMoney(asset.initial_balance, c)}
                    </TableCell>
                    <TableCell className="text-right figure text-success">
                      {asset.type === "property_equipment" ? "—" : `+ ${formatMoney(asset.inflow, c)}`}
                    </TableCell>
                    <TableCell className="text-right figure text-destructive">
                      {asset.type === "property_equipment" ? "—" : `- ${formatMoney(asset.outflow, c)}`}
                    </TableCell>
                    <TableCell className="text-right figure font-bold text-foreground">
                      {formatMoney(asset.balance, c)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => handleEdit(asset)}
                          disabled={isReadOnly}
                        >
                          <ReceiptText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete asset "${asset.name}"?`)) {
                              deleteMutation.mutate(asset.id);
                            }
                          }}
                          disabled={isReadOnly || (assets.length <= 2 && (asset.type === "bank_account" || asset.type === "petty_cash"))}
                        >
                          <Plus className="h-4 w-4 rotate-45" />
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
              <DialogTitle>{editingAsset ? "Edit Asset" : "Add Asset Account"}</DialogTitle>
              <DialogDescription>
                Configure bank accounts, cash registers, or property valuations.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g. HBL Savings Account"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">
                  Asset Type
                </Label>
                <Select
                  value={form.type}
                  onValueChange={(val: Asset["type"]) => setForm({ ...form, type: val })}
                  disabled={!!editingAsset}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_account">Bank Account</SelectItem>
                    <SelectItem value="petty_cash">Petty Cash Fund</SelectItem>
                    <SelectItem value="property_equipment">Property / Equipment Valuation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.type !== "property_equipment" ? (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="initial_balance" className="text-right">
                    Initial balance
                  </Label>
                  <Input
                    id="initial_balance"
                    type="number"
                    step="0.01"
                    value={form.initial_balance}
                    onChange={(e) => setForm({ ...form, initial_balance: e.target.value })}
                    className="col-span-3"
                    required
                  />
                </div>
              ) : (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="current_valuation" className="text-right">
                    Current valuation
                  </Label>
                  <Input
                    id="current_valuation"
                    type="number"
                    step="0.01"
                    value={form.current_valuation}
                    onChange={(e) => setForm({ ...form, current_valuation: e.target.value })}
                    className="col-span-3"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="notes" className="text-right">
                  Notes
                </Label>
                <Input
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="col-span-3"
                  placeholder="Optional details"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isReadOnly || saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save Asset"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
