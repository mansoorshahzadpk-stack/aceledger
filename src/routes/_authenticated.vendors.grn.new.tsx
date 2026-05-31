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
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { formatMoney } from "@/lib/format";
import { Package, ChevronDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendors/grn/new")({
  component: NewGrnPage,
});

type Material = { id: string; name: string; sku: string | null; unit: string; default_price: number };

function NewGrnPage() {
  const { settings, user, activeBusinessId } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    vendor_id: "",
    grn_number: "",
    material: "",
    product_id: "" as string,
    quantity: "0",
    unit: "kg",
    unit_price: "0",
    discount: "0",
    grn_date: new Date().toISOString().slice(0, 10),
    doc_template: settings.default_doc_template,
    notes: "",
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => { setForm((f) => ({ ...f, doc_template: settings.default_doc_template })); }, [settings.default_doc_template]);

  // Auto-suggest next 4-digit GRN number
  useEffect(() => {
    if (!user || !activeBusinessId || form.grn_number) return;
    supabase.rpc("next_doc_number" as any, { _business_id: activeBusinessId, _kind: "grn" }).then(({ data }) => {
      if (typeof data === "string") setForm((f) => f.grn_number ? f : { ...f, grn_number: data });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeBusinessId]);

  const { data: vendors } = useQuery({
    queryKey: ["vendors-list", user?.id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId) return [];
      return (await supabase.from("vendors").select("id, name").eq("business_id", activeBusinessId).order("name")).data ?? [];
    },
    enabled: !!user,
  });

  const { data: materials } = useQuery({
    queryKey: ["materials-active", user?.id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId) return [];
      const { data } = await supabase.from("products" as any).select("id, name, sku, unit, default_price").eq("active", true).eq("business_id", activeBusinessId).order("name");
      return (data ?? []) as unknown as Material[];
    },
    enabled: !!user,
  });

  const pickMaterial = (m: Material) => {
    setForm((f) => ({
      ...f,
      product_id: m.id,
      material: m.name,
      unit: m.unit || f.unit,
      unit_price: f.unit_price && f.unit_price !== "0" ? f.unit_price : String(m.default_price),
    }));
    setPickerOpen(false);
  };

  const total = useMemo(() => {
    const sub = (parseFloat(form.quantity) || 0) * (parseFloat(form.unit_price) || 0);
    return sub - (parseFloat(form.discount) || 0);
  }, [form.quantity, form.unit_price, form.discount]);

  const handleSave = async (status: "draft" | "posted") => {
    if (!user || !activeBusinessId || !form.vendor_id) { toast.error("Choose a vendor"); return; }
    if (!form.material) { toast.error("Choose or enter a material"); return; }
    const { error } = await supabase.from("vendor_grns").insert({
      user_id: user.id,
      business_id: activeBusinessId,
      vendor_id: form.vendor_id,
      grn_number: form.grn_number,
      material: form.material,
      product_id: form.product_id || null,
      quantity: parseFloat(form.quantity) || 0,
      unit: form.unit,
      unit_price: parseFloat(form.unit_price) || 0,
      discount: parseFloat(form.discount) || 0,
      total_amount: total,
      grn_date: form.grn_date,
      doc_template: form.doc_template,
      notes: form.notes || null,
      status,
      posted_at: status === "posted" ? new Date().toISOString() : null,
    } as any);
    if (error) toast.error(error.message);
    else {
      toast.success(status === "draft" ? "Draft saved" : "GRN posted");
      navigate({ to: "/vendors/$id", params: { id: form.vendor_id } });
    }
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
          <form onSubmit={(e) => { e.preventDefault(); handleSave("posted"); }} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vendor">
                <Select value={form.vendor_id} onValueChange={(v) => setForm({ ...form, vendor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>{vendors?.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="GRN number"><Input required value={form.grn_number} onChange={(e) => setForm({ ...form, grn_number: e.target.value })} placeholder="GRN-0001" /></Field>
              <Field label="Date"><Input type="date" required value={form.grn_date} onChange={(e) => setForm({ ...form, grn_date: e.target.value })} /></Field>

              <Field label="Material">
                <div className="flex gap-2">
                  <Input
                    value={form.material}
                    onChange={(e) => setForm({ ...form, material: e.target.value, product_id: "" })}
                    placeholder="Type or pick"
                    className="flex-1"
                  />
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="icon" title="Pick from catalog">
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="end">
                      <Command>
                        <CommandInput placeholder="Search materials…" />
                        <CommandList>
                          <CommandEmpty>No materials found. Add some in <a className="underline" href="/materials">Materials</a>.</CommandEmpty>
                          <CommandGroup>
                            {materials?.map((m) => (
                              <CommandItem key={m.id} value={`${m.name} ${m.sku ?? ""}`} onSelect={() => pickMaterial(m)}>
                                <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                                <div className="flex w-full items-center justify-between">
                                  <div>
                                    <div className="font-medium">{m.name}</div>
                                    {m.sku && <div className="text-xs text-muted-foreground">{m.sku} · {m.unit}</div>}
                                  </div>
                                  <div className="figure text-xs">{formatMoney(m.default_price, settings.currency)}</div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </Field>

              <Field label="Quantity"><Input type="number" step="0.001" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
              <Field label="Unit"><Input required value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
              <Field label="Unit price"><Input type="number" step="0.01" required value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></Field>
              <Field label="Discount"><Input type="number" step="0.01" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} /></Field>
            </div>
            <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <div className="flex items-center justify-between rounded-md border bg-muted/40 p-4">
              <span className="text-sm text-muted-foreground">Total bill amount</span>
              <span className="figure text-xl font-semibold">{formatMoney(total, settings.currency)}</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => window.history.back()}>Cancel</Button>
              <Button type="button" variant="secondary" onClick={() => handleSave("draft")}>Save as Draft</Button>
              <Button type="button" onClick={() => handleSave("posted")}>Post GRN</Button>
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
