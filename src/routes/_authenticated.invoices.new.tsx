import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";
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
import { Plus, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import {
  parseMath,
  parsePercentageOrMath,
  formatOnFocus,
  formatOnBlur,
  getFormulaPart,
  encodeFormula,
  decodeFormula,
} from "@/lib/math-parser";
import { generateCodePrefix } from "@/lib/code-prefix";

const search = z.object({ client: z.string().optional() });

export const Route = createFileRoute("/_authenticated/invoices/new")({
  validateSearch: search,
  component: NewInvoice,
});

type Item = {
  description: string;
  quantity: string;
  unit_price: string;
  product_id?: string;
  unit?: string;
  grn_ref?: string;
  vehicle_ref?: string;
  shipping?: string;
};
type Material = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  default_price: number;
};

// Client-side fallback for sequential Invoice numbering
async function calculateNextInvoiceNumber(
  clientId: string,
  clientName: string,
  storedPrefix: string | undefined | null,
  activeBusinessId: string,
): Promise<string> {
  const prefix = (storedPrefix || generateCodePrefix(clientName) || "XXX").toUpperCase();
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("client_id", clientId)
    .eq("business_id", activeBusinessId);

  if (error || !invoices) {
    return `INV-${prefix}-0001`;
  }

  let maxSeq = 0;
  const regex = new RegExp(`^INV-${prefix}-(\\d{4})$`, "i");
  for (const row of invoices) {
    const match = row.invoice_number?.match(regex);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  }
  return `INV-${prefix}-${String(maxSeq + 1).padStart(4, "0")}`;
}

