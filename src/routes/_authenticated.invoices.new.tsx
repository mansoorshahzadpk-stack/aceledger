import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
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
import { Plus, Trash2, Package } from "lucide-react";
import { toast } from "sonner";

const search = z.object({ client: z.string().optional() });

export const Route = createFileRoute("/_authenticated/invoices/new")({
  validateSearch: search,
  component: NewInvoice,
});

type Item = { description: string; quantity: string; unit_price: string; product_id?: string; unit?: string; grn_ref?: string; vehicle_ref?: string };
type Material = { id: string; name: string; sku: string | null; unit: string; default_price: number };

function NewInvoice() {
  const navigate = useNavigate();
  const { settings, user, activeBusinessId } = useApp();
  const sp = Route.useSearch();
  const [clientId, setClientId] = useState<string>(sp.client ?? "");
  const [invNum, setInvNum] = useState("");
  const [issue, setIssue] = useState(new Date().toISOString().slice(0, 10));
  const [due, setDue] = useState("");
  
  const [tax, setTax] = useState("0");
  const [shipping, setShipping] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: "1", unit_price: "0" }]);
  const [pickerOpen, setPickerOpen] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !activeBusinessId || invNum) return;
    supabase.rpc("next_doc_number" as any, { _business_id: activeBusinessId, _kind: "invoice" }).then(({ data }) => {
      if (typeof data === "string") setInvNum((v) => v || data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeBusinessId]);

  const { data: clients } = useQuery({
    queryKey: ["clients-list", user?.id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId) return [];
      return (await supabase.from("clients").select("id, name").eq("business_id", activeBusinessId).order("name")).data ?? [];
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

  const subtotal = useMemo(() => items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0), [items]);
  const taxNum = parseFloat(tax) || 0;
  const shipNum = parseFloat(shipping) || 0;
  const total = subtotal + taxNum + shipNum;

  const setItem = (idx: number, patch: Partial<Item>) => setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));

  const pickMaterial = (idx: number, m: Material) => {
    setItems(items.map((it, i) => i === idx ? {
      ...it,
      description: m.sku ? `${m.name} (${m.sku})` : m.name,
      quantity: it.quantity && it.quantity !== "0" ? it.quantity : "1",
      unit_price: String(m.default_price),
      product_id: m.id,
      unit: m.unit,
    } : it));
    setPickerOpen(null);
  };

  const save = async (status: "draft" | "posted") => {
    if (!user || !activeBusinessId || !clientId) { toast.error("Choose a client"); return; }
    if (items.length === 0 || items.every((it) => !it.description)) { toast.error("Add at least one line item"); return; }
    const { data: inv, error } = await supabase.from("invoices").insert({
      user_id: user.id,
      business_id: activeBusinessId,
      client_id: clientId,
      invoice_number: invNum,
      status, issue_date: issue, due_date: due || null,
      subtotal, tax: taxNum, shipping: shipNum, total,
      doc_template: settings.default_doc_template, notes: notes || null,
      posted_at: status === "posted" ? new Date().toISOString() : null,
    } as any).select().single();
    if (error) { toast.error(error.message); return; }
    const itemRows = items.filter((it) => it.description).map((it, idx) => ({
      invoice_id: inv.id, description: it.description,
      quantity: parseFloat(it.quantity) || 0,
      unit_price: parseFloat(it.unit_price) || 0,
      line_total: (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0),
      sort_order: idx,
      product_id: it.product_id || null,
      grn_ref: it.grn_ref || null,
      vehicle_ref: it.vehicle_ref || null,
    }));
    await supabase.from("invoice_items").insert(itemRows as any);
    toast.success(status === "draft" ? "Draft saved" : "Invoice posted");
    navigate({ to: "/invoices/$id", params: { id: inv.id } });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Invoice</h1>
        <p className="text-sm text-muted-foreground">Save as draft to edit freely, or post to update the client's balance</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Invoice details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client">
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Invoice #"><Input value={invNum} onChange={(e) => setInvNum(e.target.value)} placeholder="INV-0001" /></Field>
            <Field label="Issue date"><Input type="date" value={issue} onChange={(e) => setIssue(e.target.value)} /></Field>
            <Field label="Due date"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Line items</CardTitle>
          <Button asChild variant="ghost" size="sm"><Link to="/materials"><Package className="mr-1 h-4 w-4" />Manage materials</Link></Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it, idx) => (
            <div key={idx} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <Popover open={pickerOpen === idx} onOpenChange={(v) => setPickerOpen(v ? idx : null)}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      <Package className="mr-1 h-4 w-4" />
                      {(materials?.length ?? 0) > 0 ? "Select from materials" : "No materials yet"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search materials…" />
                      <CommandList>
                        <CommandEmpty>
                          No materials found. <Link to="/materials" className="underline">Add one</Link>.
                        </CommandEmpty>
                        <CommandGroup>
                          {materials?.map((m) => (
                            <CommandItem key={m.id} value={`${m.name} ${m.sku ?? ""}`} onSelect={() => pickMaterial(idx, m)}>
                              <div className="flex w-full items-center justify-between">
                                <div>
                                  <div className="font-medium">{m.name}</div>
                                  {m.sku && <div className="text-xs text-muted-foreground">{m.sku} · {m.unit}</div>}
                                </div>
                                <div className="figure text-sm">{formatMoney(m.default_price, settings.currency)}</div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button type="button" variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_100px_140px_140px] md:items-end">
                <Field label="Description"><Input value={it.description} onChange={(e) => setItem(idx, { description: e.target.value })} placeholder="Material / service" /></Field>
                <Field label="Qty"><Input type="number" step="0.001" value={it.quantity} onChange={(e) => setItem(idx, { quantity: e.target.value })} /></Field>
                <Field label="Unit price"><Input type="number" step="0.01" value={it.unit_price} onChange={(e) => setItem(idx, { unit_price: e.target.value })} /></Field>
                <Field label="Amount"><div className="figure h-9 rounded-md border bg-muted/40 px-3 py-2 text-right text-sm">{formatMoney((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), settings.currency)}</div></Field>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <Field label="GRN reference (optional)"><Input value={it.grn_ref ?? ""} onChange={(e) => setItem(idx, { grn_ref: e.target.value })} placeholder="e.g. 03345" /></Field>
                <Field label="Vehicle (optional)"><Input value={it.vehicle_ref ?? ""} onChange={(e) => setItem(idx, { vehicle_ref: e.target.value })} placeholder="e.g. XA 319" /></Field>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => setItems([...items, { description: "", quantity: "1", unit_price: "0" }])}>
            <Plus className="mr-1 h-4 w-4" />Add line
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <div className="ml-auto w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="figure">{formatMoney(subtotal, settings.currency)}</span></div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Tax</span>
              <Input type="number" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} className="h-8 w-32 text-right" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Shipping / Freight</span>
              <Input type="number" step="0.01" value={shipping} onChange={(e) => setShipping(e.target.value)} className="h-8 w-32 text-right" placeholder="0 or negative" />
            </div>
            <div className="flex justify-between border-t pt-2 text-lg font-semibold"><span>Total</span><span className="figure">{formatMoney(total, settings.currency)}</span></div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => navigate({ to: "/invoices" })}>Cancel</Button>
        <Button variant="secondary" onClick={() => save("draft")}>Save as Draft</Button>
        <Button onClick={() => save("posted")}>Post Invoice</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}
