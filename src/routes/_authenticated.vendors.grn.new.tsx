import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  parseMath,
  parsePercentageOrMath,
  formatOnFocus,
  formatOnBlur,
  getFormulaPart,
  encodeFormula,
} from "@/lib/math-parser";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { formatMoney } from "@/lib/format";
import { Package, ChevronDown, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { generateCodePrefix } from "@/lib/code-prefix";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/vendors/grn/new")({
  component: NewGrnPage,
});

type Material = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  default_price: number;
};

// Client-side fallback for sequential GRN numbering
async function calculateNextGrnNumber(
  vendorId: string,
  vendorName: string,
  storedPrefix: string | undefined | null,
  activeBusinessId: string,
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

type GRNItem = {
  material: string;
  product_id: string;
  quantity: string;
  unit: string;
  unit_price: string;
  details: string;
  shipping: string;
};

function NewGrnPage() {
  const { settings, user, activeBusinessId, isReadOnly } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    vendor_id: "",
    grn_number: "",
    grn_date: new Date().toISOString().slice(0, 10),
    discount: "0",
    tax: "0",
    notes: "",
    doc_template: settings.default_doc_template,
  });
  const [items, setItems] = useState<GRNItem[]>([
    { material: "", product_id: "", quantity: "1", unit: "kg", unit_price: "0", details: "", shipping: "0" },
  ]);
  const [pickerOpen, setPickerOpen] = useState<number | null>(null);

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
        return (fallbackData ?? []).map((v) => ({ ...v, code_prefix: undefined }));
      }
      return data ?? [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    setForm((f) => ({ ...f, doc_template: settings.default_doc_template }));
  }, [settings.default_doc_template]);

  // Auto-suggest next vendor-specific GRN number
  useEffect(() => {
    if (!user || !activeBusinessId || !form.vendor_id || !vendors) {
      setForm((f) => ({ ...f, grn_number: "" }));
      return;
    }
    const selectedVendor = vendors.find((v) => v.id === form.vendor_id);
    if (!selectedVendor) return;

    supabase
      .rpc("get_next_grn_number" as any, { _vendor_id: form.vendor_id })
      .then(async ({ data, error }) => {
        if (error) {
          console.warn("RPC failed, falling back to client-side calculation:", error);
          const fallbackNum = await calculateNextGrnNumber(
            form.vendor_id,
            selectedVendor.name,
            selectedVendor.code_prefix,
            activeBusinessId,
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
      const { data } = await supabase
        .from("products" as any)
        .select("id, name, sku, unit, default_price")
        .eq("active", true)
        .eq("business_id", activeBusinessId)
        .eq("user_id", user.id)
        .order("name");
      return (data ?? []) as unknown as Material[];
    },
    enabled: !!user,
  });

  const setItem = (idx: number, patch: Partial<GRNItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const pickMaterial = (idx: number, m: Material) => {
    setItem(idx, {
      product_id: m.id,
      material: m.name,
      unit: m.unit || "kg",
      unit_price: String(m.default_price),
    });
    setPickerOpen(null);
  };

  const subtotal = useMemo(() => {
    return items.reduce((s, i) => s + (parseMath(i.quantity) || 0) * (parseMath(i.unit_price) || 0), 0);
  }, [items]);

  const discountNum = useMemo(
    () => parsePercentageOrMath(form.discount, subtotal),
    [form.discount, subtotal],
  );
  const taxNum = useMemo(() => {
    const postDiscountSubtotal = subtotal - discountNum;
    return parsePercentageOrMath(form.tax, postDiscountSubtotal);
  }, [form.tax, subtotal, discountNum]);
  const shipNum = useMemo(() => {
    return items.reduce((s, i) => {
      const rowSubtotal = (parseMath(i.quantity) || 0) * (parseMath(i.unit_price) || 0);
      return s + (parsePercentageOrMath(i.shipping || "0", rowSubtotal) || 0);
    }, 0);
  }, [items]);

  const total = useMemo(() => {
    return subtotal - discountNum + taxNum + shipNum;
  }, [subtotal, discountNum, taxNum, shipNum]);

  const handleSave = async (status: "draft" | "posted") => {
    if (!user || !activeBusinessId || !form.vendor_id) {
      toast.error("Choose a vendor");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    if (items.some((it) => !it.material)) {
      toast.error("Choose or enter a material for all line items");
      return;
    }

    const targetNum = form.grn_number.trim();
    if (!targetNum) {
      toast.error("GRN number cannot be empty");
      return;
    }

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

    const firstItem = items[0];
    const firstItemQty = parseMath(firstItem.quantity) || 0;
    const firstItemPrice = parseMath(firstItem.unit_price) || 0;
    const firstItemSubtotal = firstItemQty * firstItemPrice;
    const firstItemShipping = parsePercentageOrMath(firstItem.shipping || "0", firstItemSubtotal) || 0;

    let { data: newGrn, error } = await supabase
      .from("vendor_grns")
      .insert({
        user_id: user.id,
        business_id: activeBusinessId,
        vendor_id: form.vendor_id,
        grn_number: targetNum,
        material: firstItem.material,
        product_id: firstItem.product_id || null,
        quantity: firstItemQty,
        unit: firstItem.unit,
        unit_price: firstItemPrice,
        discount: discountNum,
        tax: taxNum,
        shipping: shipNum,
        total_amount: total,
        grn_date: form.grn_date,
        doc_template: form.doc_template,
        notes: form.notes || null,
        status,
        posted_at: status === "posted" ? new Date().toISOString() : null,
        quantity_formula: encodeFormula(getFormulaPart(firstItem.quantity)),
        unit_price_formula: encodeFormula(getFormulaPart(firstItem.unit_price)),
        discount_formula: encodeFormula(getFormulaPart(form.discount)),
        tax_formula: encodeFormula(getFormulaPart(form.tax)),
        shipping_formula: encodeFormula(getFormulaPart(firstItem.shipping || "")),
        details: firstItem.details || null,
      } as any)
      .select("id")
      .single();

    if (error && (error.message.includes("details") || error.message.includes("column"))) {
      const fallbackResult = await supabase
        .from("vendor_grns")
        .insert({
          user_id: user.id,
          business_id: activeBusinessId,
          vendor_id: form.vendor_id,
          grn_number: targetNum,
          material: firstItem.material,
          product_id: firstItem.product_id || null,
          quantity: firstItemQty,
          unit: firstItem.unit,
          unit_price: firstItemPrice,
          discount: discountNum,
          tax: taxNum,
          shipping: shipNum,
          total_amount: total,
          grn_date: form.grn_date,
          doc_template: form.doc_template,
          notes: form.notes || null,
          status,
          posted_at: status === "posted" ? new Date().toISOString() : null,
          quantity_formula: encodeFormula(getFormulaPart(firstItem.quantity)),
          unit_price_formula: encodeFormula(getFormulaPart(firstItem.unit_price)),
          discount_formula: encodeFormula(getFormulaPart(form.discount)),
          tax_formula: encodeFormula(getFormulaPart(form.tax)),
          shipping_formula: encodeFormula(getFormulaPart(firstItem.shipping || "")),
          vehicle_number: firstItem.details || null,
        } as any)
        .select("id")
        .single();
      newGrn = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      toast.error(error.message);
      return;
    }

    if (newGrn) {
      const insertItems = items.map((it: any) => {
        const rowSubtotal = (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0);
        return {
          grn_id: newGrn.id,
          product_id: it.product_id || null,
          material: it.material,
          quantity: parseMath(it.quantity) || 0,
          unit: it.unit,
          unit_price: parseMath(it.unit_price) || 0,
          quantity_formula: encodeFormula(getFormulaPart(it.quantity)),
          unit_price_formula: encodeFormula(getFormulaPart(it.unit_price)),
          line_details: it.details || null,
          shipping: parsePercentageOrMath(it.shipping || "0", rowSubtotal) || 0,
          shipping_formula: encodeFormula(getFormulaPart(it.shipping || "")),
        };
      });

      let { error: itemError } = await supabase
        .from("vendor_grn_items" as any)
        .insert(insertItems);

      if (itemError && (itemError.message.includes("shipping_formula") || itemError.message.includes("column"))) {
        const fallbackInsertItems = items.map((it: any) => {
          const rowSubtotal = (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0);
          return {
            grn_id: newGrn.id,
            product_id: it.product_id || null,
            material: it.material,
            quantity: parseMath(it.quantity) || 0,
            unit: it.unit,
            unit_price: parseMath(it.unit_price) || 0,
            quantity_formula: encodeFormula(getFormulaPart(it.quantity)),
            unit_price_formula: encodeFormula(getFormulaPart(it.unit_price)),
            line_details: it.details || null,
            shipping: parsePercentageOrMath(it.shipping || "0", rowSubtotal) || 0,
          };
        });
        let fallbackRes = await supabase
          .from("vendor_grn_items" as any)
          .insert(fallbackInsertItems);
        itemError = fallbackRes.error;
      }

      if (itemError && (itemError.message.includes("shipping") || itemError.message.includes("column"))) {
        const fallbackInsertItems = items.map((it: any) => ({
          grn_id: newGrn.id,
          product_id: it.product_id || null,
          material: it.material,
          quantity: parseMath(it.quantity) || 0,
          unit: it.unit,
          unit_price: parseMath(it.unit_price) || 0,
          quantity_formula: encodeFormula(getFormulaPart(it.quantity)),
          unit_price_formula: encodeFormula(getFormulaPart(it.unit_price)),
          line_details: it.details || null,
        }));
        let fallbackRes = await supabase
          .from("vendor_grn_items" as any)
          .insert(fallbackInsertItems);
        itemError = fallbackRes.error;
      }

      if (itemError && (itemError.message.includes("line_details") || itemError.message.includes("column"))) {
        const fallbackInsertItems = items.map((it: any) => ({
          grn_id: newGrn.id,
          product_id: it.product_id || null,
          material: it.material,
          quantity: parseMath(it.quantity) || 0,
          unit: it.unit,
          unit_price: parseMath(it.unit_price) || 0,
          quantity_formula: encodeFormula(getFormulaPart(it.quantity)),
          unit_price_formula: encodeFormula(getFormulaPart(it.unit_price)),
          vehicle_number: it.details || null,
        }));
        let fallbackRes = await supabase
          .from("vendor_grn_items" as any)
          .insert(fallbackInsertItems);
        itemError = fallbackRes.error;
      }

      if (itemError) {
        console.error("Failed to insert GRN items:", itemError);
      }
    }

    toast.success(status === "draft" ? "Draft saved" : "GRN posted");
    navigate({ to: "/vendors/$id", params: { id: form.vendor_id } });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Log Goods Received</h1>
        <p className="text-sm text-muted-foreground">Record raw material received from a vendor</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>GRN details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Vendor">
                <Select
                  value={form.vendor_id}
                  onValueChange={(v) => setForm({ ...form, vendor_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors?.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="GRN number">
                <Input
                  required
                  value={form.grn_number}
                  onChange={(e) => setForm({ ...form, grn_number: e.target.value })}
                  placeholder="GRN-0001"
                />
              </Field>
              <Field label="Date">
                <Input
                  type="date"
                  required
                  value={form.grn_date}
                  onChange={(e) => setForm({ ...form, grn_date: e.target.value })}
                />
              </Field>
            </div>

            <div className="space-y-4">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Line items</Label>
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "space-y-3 rounded-md border p-4 transition-all duration-300",
                    idx % 2 === 1
                      ? "bg-muted/50 dark:bg-muted/20 border-border"
                      : "bg-background border-border"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Popover
                      open={pickerOpen === idx}
                      onOpenChange={(v) => setPickerOpen(v ? idx : null)}
                    >
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" size="sm">
                          <Package className="mr-1 h-4 w-4" />
                          {(materials?.length ?? 0) > 0 ? "Select from catalog" : "No materials yet"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search materials…" />
                          <CommandList>
                            <CommandEmpty>
                              No materials found.{" "}
                              <Link to="/materials" className="underline">
                                Add one
                              </Link>
                              .
                            </CommandEmpty>
                            <CommandGroup>
                              {materials?.map((m) => (
                                <CommandItem
                                  key={m.id}
                                  value={`${m.name} ${m.sku ?? ""}`}
                                  onSelect={() => pickMaterial(idx, m)}
                                >
                                  <div className="flex w-full items-center justify-between">
                                    <div>
                                      <div className="font-medium">{m.name}</div>
                                      {m.sku && (
                                        <div className="text-xs text-muted-foreground">
                                          {m.sku} · {m.unit}
                                        </div>
                                      )}
                                    </div>
                                    <div className="figure text-sm">
                                      {formatMoney(m.default_price, settings.currency)}
                                    </div>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setItems(items.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-2 md:grid-cols-[1fr_100px_80px_120px_120px_120px] md:items-end">
                    <Field label="Material">
                      <Input
                        value={it.material}
                        onChange={(e) => setItem(idx, { material: e.target.value, product_id: "" })}
                        placeholder="Material name"
                      />
                    </Field>
                    <Field label="Qty" helper="supports math">
                      <Input
                        type="text"
                        value={it.quantity}
                        onChange={(e) => setItem(idx, { quantity: e.target.value })}
                        onFocus={() => setItem(idx, { quantity: formatOnFocus(it.quantity) })}
                        onBlur={() => setItem(idx, { quantity: formatOnBlur(it.quantity) })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setItem(idx, { quantity: formatOnBlur(it.quantity) });
                            e.preventDefault();
                          }
                        }}
                        placeholder="e.g. 10"
                      />
                    </Field>
                    <Field label="Unit">
                      <Input
                        value={it.unit}
                        onChange={(e) => setItem(idx, { unit: e.target.value })}
                        placeholder="kg"
                      />
                    </Field>
                    <Field label="Unit price" helper="supports math">
                      <Input
                        type="text"
                        value={it.unit_price}
                        onChange={(e) => setItem(idx, { unit_price: e.target.value })}
                        onFocus={() => setItem(idx, { unit_price: formatOnFocus(it.unit_price) })}
                        onBlur={() => setItem(idx, { unit_price: formatOnBlur(it.unit_price) })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setItem(idx, { unit_price: formatOnBlur(it.unit_price) });
                            e.preventDefault();
                          }
                        }}
                        placeholder="e.g. 100"
                      />
                    </Field>
                    <Field label="Shipping / Freight">
                      <Input
                        type="text"
                        value={it.shipping}
                        onChange={(e) => setItem(idx, { shipping: e.target.value })}
                        onFocus={() => setItem(idx, { shipping: formatOnFocus(it.shipping) })}
                        onBlur={() => setItem(idx, { shipping: formatOnBlur(it.shipping, (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0)) })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setItem(idx, { shipping: formatOnBlur(it.shipping, (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0)) });
                            e.preventDefault();
                          }
                        }}
                        placeholder="e.g. 100 or 1%"
                      />
                    </Field>
                    <Field label="Amount">
                      <div className="figure h-9 rounded-md border bg-muted/40 px-3 py-2 text-right text-sm">
                        {formatMoney(
                          (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0),
                          settings.currency,
                        )}
                      </div>
                    </Field>
                  </div>
                  <Field label="Details (optional)">
                    <Input
                      value={it.details}
                      onChange={(e) => setItem(idx, { details: e.target.value })}
                      placeholder="e.g., Vehicle No, Driver, or notes..."
                    />
                  </Field>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setItems([...items, { material: "", product_id: "", quantity: "1", unit: "kg", unit_price: "0", details: "", shipping: "0" }])
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Item
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Notes">
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Additional observations..."
                  className="min-h-[120px]"
                />
              </Field>
              <div className="space-y-3 rounded-md border p-4 bg-muted/10">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="figure">{formatMoney(subtotal, settings.currency)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <Input
                    type="text"
                    value={form.discount}
                    onChange={(e) => setForm({ ...form, discount: e.target.value })}
                    onFocus={() => setForm((f) => ({ ...f, discount: formatOnFocus(f.discount) }))}
                    onBlur={() => setForm((f) => ({ ...f, discount: formatOnBlur(f.discount, subtotal) }))}
                    className="h-8 w-28 text-right text-xs"
                    placeholder="Discount"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <Input
                    type="text"
                    value={form.tax}
                    onChange={(e) => setForm({ ...form, tax: e.target.value })}
                    onFocus={() => setForm((f) => ({ ...f, tax: formatOnFocus(f.tax) }))}
                    onBlur={() => setForm((f) => ({ ...f, tax: formatOnBlur(f.tax, subtotal - discountNum) }))}
                    className="h-8 w-28 text-right text-xs"
                    placeholder="Tax"
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Shipping / Freight (Total)</span>
                  <span className="figure">{formatMoney(shipNum, settings.currency)}</span>
                </div>
                <hr className="border-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <span className="figure text-lg font-bold text-primary">
                    {formatMoney(total, settings.currency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => window.history.back()}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleSave("draft")}
                disabled={isReadOnly}
              >
                Save as Draft
              </Button>
              <Button type="button" onClick={() => handleSave("posted")} disabled={isReadOnly}>
                Post GRN
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
        {helper && (
          <span className="text-[10px] text-muted-foreground font-normal lowercase">{helper}</span>
        )}
      </div>
      {children}
    </div>
  );
}
