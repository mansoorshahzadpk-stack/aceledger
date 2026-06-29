import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";
import {
  Plus,
  Wallet,
  Landmark,
  Home,
  ArrowUpRight,
  ArrowDownLeft,
  ReceiptText,
  ArrowLeftRight,
  Calendar,
  Info,
  RefreshCw,
  Pencil,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/assets")({
  component: AssetsPage,
  head: () => ({
    meta: [
      { title: "Asset Management — Ace Ledger" },
      {
        name: "description",
        content: "Manage Bank Accounts, Petty Cash, and Property & Equipment in Ace Ledger ERP.",
      },
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
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    from_asset_id: "",
    to_asset_id: "",
    amount: "",
    transfer_date: new Date().toISOString().slice(0, 10),
    remarks: "",
  });

  const [form, setForm] = useState({
    name: "",
    type: "bank_account" as Asset["type"],
    initial_balance: "0",
    current_valuation: "0",
    notes: "",
  });

  const [selectedAssetLedger, setSelectedAssetLedger] = useState<Asset | null>(null);

  // Query assets
  const {
    data: assets = [],
    isLoading,
    isSuccess,
  } = useQuery({
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

      const clientPaysPromise = supabase
        .from("client_payments")
        .select("amount, asset_id")
        .eq("status", "posted")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user.id);
      const ledgerTxsPromise = supabase
        .from("ledger_transactions" as any)
        .select("amount, asset_id, type")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user.id);
      const vendorPaysPromise = supabase
        .from("vendor_payments")
        .select("amount, asset_id, status")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user.id);

      const [resClient, resLedger, resVendor] = await Promise.all([
        clientPaysPromise,
        ledgerTxsPromise,
        vendorPaysPromise,
      ]);

      let vendorPaysResult: any[] = resVendor.data || [];
      if (resVendor.error && resVendor.error.code === "42703") {
        const { data: fallback } = await supabase
          .from("vendor_payments")
          .select("amount, asset_id")
          .eq("business_id", activeBusinessId)
          .eq("user_id", user.id);
        vendorPaysResult = fallback || [];
      } else {
        vendorPaysResult = vendorPaysResult.filter((p: any) => (p.status || "posted") === "posted");
      }

      return {
        clientPays: resClient.data || [],
        vendorPays: vendorPaysResult,
        ledgerTxs: resLedger.data || [],
      };
    },
    enabled: !!activeBusinessId && !!user,
  });

  // Query asset detailed ledger transactions
  const { data: ledgerTxsList = [], isLoading: isLedgerLoading } = useQuery({
    queryKey: ["asset_ledger_details", user?.id, selectedAssetLedger?.id],
    queryFn: async () => {
      if (!selectedAssetLedger || !user) return [];
      const assetId = selectedAssetLedger.id;

      const clientPaysPromise = supabase
        .from("client_payments")
        .select("id, amount, payment_date, reference, method, clients(name)")
        .eq("asset_id", assetId)
        .eq("status", "posted")
        .eq("user_id", user.id);

      const ledgerTxsPromise = supabase
        .from("ledger_transactions" as any)
        .select("id, amount, transaction_date, type, description, category")
        .eq("asset_id", assetId)
        .eq("user_id", user.id);

      const vendorPaysPromise = supabase
        .from("vendor_payments")
        .select("id, amount, payment_date, reference, method, vendors(name), status")
        .eq("asset_id", assetId)
        .eq("user_id", user.id);

      const [resClient, resLedger, resVendor] = await Promise.all([
        clientPaysPromise,
        ledgerTxsPromise,
        vendorPaysPromise,
      ]);

      let vendorPaysResult: any[] = resVendor.data || [];
      if (resVendor.error && resVendor.error.code === "42703") {
        const { data: fallback } = await supabase
          .from("vendor_payments")
          .select("id, amount, payment_date, reference, method, vendors(name)")
          .eq("asset_id", assetId)
          .eq("user_id", user.id);
        vendorPaysResult = fallback || [];
      } else {
        vendorPaysResult = vendorPaysResult.filter((p: any) => (p.status || "posted") === "posted");
      }

      const clientPays = resClient.data || [];
      const ledgerTxs = resLedger.data || [];
      const vendorPays = vendorPaysResult;

      const list: any[] = [];

      if (clientPays) {
        clientPays.forEach((p: any) => {
          list.push({
            id: p.id,
            date: p.payment_date,
            type: "Client Payment Received",
            description: p.clients?.name ? `${p.clients.name}` : "Client Payment",
            reference: p.reference || p.method || "—",
            flowType: "debit", // Inflow
            amount: Number(p.amount),
          });
        });
      }

      if (vendorPays) {
        vendorPays.forEach((p: any) => {
          list.push({
            id: p.id,
            date: p.payment_date,
            type: "Vendor Bill Settled",
            description: p.vendors?.name ? `${p.vendors.name}` : "Vendor Payment",
            reference: p.reference || p.method || "—",
            flowType: "credit", // Outflow
            amount: Number(p.amount),
          });
        });
      }

      if (ledgerTxs) {
        ledgerTxs.forEach((tx: any) => {
          const isFundTransfer = tx.category === "Fund Transfer";
          list.push({
            id: tx.id,
            date: tx.transaction_date,
            type: isFundTransfer ? "Internal Funds Transfer" : tx.category || "General Ledger",
            description: tx.description || "—",
            reference: "—",
            flowType: tx.type, // 'debit' or 'credit'
            amount: Number(tx.amount),
          });
        });
      }

      if (
        selectedAssetLedger.type !== "property_equipment" &&
        Number(selectedAssetLedger.initial_balance) > 0
      ) {
        list.push({
          id: `initial_${selectedAssetLedger.id}`,
          date: selectedAssetLedger.created_at.slice(0, 10),
          type: "Opening Balance",
          description: "Initial account setup balance",
          reference: "—",
          flowType: "debit", // Opening balance is an inflow
          amount: Number(selectedAssetLedger.initial_balance),
        });
      }

      // Sort descending by date (latest first)
      return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
    enabled: !!selectedAssetLedger && !!user,
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
    if (
      isSuccess &&
      assets.length === 0 &&
      activeBusinessId &&
      user &&
      !isLoading &&
      !provisionMutation.isPending &&
      !isReadOnly
    ) {
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
        const { error } = await supabase.from("assets" as any).insert({
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
      initial_balance:
        form.type === "property_equipment" ? 0 : parseFloat(form.initial_balance) || 0,
      current_valuation:
        form.type === "property_equipment" ? parseFloat(form.current_valuation) || 0 : 0,
      notes: form.notes || null,
    };

    saveMutation.mutate(payload);
  };

  // Transfer Mutation
  const transferMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!user || !activeBusinessId) return;
      const { error } = await supabase.rpc("transfer_funds" as any, {
        p_from_asset_id: payload.from_asset_id,
        p_to_asset_id: payload.to_asset_id,
        p_amount: payload.amount,
        p_date: payload.transfer_date,
        p_remarks: payload.remarks,
        p_user_id: user.id,
        p_business_id: activeBusinessId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Funds transferred successfully");
      setTransferOpen(false);
      setTransferForm({
        from_asset_id: "",
        to_asset_id: "",
        amount: "",
        transfer_date: new Date().toISOString().slice(0, 10),
        remarks: "",
      });
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["asset_flows"] });
      qc.invalidateQueries({ queryKey: ["ledger_transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to transfer funds");
    },
  });

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.from_asset_id) {
      toast.error("Please select a source account");
      return;
    }
    if (!transferForm.to_asset_id) {
      toast.error("Please select a destination account");
      return;
    }
    const amt = parseFloat(transferForm.amount) || 0;
    if (amt <= 0) {
      toast.error("Please enter a valid transfer amount");
      return;
    }
    if (amt > fromAssetBalance) {
      toast.error("Insufficient balance in source account");
      return;
    }
    transferMutation.mutate({
      from_asset_id: transferForm.from_asset_id,
      to_asset_id: transferForm.to_asset_id,
      amount: amt,
      transfer_date: transferForm.transfer_date,
      remarks: transferForm.remarks,
    });
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

  const selectedFromAsset = computedAssets.find((a) => a.id === transferForm.from_asset_id);
  const fromAssetBalance = selectedFromAsset ? selectedFromAsset.balance : 0;
  const cashBankAssets = computedAssets.filter(
    (a) => a.type === "bank_account" || a.type === "petty_cash",
  );
  const destinationAssets = cashBankAssets.filter((a) => a.id !== transferForm.from_asset_id);

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
            Track bank accounts, petty cash funds, and property/equipment valuations to represent
            your business capital.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={isReadOnly}
            onClick={() => {
              const cashBank = computedAssets.filter(
                (a) => a.type === "bank_account" || a.type === "petty_cash",
              );
              setTransferForm({
                from_asset_id: cashBank[0]?.id || "",
                to_asset_id: cashBank[1]?.id || "",
                amount: "",
                transfer_date: new Date().toISOString().slice(0, 10),
                remarks: "",
              });
              setTransferOpen(true);
            }}
          >
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Transfer Funds
          </Button>
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
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Cash &amp; Bank Holdings
                </p>
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
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Property &amp; Equipment Val
                </p>
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
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Total Assets capital
                </p>
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
          <CardDescription>
            Capital accounts linked to client receivables and vendor payments
          </CardDescription>
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
                  <TableRow
                    key={asset.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedAssetLedger(asset)}
                    title={`View transaction ledger for ${asset.name}`}
                  >
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
                      {asset.type === "property_equipment"
                        ? "—"
                        : formatMoney(asset.initial_balance, c)}
                    </TableCell>
                    <TableCell className="text-right figure text-success">
                      {asset.type === "property_equipment"
                        ? "—"
                        : `+ ${formatMoney(asset.inflow, c)}`}
                    </TableCell>
                    <TableCell className="text-right figure text-destructive">
                      {asset.type === "property_equipment"
                        ? "—"
                        : `- ${formatMoney(asset.outflow, c)}`}
                    </TableCell>
                    <TableCell className="text-right figure font-bold text-foreground">
                      {formatMoney(asset.balance, c)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:bg-muted"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAssetLedger(asset);
                          }}
                          title="View Transaction Ledger"
                        >
                          <ReceiptText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:bg-muted"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(asset);
                          }}
                          disabled={isReadOnly}
                          title="Edit Account Details"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Are you sure you want to delete asset "${asset.name}"?`)) {
                              deleteMutation.mutate(asset.id);
                            }
                          }}
                          disabled={
                            isReadOnly ||
                            (assets.length <= 2 &&
                              (asset.type === "bank_account" || asset.type === "petty_cash"))
                          }
                          title="Delete Account"
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
        <DialogContent className="max-w-4xl lg:max-w-5xl w-[90vw]">
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
                    <SelectItem value="property_equipment">
                      Property / Equipment Valuation
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.type !== "property_equipment" ? (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="initial_balance" className="text-right">
                    Initial balance
                  </Label>
                  <FormattedInput
                    id="initial_balance"
                    mode="currency"
                    rawValue={form.initial_balance}
                    onRawChange={(raw) => setForm({ ...form, initial_balance: raw })}
                    className="col-span-3"
                    required
                  />
                </div>
              ) : (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="current_valuation" className="text-right">
                    Current valuation
                  </Label>
                  <FormattedInput
                    id="current_valuation"
                    mode="currency"
                    rawValue={form.current_valuation}
                    onRawChange={(raw) => setForm({ ...form, current_valuation: raw })}
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

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-4xl lg:max-w-5xl w-[90vw]">
          <form onSubmit={handleTransferSubmit}>
            <DialogHeader>
              <DialogTitle>Transfer Funds</DialogTitle>
              <DialogDescription>Move money between cash/bank holding accounts.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="from_asset_id" className="text-right text-sm font-medium">
                  From Account
                </Label>
                <Select
                  value={transferForm.from_asset_id}
                  onValueChange={(val) => {
                    const cb = computedAssets.filter(
                      (a) => a.type === "bank_account" || a.type === "petty_cash",
                    );
                    const nextTo =
                      transferForm.to_asset_id === val
                        ? cb.find((a) => a.id !== val)?.id || ""
                        : transferForm.to_asset_id;
                    setTransferForm({ ...transferForm, from_asset_id: val, to_asset_id: nextTo });
                  }}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {cashBankAssets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {transferForm.from_asset_id && (
                <div className="grid grid-cols-4 items-center gap-4 -mt-2">
                  <div className="col-start-2 col-span-3 text-xs text-muted-foreground flex justify-between">
                    <span>Available Balance:</span>
                    <span className="font-semibold text-warning">
                      {formatMoney(fromAssetBalance, c)}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="to_asset_id" className="text-right text-sm font-medium">
                  To Account
                </Label>
                <Select
                  value={transferForm.to_asset_id}
                  onValueChange={(val) => setTransferForm({ ...transferForm, to_asset_id: val })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinationAssets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="transfer_amount" className="text-right text-sm font-medium">
                  Amount
                </Label>
                <FormattedInput
                  id="transfer_amount"
                  mode="currency"
                  rawValue={transferForm.amount}
                  onRawChange={(raw) => setTransferForm({ ...transferForm, amount: raw })}
                  className="col-span-3"
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="transfer_date" className="text-right text-sm font-medium">
                  Date
                </Label>
                <Input
                  id="transfer_date"
                  type="date"
                  value={transferForm.transfer_date}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, transfer_date: e.target.value })
                  }
                  className="col-span-3"
                  required
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="transfer_remarks" className="text-right text-sm font-medium">
                  Remarks
                </Label>
                <Input
                  id="transfer_remarks"
                  value={transferForm.remarks}
                  onChange={(e) => setTransferForm({ ...transferForm, remarks: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g. Weekly petty cash replenishment"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isReadOnly || transferMutation.isPending}>
                {transferMutation.isPending ? "Transferring..." : "Confirm Transfer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detailed Transaction Ledger Side Drawer */}
      <Sheet
        open={!!selectedAssetLedger}
        onOpenChange={(open) => !open && setSelectedAssetLedger(null)}
      >
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-2 text-xl">
              <ReceiptText className="h-5 w-5 text-primary" />
              {selectedAssetLedger?.name} — Detailed Ledger
            </SheetTitle>
            <SheetDescription>
              Chronological flow of funds for this account. Current running balance:{" "}
              <span className="font-bold text-foreground">
                {selectedAssetLedger
                  ? formatMoney(
                      computedAssets.find((a) => a.id === selectedAssetLedger.id)?.balance || 0,
                      c,
                    )
                  : "—"}
              </span>
            </SheetDescription>
          </SheetHeader>

          <div className="py-4 space-y-4">
            <div className="overflow-auto rounded-md border max-h-[70vh]">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-28">Date</TableHead>
                    <TableHead className="w-44">Source / Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right w-36">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLedgerLoading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                        <div className="flex flex-col items-center gap-2 justify-center">
                          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                          <span>Loading transaction ledger...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLedgerLoading && ledgerTxsList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                        No transactions recorded for this account.
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLedgerLoading &&
                    ledgerTxsList.map((tx: any) => {
                      const isDebit = tx.flowType === "debit";
                      return (
                        <TableRow key={tx.id} className="hover:bg-muted/30">
                          <TableCell className="tabular text-xs whitespace-nowrap">
                            {tx.date}
                          </TableCell>
                          <TableCell className="font-medium text-xs whitespace-nowrap flex items-center gap-1.5 py-3">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                tx.type === "Opening Balance"
                                  ? "bg-blue-500"
                                  : tx.type === "Internal Funds Transfer"
                                    ? "bg-purple-500"
                                    : isDebit
                                      ? "bg-success"
                                      : "bg-destructive"
                              }`}
                            />
                            {tx.type}
                          </TableCell>
                          <TableCell
                            className="text-xs max-w-[180px] truncate"
                            title={tx.description}
                          >
                            {tx.description}
                            {tx.reference && tx.reference !== "—" && (
                              <span className="block text-[10px] text-muted-foreground truncate">
                                Ref: {tx.reference}
                              </span>
                            )}
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold text-xs tabular figure whitespace-nowrap ${
                              isDebit ? "text-success" : "text-destructive"
                            }`}
                          >
                            {isDebit ? "+" : "-"} {formatMoney(tx.amount, c)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>

            <div className="text-[11px] text-muted-foreground flex items-center gap-1 bg-muted/40 p-3 rounded-lg border">
              <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>
                Note: Inflows (Debits / +) represent money entering the account. Outflows (Credits /
                -) represent money leaving the account.
              </span>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
