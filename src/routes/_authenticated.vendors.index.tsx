import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/format";
import { Plus, Truck, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendors/")({
  component: VendorsPage,
  head: () => ({
    meta: [
      { title: "Vendors — Ace Ledger" },
      { name: "description", content: "Track raw material vendors, GRNs, opening balances, and outstanding payables." },
      { property: "og:title", content: "Vendors — Ace Ledger" },
      { property: "og:description", content: "Track raw material vendors, GRNs, opening balances, and outstanding payables." },
      { property: "og:url", content: "https://aceledger.top/vendors" },
    ],
    links: [{ rel: "canonical", href: "https://aceledger.top/vendors" }],
  }),
});

function VendorsPage() {
  const { settings, user, activeBusinessId, isReadOnly } = useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: "", contact_person: "", phone: "", email: "", address: "", opening_balance: "0", notes: "" });

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["vendors", user?.id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId || !user) return [];
      const { data: vs } = await supabase.from("vendors").select("*").eq("business_id", activeBusinessId).eq("user_id", user.id).order("created_at", { ascending: false });
      const { data: grns } = await supabase.from("vendor_grns").select("vendor_id, total_amount, status").eq("business_id", activeBusinessId).eq("user_id", user.id);
      const { data: pays } = await supabase.from("vendor_payments").select("vendor_id, amount").eq("business_id", activeBusinessId).eq("user_id", user.id);
      return (vs ?? []).map((v) => {
        const owed = Number(v.opening_balance)
          + (grns ?? []).filter((g) => g.vendor_id === v.id && (g.status || "posted") === "posted").reduce((s, x) => s + Number(x.total_amount), 0)
          - (pays ?? []).filter((p) => p.vendor_id === v.id).reduce((s, x) => s + Number(x.amount), 0);
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
    const { error } = await supabase.from("vendors").insert({
      user_id: user.id,
      business_id: activeBusinessId,
      name: form.name,
      contact_person: form.contact_person || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      opening_balance: parseFloat(form.opening_balance) || 0,
      notes: form.notes || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Vendor added");
      setOpen(false);
      setForm({ name: "", contact_person: "", phone: "", email: "", address: "", opening_balance: "0", notes: "" });
      qc.invalidateQueries({ queryKey: ["vendors"] });
    }
  };

  const deleteSelected = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0 || !user) return;
    const { error: e1 } = await supabase.from("vendor_payments").delete().in("vendor_id", ids).eq("user_id", user.id);
    const { error: e2 } = await supabase.from("vendor_grns").delete().in("vendor_id", ids).eq("user_id", user.id);
    const { error: e3 } = await supabase.from("vendors").delete().in("id", ids).eq("user_id", user.id);
    if (e1 || e2 || e3) { toast.error((e1 || e2 || e3)!.message); return; }
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
                <Button variant="destructive" disabled={isReadOnly}><Trash2 className="mr-2 h-4 w-4" />Delete ({selected.size})</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selected.size} vendor{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes the selected vendors along with all their GRNs and payment history. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button asChild className={isReadOnly ? "pointer-events-none opacity-50" : ""}><Link to="/vendors/grn/new"><Truck className="mr-2 h-4 w-4" />Log GRN</Link></Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="outline" disabled={isReadOnly}><Plus className="mr-2 h-4 w-4" />New Vendor</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Vendor</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <Field label="Name"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Contact person"><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></Field>
                  <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                </div>
                <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field label="Address"><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
                <Field label="Opening balance (we owe them)"><Input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} /></Field>
                <DialogFooter><Button type="submit" disabled={isReadOnly}>Save vendor</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Vendor balances</CardTitle><CardDescription>Total we owe each vendor (opening + GRNs − payments)</CardDescription></CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={!!vendors && vendors.length > 0 && selected.size === vendors.length}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead className="text-right">We owe</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && (vendors?.length ?? 0) === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No vendors yet</TableCell></TableRow>
                )}
                {vendors?.map((v) => (
                  <TableRow key={v.id} data-state={selected.has(v.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox checked={selected.has(v.id)} onCheckedChange={() => toggle(v.id)} aria-label={`Select ${v.name}`} />
                    </TableCell>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell className="text-muted-foreground">{v.phone ?? "—"}</TableCell>
                    <TableCell className="text-right figure font-medium text-destructive">{formatMoney(v.owed, settings.currency)}</TableCell>
                    <TableCell className="text-right"><Button asChild variant="ghost" size="sm"><Link to="/vendors/$id" params={{ id: v.id }}>Open</Link></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
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
