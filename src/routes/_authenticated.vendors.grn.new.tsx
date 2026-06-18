import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { parseMath, parsePercentageOrMath, formatOnFocus, formatOnBlur, getFormulaPart } from "@/lib/math-parser";
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
import { generateCodePrefix } from "@/lib/code-prefix";

export const Route = createFileRoute("/_authenticated/vendors/grn/new")({
  component: NewGrnPage,
});

type Material = { id: string; name: string; sku: string | null; unit: string; default_price: number };

// Client-side fallback for sequential GRN numbering
async function calculateNextGrnNumber(
  vendorId: string,
  vendorName: string,
  storedPrefix: string | undefined | null,
  activeBusinessId: string
): Promise<string> {
  const prefix = (storedPrefix || generateCodePrefix(vendorName) || "XXX").toUpperCase();
  const { data: grns, error } = await supabase
    .from("vendor_grns")
    .select("grn_number")
    .eq("vendor_id", vendorId)
    .eq("business_id", activeBusinessId);

  if (error || !grns) {
    return `GRN-${prefix}-0001`;
  }

  let maxSeq = 0;
  const regex = new RegExp(`^GRN-${prefix}-(\\d{4})$`, "i");
  for (const row of grns) {
    const match = row.grn_number?.match(regex);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  }
  return `GRN-${prefix}-${String(maxSeq + 1).padStart(4, "0")}`;
}

