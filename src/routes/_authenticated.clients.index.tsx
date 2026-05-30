import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { Plus, Banknote, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients/")({
  component: ClientsPage,
  head: () => ({
    meta: [
      { title: "Industry Clients — Ace Ledger" },
      { name: "description", content: "Manage industry clients, opening balances, invoices, and weekly installment collections." },
      { property: "og:title", content: "Industry Clients — Ace Ledger" },
      { property: "og:description", content: "Manage industry clients, opening balances, invoices, and weekly installment collections." },
      { property: "og:url", content: "https://aceledger.top/clients" },
    ],
    links: [{ rel: "canonical", href: "https://aceledger.top/clients" }],
  }),
});

function ClientsPage() {
  const { settings, user } = useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: "", contact_person: "", phone: "", email: "", address: "", opening_balance: "0" });
  const [payOpen, setPayOpen] = useState<string | null>(null);
  const [pay, setPay] = useState({ amount: "", payment_date: new Date().toISOString().slice(0, 10), method: "cash", reference: "" });

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", user?.id],
    queryFn: async () => {
      const [{ data: cs }, { data: invs }, { data: pays }] = await Promise.all([
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
        supabase.from("invoices").select("client_id, total, status"),
        supabase.from("client_payments").select("client_id, amount"),
      ]);
      return (cs ?? []).map((c) => {
        const posted = (invs ?? []).filter((i) => i.client_id === c.id && i.status === "posted").reduce((s, x) => s + Number(x.total), 0);
        const paid = (pays ?? []).filter((p) => p.client_id === c.id).reduce((s, x) => s + Number(x.amount), 0);
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
    if (!user) return;
    const { error } = await supabase.from("clients").insert({
      user_id: user.id,
      name: form.name,
      contact_person: form.contact_person || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      opening_balance: parseFloat(form.opening_balance) || 0,
    });
    if (error) toast.error(error.message);
    else { toast.success("Client added"); setOpen(false); setForm({ name: "", contact_person: "", phone: "", email: "", address: "", opening_balance: "0" }); qc.invalidateQueries({ queryKey: ["clients"] }); }
  };

  const logInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !payOpen) return;
    const { error } = await supabase.from("client_payments").insert({
      user_id: user.id, client_id: payOpen,
      amount: parseFloat(pay.amount) || 0,
      payment_date: pay.payment_date,
      method: pay.method as any,
      reference: pay.reference || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Payment Received recorded — balance updated");
      setPayOpen(null);
      setPay({ amount: "", payment_date: new Date().toISOString().slice(0, 10), method: "cash", reference: "" });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
  };

  const deleteSelected = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    // payments → amendments → items → invoices → clients
    const { data: invs } = await supabase.from("invoices").select("id").in("client_id", ids);
    const invIds = (invs ?? []).map((i) => i.id);
    await supabase.from("client_payments").delete().in("client_id", ids);
    if (invIds.length) {
      await supabase.from("invoice_amendments").delete().in("invoice_id", invIds);
      await supabase.from("invoice_items").delete().in("invoice_id", invIds);
      await supabase.from("invoices").delete().in("id", invIds);
    }
    const { error } = await supabase.from("clients").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
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
          <p className="text-sm text-muted-foreground">Outstanding balances and payments received</p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" />Delete ({selected.size})</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selected.size} client{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes the selected clients along with all their invoices, line items, amendments and payment history. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Client</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Client</DialogTitle></DialogHeader>
              <form onSubmit={addClient} className="space-y-3">
                <Field label="Name"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Contact person"><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></Field>
                  <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                </div>
                <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field label="Address"><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
                <Field label="Opening balance (owes us)"><Input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} /></Field>
                <DialogFooter><Button type="submit">Save client</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Outstanding balances</CardTitle><CardDescription>Tap "Log Payment Received" to record a payment</CardDescription></CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={!!clients && clients.length > 0 && selected.size === clients.length}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Client</TableHead><TableHead>Phone</TableHead>
                <TableHead className="text-right">Outstanding</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && (clients?.length ?? 0) === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No clients yet</TableCell></TableRow>}
                {clients?.map((c) => (
                  <TableRow key={c.id} data-state={selected.has(c.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} aria-label={`Select ${c.name}`} />
                    </TableCell>
                    <TableCell className="font-medium"><Link to="/clients/$id" params={{ id: c.id }} className="hover:underline">{c.name}</Link></TableCell>
                    <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                    <TableCell className="text-right figure font-medium text-warning">{formatMoney(c.outstanding, settings.currency)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="default" disabled={!c.hasPosted} onClick={() => setPayOpen(c.id)} title={!c.hasPosted ? "No posted invoices" : ""}>
                        <Banknote className="mr-1 h-4 w-4" />Log Payment Received
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!payOpen} onOpenChange={(v) => !v && setPayOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log Payment Received</DialogTitle></DialogHeader>
          <form onSubmit={logInstallment} className="space-y-3">
            <Field label="Amount"><Input type="number" step="0.01" required value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} autoFocus /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date"><Input type="date" required value={pay.payment_date} onChange={(e) => setPay({ ...pay, payment_date: e.target.value })} /></Field>
              <Field label="Method">
                <Select value={pay.method} onValueChange={(v) => setPay({ ...pay, method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="mobile">Mobile / wallet</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Reference (optional)"><Input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></Field>
            <DialogFooter><Button type="submit">Subtract from balance</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}