function NewInvoice() {
  const navigate = useNavigate();
  const { settings, user, activeBusinessId, isReadOnly } = useApp();
  const sp = Route.useSearch();
  const [clientId, setClientId] = useState<string>(sp.client ?? "");
  const [invNum, setInvNum] = useState("");
  const [issue, setIssue] = useState(new Date().toISOString().slice(0, 10));
  const [due, setDue] = useState("");

  const [tax, setTax] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: "1", unit_price: "0", shipping: "0" }]);
  const [pickerOpen, setPickerOpen] = useState<number | null>(null);

  const { data: clients } = useQuery({
    queryKey: ["clients-list", user?.id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId || !user) return [];
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, code_prefix")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user.id)
        .order("name");
      if (error) {
        // Fallback if code_prefix doesn't exist in schema
        const { data: fallbackData } = await supabase
          .from("clients")
          .select("id, name")
          .eq("business_id", activeBusinessId)
          .eq("user_id", user.id)
          .order("name");
        return (fallbackData ?? []).map((c) => ({ ...c, code_prefix: undefined }));
      }
      return data ?? [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user || !activeBusinessId || !clientId || !clients) {
      setInvNum("");
      return;
    }
    const selectedClient = clients.find((c) => c.id === clientId);
    if (!selectedClient) return;

    supabase
      .rpc("get_next_invoice_number" as any, { _client_id: clientId })
      .then(async ({ data, error }) => {
        if (error) {
          console.warn("RPC failed, falling back to client-side calculation:", error);
          const fallbackNum = await calculateNextInvoiceNumber(
            clientId,
            selectedClient.name,
            selectedClient.code_prefix,
            activeBusinessId,
          );
          setInvNum(fallbackNum);
        } else if (typeof data === "string") {
          setInvNum(data);
        }
      });
  }, [user, activeBusinessId, clientId, clients]);

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

  const subtotal = useMemo(
    () =>
      items.reduce((s, i) => s + (parseMath(i.quantity) || 0) * (parseMath(i.unit_price) || 0), 0),
    [items],
  );
  const discountNum = useMemo(
    () => parsePercentageOrMath(discount, subtotal),
    [discount, subtotal],
  );
  const taxNum = useMemo(
    () => parsePercentageOrMath(tax, subtotal - discountNum),
    [tax, subtotal, discountNum],
  );
  const shipNum = useMemo(
    () => items.reduce((s, i) => {
      const rowSubtotal = (parseMath(i.quantity) || 0) * (parseMath(i.unit_price) || 0);
      return s + (parsePercentageOrMath(i.shipping || "0", rowSubtotal) || 0);
    }, 0),
    [items],
  );
  const total = useMemo(
    () => subtotal + taxNum + shipNum - discountNum,
    [subtotal, taxNum, shipNum, discountNum],
  );

  const setItem = (idx: number, patch: Partial<Item>) =>
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const pickMaterial = (idx: number, m: Material) => {
    setItems(
      items.map((it, i) =>
        i === idx
          ? {
              ...it,
              description: m.sku ? `${m.name} (${m.sku})` : m.name,
              quantity: it.quantity && it.quantity !== "0" ? it.quantity : "1",
              unit_price: String(m.default_price),
              product_id: m.id,
              unit: m.unit,
            }
          : it,
      ),
    );
    setPickerOpen(null);
  };

  const save = async (status: "draft" | "posted") => {
    if (!user || !activeBusinessId || !clientId) {
      toast.error("Choose a client");
      return;
    }
    if (items.length === 0 || items.every((it) => !it.description)) {
      toast.error("Add at least one line item");
      return;
    }

    const targetNum = invNum.trim();
    if (!targetNum) {
      toast.error("Invoice number cannot be empty");
      return;
    }

    // Validate uniqueness of invoice_number within activeBusinessId
    const { data: existing, error: checkError } = await supabase
      .from("invoices")
      .select("id")
      .eq("business_id", activeBusinessId)
      .eq("invoice_number", targetNum);

    if (checkError) {
      toast.error("Error checking invoice uniqueness: " + checkError.message);
      return;
    }
    if (existing && existing.length > 0) {
      toast.error(
        `Invoice number "${targetNum}" is already in use. Please enter a unique invoice number.`,
      );
      return;
    }

    const { data: inv, error } = await supabase
      .from("invoices")
      .insert({
        user_id: user.id,
        business_id: activeBusinessId,
        client_id: clientId,
        invoice_number: targetNum,
        status,
        issue_date: issue,
        due_date: due || null,
        subtotal,
        tax: taxNum,
        shipping: shipNum,
        discount: discountNum,
        total,
        doc_template: settings.default_doc_template,
        notes: notes || null,
        posted_at: status === "posted" ? new Date().toISOString() : null,
        discount_formula: encodeFormula(getFormulaPart(discount)),
        tax_formula: encodeFormula(getFormulaPart(tax)),
        shipping_formula: null,
      } as any)
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    const itemRows = items
      .filter((it) => it.description)
      .map((it, idx) => {
        const rowSubtotal = (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0);
        return {
          invoice_id: inv.id,
          description: it.description,
          quantity: parseMath(it.quantity) || 0,
          unit_price: parseMath(it.unit_price) || 0,
          line_total: rowSubtotal,
          sort_order: idx,
          product_id: it.product_id || null,
          grn_ref: it.grn_ref || null,
          vehicle_ref: it.vehicle_ref || null,
          quantity_formula: encodeFormula(getFormulaPart(it.quantity)),
          unit_price_formula: encodeFormula(getFormulaPart(it.unit_price)),
          shipping: parsePercentageOrMath(it.shipping || "0", rowSubtotal) || 0,
          shipping_formula: encodeFormula(getFormulaPart(it.shipping || "")),
        };
      });
    let { error: itemInsertError } = await supabase.from("invoice_items").insert(itemRows as any);
    if (itemInsertError && (itemInsertError.message.includes("shipping_formula") || itemInsertError.message.includes("column"))) {
      const fallbackItemRows = items
        .filter((it) => it.description)
        .map((it, idx) => {
          const rowSubtotal = (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0);
          return {
            invoice_id: inv.id,
            description: it.description,
            quantity: parseMath(it.quantity) || 0,
            unit_price: parseMath(it.unit_price) || 0,
            line_total: rowSubtotal,
            sort_order: idx,
            product_id: it.product_id || null,
            grn_ref: it.grn_ref || null,
            vehicle_ref: it.vehicle_ref || null,
            quantity_formula: encodeFormula(getFormulaPart(it.quantity)),
            unit_price_formula: encodeFormula(getFormulaPart(it.unit_price)),
            shipping: parsePercentageOrMath(it.shipping || "0", rowSubtotal) || 0,
          };
        });
      let fallbackRes = await supabase.from("invoice_items").insert(fallbackItemRows as any);
      itemInsertError = fallbackRes.error;
    }
    if (itemInsertError && (itemInsertError.message.includes("shipping") || itemInsertError.message.includes("column"))) {
      const fallbackItemRows = items
        .filter((it) => it.description)
        .map((it, idx) => ({
          invoice_id: inv.id,
          description: it.description,
          quantity: parseMath(it.quantity) || 0,
          unit_price: parseMath(it.unit_price) || 0,
          line_total: (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0),
          sort_order: idx,
          product_id: it.product_id || null,
          grn_ref: it.grn_ref || null,
          vehicle_ref: it.vehicle_ref || null,
          quantity_formula: encodeFormula(getFormulaPart(it.quantity)),
          unit_price_formula: encodeFormula(getFormulaPart(it.unit_price)),
        }));
      await supabase.from("invoice_items").insert(fallbackItemRows as any);
    }
    toast.success(status === "draft" ? "Draft saved" : "Invoice posted");
    navigate({ to: "/invoices/$id", params: { id: inv.id } });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Invoice</h1>
        <p className="text-sm text-muted-foreground">
          Save as draft to edit freely, or post to update the client's balance
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client">
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Invoice #">
              <Input
                value={invNum}
                onChange={(e) => setInvNum(e.target.value)}
                placeholder="INV-0001"
              />
            </Field>
            <Field label="Issue date">
              <Input type="date" value={issue} onChange={(e) => setIssue(e.target.value)} />
            </Field>
            <Field label="Due date">
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Line items</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/materials">
              <Package className="mr-1 h-4 w-4" />
              Manage materials
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it, idx) => (
            <div
              key={idx}
              className={cn(
                "space-y-2 rounded-md border p-3 transition-all duration-300",
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
                      {(materials?.length ?? 0) > 0 ? "Select from materials" : "No materials yet"}
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_100px_120px_120px_120px] md:items-end">
                <Field label="Description">
                  <Input
                    value={it.description}
                    onChange={(e) => setItem(idx, { description: e.target.value })}
                    placeholder="Material / service"
                  />
                </Field>
                <Field label="Qty" helper="supports math, e.g. 10/2">
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
                    placeholder="e.g. 5 or 10/2"
                  />
                </Field>
                <Field label="Unit price" helper="supports math, e.g. 200/2">
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
                    placeholder="e.g. 100 or 200/2"
                  />
                </Field>
                <Field label="Shipping / Freight">
                  <Input
                    type="text"
                    value={it.shipping ?? "0"}
                    onChange={(e) => setItem(idx, { shipping: e.target.value })}
                    onFocus={() => setItem(idx, { shipping: formatOnFocus(it.shipping ?? "0") })}
                    onBlur={() => setItem(idx, { shipping: formatOnBlur(it.shipping ?? "0", (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0)) })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setItem(idx, { shipping: formatOnBlur(it.shipping ?? "0", (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0)) });
                        e.preventDefault();
                      }
                    }}
                    placeholder="Freight"
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
              <div className="grid gap-2 md:grid-cols-2">
                <Field label="GRN reference (optional)">
                  <Input
                    value={it.grn_ref ?? ""}
                    onChange={(e) => setItem(idx, { grn_ref: e.target.value })}
                    placeholder="e.g. 03345"
                  />
                </Field>
                <Field label="Details (optional)">
                  <Input
                    value={it.vehicle_ref ?? ""}
                    onChange={(e) => setItem(idx, { vehicle_ref: e.target.value })}
                    placeholder="e.g. Grade A, Batch 04, Special Notes"
                  />
                </Field>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setItems([...items, { description: "", quantity: "1", unit_price: "0", shipping: "0" }])
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            Add line
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div className="ml-auto w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="figure">{formatMoney(subtotal, settings.currency)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex flex-col items-start">
                <span>Tax</span>
                {tax.trim().endsWith("%") && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ({formatMoney(taxNum, settings.currency)})
                  </span>
                )}
              </span>
              <Input
                type="text"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                onFocus={() => setTax(formatOnFocus(tax))}
                onBlur={() => setTax(formatOnBlur(tax, subtotal - discountNum))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setTax(formatOnBlur(tax, subtotal - discountNum));
                    e.preventDefault();
                  }
                }}
                placeholder="e.g. 500 or 5%"
                className="h-8 w-36 text-right text-xs"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex flex-col items-start">
                <span>Shipping / Freight</span>
              </span>
              <Input
                type="text"
                disabled
                readOnly
                value={formatMoney(shipNum, settings.currency)}
                className="h-8 w-36 text-right text-xs bg-muted text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex flex-col items-start">
                <span>Discount</span>
                {discount.trim().endsWith("%") && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ({formatMoney(discountNum, settings.currency)})
                  </span>
                )}
              </span>
              <Input
                type="text"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                onFocus={() => setDiscount(formatOnFocus(discount))}
                onBlur={() => setDiscount(formatOnBlur(discount, subtotal))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setDiscount(formatOnBlur(discount, subtotal));
                    e.preventDefault();
                  }
                }}
                placeholder="e.g. 500 or 2%"
                className="h-8 w-36 text-right text-xs"
              />
            </div>
            <div className="flex justify-between border-t pt-2 text-lg font-semibold">
              <span>Total</span>
              <span className="figure">{formatMoney(total, settings.currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => navigate({ to: "/invoices" })}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={() => save("draft")} disabled={isReadOnly}>
          Save as Draft
        </Button>
        <Button onClick={() => save("posted")} disabled={isReadOnly}>
          Post Invoice
        </Button>
      </div>
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