function NewGrnPage() {
  const { settings, user, activeBusinessId, isReadOnly } = useApp();
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
    tax: "0",
    shipping: "0",
    grn_date: new Date().toISOString().slice(0, 10),
    doc_template: settings.default_doc_template,
    notes: "",
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: vendors } = useQuery({
    queryKey: ["vendors-list", user?.id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId || !user) return [];
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, code_prefix")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user.id)
        .order("name");
      if (error) {
        // Fallback if code_prefix doesn't exist in schema
        const { data: fallbackData } = await supabase
          .from("vendors")
          .select("id, name")
          .eq("business_id", activeBusinessId)
          .eq("user_id", user.id)
          .order("name");
        return (fallbackData ?? []).map(v => ({ ...v, code_prefix: undefined }));
      }
      return data ?? [];
    },
    enabled: !!user,
  });

  useEffect(() => { setForm((f) => ({ ...f, doc_template: settings.default_doc_template })); }, [settings.default_doc_template]);

  // Auto-suggest next vendor-specific GRN number
  useEffect(() => {
    if (!user || !activeBusinessId || !form.vendor_id || !vendors) {
      setForm((f) => ({ ...f, grn_number: "" }));
      return;
    }
    const selectedVendor = vendors.find((v) => v.id === form.vendor_id);
    if (!selectedVendor) return;

    supabase.rpc("get_next_grn_number" as any, { _vendor_id: form.vendor_id }).then(async ({ data, error }) => {
      if (error) {
        console.warn("RPC failed, falling back to client-side calculation:", error);
        const fallbackNum = await calculateNextGrnNumber(
          form.vendor_id,
          selectedVendor.name,
          selectedVendor.code_prefix,
          activeBusinessId
        );
        setForm((f) => ({ ...f, grn_number: fallbackNum }));
      } else if (typeof data === "string") {
        setForm((f) => ({ ...f, grn_number: data }));
      }
    });
  }, [user, activeBusinessId, form.vendor_id, vendors]);

  const { data: materials } = useQuery({
    queryKey: ["materials-active", user?.id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId || !user) return [];
      const { data } = await supabase.from("products" as any).select("id, name, sku, unit, default_price").eq("active", true).eq("business_id", activeBusinessId).eq("user_id", user.id).order("name");
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

  const subtotal = useMemo(() => {
    return (parseMath(form.quantity) || 0) * (parseMath(form.unit_price) || 0);
  }, [form.quantity, form.unit_price]);

  const discountNum = useMemo(() => parsePercentageOrMath(form.discount, subtotal), [form.discount, subtotal]);
  const taxNum = useMemo(() => parsePercentageOrMath(form.tax, subtotal), [form.tax, subtotal]);
  const shipNum = useMemo(() => parsePercentageOrMath(form.shipping, subtotal), [form.shipping, subtotal]);

  const total = useMemo(() => {
    return subtotal - discountNum + taxNum + shipNum;
  }, [subtotal, discountNum, taxNum, shipNum]);

  const handleSave = async (status: "draft" | "posted") => {
    if (!user || !activeBusinessId || !form.vendor_id) { toast.error("Choose a vendor"); return; }
    if (!form.material) { toast.error("Choose or enter a material"); return; }
    
    const targetNum = form.grn_number.trim();
    if (!targetNum) { toast.error("GRN number cannot be empty"); return; }

    // Validate uniqueness of grn_number within activeBusinessId
    const { data: existing, error: checkError } = await supabase
      .from("vendor_grns")
      .select("id")
      .eq("business_id", activeBusinessId)
      .eq("grn_number", targetNum);
      
    if (checkError) {
      toast.error("Error checking GRN uniqueness: " + checkError.message);
      return;
    }
    if (existing && existing.length > 0) {
      toast.error(`GRN number "${targetNum}" is already in use. Please enter a unique GRN number.`);
      return;
    }

    const { error } = await supabase.from("vendor_grns").insert({
      user_id: user.id,
      business_id: activeBusinessId,
      vendor_id: form.vendor_id,
      grn_number: targetNum,
      material: form.material,
      product_id: form.product_id || null,
      quantity: parseMath(form.quantity) || 0,
      unit: form.unit,
      unit_price: parseMath(form.unit_price) || 0,
      discount: discountNum,
      tax: taxNum,
      shipping: shipNum,
      total_amount: total,
      grn_date: form.grn_date,
      doc_template: form.doc_template,
      notes: form.notes || null,
      status,
      posted_at: status === "posted" ? new Date().toISOString() : null,
      quantity_formula: getFormulaPart(form.quantity),
      unit_price_formula: getFormulaPart(form.unit_price),
      discount_formula: getFormulaPart(form.discount),
      tax_formula: getFormulaPart(form.tax),
      shipping_formula: getFormulaPart(form.shipping),
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

              <Field label="Quantity" helper="supports math, e.g. 50/2">
                <Input
                  type="text"
                  required
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  onFocus={() => setForm((f) => ({ ...f, quantity: formatOnFocus(f.quantity) }))}
                  onBlur={() => setForm((f) => ({ ...f, quantity: formatOnBlur(f.quantity) }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setForm((f) => ({ ...f, quantity: formatOnBlur(f.quantity) }));
                      e.preventDefault();
                    }
                  }}
                  placeholder="e.g. 10 or 20*5"
                />
              </Field>
              <Field label="Unit"><Input required value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
              <Field label="Unit price" helper="supports math, e.g. 200/2">
                <Input
                  type="text"
                  required
                  value={form.unit_price}
                  onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                  onFocus={() => setForm((f) => ({ ...f, unit_price: formatOnFocus(f.unit_price) }))}
                  onBlur={() => setForm((f) => ({ ...f, unit_price: formatOnBlur(f.unit_price) }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setForm((f) => ({ ...f, unit_price: formatOnBlur(f.unit_price) }));
                      e.preventDefault();
                    }
                  }}
                  placeholder="e.g. 100 or 200/2"
                />
              </Field>
              <Field
                label="Discount"
                helper={form.discount.trim().endsWith("%") ? `(${formatMoney(discountNum, settings.currency)})` : "flat or %, e.g., 2%"}
              >
                <Input
                  type="text"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: e.target.value })}
                  onFocus={() => setForm((f) => ({ ...f, discount: formatOnFocus(f.discount) }))}
                  onBlur={() => {
                    if (!form.discount.trim().endsWith("%")) {
                      setForm((f) => ({ ...f, discount: formatOnBlur(f.discount) }));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !form.discount.trim().endsWith("%")) {
                      setForm((f) => ({ ...f, discount: formatOnBlur(f.discount) }));
                      e.preventDefault();
                    }
                  }}
                  placeholder="e.g. 500 or 2%"
                />
              </Field>
              <Field
                label="Tax"
                helper={form.tax.trim().endsWith("%") ? `(${formatMoney(taxNum, settings.currency)})` : "flat or %, e.g., 5%"}
              >
                <Input
                  type="text"
                  value={form.tax}
                  onChange={(e) => setForm({ ...form, tax: e.target.value })}
                  onFocus={() => setForm((f) => ({ ...f, tax: formatOnFocus(f.tax) }))}
                  onBlur={() => {
                    if (!form.tax.trim().endsWith("%")) {
                      setForm((f) => ({ ...f, tax: formatOnBlur(f.tax) }));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !form.tax.trim().endsWith("%")) {
                      setForm((f) => ({ ...f, tax: formatOnBlur(f.tax) }));
                      e.preventDefault();
                    }
                  }}
                  placeholder="e.g. 500 or 5%"
                />
              </Field>
              <Field
                label="Shipping / Freight"
                helper={form.shipping.trim().endsWith("%") ? `(${formatMoney(shipNum, settings.currency)})` : "flat or %, e.g., 1.5%"}
              >
                <Input
                  type="text"
                  value={form.shipping}
                  onChange={(e) => setForm({ ...form, shipping: e.target.value })}
                  onFocus={() => setForm((f) => ({ ...f, shipping: formatOnFocus(f.shipping) }))}
                  onBlur={() => {
                    if (!form.shipping.trim().endsWith("%")) {
                      setForm((f) => ({ ...f, shipping: formatOnBlur(f.shipping) }));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !form.shipping.trim().endsWith("%")) {
                      setForm((f) => ({ ...f, shipping: formatOnBlur(f.shipping) }));
                      e.preventDefault();
                    }
                  }}
                  placeholder="e.g. 1000 or 1.5%"
                />
              </Field>
            </div>
            <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <div className="flex items-center justify-between rounded-md border bg-muted/40 p-4">
              <span className="text-sm text-muted-foreground">Total bill amount</span>
              <span className="figure text-xl font-semibold">{formatMoney(total, settings.currency)}</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => window.history.back()}>Cancel</Button>
              <Button type="button" variant="secondary" onClick={() => handleSave("draft")} disabled={isReadOnly}>Save as Draft</Button>
              <Button type="button" onClick={() => handleSave("posted")} disabled={isReadOnly}>Post GRN</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
        {helper && <span className="text-[10px] text-muted-foreground font-normal lowercase">{helper}</span>}
      </div>
      {children}
    </div>
  );
}
