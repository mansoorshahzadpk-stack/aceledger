import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, Plus, Printer, Pencil, Trash2, History, Send } from "lucide-react";
import { renderDocument } from "@/lib/document-templates";

export const Route = createFileRoute("/_authenticated/vendors/$id")({
  component: VendorDetail,
});

type GRN = {
  id: string;
  grn_number: string;
  grn_date: string;
  material: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_amount: number;
  doc_template: string;
  notes: string | null;
  status?: "draft" | "posted";
  posted_at?: string | null;
};

function VendorDetail() {
  const { id } = Route.useParams();
  const { settings, user, activeBusinessId } = useApp();
  const qc = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ amount: "", payment_date: new Date().toISOString().slice(0, 10), method: "bank", reference: "", notes: "", asset_id: "" });

  const { data: bankCashAssets = [] } = useQuery({
    queryKey: ["bank_cash_assets", activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId) return [];
      const { data, error } = await supabase
        .from("assets")
        .select("id, name, type")
        .eq("business_id", activeBusinessId)
        .in("type", ["bank_account", "petty_cash"]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeBusinessId,
  });

  useEffect(() => {
    if (bankCashAssets.length > 0 && !pay.asset_id) {
      setPay(prev => ({ ...prev, asset_id: bankCashAssets[0].id }));
    }
  }, [bankCashAssets, pay.asset_id]);

  const [editGrn, setEditGrn] = useState<GRN | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [editReason, setEditReason] = useState("");

  const [deleteGrn, setDeleteGrn] = useState<GRN | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const { data } = useQuery({
    queryKey: ["vendor", id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId) return { v: null, grns: [], pays: [], owed: 0, amends: [] };
      const [{ data: v }, { data: grns }, { data: pays }, { data: amends }] = await Promise.all([
        supabase.from("vendors").select("*").eq("id", id).eq("business_id", activeBusinessId).single(),
        supabase.from("vendor_grns").select("*").eq("vendor_id", id).eq("business_id", activeBusinessId).order("grn_date", { ascending: false }),
        supabase.from("vendor_payments").select("*").eq("vendor_id", id).eq("business_id", activeBusinessId).order("payment_date", { ascending: false }),
        supabase.from("grn_amendments" as any).select("*").order("created_at", { ascending: false }),
      ]);
      const owed = Number(v?.opening_balance ?? 0)
        + (grns ?? []).filter((g) => (g.status || "posted") === "posted").reduce((s, x) => s + Number(x.total_amount), 0)
        - (pays ?? []).reduce((s, x) => s + Number(x.amount), 0);
      return { v, grns: (grns ?? []) as GRN[], pays: pays ?? [], owed, amends: (amends ?? []) as any[] };
    },
    enabled: !!user,
  });

  const grnIds = new Set((data?.grns ?? []).map((g) => g.id));
  const vendorAmends = (data?.amends ?? []).filter((a) => grnIds.has(a.grn_id));

  const logPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeBusinessId) return;
    const { error } = await supabase.from("vendor_payments").insert({
      user_id: user.id,
      business_id: activeBusinessId,
      vendor_id: id,
      amount: parseFloat(pay.amount) || 0,
      payment_date: pay.payment_date,
      method: pay.method as any,
      reference: pay.reference || null,
      notes: pay.notes || null,
      asset_id: pay.asset_id === "" ? null : pay.asset_id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Payment logged"); setPayOpen(false); setPay({ amount: "", payment_date: new Date().toISOString().slice(0, 10), method: "bank", reference: "", notes: "", asset_id: bankCashAssets[0]?.id || "" }); qc.invalidateQueries({ queryKey: ["vendor", id] }); }
  };

  const openEdit = (g: GRN) => {
    setEditGrn(g);
    setEditForm({
      grn_number: g.grn_number, grn_date: g.grn_date, material: g.material,
      quantity: String(g.quantity), unit: g.unit, unit_price: String(g.unit_price),
      discount: String(g.discount ?? 0),
      tax: String(g.tax ?? 0),
      shipping: String(g.shipping ?? 0),
      notes: g.notes ?? "",
    });
    setEditReason("");
  };

  const saveEdit = async () => {
    if (!editGrn || !user || !editForm) return;
    const qty = parseFloat(editForm.quantity) || 0;
    const price = parseFloat(editForm.unit_price) || 0;
    const discount = parseFloat(editForm.discount) || 0;
    const tax = parseFloat(editForm.tax) || 0;
    const shipping = parseFloat(editForm.shipping) || 0;
    const newTotal = (qty * price) - discount + tax + shipping;
    const isPosted = (editGrn.status || "posted") === "posted";
    if (isPosted) {
      if (editReason.trim().length < 5) { toast.error("Reason must be at least 5 characters"); return; }
      await supabase.from("grn_amendments" as any).insert({
        user_id: user.id, grn_id: editGrn.id, reason: editReason.trim(),
        previous_total: editGrn.total_amount, new_total: newTotal, action: "edit",
      });
    }
    await supabase.from("vendor_grns").update({
      grn_number: editForm.grn_number, grn_date: editForm.grn_date,
      material: editForm.material, quantity: qty, unit: editForm.unit,
      unit_price: price, discount: discount, tax: tax, shipping: shipping, total_amount: newTotal, notes: editForm.notes || null,
    }).eq("id", editGrn.id);
    toast.success(isPosted ? "GRN amended" : "GRN updated");
    setEditGrn(null);
    setEditReason("");
    qc.invalidateQueries({ queryKey: ["vendor", id] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const confirmDelete = async () => {
    if (!deleteGrn || !user) return;
    const isPosted = (deleteGrn.status || "posted") === "posted";
    if (isPosted && deleteReason.trim().length < 5) { toast.error("Reason must be at least 5 characters"); return; }
    if (isPosted) {
      await supabase.from("grn_amendments" as any).insert({
        user_id: user.id, grn_id: deleteGrn.id, reason: `[DELETED] ${deleteReason.trim()}`,
        previous_total: deleteGrn.total_amount, new_total: 0, action: "delete",
      });
    }
    await supabase.from("vendor_grns").delete().eq("id", deleteGrn.id);
    toast.success("GRN deleted");
    setDeleteGrn(null); setDeleteReason("");
    qc.invalidateQueries({ queryKey: ["vendor", id] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const postGrnDirect = async (grn: GRN) => {
    if (!user) return;
    const { error } = await supabase.from("vendor_grns").update({
      status: "posted",
      posted_at: new Date().toISOString()
    } as any).eq("id", grn.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("GRN posted — added to vendor balance");
      qc.invalidateQueries({ queryKey: ["vendor", id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
  };

  const printGrn = (grn: GRN) => {
    renderDocument({
      template: settings.default_doc_template as any,
      title: "Goods Received Note",
      number: grn.grn_number,
      date: grn.grn_date,
      currency: settings.currency,
      business: { name: settings.business_name, address: settings.business_address, phone: settings.business_phone, logo_url: settings.business_logo_url },
      counterparty: { label: "Received From", name: data?.v?.name, address: data?.v?.address, phone: data?.v?.phone },
      items: [{ description: grn.material, quantity: grn.quantity, unit_price: grn.unit_price, line_total: grn.quantity * grn.unit_price, unit: grn.unit }],
      subtotal: grn.quantity * grn.unit_price, tax: grn.tax || 0, shipping: grn.shipping || 0, discount: grn.discount, total: grn.total_amount, notes: grn.notes,
      showBalanceDue: false,
    });
  };

  if (!data?.v) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2"><Link to="/vendors"><ArrowLeft className="mr-1 h-4 w-4" />Vendors</Link></Button>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{data.v.name}</h1>
            <p className="text-sm text-muted-foreground">{data.v.phone ?? ""} {data.v.email ? ` · ${data.v.email}` : ""}</p>
          </div>
          <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-4 py-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">We owe</span>
            <span className="figure text-xl font-semibold text-destructive">{formatMoney(data.owed, settings.currency)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 min-w-0 w-full">
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div><CardTitle>Goods Received (GRNs)</CardTitle><CardDescription>Material logged from this vendor</CardDescription></div>
            <Button asChild size="sm"><Link to="/vendors/grn/new"><Plus className="mr-1 h-4 w-4" />New GRN</Link></Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>GRN #</TableHead><TableHead>Material</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="w-36 text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.grns.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No GRNs yet</TableCell></TableRow>}
                  {data.grns.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="tabular">{formatDate(g.grn_date)}</TableCell>
                      <TableCell className="font-mono text-xs">{g.grn_number}</TableCell>
                      <TableCell>{g.material}</TableCell>
                      <TableCell>
                        <Badge variant={(g.status || "posted") === "posted" ? "default" : "secondary"} className="capitalize">
                          {g.status || "posted"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right figure">{formatMoney(g.total_amount, settings.currency)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {(g.status || "posted") === "draft" && (
                            <Button size="icon" variant="ghost" onClick={() => postGrnDirect(g)} title="Post GRN" className="text-primary hover:text-primary hover:bg-primary/10">
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => printGrn(g)} title="Print"><Printer className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(g)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => { setDeleteGrn(g); setDeleteReason(""); }} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div><CardTitle>Payments to vendor</CardTitle><CardDescription>Money we have paid them</CardDescription></div>
            <Dialog open={payOpen} onOpenChange={setPayOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Log Payment</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Log Payment to {data.v.name}</DialogTitle></DialogHeader>
                <form onSubmit={logPayment} className="space-y-3">
                  <Field label="Amount"><Input type="number" step="0.01" required value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field>
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
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <Field label="Withdrawal Account">
                    <Select value={pay.asset_id} onValueChange={(v) => setPay({ ...pay, asset_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {bankCashAssets.map((asset) => (
                          <SelectItem key={asset.id} value={asset.id}>
                            {asset.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Reference"><Input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} placeholder="Cheque # / Txn ID" /></Field>
                  <Field label="Notes"><Textarea value={pay.notes} onChange={(e) => setPay({ ...pay, notes: e.target.value })} /></Field>
                  <DialogFooter><Button type="submit">Save payment</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
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

      {vendorAmends.length > 0 && (
        <Card className="min-w-0">
          <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4" />GRN Amendments</CardTitle><CardDescription>Edits and deletions of posted GRNs</CardDescription></CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Action</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Was</TableHead><TableHead className="text-right">Became</TableHead></TableRow></TableHeader>
                <TableBody>
                  {vendorAmends.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="tabular">{formatDate(a.created_at)}</TableCell>
                      <TableCell><Badge variant={a.action === "delete" ? "destructive" : "secondary"}>{a.action}</Badge></TableCell>
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

      {/* Edit GRN dialog */}
      <Dialog open={!!editGrn} onOpenChange={(o) => !o && setEditGrn(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit GRN {editGrn?.grn_number}</DialogTitle></DialogHeader>
          {editForm && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="GRN #"><Input value={editForm.grn_number} onChange={(e) => setEditForm({ ...editForm, grn_number: e.target.value })} /></Field>
                <Field label="Date"><Input type="date" value={editForm.grn_date} onChange={(e) => setEditForm({ ...editForm, grn_date: e.target.value })} /></Field>
              </div>
              <Field label="Material"><Input value={editForm.material} onChange={(e) => setEditForm({ ...editForm, material: e.target.value })} /></Field>
              <div className="grid grid-cols-4 gap-3">
                <Field label="Qty"><Input type="number" step="0.001" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} /></Field>
                <Field label="Unit"><Input value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} /></Field>
                <Field label="Unit price"><Input type="number" step="0.01" value={editForm.unit_price} onChange={(e) => setEditForm({ ...editForm, unit_price: e.target.value })} /></Field>
                <Field label="Discount"><Input type="number" step="0.01" value={editForm.discount} onChange={(e) => setEditForm({ ...editForm, discount: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tax"><Input type="number" step="0.01" value={editForm.tax} onChange={(e) => setEditForm({ ...editForm, tax: e.target.value })} /></Field>
                <Field label="Shipping / Freight"><Input type="number" step="0.01" value={editForm.shipping} onChange={(e) => setEditForm({ ...editForm, shipping: e.target.value })} /></Field>
              </div>
              <Field label="Notes"><Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></Field>
              {(editGrn?.status || "posted") === "posted" && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Reason for change (required)</Label>
                  <Textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="e.g. Corrected quantity per weighbridge slip" rows={3} />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGrn(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save amendment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete GRN dialog */}
      <Dialog open={!!deleteGrn} onOpenChange={(o) => !o && setDeleteGrn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {(deleteGrn?.status || "posted") === "posted"
                ? `Delete GRN ${deleteGrn?.grn_number}?`
                : `Delete Draft GRN ${deleteGrn?.grn_number}?`}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {(deleteGrn?.status || "posted") === "posted"
              ? "This removes the GRN and reduces the amount we owe this vendor. A reason is required for the audit trail."
              : "This will permanently delete this draft GRN."}
          </p>
          {(deleteGrn?.status || "posted") === "posted" && (
            <Textarea autoFocus value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="Reason for deletion" rows={4} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGrn(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete GRN</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}
