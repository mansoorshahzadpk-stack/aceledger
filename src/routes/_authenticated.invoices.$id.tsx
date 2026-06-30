import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatDate } from "@/lib/format";
import { renderDocument } from "@/lib/document-templates";
import { ArrowLeft, Plus, Printer, Send, Trash2, History } from "lucide-react";
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

function formatMoneyFormula(val: string, currency: any) {
  if (val.includes("=")) {
    const parts = val.split("=");
    const expr = parts[0].trim();
    const res = parts[1].trim();
    return `${expr} = ${formatMoney(res, currency)}`;
  }
  return formatMoney(val, currency);
}

const valHasFormula = (val: string) => val.includes("=") || /[+\-*/()]/.test(val);

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  component: InvoiceDetail,
});

type Item = {
  id?: string;
  description: string;
  quantity: string;
  unit_price: string;
  unit?: string | null;
  grn_ref?: string | null;
  vehicle_ref?: string | null;
  shipping?: string;
};

function InvoiceDetail() {
  const { id } = Route.useParams();
  const { settings, user, activeBusinessId, isReadOnly } = useApp();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);
  const [amendReason, setAmendReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [pendingTotal, setPendingTotal] = useState<{
    subtotal: number;
    tax: number;
    shipping: number;
    discount: number;
    total: number;
    items: Item[];
    meta: any;
  } | null>(null);
  const [form, setForm] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const { data } = useQuery({
    queryKey: ["invoice", user?.id, id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId || !user) return { inv: null, items: [], amendments: [], payments: [] };
      const [{ data: inv }, { data: its }, { data: amends }, { data: pays }] = await Promise.all([
        supabase
          .from("invoices")
          .select("*, clients(*)")
          .eq("id", id)
          .eq("business_id", activeBusinessId)
          .eq("user_id", user.id)
          .single(),
        supabase.from("invoice_items").select("*").eq("invoice_id", id).order("sort_order"),
        supabase
          .from("invoice_amendments")
          .select("*")
          .eq("invoice_id", id)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("client_payments").select("*").eq("invoice_id", id).eq("user_id", user.id),
      ]);
      return { inv, items: its ?? [], amendments: amends ?? [], payments: pays ?? [] };
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (data?.inv && !form) {
      const i = data.inv as any;
      const tDec = decodeFormula(i.tax_formula);
      const sDecMain = decodeFormula(i.shipping_formula);
      const dDec = decodeFormula(i.discount_formula);

      setForm({
        invoice_number: i.invoice_number,
        issue_date: i.issue_date,
        due_date: i.due_date ?? "",
        tax: tDec
          ? tDec.endsWith("%")
            ? tDec
            : `${tDec} = ${i.tax}`
          : String(i.tax),
        shipping: sDecMain
          ? sDecMain.endsWith("%")
            ? sDecMain
            : `${sDecMain} = ${i.shipping}`
          : String(i.shipping ?? 0),
        discount: dDec
          ? dDec.endsWith("%")
            ? dDec
            : `${dDec} = ${i.discount}`
          : String(i.discount ?? 0),
        notes: i.notes ?? "",
        doc_template: i.doc_template,
      });
      setItems(
        data.items.map((it: any) => {
          const qDec = decodeFormula(it.quantity_formula);
          const pDec = decodeFormula(it.unit_price_formula);
          const sDec = decodeFormula(it.shipping_formula);
          return {
            id: it.id,
            description: it.description,
            quantity: qDec
              ? `${qDec} = ${it.quantity}`
              : String(it.quantity),
            unit_price: pDec
              ? `${pDec} = ${it.unit_price}`
              : String(it.unit_price),
            unit: it.unit ?? null,
            grn_ref: it.grn_ref ?? null,
            vehicle_ref: it.vehicle_ref ?? null,
            shipping: sDec
              ? sDec.endsWith("%")
                ? sDec
                : `${sDec} = ${it.shipping}`
              : String(it.shipping ?? 0),
          };
        }),
      );
    }
  }, [data, form]);

  const subtotal = useMemo(
    () =>
      items.reduce((s, i) => s + (parseMath(i.quantity) || 0) * (parseMath(i.unit_price) || 0), 0),
    [items],
  );
  const discountNum = useMemo(
    () => parsePercentageOrMath(form?.discount ?? "0", subtotal),
    [form?.discount, subtotal],
  );
  const taxNum = useMemo(
    () => parsePercentageOrMath(form?.tax ?? "0", subtotal - discountNum),
    [form?.tax, subtotal, discountNum],
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

  if (!data?.inv || !form) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const inv: any = data.inv;
  const isPosted = inv.status === "posted";

  const updateLine = (idx: number, patch: Partial<Item>) =>
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const writeItems = async () => {
    await supabase.from("invoice_items").delete().eq("invoice_id", id);
    const itemRows = items
      .filter((it) => it.description)
      .map((it, idx) => {
        const rowSubtotal = (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0);
        return {
          invoice_id: id,
          description: it.description,
          quantity: parseMath(it.quantity) || 0,
          unit_price: parseMath(it.unit_price) || 0,
          line_total: rowSubtotal,
          sort_order: idx,
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
            invoice_id: id,
            description: it.description,
            quantity: parseMath(it.quantity) || 0,
            unit_price: parseMath(it.unit_price) || 0,
            line_total: rowSubtotal,
            sort_order: idx,
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
          invoice_id: id,
          description: it.description,
          quantity: parseMath(it.quantity) || 0,
          unit_price: parseMath(it.unit_price) || 0,
          line_total: (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0),
          sort_order: idx,
          grn_ref: it.grn_ref || null,
          vehicle_ref: it.vehicle_ref || null,
          quantity_formula: encodeFormula(getFormulaPart(it.quantity)),
          unit_price_formula: encodeFormula(getFormulaPart(it.unit_price)),
        }));
      await supabase.from("invoice_items").insert(fallbackItemRows as any);
    }
  };

  const saveDraftEdit = async () => {
    if (!user) return;
    const targetNum = form.invoice_number.trim();
    if (!targetNum) {
      toast.error("Invoice number cannot be empty");
      return;
    }

    // Validate uniqueness of invoice_number within activeBusinessId
    const { data: existing, error: checkError } = await supabase
      .from("invoices")
      .select("id")
      .eq("business_id", inv.business_id)
      .eq("invoice_number", targetNum)
      .neq("id", id);

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

    await supabase
      .from("invoices")
      .update({
        invoice_number: targetNum,
        issue_date: form.issue_date,
        due_date: form.due_date || null,
        tax: taxNum,
        shipping: shipNum,
        discount: discountNum,
        subtotal,
        total,
        notes: form.notes || null,
        doc_template: form.doc_template,
        tax_formula: encodeFormula(getFormulaPart(form.tax)),
        shipping_formula: null,
        discount_formula: encodeFormula(getFormulaPart(form.discount)),
      } as any)
      .eq("id", id)
      .eq("user_id", user.id);
    await writeItems();
    toast.success("Draft saved");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["invoice", id] });
  };

  const requestPostedEdit = () => {
    setPendingTotal({
      subtotal,
      tax: taxNum,
      shipping: shipNum,
      discount: discountNum,
      total,
      items,
      meta: form,
    });
    setAmendOpen(true);
  };

  const applyAmendment = async () => {
    if (amendReason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters");
      return;
    }
    if (!pendingTotal || !user) return;
    const targetNum = pendingTotal.meta.invoice_number.trim();
    if (!targetNum) {
      toast.error("Invoice number cannot be empty");
      return;
    }

    // Validate uniqueness of invoice_number within activeBusinessId
    const { data: existing, error: checkError } = await supabase
      .from("invoices")
      .select("id")
      .eq("business_id", inv.business_id)
      .eq("invoice_number", targetNum)
      .neq("id", id);

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

    await supabase.from("invoice_amendments").insert({
      invoice_id: id,
      user_id: user.id,
      reason: amendReason.trim(),
      previous_total: inv.total,
      new_total: pendingTotal.total,
    });
    await supabase
      .from("invoices")
      .update({
        invoice_number: targetNum,
        issue_date: pendingTotal.meta.issue_date,
        due_date: pendingTotal.meta.due_date || null,
        subtotal: pendingTotal.subtotal,
        tax: pendingTotal.tax,
        shipping: pendingTotal.shipping,
        discount: pendingTotal.discount,
        total: pendingTotal.total,
        notes: pendingTotal.meta.notes || null,
        doc_template: pendingTotal.meta.doc_template,
        current_version: inv.current_version + 1,
        tax_formula: encodeFormula(getFormulaPart(pendingTotal.meta.tax)),
        shipping_formula: null,
        discount_formula: encodeFormula(getFormulaPart(pendingTotal.meta.discount)),
      } as any)
      .eq("id", id)
      .eq("user_id", user.id);
    await supabase.from("invoice_items").delete().eq("invoice_id", id);
    const itemRows = pendingTotal.items
      .filter((it) => it.description)
      .map((it, idx) => ({
        invoice_id: id,
        description: it.description,
        quantity: parseMath(it.quantity) || 0,
        unit_price: parseMath(it.unit_price) || 0,
        line_total: (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0),
        sort_order: idx,
        grn_ref: it.grn_ref || null,
        vehicle_ref: it.vehicle_ref || null,
        quantity_formula: encodeFormula(getFormulaPart(it.quantity)),
        unit_price_formula: encodeFormula(getFormulaPart(it.unit_price)),
        shipping: parseMath(it.shipping || "0") || 0,
      }));
    const { error: itemInsertError } = await supabase.from("invoice_items").insert(itemRows as any);
    if (itemInsertError && (itemInsertError.message.includes("shipping") || itemInsertError.message.includes("column"))) {
      const fallbackItemRows = pendingTotal.items
        .filter((it) => it.description)
        .map((it, idx) => ({
          invoice_id: id,
          description: it.description,
          quantity: parseMath(it.quantity) || 0,
          unit_price: parseMath(it.unit_price) || 0,
          line_total: (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0),
          sort_order: idx,
          grn_ref: it.grn_ref || null,
          vehicle_ref: it.vehicle_ref || null,
          quantity_formula: encodeFormula(getFormulaPart(it.quantity)),
          unit_price_formula: encodeFormula(getFormulaPart(it.unit_price)),
        }));
      await supabase.from("invoice_items").insert(fallbackItemRows as any);
    }
    toast.success("Amendment logged · client balance updated");
    setAmendOpen(false);
    setAmendReason("");
    setPendingTotal(null);
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["invoice", id] });
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const deleteInvoice = async () => {
    if (isPosted && deleteReason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters");
      return;
    }
    if (!user) return;
    if (isPosted) {
      await supabase.from("invoice_amendments").insert({
        invoice_id: id,
        user_id: user.id,
        reason: `[DELETED] ${deleteReason.trim()}`,
        previous_total: inv.total,
        new_total: 0,
      });
    }
    await supabase.from("client_payments").delete().eq("invoice_id", id).eq("user_id", user.id);
    await supabase.from("invoice_items").delete().eq("invoice_id", id);
    await supabase.from("invoice_amendments").delete().eq("invoice_id", id).eq("user_id", user.id);
    await supabase.from("invoices").delete().eq("id", id).eq("user_id", user.id);
    toast.success("Invoice deleted");
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    navigate({ to: "/invoices" });
  };

  const postInvoice = async () => {
    if (!user) return;
    await supabase
      .from("invoices")
      .update({ status: "posted", posted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    toast.success("Invoice posted — added to client balance");
    qc.invalidateQueries({ queryKey: ["invoice", id] });
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const print = () => {
    renderDocument({
      template: settings.default_doc_template,
      title: "Invoice",
      number: form.invoice_number,
      date: form.issue_date,
      due_date: form.due_date,
      currency: settings.currency,
      business: {
        name: settings.business_name,
        address: settings.business_address,
        phone: settings.business_phone,
        logo_url: settings.business_logo_url,
      },
      counterparty: {
        label: "Bill To",
        name: inv.clients?.name,
        address: inv.clients?.address,
        phone: inv.clients?.phone,
      },
      items: items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        line_total: (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0),
        unit: it.unit,
        grn_ref: it.grn_ref,
        vehicle_ref: it.vehicle_ref,
        shipping: it.shipping || 0,
      })),
      subtotal,
      tax: taxNum,
      shipping: shipNum,
      discount: discountNum,
      total,
      notes: form.notes,
      status: inv.status,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/invoices">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Invoices
          </Link>
        </Button>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{inv.invoice_number}</h1>
              <Badge variant={isPosted ? "default" : "secondary"} className="capitalize">
                {inv.status}
              </Badge>
              {inv.current_version > 1 && <Badge variant="outline">v{inv.current_version}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {inv.clients?.name} · {formatDate(inv.issue_date)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={print}>
              <Printer className="mr-1 h-4 w-4" />
              Print / PDF
            </Button>
            {data.amendments.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5"
              >
                <History className="h-4 w-4" />
                {showHistory ? "Hide Change History" : "View Change History"}
              </Button>
            )}
            {!editing && (
              <Button variant="secondary" onClick={() => setEditing(true)} disabled={isReadOnly}>
                {isPosted ? "Edit (requires reason)" : "Edit"}
              </Button>
            )}
            {!editing && (
              <Button
                variant="destructive"
                onClick={() => {
                  setDeleteReason("");
                  setDeleteOpen(true);
                }}
                disabled={isReadOnly}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Delete
              </Button>
            )}
            {!isPosted && (
              <Button onClick={postInvoice} disabled={isReadOnly}>
                <Send className="mr-1 h-4 w-4" />
                Post Invoice
              </Button>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Details</CardTitle>
          {editing && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setForm(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={isPosted ? requestPostedEdit : saveDraftEdit}
                disabled={isReadOnly}
              >
                Save changes
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Invoice #">
              <Input
                disabled={!editing}
                value={form.invoice_number}
                onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
              />
            </Field>
            <Field label="Issue date">
              <Input
                type="date"
                disabled={!editing}
                value={form.issue_date}
                onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
              />
            </Field>
            <Field label="Due date">
              <Input
                type="date"
                disabled={!editing}
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </Field>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Line items
            </Label>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-24 text-right">Qty</TableHead>
                    <TableHead className="w-32 text-right">Unit price</TableHead>
                    <TableHead className="w-32 text-right">Shipping / Freight</TableHead>
                    <TableHead className="w-32 text-right">Amount</TableHead>
                    {editing && <TableHead className="w-10"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, idx) => (
                    <TableRow
                      key={idx}
                      className={cn(
                        "transition-all duration-300",
                        idx % 2 === 1
                          ? "bg-muted/50 dark:bg-muted/20 border-border"
                          : "bg-background border-border"
                      )}
                    >
                      <TableCell>
                        {editing ? (
                          <div className="space-y-1">
                            <Input
                              value={it.description}
                              onChange={(e) => updateLine(idx, { description: e.target.value })}
                            />
                            <div className="flex gap-1">
                              <Input
                                className="h-7 text-xs"
                                value={it.grn_ref ?? ""}
                                placeholder="GRN ref"
                                onChange={(e) => updateLine(idx, { grn_ref: e.target.value })}
                              />
                              <Input
                                className="h-7 text-xs"
                                value={it.vehicle_ref ?? ""}
                                placeholder="Details"
                                onChange={(e) => updateLine(idx, { vehicle_ref: e.target.value })}
                              />
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div>{it.description}</div>
                            {(it.grn_ref || it.vehicle_ref) && (
                              <div className="text-xs text-muted-foreground">
                                {it.grn_ref && <>GRN: {it.grn_ref}</>}
                                {it.grn_ref && it.vehicle_ref && " · "}
                                {it.vehicle_ref && <>Details: {it.vehicle_ref}</>}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editing ? (
                          <Input
                            type="text"
                            value={it.quantity}
                            onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                            onFocus={() =>
                              updateLine(idx, { quantity: formatOnFocus(it.quantity) })
                            }
                            onBlur={() => updateLine(idx, { quantity: formatOnBlur(it.quantity) })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateLine(idx, { quantity: formatOnBlur(it.quantity) });
                                e.preventDefault();
                              }
                            }}
                            className="text-right"
                          />
                        ) : (
                          <span className="figure">{it.quantity}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editing ? (
                          <Input
                            type="text"
                            value={it.unit_price}
                            onChange={(e) => updateLine(idx, { unit_price: e.target.value })}
                            onFocus={() =>
                              updateLine(idx, { unit_price: formatOnFocus(it.unit_price) })
                            }
                            onBlur={() =>
                              updateLine(idx, { unit_price: formatOnBlur(it.unit_price) })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateLine(idx, { unit_price: formatOnBlur(it.unit_price) });
                                e.preventDefault();
                              }
                            }}
                            className="text-right"
                          />
                        ) : (
                          <span className="figure">
                            {formatMoneyFormula(it.unit_price, settings.currency)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editing ? (
                          <Input
                            type="text"
                            value={it.shipping ?? "0"}
                            onChange={(e) => updateLine(idx, { shipping: e.target.value })}
                            onFocus={() =>
                              updateLine(idx, { shipping: formatOnFocus(it.shipping ?? "0") })
                            }
                            onBlur={() =>
                              updateLine(idx, { shipping: formatOnBlur(it.shipping ?? "0", (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0)) })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateLine(idx, { shipping: formatOnBlur(it.shipping ?? "0", (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0)) });
                                e.preventDefault();
                              }
                            }}
                            className="text-right"
                          />
                        ) : (
                          <span className="figure">
                            {formatMoneyFormula(it.shipping ?? "0", settings.currency)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right figure">
                        {formatMoney(
                          (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0),
                          settings.currency,
                        )}
                      </TableCell>
                      {editing && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setItems(items.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {editing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setItems([...items, { description: "", quantity: "1", unit_price: "0", shipping: "0" }])
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                Add line
              </Button>
            )}
          </div>

          <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="figure">{formatMoney(subtotal, settings.currency)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex flex-col items-start">
                <span>Tax</span>
                {form.tax.trim().endsWith("%") && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ({formatMoney(taxNum, settings.currency)})
                  </span>
                )}
              </span>
              {editing ? (
                <Input
                  type="text"
                  value={form.tax}
                  onChange={(e) => setForm({ ...form, tax: e.target.value })}
                  onFocus={() => setForm({ ...form, tax: formatOnFocus(form.tax) })}
                  onBlur={() => setForm({ ...form, tax: formatOnBlur(form.tax, subtotal - discountNum) })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setForm({ ...form, tax: formatOnBlur(form.tax, subtotal - discountNum) });
                      e.preventDefault();
                    }
                  }}
                  className="h-8 w-28 text-right text-xs"
                />
              ) : (
                <span className="figure">
                  {form.tax.trim().endsWith("%") ? (
                    <>
                      {form.tax} = {formatMoney(taxNum, settings.currency)}
                    </>
                  ) : (
                    formatMoneyFormula(form.tax, settings.currency)
                  )}
                </span>
              )}
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
                className="h-8 w-28 text-right text-xs bg-muted text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex flex-col items-start">
                <span>Discount</span>
                {form.discount.trim().endsWith("%") && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ({formatMoney(discountNum, settings.currency)})
                  </span>
                )}
              </span>
              {editing ? (
                <Input
                  type="text"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: e.target.value })}
                  onFocus={() => setForm({ ...form, discount: formatOnFocus(form.discount) })}
                  onBlur={() => setForm({ ...form, discount: formatOnBlur(form.discount, subtotal) })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setForm({ ...form, discount: formatOnBlur(form.discount, subtotal) });
                      e.preventDefault();
                    }
                  }}
                  className="h-8 w-28 text-right text-xs"
                />
              ) : (
                <span className="figure text-red-600 dark:text-red-500">
                  {form.discount.trim().endsWith("%") ? (
                    <>
                      -{form.discount} = {formatMoney(discountNum, settings.currency)}
                    </>
                  ) : valHasFormula(form.discount) ? (
                    `-${formatMoneyFormula(form.discount, settings.currency)}`
                  ) : (
                    `-${formatMoney(discountNum, settings.currency)}`
                  )}
                </span>
              )}
            </div>
            <div className="flex justify-between border-t pt-2 text-lg font-semibold">
              <span>Total</span>
              <span className="figure">{formatMoney(total, settings.currency)}</span>
            </div>
          </div>

          <Field label="Notes">
            <Textarea
              disabled={!editing}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
        </CardContent>
      </Card>

      {data.amendments.length > 0 && showHistory && (
        <Card className="min-w-0 animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Amendment History
            </CardTitle>
            <CardDescription>Audit trail of edits made after posting</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Was</TableHead>
                    <TableHead className="text-right">Became</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.amendments.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="tabular">{formatDate(a.created_at)}</TableCell>
                      <TableCell>{a.reason}</TableCell>
                      <TableCell className="text-right figure">
                        {formatMoney(a.previous_total, settings.currency)}
                      </TableCell>
                      <TableCell className="text-right figure font-medium">
                        {formatMoney(a.new_total, settings.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={amendOpen} onOpenChange={setAmendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reason for Amendment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This invoice is posted. Provide a reason that will be logged to the audit trail and the
            client's balance will be recalculated.
          </p>
          <Textarea
            autoFocus
            value={amendReason}
            onChange={(e) => setAmendReason(e.target.value)}
            placeholder="e.g. Corrected quantity per delivery note 24-09-12"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAmendOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyAmendment} disabled={isReadOnly}>
              Confirm amendment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete invoice {inv.invoice_number}?</DialogTitle>
          </DialogHeader>
          {isPosted ? (
            <>
              <p className="text-sm text-muted-foreground">
                This invoice is posted. Deletion will remove it from the client balance. A reason is
                required for the audit trail.
              </p>
              <Textarea
                autoFocus
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Reason for deletion"
                rows={4}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">This draft will be permanently removed.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteInvoice} disabled={isReadOnly}>
              Delete invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
