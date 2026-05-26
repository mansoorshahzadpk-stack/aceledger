import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendors/grn/new")({
  component: NewGrnPage,
});

function NewGrnPage() {
  const { settings, user } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    vendor_id: "",
    grn_number: `GRN-${Date.now().toString().slice(-6)}`,
    material: "",
    quantity: "0",
    unit: "kg",
    unit_price: "0",
    grn_date: new Date().toISOString().slice(0, 10),
    doc_template: settings.default_doc_template,
    notes: "",
  });

  useEffect(() => { setForm((f) => ({ ...f, doc_template: settings.default_doc_template })); }, [settings.default_doc_template]);

  const { data: vendors } = useQuery({
    queryKey: ["vendors-list", user?.id],
    queryFn: async () => (await supabase.from("vendors").select("id, name").order("name")).data ?? [],
    enabled: !!user,
  });

  const total = useMemo(() => (parseFloat(form.quantity) || 0) * (parseFloat(form.unit_price) || 0), [form.quantity, form.unit_price]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.vendor_id) { toast.error("Choose a vendor"); return; }
    const { error } = await supabase.from("vendor_grns").insert({
      user_id: user.id,
      vendor_id: form.vendor_id,
      grn_number: form.grn_number,
      material: form.material,
      quantity: parseFloat(form.quantity) || 0,
      unit: form.unit,
      unit_price: parseFloat(form.unit_price) || 0,
      total_amount: total,
      grn_date: form.grn_date,
      doc_template: form.doc_template,
      notes: form.notes || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("GRN logged"); navigate({ to: "/vendors/$id", params: { id: form.vendor_id } }); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Log Goods Received</h1>
        <p className="text-sm text-muted-foreground">Record raw material received from a vendor</p>
      </div>
      <Card>
        <CardHeader><CardTitle>GRN details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vendor">
                <Select value={form.vendor_id} onValueChange={(v) => setForm({ ...form, vendor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>{vendors?.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="GRN number"><Input required value={form.grn_number} onChange={(e) => setForm({ ...form, grn_number: e.target.value })} /></Field>
              <Field label="Date"><Input type="date" required value={form.grn_date} onChange={(e) => setForm({ ...form, grn_date: e.target.value })} /></Field>
              <Field label="Material"><Input required value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} placeholder="e.g. Cotton lint" /></Field>
              <Field label="Quantity"><Input type="number" step="0.001" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
              <Field label="Unit"><Input required value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
              <Field label="Unit price"><Input type="number" step="0.01" required value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></Field>
              <Field label="Document layout">
                <Select value={form.doc_template} onValueChange={(v) => setForm({ ...form, doc_template: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic">Classic Professional</SelectItem>
                    <SelectItem value="modern">Modern Minimalist</SelectItem>
                    <SelectItem value="compact">Compact / High-Density</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <div className="flex items-center justify-between rounded-md border bg-muted/40 p-4">
              <span className="text-sm text-muted-foreground">Total bill amount</span>
              <span className="figure text-xl font-semibold">{formatMoney(total, settings.currency)}</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/vendors" })}>Cancel</Button>
              <Button type="submit">Save GRN</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}
