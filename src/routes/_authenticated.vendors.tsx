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
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/format";
import { Plus, Truck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendors")({
  component: VendorsPage,
});

function VendorsPage() {
  const { settings, user } = useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", contact_person: "", phone: "", email: "", address: "", opening_balance: "0", notes: "" });

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["vendors", user?.id],
    queryFn: async () => {
      const { data: vs } = await supabase.from("vendors").select("*").order("created_at", { ascending: false });
      const { data: grns } = await supabase.from("vendor_grns").select("vendor_id, total_amount");
      const { data: pays } = await supabase.from("vendor_payments").select("vendor_id, amount");
      return (vs ?? []).map((v) => {
        const owed = Number(v.opening_balance)
          + (grns ?? []).filter((g) => g.vendor_id === v.id).reduce((s, x) => s + Number(x.total_amount), 0)
          - (pays ?? []).filter((p) => p.vendor_id === v.id).reduce((s, x) => s + Number(x.amount), 0);
        return { ...v, owed };
      });
    },
    enabled: !!user,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("vendors").insert({
      user_id: user.id,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
          <p className="text-sm text-muted-foreground">Raw material suppliers and amounts owed</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/vendors/grn/new"><Truck className="mr-2 h-4 w-4" />Log GRN</Link></Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Vendor</Button></DialogTrigger>
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
                <DialogFooter><Button type="submit">Save vendor</Button></DialogFooter>
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
                <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead className="text-right">We owe</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && (vendors?.length ?? 0) === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No vendors yet</TableCell></TableRow>
                )}
                {vendors?.map((v) => (
                  <TableRow key={v.id}>
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
