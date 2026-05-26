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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatDate } from "@/lib/format";
import { ArrowLeft, Plus, Banknote } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const { settings, user } = useApp();
  const qc = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ amount: "", payment_date: new Date().toISOString().slice(0, 10), method: "cash", reference: "", invoice_id: "" });

  const { data } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const [{ data: c }, { data: invs }, { data: pays }] = await Promise.all([
        supabase.from("clients").select("*").eq("id", id).single(),
        supabase.from("invoices").select("*").eq("client_id", id).order("issue_date", { ascending: false }),
        supabase.from("client_payments").select("*").eq("client_id", id).order("payment_date", { ascending: false }),
      ]);
      const posted = (invs ?? []).filter((i) => i.status === "posted").reduce((s, x) => s + Number(x.total), 0);
      const paid = (pays ?? []).reduce((s, x) => s + Number(x.amount), 0);
      const outstanding = Number(c?.opening_balance ?? 0) + posted - paid;
      return { c, invs: invs ?? [], pays: pays ?? [], outstanding, posted };
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
    else { toast.success("Installment recorded"); setPayOpen(false); setPay({ amount: "", payment_date: new Date().toISOString().slice(0, 10), method: "cash", reference: "", invoice_id: "" }); qc.invalidateQueries({ queryKey: ["client", id] }); qc.invalidateQueries({ queryKey: ["clients"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); }
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
          <Banknote className="mr-1 h-4 w-4" />Log Weekly Installment
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Invoices</CardTitle><CardDescription>Drafts are editable and don't affect balance</CardDescription></CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>#</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.invs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No invoices</TableCell></TableRow>}
                  {data.invs.map((i) => (
                    <TableRow key={i.id} className="cursor-pointer hover:bg-muted/30">
                      <TableCell className="tabular">{formatDate(i.issue_date)}</TableCell>
                      <TableCell><Link to="/invoices/$id" params={{ id: i.id }} className="font-mono text-xs hover:underline">{i.invoice_number}</Link></TableCell>
                      <TableCell><Badge variant={i.status === "posted" ? "default" : "secondary"} className="capitalize">{i.status}</Badge></TableCell>
                      <TableCell className="text-right figure">{formatMoney(i.total, settings.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Weekly installments</CardTitle><CardDescription>Payments received from this client</CardDescription></CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Ref</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.pays.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No payments yet</TableCell></TableRow>}
                  {data.pays.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="tabular">{formatDate(p.payment_date)}</TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{p.method}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.reference ?? "—"}</TableCell>
                      <TableCell className="text-right figure text-success">{formatMoney(p.amount, settings.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log Weekly Installment</DialogTitle></DialogHeader>
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
            <DialogFooter><Button type="submit">Save installment</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}
