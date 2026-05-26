import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatDate } from "@/lib/format";
import { renderDocument } from "@/lib/document-templates";
import { ArrowLeft, Plus, Printer, Send, Trash2, History } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  component: InvoiceDetail,
});

type Item = { id?: string; description: string; quantity: string; unit_price: string };

function InvoiceDetail() {
  const { id } = Route.useParams();
  const { settings, user } = useApp();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);
  const [amendReason, setAmendReason] = useState("");
  const [pendingTotal, setPendingTotal] = useState<{ subtotal: number; tax: number; total: number; items: Item[]; meta: any } | null>(null);
  const [form, setForm] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);

  const { data } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const [{ data: inv }, { data: its }, { data: amends }, { data: pays }] = await Promise.all([
        supabase.from("invoices").select("*, clients(*)").eq("id", id).single(),
        supabase.from("invoice_items").select("*").eq("invoice_id", id).order("sort_order"),
        supabase.from("invoice_amendments").select("*").eq("invoice_id", id).order("created_at", { ascending: false }),
        supabase.from("client_payments").select("*").eq("invoice_id", id),
      ]);
      return { inv, items: its ?? [], amendments: amends ?? [], payments: pays ?? [] };
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (data?.inv && !form) {
      setForm({
        invoice_number: data.inv.invoice_number, issue_date: data.inv.issue_date,
        due_date: data.inv.due_date ?? "", tax: String(data.inv.tax), notes: data.inv.notes ?? "",
        doc_template: data.inv.doc_template,
      });
      setItems(data.items.map((it) => ({ id: it.id, description: it.description, quantity: String(it.quantity), unit_price: String(it.unit_price) })));
    }
  }, [data, form]);

  const subtotal = useMemo(() => items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0), [items]);
  const taxNum = parseFloat(form?.tax ?? "0") || 0;
  const total = subtotal + taxNum;

  if (!data?.inv || !form) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const inv = data.inv;
  const isPosted = inv.status === "posted";

  const updateLine = (idx: number, patch: Partial<Item>) => setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));

  const saveDraftEdit = async () => {
    await supabase.from("invoices").update({
      invoice_number: form.invoice_number, issue_date: form.issue_date, due_date: form.due_date || null,
      tax: taxNum, subtotal, total, notes: form.notes || null, doc_template: form.doc_template,
    }).eq("id", id);
    await supabase.from("invoice_items").delete().eq("invoice_id", id);
    await supabase.from("invoice_items").insert(items.filter((it) => it.description).map((it, idx) => ({
      invoice_id: id, description: it.description,
      quantity: parseFloat(it.quantity) || 0, unit_price: parseFloat(it.unit_price) || 0,
      line_total: (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), sort_order: idx,
    })));
    toast.success("Draft saved");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["invoice", id] });
  };

  const requestPostedEdit = () => {
    setPendingTotal({ subtotal, tax: taxNum, total, items, meta: form });
    setAmendOpen(true);
  };

  const applyAmendment = async () => {
    if (amendReason.trim().length < 5) { toast.error("Reason must be at least 5 characters"); return; }
    if (!pendingTotal || !user) return;
    await supabase.from("invoice_amendments").insert({
      invoice_id: id, user_id: user.id, reason: amendReason.trim(),
      previous_total: inv.total, new_total: pendingTotal.total,
    });
    await supabase.from("invoices").update({
      invoice_number: pendingTotal.meta.invoice_number,
      issue_date: pendingTotal.meta.issue_date, due_date: pendingTotal.meta.due_date || null,
      subtotal: pendingTotal.subtotal, tax: pendingTotal.tax, total: pendingTotal.total,
      notes: pendingTotal.meta.notes || null, doc_template: pendingTotal.meta.doc_template,
      current_version: inv.current_version + 1,
    }).eq("id", id);
    await supabase.from("invoice_items").delete().eq("invoice_id", id);
    await supabase.from("invoice_items").insert(pendingTotal.items.filter((it) => it.description).map((it, idx) => ({
      invoice_id: id, description: it.description,
      quantity: parseFloat(it.quantity) || 0, unit_price: parseFloat(it.unit_price) || 0,
      line_total: (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), sort_order: idx,
    })));
    toast.success("Amendment logged · client balance updated");
    setAmendOpen(false); setAmendReason(""); setPendingTotal(null); setEditing(false);
    qc.invalidateQueries({ queryKey: ["invoice", id] });
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const postInvoice = async () => {
    await supabase.from("invoices").update({ status: "posted", posted_at: new Date().toISOString() }).eq("id", id);
    toast.success("Invoice posted — added to client balance");
    qc.invalidateQueries({ queryKey: ["invoice", id] });
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const print = () => {
    renderDocument({
      template: form.doc_template, title: "Invoice", number: form.invoice_number,
      date: form.issue_date, due_date: form.due_date,
      currency: settings.currency,
      business: { name: settings.business_name, address: settings.business_address, phone: settings.business_phone },
      counterparty: { label: "Bill To", name: inv.clients?.name, address: inv.clients?.address, phone: inv.clients?.phone },
      items: items.map((it) => ({ description: it.description, quantity: it.quantity, unit_price: it.unit_price, line_total: (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0) })),
      subtotal, tax: taxNum, total, notes: form.notes, status: inv.status,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2"><Link to="/invoices"><ArrowLeft className="mr-1 h-4 w-4" />Invoices</Link></Button>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{inv.invoice_number}</h1>
              <Badge variant={isPosted ? "default" : "secondary"} className="capitalize">{inv.status}</Badge>
              {inv.current_version > 1 && <Badge variant="outline">v{inv.current_version}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{inv.clients?.name} · {formatDate(inv.issue_date)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={print}><Printer className="mr-1 h-4 w-4" />Print / PDF</Button>
            {!isPosted && !editing && <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>}
            {!isPosted && <Button onClick={postInvoice}><Send className="mr-1 h-4 w-4" />Post Invoice</Button>}
            {isPosted && !editing && <Button variant="secondary" onClick={() => setEditing(true)}>Edit (requires reason)</Button>}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Details</CardTitle>
          {editing && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setForm(null); }}>Cancel</Button>
              <Button size="sm" onClick={isPosted ? requestPostedEdit : saveDraftEdit}>Save changes</Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Invoice #"><Input disabled={!editing} value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} /></Field>
            <Field label="Issue date"><Input type="date" disabled={!editing} value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></Field>
            <Field label="Due date"><Input type="date" disabled={!editing} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
            <Field label="Template">
              <Select value={form.doc_template} onValueChange={(v) => setForm({ ...form, doc_template: v })} disabled={!editing}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">Classic Professional</SelectItem>
                  <SelectItem value="modern">Modern Minimalist</SelectItem>
                  <SelectItem value="compact">Compact / High-Density</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Line items</Label>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="w-24 text-right">Qty</TableHead><TableHead className="w-32 text-right">Unit</TableHead><TableHead className="w-32 text-right">Amount</TableHead>{editing && <TableHead className="w-10"></TableHead>}</TableRow></TableHeader>
                <TableBody>
                  {items.map((it, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{editing ? <Input value={it.description} onChange={(e) => updateLine(idx, { description: e.target.value })} /> : it.description}</TableCell>
                      <TableCell className="text-right">{editing ? <Input type="number" step="0.001" value={it.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} className="text-right" /> : <span className="figure">{it.quantity}</span>}</TableCell>
                      <TableCell className="text-right">{editing ? <Input type="number" step="0.01" value={it.unit_price} onChange={(e) => updateLine(idx, { unit_price: e.target.value })} className="text-right" /> : <span className="figure">{formatMoney(it.unit_price, settings.currency)}</span>}</TableCell>
                      <TableCell className="text-right figure">{formatMoney((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), settings.currency)}</TableCell>
                      {editing && <TableCell><Button variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button></TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {editing && <Button variant="outline" size="sm" onClick={() => setItems([...items, { description: "", quantity: "1", unit_price: "0" }])}><Plus className="mr-1 h-4 w-4" />Add line</Button>}
          </div>

          <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="figure">{formatMoney(subtotal, settings.currency)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Tax</span>{editing ? <Input type="number" step="0.01" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} className="h-8 w-28 text-right" /> : <span className="figure">{formatMoney(taxNum, settings.currency)}</span>}</div>
            <div className="flex justify-between border-t pt-2 text-lg font-semibold"><span>Total</span><span className="figure">{formatMoney(total, settings.currency)}</span></div>
          </div>

          <Field label="Notes"><Textarea disabled={!editing} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </CardContent>
      </Card>

      {data.amendments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4" />Amendment History</CardTitle><CardDescription>Audit trail of edits made after posting</CardDescription></CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Was</TableHead><TableHead className="text-right">Became</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.amendments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="tabular">{formatDate(a.created_at)}</TableCell>
                      <TableCell>{a.reason}</TableCell>
                      <TableCell className="text-right figure">{formatMoney(a.previous_total, settings.currency)}</TableCell>
                      <TableCell className="text-right figure font-medium">{formatMoney(a.new_total, settings.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={amendOpen} onOpenChange={setAmendOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reason for Amendment</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This invoice is posted. Provide a reason that will be logged to the audit trail and the client's balance will be recalculated.</p>
          <Textarea autoFocus value={amendReason} onChange={(e) => setAmendReason(e.target.value)} placeholder="e.g. Corrected quantity per delivery note 24-09-12" rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAmendOpen(false)}>Cancel</Button>
            <Button onClick={applyAmendment}>Confirm amendment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}
