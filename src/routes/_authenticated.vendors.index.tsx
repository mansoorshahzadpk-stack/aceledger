import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/format";
import { Plus, Truck, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { generateCodePrefix } from "@/lib/code-prefix";

export const Route = createFileRoute("/_authenticated/vendors/")({
  component: VendorsPage,
  head: () => ({
    meta: [
      { title: "Vendors — Ace Ledger" },
      {
        name: "description",
        content: "Track raw material vendors, GRNs, opening balances, and outstanding payables.",
      },
      { property: "og:title", content: "Vendors — Ace Ledger" },
      {
        property: "og:description",
        content: "Track raw material vendors, GRNs, opening balances, and outstanding payables.",
      },
      { property: "og:url", content: "https://aceledger.top/vendors" },
    ],
    links: [{ rel: "canonical", href: "https://aceledger.top/vendors" }],
  }),
});

function VendorsPage() {
  const { settings, user, activeBusinessId, isReadOnly } = useApp();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editVendor, setEditVendor] = useState<any | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    name: "",
    code_prefix: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    opening_balance: "0",
    notes: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    code_prefix: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    opening_balance: "0",
    notes: "",
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

  const handleEdit = (vendor: any) => {
    setEditVendor(vendor);
    setEditForm({
      name: vendor.name,
      code_prefix: vendor.code_prefix ?? "",
      contact_person: vendor.contact_person ?? "",
      phone: vendor.phone ?? "",
      email: vendor.email ?? "",
      address: vendor.address ?? "",
      opening_balance: String(vendor.opening_balance ?? 0),
      notes: vendor.notes ?? "",
    });
    setEditOpen(true);
  };

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["vendors", user?.id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId || !user) return [];
      const { data: vs } = await supabase
        .from("vendors")
        .select("*")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const { data: grns } = await supabase
        .from("vendor_grns")
        .select("vendor_id, total_amount, status")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user.id);

      const vpayResult = await supabase
        .from("vendor_payments")
        .select("vendor_id, amount, status")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user.id);
      let pays: any[] = vpayResult.data || [];
      if (vpayResult.error && vpayResult.error.code === "42703") {
        const { data: fallback } = await supabase
          .from("vendor_payments")
          .select("vendor_id, amount")
          .eq("business_id", activeBusinessId)
          .eq("user_id", user.id);
        pays = fallback || [];
      }

      return (vs ?? []).map((v) => {
        const owed =
          Number(v.opening_balance) +
          (grns ?? [])
            .filter((g) => g.vendor_id === v.id && (g.status || "posted") === "posted")
            .reduce((s, x) => s + Number(x.total_amount), 0) -
          (pays ?? [])
            .filter((p: any) => p.vendor_id === v.id && (p.status || "posted") === "posted")
            .reduce((s, x) => s + Number(x.amount), 0);
        return { ...v, owed };
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
    if (!vendors) return;
    if (selected.size === vendors.length) setSelected(new Set());
    else setSelected(new Set(vendors.map((v) => v.id)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeBusinessId) return;
    const prefix = form.code_prefix.trim().toUpperCase();
    if (prefix.length !== 3) {
      toast.error("Prefix must be exactly 3 characters");
      return;
    }

    // Check if the database has code_prefix column
    const { error: checkColError } = await supabase.from("vendors").select("code_prefix").limit(1);
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
      notes: form.notes || null,
    };

    if (hasPrefixCol) {
      payload.code_prefix = prefix;
    }

    const { error } = await supabase.from("vendors").insert(payload);
    if (error) toast.error(error.message);
    else {
      toast.success("Vendor added");
      setOpen(false);
      setForm({
        name: "",
        code_prefix: "",
        contact_person: "",
        phone: "",
        email: "",
        address: "",
        opening_balance: "0",
        notes: "",
      });
      setIsPrefixTouched(false);
      qc.invalidateQueries({ queryKey: ["vendors"] });
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeBusinessId || !editVendor) return;
    const { error } = await supabase
      .from("vendors")
      .update({
        name: editForm.name,
        contact_person: editForm.contact_person || null,
        phone: editForm.phone || null,
        email: editForm.email || null,
        address: editForm.address || null,
        opening_balance: parseFloat(editForm.opening_balance) || 0,
        notes: editForm.notes || null,
      })
      .eq("id", editVendor.id)
      .eq("user_id", user.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Vendor details amended");
      setEditOpen(false);
      setEditVendor(null);
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
  };

  const deleteSelected = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0 || !user) return;
    const { error: e1 } = await supabase
      .from("vendor_payments")
      .delete()
      .in("vendor_id", ids)
      .eq("user_id", user.id);
    const { error: e2 } = await supabase
      .from("vendor_grns")
      .delete()
      .in("vendor_id", ids)
      .eq("user_id", user.id);
    const { error: e3 } = await supabase
      .from("vendors")
      .delete()
      .in("id", ids)
      .eq("user_id", user.id);
    if (e1 || e2 || e3) {
      toast.error((e1 || e2 || e3)!.message);
      return;
    }
    toast.success(`Deleted ${ids.length} vendor${ids.length === 1 ? "" : "s"}`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["vendors"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
          <p className="text-sm text-muted-foreground">Raw material suppliers and amounts owed</p>
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
                    Delete {selected.size} vendor{selected.size === 1 ? "" : "s"}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes the selected vendors along with all their GRNs and
                    payment history. This cannot be undone.
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
          <Button asChild className={isReadOnly ? "pointer-events-none opacity-50" : ""}>
            <Link to="/vendors/grn/new">
              <Truck className="mr-2 h-4 w-4" />
              Log GRN
            </Link>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={isReadOnly}>
                <Plus className="mr-2 h-4 w-4" />
                New Vendor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Vendor</DialogTitle>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-3">
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
                <Field label="Opening balance (we owe them)">
                  <FormattedInput
                    mode="currency"
                    rawValue={form.opening_balance}
                    onRawChange={(raw) => setForm({ ...form, opening_balance: raw })}
                    placeholder="0.00"
                  />
                </Field>
                <DialogFooter>
                  <Button type="submit" disabled={isReadOnly}>
                    Save vendor
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vendor balances</CardTitle>
          <CardDescription>Total we owe each vendor (opening + GRNs − payments)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={!!vendors && vendors.length > 0 && selected.size === vendors.length}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">We owe</TableHead>
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
                {!isLoading && (vendors?.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No vendors yet
                    </TableCell>
                  </TableRow>
                )}
                {vendors?.map((v) => (
                  <TableRow
                    key={v.id}
                    data-state={selected.has(v.id) ? "selected" : undefined}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate({ to: "/vendors/$id", params: { id: v.id } })}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(v.id)}
                        onCheckedChange={() => toggle(v.id)}
                        aria-label={`Select ${v.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell className="text-muted-foreground">{v.phone ?? "—"}</TableCell>
                    <TableCell className="text-right figure font-medium text-destructive">
                      {formatMoney(v.owed, settings.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:bg-muted"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(v);
                          }}
                          disabled={isReadOnly}
                          title="Edit / Amend Vendor"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link to="/vendors/$id" params={{ id: v.id }}>
                            Open
                          </Link>
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

      {/* Amend Vendor Details Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Amend Vendor Details</DialogTitle>
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
            <Field label="Opening balance (we owe them)">
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
