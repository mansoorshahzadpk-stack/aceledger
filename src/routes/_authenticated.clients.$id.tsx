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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatDate } from "@/lib/format";
import { ArrowLeft, Plus, Banknote, Pencil, Trash2, History } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  component: ClientDetail,
});

interface PayForm { amount: string; payment_date: string; method: string; reference: string; invoice_id: string }

function ClientDetail() {
  const { id } = Route.useParams();
  const { settings, user } = useApp();
  const qc = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState<PayForm>({ amount: "", payment_date: new Date().toISOString().slice(0, 10), method: "cash", reference: "", invoice_id: "" });

  const [editPay, setEditPay] = useState<any | null>(null);
  const [editReason, setEditReason] = useState("");
  const [editAmount, setEditAmount] = useState("");

  const [delPay, setDelPay] = useState<any | null>(null);
  const [delReason, setDelReason] = useState("");

  const { data } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const [{ data: c }, { data: invs }, { data: pays }, { data: amends }] = await Promise.all([
        supabase.from("clients").select("*").eq("id", id).single(),
        supabase.from("invoices").select("*").eq("client_id", id).order("issue_date", { ascending: false }),
        supabase.from("client_payments").select("*").eq("client_id", id).order("payment_date", { ascending: false }),
        supabase.from("payment_amendments").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      ]);
      const posted = (invs ?? []).filter((i) => i.status === "posted").reduce((s, x) => s + Number(x.total), 0);
      const paid = (pays ?? []).reduce((s, x) => s + Number(x.amount), 0);
      const outstanding = Number(c?.opening_balance ?? 0) + posted - paid;
      return { c, invs: invs ?? [], pays: pays ?? [], amends: amends ?? [], outstanding, posted };
    },
    enabled: !!user,
  });

  const logInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("client_payments").insert({
      user_id: user.id, client_id: id,
      invoice_id: pay.invoice_id || null,
      amount: parseFloat(pay.amount) || 0,
      payment_date: pay.payment_date,
      method: pay.method as any,
      reference: pay.reference || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Payment Received recorded");
      setPayOpen(false);
      setPay({ amount: "", payment_date: new Date().toISOString().slice(0, 10), method: "cash", reference: "", invoice_id: "" });
      qc.invalidateQueries({ queryKey: ["client", id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
  };

  const openEditPay = (p: any) => {
    setEditPay(p);
    setEditAmount(String(p.amount));
    setEditReason("");
  };

  const applyEditPay = async () => {
    if (!editPay || !user) return;
    if (editReason.trim().length < 5) { toast.error("Reason must be at least 5 characters"); return; }
    const newAmt = parseFloat(editAmount) || 0;
    await supabase.from("payment_amendments").insert({
      user_id: user.id, payment_id: editPay.id, client_id: id,
      action: "edit", previous_amount: editPay.amount, new_amount: newAmt,
      reason: editReason.trim(),
    });
    await supabase.from("client_payments").update({ amount: newAmt }).eq("id", editPay.id);
    toast.success("Payment Received amended");
    setEditPay(null);
    qc.invalidateQueries({ queryKey: ["client", id] });
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const applyDeletePay = async () => {
    if (!delPay || !user) return;
    if (delReason.trim().length < 5) { toast.error("Reason must be at least 5 characters"); return; }
    await supabase.from("payment_amendments").insert({
      user_id: user.id, payment_id: delPay.id, client_id: id,
      action: "delete", previous_amount: delPay.amount, new_amount: 0,
      reason: delReason.trim(),
    });
    await supabase.from("client_payments").delete().eq("id", delPay.id);
    toast.success("Payment Received deleted");
    setDelPay(null); setDelReason("");
    qc.invalidateQueries({ queryKey: ["client", id] });
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const postedInvoices = data?.invs.filter((i) => i.status === "posted") ?? [];
  if (!data?.c) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2"><Link to="/clients"><ArrowLeft className="mr-1 h-4 w-4" />Clients</Link></Button>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{data.c.name}</h1>
            <p className="text-sm text-muted-foreground">{data.c.phone ?? ""} {data.c.email ? ` · ${data.c.email}` : ""}</p>
          </div>
          <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-4 py-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding</span>
            <span className="figure text-xl font-semibold text-warning">{formatMoney(data.outstanding, settings.currency)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild><Link to="/invoices/new" search={{ client: id } as any}><Plus className="mr-1 h-4 w-4" />New Invoice</Link></Button>
        <Button variant="default" disabled={postedInvoices.length === 0 && Number(data.c.opening_balance) === 0} onClick={() => setPayOpen(true)}>
          <Banknote className="mr-1 h-4 w-4" />Log Payment Received
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Invoices</CardTitle><CardDescription>Click an invoice number to edit, amend or delete</CardDescription></CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>#</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.invs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No invoices</TableCell></TableRow>}
                  {data.invs.map((i) => (
                    <TableRow key={i.id} className="hover:bg-muted/30">
                      <TableCell className="tabular">{formatDate(i.issue_date)}</TableCell>
                      <TableCell><Link to="/invoices/$id" params={{ id: i.id }} className="font-mono text-xs hover:underline">{i.invoice_number}</Link></TableCell>
                      <TableCell><Badge variant={i.status === "posted" ? "default" : "secondary"} className="capitalize">{i.status}</Badge></TableCell>
                      <TableCell className="text-right figure">{formatMoney(i.total, settings.currency)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/invoices/$id" params={{ id: i.id }}>
                            <Pencil className="h-3.5 w-3.5 mr-1" />{i.status === "posted" ? "Amend" : "Edit"}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payment Received</CardTitle><CardDescription>Payments received from this client — amend / delete requires a reason</CardDescription></CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Ref</TableHead><TableHead className="text-right">Amount</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.pays.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No payments yet</TableCell></TableRow>}
                  {data.pays.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="tabular">{formatDate(p.payment_date)}</TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{p.method}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.reference ?? "—"}</TableCell>
                      <TableCell className="text-right figure text-success">{formatMoney(p.amount, settings.currency)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" onClick={() => openEditPay(p)} title="Amend"><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { setDelPay(p); setDelReason(""); }} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {data.amends.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4" />Payment amendment history</CardTitle><CardDescription>Audit trail of edits and deletions</CardDescription></CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Action</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Was</TableHead><TableHead className="text-right">Became</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.amends.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="tabular">{formatDate(a.created_at)}</TableCell>
                      <TableCell><Badge variant={a.action === "delete" ? "destructive" : "secondary"} className="capitalize">{a.action}</Badge></TableCell>
                      <TableCell>{a.reason}</TableCell>
                      <TableCell className="text-right figure">{formatMoney(a.previous_amount, settings.currency)}</TableCell>
                      <TableCell className="text-right figure font-medium">{formatMoney(a.new_amount, settings.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
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
            <Field label="Apply to invoice (optional)">
              <Select value={pay.invoice_id || "none"} onValueChange={(v) => setPay({ ...pay, invoice_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {postedInvoices.map((i) => <SelectItem key={i.id} value={i.id}>{i.invoice_number} · {formatMoney(i.total, settings.currency)}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reference"><Input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></Field>
            <DialogFooter><Button type="submit">Save payment</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Amend payment dialog */}
      <Dialog open={!!editPay} onOpenChange={(v) => !v && setEditPay(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Amend Payment Received</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">A reason is required for the audit trail. The client balance will be recalculated.</p>
          <Field label="Amount"><Input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} /></Field>
          <Field label="Reason"><Textarea autoFocus rows={3} value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="e.g. Corrected from bank receipt" /></Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPay(null)}>Cancel</Button>
            <Button onClick={applyEditPay}>Confirm amendment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete payment dialog */}
      <Dialog open={!!delPay} onOpenChange={(v) => !v && setDelPay(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Payment Received?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will remove the payment and add it back to the client balance. A reason is required.</p>
          <Field label="Reason"><Textarea autoFocus rows={3} value={delReason} onChange={(e) => setDelReason(e.target.value)} placeholder="Reason for deletion" /></Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelPay(null)}>Cancel</Button>
            <Button variant="destructive" onClick={applyDeletePay}>Delete payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}
