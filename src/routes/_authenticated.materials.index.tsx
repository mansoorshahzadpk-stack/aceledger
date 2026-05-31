import { createFileRoute } from "@tanstack/react-router";
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
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { Plus, Trash2, Pencil, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/materials/")({
  component: MaterialsPage,
  head: () => ({
    meta: [
      { title: "Materials — Ace Ledger" },
      { name: "description", content: "Maintain the raw materials catalog with SKUs, units, and pricing." },
      { property: "og:title", content: "Materials — Ace Ledger" },
      { property: "og:description", content: "Maintain the raw materials catalog with SKUs, units, and pricing." },
      { property: "og:url", content: "https://aceledger.top/materials" },
    ],
    links: [{ rel: "canonical", href: "https://aceledger.top/materials" }],
  }),
});

type MaterialRow = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  unit: string;
  default_price: number;
  default_tax_rate: number;
  active: boolean;
};

const emptyForm = { id: "", name: "", sku: "", description: "", unit: "kg", default_price: "0", default_tax_rate: "0", active: true };

function MaterialsPage() {
  const { settings, user, activeBusinessId } = useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: materials, isLoading } = useQuery({
    queryKey: ["materials", user?.id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId) return [];
      const { data } = await supabase.from("products" as any).select("*").eq("business_id", activeBusinessId).order("created_at", { ascending: false });
      return (data ?? []) as unknown as MaterialRow[];
    },
    enabled: !!user,
  });

  const openNew = () => { setForm(emptyForm); setOpen(true); };
  const openEdit = (p: MaterialRow) => {
    setForm({
      id: p.id, name: p.name, sku: p.sku ?? "", description: p.description ?? "",
      unit: p.unit, default_price: String(p.default_price), default_tax_rate: String(p.default_tax_rate),
      active: p.active,
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeBusinessId) return;
    const payload = {
      name: form.name,
      sku: form.sku || null,
      description: form.description || null,
      unit: form.unit || "kg",
      default_price: parseFloat(form.default_price) || 0,
      default_tax_rate: parseFloat(form.default_tax_rate) || 0,
      active: form.active,
    };
    const res = form.id
      ? await supabase.from("products" as any).update(payload).eq("id", form.id)
      : await supabase.from("products" as any).insert({ ...payload, user_id: user.id, business_id: activeBusinessId });
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(form.id ? "Material updated" : "Material added");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["materials"] });
    qc.invalidateQueries({ queryKey: ["materials-active"] });
  };

  const toggleActive = async (p: MaterialRow) => {
    await supabase.from("products" as any).update({ active: !p.active }).eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["materials"] });
    qc.invalidateQueries({ queryKey: ["materials-active"] });
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (!materials) return;
    if (selected.size === materials.length) setSelected(new Set());
    else setSelected(new Set(materials.map((p) => p.id)));
  };

  const deleteSelected = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const { error } = await supabase.from("products" as any).delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`Deleted ${ids.length} material${ids.length === 1 ? "" : "s"}`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["materials"] });
    qc.invalidateQueries({ queryKey: ["materials-active"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Materials</h1>
          <p className="text-sm text-muted-foreground">Catalog of raw materials and supplies — selectable when logging GRNs and creating invoices</p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" />Delete ({selected.size})</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selected.size} material{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the materials from your catalog. Existing GRNs and invoice line items already using them are not affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />New Material</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="h-4 w-4" />Catalog</CardTitle>
          <CardDescription>Active materials appear in the GRN material picker and invoice line-item picker</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={!!materials && materials.length > 0 && selected.size === materials.length}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Default price</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && (materials?.length ?? 0) === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No materials yet — add your first one</TableCell></TableRow>
                )}
                {materials?.map((p) => (
                  <TableRow key={p.id} data-state={selected.has(p.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {p.name}
                      {p.description && <div className="text-xs text-muted-foreground truncate max-w-xs">{p.description}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.sku ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{p.unit}</Badge></TableCell>
                    <TableCell className="text-right figure">{formatMoney(p.default_price, settings.currency)}</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={p.active} onCheckedChange={() => toggleActive(p)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Edit Material" : "Add Material"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <Field label="Name"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Maize Red" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SKU"><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="optional" /></Field>
              <Field label="Unit"><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg / pcs / bag" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Default price"><Input type="number" step="0.01" required value={form.default_price} onChange={(e) => setForm({ ...form, default_price: e.target.value })} /></Field>
              <Field label="Default tax rate (%)"><Input type="number" step="0.01" value={form.default_tax_rate} onChange={(e) => setForm({ ...form, default_tax_rate: e.target.value })} /></Field>
            </div>
            <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-xs text-muted-foreground">Only active materials appear in pickers</div>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
            <DialogFooter><Button type="submit">{form.id ? "Save changes" : "Add material"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}
