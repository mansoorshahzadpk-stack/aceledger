import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { Plus, Banknote, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { generateCodePrefix } from "@/lib/code-prefix";

export const Route = createFileRoute("/_authenticated/clients/")({
  component: ClientsPage,
  head: () => ({
    meta: [
      { title: "Industry Clients — Ace Ledger" },
      {
        name: "description",
        content:
          "Manage industry clients, opening balances, invoices, and weekly installment collections.",
      },
      { property: "og:title", content: "Industry Clients — Ace Ledger" },
      {
        property: "og:description",
        content:
          "Manage industry clients, opening balances, invoices, and weekly installment collections.",
      },
      { property: "og:url", content: "https://aceledger.top/clients" },
    ],
    links: [{ rel: "canonical", href: "https://aceledger.top/clients" }],
  }),
});

function ClientsPage() {
  const { settings, user, activeBusinessId, isReadOnly } = useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editClient, setEditClient] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    code_prefix: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    opening_balance: "0",
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    name: "",
    code_prefix: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    opening_balance: "0",
  });
  const [isPrefixTouched, setIsPrefixTouched] = useState(false);

  const handleNameChange = (val: string) => {
    setForm((prev) => {
      const updated = { ...prev, name: val };
      if (!isPrefixTouched) {
        updated.code_prefix = generateCodePrefix(val);
      }
      return updated;
    });
  };

  const handleEdit = (client: any) => {
    setEditClient(client);
    setEditForm({
      name: client.name,
      code_prefix: client.code_prefix ?? "",
      contact_person: client.contact_person ?? "",
      phone: client.phone ?? "",
      email: client.email ?? "",
      address: client.address ?? "",
      opening_balance: String(client.opening_balance ?? 0),
    });
    setEditOpen(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeBusinessId || !editClient) return;
    const { error } = await supabase
      .from("clients")
      .update({
        name: editForm.name,
        contact_person: editForm.contact_person || null,
        phone: editForm.phone || null,
        email: editForm.email || null,
        address: editForm.address || null,
        opening_balance: parseFloat(editForm.opening_balance) || 0,
      })
      .eq("id", editClient.id)
      .eq("user_id", user.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Client details amended");
      setEditOpen(false);
      setEditClient(null);
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
  };
  const [payOpen, setPayOpen] = useState<string | null>(null);
  const [pay, setPay] = useState({
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    method: "cash",
    reference: "",
    asset_id: "",
  });

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

  useEffect(() => {
    if (bankCashAssets.length > 0 && !pay.asset_id) {
      setPay((prev) => ({ ...prev, asset_id: bankCashAssets[0].id }));
    }
  }, [bankCashAssets, pay.asset_id]);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", user?.id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId || !user) return [];
      const [{ data: cs }, { data: invs }, { data: pays }] = await Promise.all([
        supabase
          .from("clients")
          .select("*")
          .eq("business_id", activeBusinessId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("invoices")
          .select("client_id, total, status")
          .eq("business_id", activeBusinessId)
          .eq("user_id", user.id),
        supabase
          .from("client_payments")
          .select("client_id, amount")
          .eq("status", "posted")
          .eq("business_id", activeBusinessId)
          .eq("user_id", user.id),
      ]);
      return (cs ?? []).map((c) => {
        const posted = (invs ?? [])
          .filter((i) => i.client_id === c.id && i.status === "posted")
          .reduce((s, x) => s + Number(x.total), 0);
        const paid = (pays ?? [])
          .filter((p) => p.client_id === c.id)
          .reduce((s, x) => s + Number(x.amount), 0);
        const outstanding = Number(c.opening_balance) + posted - paid;
        const hasPosted = posted > 0 || Number(c.opening_balance) > 0;
        return { ...c, outstanding, hasPosted };
      });
    },
    enabled: !!user,
  });

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (!clients) return;
    if (selected.size === clients.length) setSelected(new Set());
    else setSelected(new Set(clients.map((c) => c.id)));
  };

  const addClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeBusinessId) return;
    const prefix = form.code_prefix.trim().toUpperCase();
    if (prefix.length !== 3) {
      toast.error("Prefix must be exactly 3 characters");
      return;
    }

    // Check if the database has code_prefix column
    const { error: checkColError } = await supabase.from("clients").select("code_prefix").limit(1);
    const hasPrefixCol = !checkColError || checkColError.code !== "42703";

    const payload: any = {
      user_id: user.id,
      business_id: activeBusinessId,
      name: form.name,
      contact_person: form.contact_person || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      opening_balance: parseFloat(form.opening_balance) || 0,
    };

    if (hasPrefixCol) {
      payload.code_prefix = prefix;
    }

    const { error } = await supabase.from("clients").insert(payload);
    if (error) toast.error(error.message);
    else {
      toast.success("Client added");
      setOpen(false);
      setForm({
        name: "",
        code_prefix: "",
        contact_person: "",
        phone: "",
        email: "",
        address: "",
        opening_balance: "0",
      });
      setIsPrefixTouched(false);
      qc.invalidateQueries({ queryKey: ["clients"] });
    }
  };

  const logInstallment = async (status: "draft" | "posted") => {
    if (!pay.amount) {
      toast.error("Please enter an amount");
      return;
    }
    if (!user || !payOpen || !activeBusinessId) return;
    const { error } = await supabase.from("client_payments").insert({
      user_id: user.id,
      business_id: activeBusinessId,
      client_id: payOpen,
      amount: parseFloat(pay.amount) || 0,
      payment_date: pay.payment_date,
      method: pay.method as any,
      reference: pay.reference || null,
      asset_id: pay.asset_id === "" ? null : pay.asset_id,
      status,
      posted_at: status === "posted" ? new Date().toISOString() : null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(
        status === "draft" ? "Payment logged as Draft" : "Payment posted — balance updated",
      );
      setPayOpen(null);
      setPay({
        amount: "",
        payment_date: new Date().toISOString().slice(0, 10),
        method: "cash",
        reference: "",
        asset_id: bankCashAssets[0]?.id || "",
      });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
  };

  const deleteSelected = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0 || !user) return;
    // payments → amendments → items → invoices → clients
    const { data: invs } = await supabase
      .from("invoices")
      .select("id")
      .in("client_id", ids)
      .eq("user_id", user.id);
    const invIds = (invs ?? []).map((i) => i.id);
    await supabase.from("client_payments").delete().in("client_id", ids).eq("user_id", user.id);
    if (invIds.length) {
      await supabase
        .from("invoice_amendments")
        .delete()
        .in("invoice_id", invIds)
        .eq("user_id", user.id);
      await supabase.from("invoice_items").delete().in("invoice_id", invIds);
      await supabase.from("invoices").delete().in("id", invIds).eq("user_id", user.id);
    }
    const { error } = await supabase.from("clients").delete().in("id", ids).eq("user_id", user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Deleted ${ids.length} client${ids.length === 1 ? "" : "s"}`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Industry Clients</h1>
          <p className="text-sm text-muted-foreground">
            Outstanding balances and payments received
          </p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isReadOnly}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete ({selected.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete {selected.size} client{selected.size === 1 ? "" : "s"}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes the selected clients along with all their invoices,
                    line items, amendments and payment history. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={deleteSelected}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={isReadOnly}>
                <Plus className="mr-2 h-4 w-4" />
                New Client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Client</DialogTitle>
              </DialogHeader>
              <form onSubmit={addClient} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Field label="Name">
                      <Input
                        required
                        value={form.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                      />
                    </Field>
                  </div>
                  <div>
                    <Field label="Prefix Code">
                      <Input
                        required
                        maxLength={3}
                        value={form.code_prefix}
                        onChange={(e) => {
                          setIsPrefixTouched(true);
                          setForm({
                            ...form,
                            code_prefix: e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(),
                          });
                        }}
                        placeholder="YAS"
                      />
                    </Field>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Contact person">
                    <Input
                      value={form.contact_person}
                      onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                    />
                  </Field>
                  <Field label="Phone">
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Email">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </Field>
                <Field label="Address">
                  <Textarea
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </Field>
                <Field label="Opening balance (owes us)">
                  <FormattedInput
                    mode="currency"
                    rawValue={form.opening_balance}
                    onRawChange={(raw) => setForm({ ...form, opening_balance: raw })}
                    placeholder="0.00"
                  />
                </Field>
                <DialogFooter>
                  <Button type="submit" disabled={isReadOnly}>
                    Save client
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Outstanding balances</CardTitle>
          <CardDescription>Tap "Log Payment Received" to record a payment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={!!clients && clients.length > 0 && selected.size === clients.length}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && (clients?.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No clients yet
                    </TableCell>
                  </TableRow>
                )}
                {clients?.map((c) => (
                  <TableRow
                    key={c.id}
                    data-state={selected.has(c.id) ? "selected" : undefined}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleEdit(c)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(c.id)}
                        onCheckedChange={() => toggle(c.id)}
                        aria-label={`Select ${c.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        to="/clients/$id"
                        params={{ id: c.id }}
                        className="hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                    <TableCell className="text-right figure font-medium text-warning">
                      {formatMoney(c.outstanding, settings.currency)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:bg-muted"
                          onClick={() => handleEdit(c)}
                          disabled={isReadOnly}
                          title="Edit / Amend Client"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          disabled={isReadOnly || !c.hasPosted}
                          onClick={() => setPayOpen(c.id)}
                          title={!c.hasPosted ? "No posted invoices" : ""}
                        >
                          <Banknote className="mr-1 h-4 w-4" />
                          Log Payment Received
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

      {/* Amend Client Details Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Amend Client Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label="Name">
                  <Input
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </Field>
              </div>
              <div>
                <Field label="Prefix Code">
                  <Input
                    disabled
                    value={editForm.code_prefix}
                    className="bg-muted text-muted-foreground cursor-not-allowed"
                  />
                </Field>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact person">
                <Input
                  value={editForm.contact_person}
                  onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })}
                />
              </Field>
              <Field label="Phone">
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Email">
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </Field>
            <Field label="Address">
              <Textarea
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              />
            </Field>
            <Field label="Opening balance (owes us)">
              <FormattedInput
                mode="currency"
                rawValue={editForm.opening_balance}
                onRawChange={(raw) => setEditForm({ ...editForm, opening_balance: raw })}
                placeholder="0.00"
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isReadOnly}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payOpen} onOpenChange={(v) => !v && setPayOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Payment Received</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
            <Field label="Amount">
              <FormattedInput
                mode="currency"
                required
                rawValue={pay.amount}
                onRawChange={(raw) => setPay({ ...pay, amount: raw })}
                autoFocus
                placeholder="0.00"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <Input
                  type="date"
                  required
                  value={pay.payment_date}
                  onChange={(e) => setPay({ ...pay, payment_date: e.target.value })}
                />
              </Field>
              <Field label="Method">
                <Select value={pay.method} onValueChange={(v) => setPay({ ...pay, method: v })}>
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
              <Select value={pay.asset_id} onValueChange={(v) => setPay({ ...pay, asset_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {bankCashAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reference (optional)">
              <Input
                value={pay.reference}
                onChange={(e) => setPay({ ...pay, reference: e.target.value })}
              />
            </Field>
            <DialogFooter className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => logInstallment("draft")}
                disabled={isReadOnly}
              >
                Save as Draft
              </Button>
              <Button type="button" onClick={() => logInstallment("posted")} disabled={isReadOnly}>
                Post Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
