import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
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
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, Plus, Printer, Pencil, Trash2, History, Send, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderDocument } from "@/lib/document-templates";
import {
  parseMath,
  parsePercentageOrMath,
  formatOnFocus,
  formatOnBlur,
  getFormulaPart,
} from "@/lib/math-parser";

export const Route = createFileRoute("/_authenticated/vendors/$id")({
  component: VendorDetail,
});

type GRN = {
  id: string;
  business_id: string;
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
  tax?: number;
  shipping?: number;
  discount?: number;
  quantity_formula?: string | null;
  unit_price_formula?: string | null;
  discount_formula?: string | null;
  tax_formula?: string | null;
  shipping_formula?: string | null;
};

function VendorDetail() {
  const { id } = Route.useParams();
  const { settings, user, activeBusinessId, isReadOnly } = useApp();
  const qc = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    method: "bank",
    reference: "",
    notes: "",
    asset_id: "",
  });

  const [editPay, setEditPay] = useState<any | null>(null);
  const [editPayReason, setEditPayReason] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editMethod, setEditMethod] = useState("");
  const [editReference, setEditReference] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editAssetId, setEditAssetId] = useState("");

  const [delPay, setDelPay] = useState<any | null>(null);
  const [delReason, setDelReason] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    reason: string;
    table: "grn_amendments" | "vendor_payment_amendments";
  } | null>(null);
  const [masterPassword, setMasterPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [maximizedCard, setMaximizedCard] = useState<"grns" | "payments" | null>(null);

  const { data: bankCashAssets = [] } = useQuery({
    queryKey: ["bank_cash_assets", user?.id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId || !user) return [];
      const { data, error } = await supabase
        .from("assets")
        .select("id, name, type")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user.id)
        .in("type", ["bank_account", "petty_cash"]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeBusinessId && !!user,
  });

  useEffect(() => {
    if (bankCashAssets.length > 0 && !pay.asset_id) {
      setPay((prev) => ({ ...prev, asset_id: bankCashAssets[0].id }));
    }
  }, [bankCashAssets, pay.asset_id]);

  const [editGrn, setEditGrn] = useState<GRN | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [editReason, setEditReason] = useState("");

  const [deleteGrn, setDeleteGrn] = useState<GRN | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const { data } = useQuery({
    queryKey: ["vendor", user?.id, id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId || !user)
        return { v: null, grns: [], pays: [], owed: 0, amends: [], paymentAmends: [] };
      const [vRes, grnsRes, vpayResult, amendsRes] = await Promise.all([
        supabase
          .from("vendors")
          .select("*")
          .eq("id", id)
          .eq("business_id", activeBusinessId)
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("vendor_grns")
          .select("*")
          .eq("vendor_id", id)
          .eq("business_id", activeBusinessId)
          .eq("user_id", user.id)
          .order("grn_date", { ascending: false }),
        supabase
          .from("vendor_payments")
          .select("*, assets(name)")
          .eq("vendor_id", id)
          .eq("business_id", activeBusinessId)
          .eq("user_id", user.id)
          .order("payment_date", { ascending: false }),
        supabase
          .from("grn_amendments" as any)
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      let pays: any[] = vpayResult.data || [];
      if (vpayResult.error && vpayResult.error.code === "42703") {
        const { data: fallback } = await supabase
          .from("vendor_payments")
          .select(
            "id, vendor_id, amount, payment_date, method, reference, notes, asset_id, assets(name)",
          )
          .eq("vendor_id", id)
          .eq("business_id", activeBusinessId)
          .eq("user_id", user.id)
          .order("payment_date", { ascending: false });
        pays = (fallback || []) as any[];
      }

      // Fetch vendor_payment_amendments safely (handling missing table error)
      const vpayAmendsResult = await supabase
        .from("vendor_payment_amendments" as any)
        .select("*")
        .eq("vendor_id", id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const paymentAmends = (vpayAmendsResult.data || []) as any[];

      const v = vRes.data;
      const grns = grnsRes.data || [];
      const amends = (amendsRes.data || []) as any[];

      const grnTotal = (grns ?? [])
        .filter((g) => g.status === "posted" || g.status == null)
        .reduce((s, x) => s + Number(x.total_amount), 0);
      const paid = (pays ?? [])
        .filter((p: any) => p.status === "posted")
        .reduce((s, x) => s + Number(x.amount), 0);
      const owed = Number(v?.opening_balance ?? 0) + grnTotal - paid;

      return { v, grns: grns as GRN[], pays, owed, amends, paymentAmends };
    },
    enabled: !!user,
  });

  const grnIds = new Set((data?.grns ?? []).map((g) => g.id));
  const vendorAmends = (data?.amends ?? []).filter((a) => grnIds.has(a.grn_id));

  const combinedHistory = useMemo(() => {
    const grnAmendsMapped = vendorAmends.map((a: any) => ({
      id: a.id,
      created_at: a.created_at,
      type: "grn" as const,
      action: a.action,
      reason: a.reason,
      was: a.previous_total,
      became: a.new_total,
      table: "grn_amendments" as const,
    }));

    const paymentAmendsMapped = (data?.paymentAmends ?? []).map((a: any) => ({
      id: a.id,
      created_at: a.created_at,
      type: "payment" as const,
      action: a.action,
      reason: a.reason,
      was: a.previous_amount,
      became: a.new_amount,
      table: "vendor_payment_amendments" as const,
    }));

    return [...grnAmendsMapped, ...paymentAmendsMapped].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [vendorAmends, data?.paymentAmends]);

  const logPayment = async (status: "draft" | "posted") => {
    if (!pay.amount) {
      toast.error("Please enter an amount");
      return;
    }
    if (!user || !activeBusinessId) return;

    const payload: any = {
      user_id: user.id,
      business_id: activeBusinessId,
      vendor_id: id,
      amount: parseFloat(pay.amount) || 0,
      payment_date: pay.payment_date,
      method: pay.method as any,
      reference: pay.reference || null,
      notes: pay.notes || null,
      asset_id: pay.asset_id === "" ? null : pay.asset_id,
      // Always explicitly set status — never leave it null so the
      // legacy (p.status || "posted") fallback cannot misclassify a draft as posted.
      status: status,
      posted_at: status === "posted" ? new Date().toISOString() : null,
    };

    const { error } = await supabase.from("vendor_payments").insert(payload);
    if (error) {
      // If the status column doesn't exist yet in the DB, retry without it
      // (backwards-compat for older deployments without the column)
      if (error.code === "42703") {
        const { amount, payment_date, method, reference, notes, asset_id } = payload;
        const { error: retryError } = await supabase.from("vendor_payments").insert({
          user_id: user.id,
          business_id: activeBusinessId,
          vendor_id: id,
          amount,
          payment_date,
          method,
          reference,
          notes,
          asset_id,
        });
        if (retryError) {
          toast.error(retryError.message);
          return;
        }
        // Column doesn't exist — treat as posted (legacy mode)
        toast.success("Payment posted — balance updated");
      } else {
        toast.error(error.message);
        return;
      }
    } else {
      toast.success(
        status === "draft"
          ? "Payment saved as Draft — balance not yet affected"
          : "Payment posted — balance updated",
      );
    }

    setPayOpen(false);
    setPay({
      amount: "",
      payment_date: new Date().toISOString().slice(0, 10),
      method: "bank",
      reference: "",
      notes: "",
      asset_id: bankCashAssets[0]?.id || "",
    });
    qc.invalidateQueries({ queryKey: ["vendor", id] });
    // Only refresh the vendors list balance when actually posting
    if (status === "posted") {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } else {
      // Refresh vendor detail only (draft doesn't affect global balances)
      qc.invalidateQueries({ queryKey: ["vendor"] });
    }
  };

  const openEditPay = (p: any) => {
    setEditPay(p);
    setEditAmount(String(p.amount));
    setEditDate(p.payment_date);
    setEditMethod(p.method);
    setEditReference(p.reference || "");
    setEditNotes(p.notes || "");
    setEditPayReason("");
    setEditAssetId(p.asset_id || "");
  };

  const applyEditPay = async () => {
    if (!editPay || !user) return;
    const isPosted = (editPay.status || "posted") === "posted";
    const newAmt = parseFloat(editAmount) || 0;

    if (newAmt <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }

    if (isPosted && editPayReason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters");
      return;
    }

    const { error: checkColError } = await supabase
      .from("vendor_payments")
      .select("status")
      .limit(1);
    const hasStatusCol = !checkColError || checkColError.code !== "42703";

    let error = null;
    if (hasStatusCol) {
      const { error: rpcError } = await supabase.rpc("update_vendor_payment" as any, {
        p_payment_id: editPay.id,
        p_amount: newAmt,
        p_date: editDate,
        p_method: editMethod,
        p_reference: editReference,
        p_notes: editNotes,
        p_reason: isPosted ? editPayReason.trim() : "",
        p_user_id: user.id,
        p_asset_id: editAssetId === "" ? null : editAssetId,
      });
      error = rpcError;
    } else {
      const { error: updateError } = await supabase
        .from("vendor_payments")
        .update({
          amount: newAmt,
          payment_date: editDate,
          method: editMethod as any,
          reference: editReference || null,
          notes: editNotes || null,
          asset_id: editAssetId === "" ? null : editAssetId,
        })
        .eq("id", editPay.id)
        .eq("user_id", user.id);
      error = updateError;
    }

    if (error) {
      toast.error(error.message || "Failed to update payment");
    } else {
      toast.success(isPosted ? "Payment amended" : "Payment updated");
      setEditPay(null);
      qc.invalidateQueries({ queryKey: ["vendor", id] });
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
  };

  const applyDeletePay = async () => {
    if (!delPay || !user) return;
    const isPosted = (delPay.status || "posted") === "posted";

    const { error: checkColError } = await supabase
      .from("vendor_payments")
      .select("status")
      .limit(1);
    const hasStatusCol = !checkColError || checkColError.code !== "42703";

    if (isPosted && hasStatusCol) {
      if (delReason.trim().length < 5) {
        toast.error("Reason must be at least 5 characters");
        return;
      }

      const { error: amendError } = await supabase.from("vendor_payment_amendments" as any).insert({
        user_id: user.id,
        payment_id: delPay.id,
        vendor_id: id,
        action: "delete",
        previous_amount: delPay.amount,
        new_amount: 0,
        reason: delReason.trim(),
      });
      if (amendError) {
        toast.error("Failed to log deletion audit: " + amendError.message);
        return;
      }
    }

    const { error: deleteError } = await supabase
      .from("vendor_payments")
      .delete()
      .eq("id", delPay.id)
      .eq("user_id", user.id);
    if (deleteError) {
      toast.error("Failed to delete payment: " + deleteError.message);
    } else {
      toast.success(isPosted ? "Payment deleted" : "Draft Payment deleted");
      setDelPay(null);
      setDelReason("");
      qc.invalidateQueries({ queryKey: ["vendor", id] });
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
  };

  const postPaymentDirect = async (p: any) => {
    if (!user) return;
    const { error } = await supabase
      .from("vendor_payments")
      .update({
        status: "posted",
        posted_at: new Date().toISOString(),
      } as any)
      .eq("id", p.id)
      .eq("user_id", user.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Payment posted — balance updated");
      qc.invalidateQueries({ queryKey: ["vendor", id] });
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
  };

  const handleDeleteConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget) return;
    if (!masterPassword) {
      toast.error("Master password is required");
      return;
    }
    setIsDeleting(true);
    try {
      const { data: isValid, error: checkError } = await supabase.rpc("check_master_password", {
        p_user_id: user?.id || "",
        p_password: masterPassword,
      });

      if (checkError || !isValid) {
        throw new Error(checkError?.message || "Incorrect master password");
      }

      const { error: deleteError } = await supabase
        .from(deleteTarget.table as any)
        .delete()
        .eq("id", deleteTarget.id)
        .eq("user_id", user?.id || "");

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      toast.success("Audit log entry deleted successfully");
      setDeleteTarget(null);
      setMasterPassword("");
      qc.invalidateQueries({ queryKey: ["vendor", id] });
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsDeleting(false);
    }
  };

  const openEdit = (g: GRN) => {
    setEditGrn(g);
    setEditForm({
      grn_number: g.grn_number,
      grn_date: g.grn_date,
      material: g.material,
      quantity: g.quantity_formula ? `${g.quantity_formula} = ${g.quantity}` : String(g.quantity),
      unit: g.unit,
      unit_price: g.unit_price_formula
        ? `${g.unit_price_formula} = ${g.unit_price}`
        : String(g.unit_price),
      discount: g.discount_formula
        ? g.discount_formula.endsWith("%")
          ? g.discount_formula
          : `${g.discount_formula} = ${g.discount}`
        : String(g.discount ?? 0),
      tax: g.tax_formula
        ? g.tax_formula.endsWith("%")
          ? g.tax_formula
          : `${g.tax_formula} = ${g.tax}`
        : String(g.tax ?? 0),
      shipping: g.shipping_formula
        ? g.shipping_formula.endsWith("%")
          ? g.shipping_formula
          : `${g.shipping_formula} = ${g.shipping}`
        : String(g.shipping ?? 0),
      notes: g.notes ?? "",
    });
    setEditReason("");
  };

  const saveEdit = async () => {
    if (!editGrn || !user || !editForm) return;
    const targetNum = editForm.grn_number.trim();
    if (!targetNum) {
      toast.error("GRN number cannot be empty");
      return;
    }

    // Validate uniqueness of grn_number within activeBusinessId
    const { data: existing, error: checkError } = await supabase
      .from("vendor_grns")
      .select("id")
      .eq("business_id", editGrn.business_id)
      .eq("grn_number", targetNum)
      .neq("id", editGrn.id);

    if (checkError) {
      toast.error("Error checking GRN uniqueness: " + checkError.message);
      return;
    }
    if (existing && existing.length > 0) {
      toast.error(`GRN number "${targetNum}" is already in use. Please enter a unique GRN number.`);
      return;
    }

    const qty = parseMath(editForm.quantity) || 0;
    const price = parseMath(editForm.unit_price) || 0;
    const subtotal = qty * price;
    const discount = parsePercentageOrMath(editForm.discount, subtotal);
    const tax = parsePercentageOrMath(editForm.tax, subtotal);
    const shipping = parsePercentageOrMath(editForm.shipping, subtotal);
    const newTotal = subtotal - discount + tax + shipping;
    const isPosted = (editGrn.status || "posted") === "posted";
    if (isPosted) {
      if (editReason.trim().length < 5) {
        toast.error("Reason must be at least 5 characters");
        return;
      }
      await supabase.from("grn_amendments" as any).insert({
        user_id: user.id,
        grn_id: editGrn.id,
        reason: editReason.trim(),
        previous_total: editGrn.total_amount,
        new_total: newTotal,
        action: "edit",
      });
    }
    await supabase
      .from("vendor_grns")
      .update({
        grn_number: targetNum,
        grn_date: editForm.grn_date,
        material: editForm.material,
        quantity: qty,
        unit: editForm.unit,
        unit_price: price,
        discount: discount,
        tax: tax,
        shipping: shipping,
        total_amount: newTotal,
        notes: editForm.notes || null,
        quantity_formula: getFormulaPart(editForm.quantity),
        unit_price_formula: getFormulaPart(editForm.unit_price),
        discount_formula: getFormulaPart(editForm.discount),
        tax_formula: getFormulaPart(editForm.tax),
        shipping_formula: getFormulaPart(editForm.shipping),
      } as any)
      .eq("id", editGrn.id)
      .eq("user_id", user.id);
    toast.success(isPosted ? "GRN amended" : "GRN updated");
    setEditGrn(null);
    setEditReason("");
    qc.invalidateQueries({ queryKey: ["vendor", id] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const confirmDelete = async () => {
    if (!deleteGrn || !user) return;
    const isPosted = (deleteGrn.status || "posted") === "posted";
    if (isPosted && deleteReason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters");
      return;
    }
    if (isPosted) {
      await supabase.from("grn_amendments" as any).insert({
        user_id: user.id,
        grn_id: deleteGrn.id,
        reason: `[DELETED] ${deleteReason.trim()}`,
        previous_total: deleteGrn.total_amount,
        new_total: 0,
        action: "delete",
      });
    }
    await supabase.from("vendor_grns").delete().eq("id", deleteGrn.id).eq("user_id", user.id);
    toast.success("GRN deleted");
    setDeleteGrn(null);
    setDeleteReason("");
    qc.invalidateQueries({ queryKey: ["vendor", id] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const postGrnDirect = async (grn: GRN) => {
    if (!user) return;
    const { error } = await supabase
      .from("vendor_grns")
      .update({
        status: "posted",
        posted_at: new Date().toISOString(),
      } as any)
      .eq("id", grn.id)
      .eq("user_id", user.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("GRN posted — added to vendor balance");
      qc.invalidateQueries({ queryKey: ["vendor", id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
  };

  const printGrn = (grn: GRN) => {
    const displayQty = grn.quantity_formula
      ? `${grn.quantity_formula} = ${grn.quantity}`
      : grn.quantity;
    const displayUnitPrice = grn.unit_price_formula
      ? `${grn.unit_price_formula} = ${grn.unit_price}`
      : grn.unit_price;

    renderDocument({
      template: settings.default_doc_template as any,
      title: "Goods Received Note",
      number: grn.grn_number,
      date: grn.grn_date,
      currency: settings.currency,
      business: {
        name: settings.business_name,
        address: settings.business_address,
        phone: settings.business_phone,
        logo_url: settings.business_logo_url,
      },
      counterparty: {
        label: "Received From",
        name: data?.v?.name,
        address: data?.v?.address,
        phone: data?.v?.phone,
      },
      items: [
        {
          description: grn.material,
          quantity: displayQty,
          unit_price: displayUnitPrice,
          line_total: grn.quantity * grn.unit_price,
          unit: grn.unit,
        },
      ],
      subtotal: grn.quantity * grn.unit_price,
      tax: grn.tax || 0,
      shipping: grn.shipping || 0,
      discount: grn.discount,
      total: grn.total_amount,
      notes: grn.notes,
      showBalanceDue: false,
    });
  };

  if (!data?.v) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/vendors">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Vendors
          </Link>
        </Button>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{data.v.name}</h1>
            <p className="text-sm text-muted-foreground">
              {data.v.phone ?? ""} {data.v.email ? ` · ${data.v.email}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-4 py-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">We owe</span>
              <span className="figure text-xl font-semibold text-destructive">
                {formatMoney(data.owed, settings.currency)}
              </span>
            </div>
            {combinedHistory.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoryOpen(true)}
                className="flex items-center gap-1.5"
              >
                <History className="h-4 w-4" />
                View Change History
              </Button>
            )}
          </div>
        </div>
      </div>

      {maximizedCard && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
          onClick={() => setMaximizedCard(null)}
        />
      )}

      <div
        className={cn(
          "grid gap-6 min-w-0 w-full transition-all duration-300",
          maximizedCard ? "grid-cols-1" : "lg:grid-cols-2",
        )}
      >
        <Card
          className={cn(
            "min-w-0 transition-all duration-300 ease-in-out",
            maximizedCard === "grns"
              ? "fixed inset-4 md:inset-10 z-40 bg-card overflow-y-auto shadow-2xl border animate-in fade-in zoom-in-95"
              : maximizedCard === "payments"
                ? "hidden"
                : "relative",
          )}
        >
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle>Goods Received (GRNs)</CardTitle>
              <CardDescription>Material logged from this vendor</CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                asChild
                size="sm"
                className={isReadOnly ? "pointer-events-none opacity-50" : ""}
              >
                <Link to="/vendors/grn/new">
                  <Plus className="mr-1 h-4 w-4" />
                  New GRN
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setMaximizedCard(maximizedCard === "grns" ? null : "grns")}
                title={maximizedCard === "grns" ? "Minimize" : "Maximize"}
              >
                {maximizedCard === "grns" ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>GRN #</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-36 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.grns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                        No GRNs yet
                      </TableCell>
                    </TableRow>
                  )}
                  {data.grns.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="tabular">{formatDate(g.grn_date)}</TableCell>
                      <TableCell className="font-mono text-xs">{g.grn_number}</TableCell>
                      <TableCell>{g.material}</TableCell>
                      <TableCell>
                        <Badge
                          variant={(g.status || "posted") === "posted" ? "default" : "secondary"}
                          className="capitalize"
                        >
                          {g.status || "posted"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right figure">
                        {formatMoney(g.total_amount, settings.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {(g.status || "posted") === "draft" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => postGrnDirect(g)}
                              disabled={isReadOnly}
                              title="Post GRN"
                              className="text-primary hover:text-primary hover:bg-primary/10"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => printGrn(g)}
                            title="Print"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(g)}
                            disabled={isReadOnly}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setDeleteGrn(g);
                              setDeleteReason("");
                            }}
                            disabled={isReadOnly}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "min-w-0 transition-all duration-300 ease-in-out",
            maximizedCard === "payments"
              ? "fixed inset-4 md:inset-10 z-40 bg-card overflow-y-auto shadow-2xl border animate-in fade-in zoom-in-95"
              : maximizedCard === "grns"
                ? "hidden"
                : "relative",
          )}
        >
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle>Payments to vendor</CardTitle>
              <CardDescription>
                Money we have paid them — drafts can be updated/deleted freely
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Dialog open={payOpen} onOpenChange={setPayOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={isReadOnly}>
                    <Plus className="mr-1 h-4 w-4" />
                    Log Payment
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Log Payment to {data.v.name}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
                    <Field label="Amount">
                      <FormattedInput
                        mode="currency"
                        required
                        rawValue={pay.amount}
                        onRawChange={(raw) => setPay({ ...pay, amount: raw })}
                        placeholder="0.00"
                        autoFocus
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Date">
                        <Input
                          type="date"
                          required
                          value={pay.payment_date}
                          onChange={(e) => setPay({ ...pay, payment_date: e.target.value })}
                        />
                      </Field>
                      <Field label="Method">
                        <Select
                          value={pay.method}
                          onValueChange={(v) => setPay({ ...pay, method: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
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
                      <Select
                        value={pay.asset_id}
                        onValueChange={(v) => setPay({ ...pay, asset_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankCashAssets.map((asset) => (
                            <SelectItem key={asset.id} value={asset.id}>
                              {asset.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Reference">
                      <Input
                        value={pay.reference}
                        onChange={(e) => setPay({ ...pay, reference: e.target.value })}
                        placeholder="Cheque # / Txn ID"
                      />
                    </Field>
                    <Field label="Notes">
                      <Textarea
                        value={pay.notes}
                        onChange={(e) => setPay({ ...pay, notes: e.target.value })}
                      />
                    </Field>
                    <DialogFooter className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => logPayment("draft")}
                        disabled={isReadOnly}
                      >
                        Save as Draft
                      </Button>
                      <Button
                        type="button"
                        onClick={() => logPayment("posted")}
                        disabled={isReadOnly}
                      >
                        Post Payment
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setMaximizedCard(maximizedCard === "payments" ? null : "payments")}
                title={maximizedCard === "payments" ? "Minimize" : "Maximize"}
              >
                {maximizedCard === "payments" ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Withdrawal Account</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-36 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.pays.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                        No payments yet
                      </TableCell>
                    </TableRow>
                  )}
                  {data.pays.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="tabular">{formatDate(p.payment_date)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {p.method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium text-muted-foreground">
                        {p.assets?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.reference ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={(p.status || "posted") === "posted" ? "default" : "secondary"}
                          className="capitalize"
                        >
                          {p.status || "posted"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right figure text-success">
                        {formatMoney(p.amount, settings.currency)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          {(p.status || "posted") === "draft" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => postPaymentDirect(p)}
                              disabled={isReadOnly}
                              title="Post Payment"
                              className="text-primary hover:text-primary hover:bg-primary/10"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditPay(p)}
                            disabled={isReadOnly}
                            title="Edit / Amend"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setDelPay(p);
                              setDelReason("");
                            }}
                            disabled={isReadOnly}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit GRN dialog */}
      <Dialog open={!!editGrn} onOpenChange={(o) => !o && setEditGrn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit GRN {editGrn?.grn_number}</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="GRN #">
                  <Input
                    value={editForm.grn_number}
                    onChange={(e) => setEditForm({ ...editForm, grn_number: e.target.value })}
                  />
                </Field>
                <Field label="Date">
                  <Input
                    type="date"
                    value={editForm.grn_date}
                    onChange={(e) => setEditForm({ ...editForm, grn_date: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Material">
                <Input
                  value={editForm.material}
                  onChange={(e) => setEditForm({ ...editForm, material: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-4 gap-3">
                <Field label="Qty">
                  <Input
                    type="text"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                    onFocus={() =>
                      setEditForm({ ...editForm, quantity: formatOnFocus(editForm.quantity) })
                    }
                    onBlur={() =>
                      setEditForm({ ...editForm, quantity: formatOnBlur(editForm.quantity) })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setEditForm({ ...editForm, quantity: formatOnBlur(editForm.quantity) });
                        e.preventDefault();
                      }
                    }}
                  />
                </Field>
                <Field label="Unit">
                  <Input
                    value={editForm.unit}
                    onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                  />
                </Field>
                <Field label="Unit price">
                  <Input
                    type="text"
                    value={editForm.unit_price}
                    onChange={(e) => setEditForm({ ...editForm, unit_price: e.target.value })}
                    onFocus={() =>
                      setEditForm({ ...editForm, unit_price: formatOnFocus(editForm.unit_price) })
                    }
                    onBlur={() =>
                      setEditForm({ ...editForm, unit_price: formatOnBlur(editForm.unit_price) })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setEditForm({ ...editForm, unit_price: formatOnBlur(editForm.unit_price) });
                        e.preventDefault();
                      }
                    }}
                  />
                </Field>
                <Field label="Discount">
                  <Input
                    type="text"
                    value={editForm.discount}
                    onChange={(e) => setEditForm({ ...editForm, discount: e.target.value })}
                    onFocus={() =>
                      setEditForm({ ...editForm, discount: formatOnFocus(editForm.discount) })
                    }
                    onBlur={() => {
                      if (!editForm.discount.trim().endsWith("%")) {
                        setEditForm({ ...editForm, discount: formatOnBlur(editForm.discount) });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !editForm.discount.trim().endsWith("%")) {
                        setEditForm({ ...editForm, discount: formatOnBlur(editForm.discount) });
                        e.preventDefault();
                      }
                    }}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tax">
                  <Input
                    type="text"
                    value={editForm.tax}
                    onChange={(e) => setEditForm({ ...editForm, tax: e.target.value })}
                    onFocus={() => setEditForm({ ...editForm, tax: formatOnFocus(editForm.tax) })}
                    onBlur={() => {
                      if (!editForm.tax.trim().endsWith("%")) {
                        setEditForm({ ...editForm, tax: formatOnBlur(editForm.tax) });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !editForm.tax.trim().endsWith("%")) {
                        setEditForm({ ...editForm, tax: formatOnBlur(editForm.tax) });
                        e.preventDefault();
                      }
                    }}
                  />
                </Field>
                <Field label="Shipping / Freight">
                  <Input
                    type="text"
                    value={editForm.shipping}
                    onChange={(e) => setEditForm({ ...editForm, shipping: e.target.value })}
                    onFocus={() =>
                      setEditForm({ ...editForm, shipping: formatOnFocus(editForm.shipping) })
                    }
                    onBlur={() => {
                      if (!editForm.shipping.trim().endsWith("%")) {
                        setEditForm({ ...editForm, shipping: formatOnBlur(editForm.shipping) });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !editForm.shipping.trim().endsWith("%")) {
                        setEditForm({ ...editForm, shipping: formatOnBlur(editForm.shipping) });
                        e.preventDefault();
                      }
                    }}
                  />
                </Field>
              </div>
              <Field label="Notes">
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                />
              </Field>
              {(editGrn?.status || "posted") === "posted" && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Reason for change (required)
                  </Label>
                  <Textarea
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="e.g. Corrected quantity per weighbridge slip"
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGrn(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={isReadOnly}>
              Save amendment
            </Button>
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
            <Textarea
              autoFocus
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Reason for deletion"
              rows={4}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGrn(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isReadOnly}>
              Delete GRN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Amend payment dialog */}
      <Dialog open={!!editPay} onOpenChange={(v) => !v && setEditPay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {(editPay?.status || "posted") === "posted"
                ? "Amend Payment to Vendor"
                : "Edit Payment to Vendor"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {(editPay?.status || "posted") === "posted"
              ? "A reason is required for the audit trail. The vendor balance will be recalculated."
              : "Update the draft payment details."}
          </p>
          <div className="space-y-3 py-2">
            <Field label="Amount">
              <FormattedInput
                mode="currency"
                rawValue={editAmount}
                onRawChange={setEditAmount}
                placeholder="0.00"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <Input
                  type="date"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </Field>
              <Field label="Method">
                <Select value={editMethod} onValueChange={setEditMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
              <Select value={editAssetId} onValueChange={setEditAssetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {bankCashAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reference">
              <Input value={editReference} onChange={(e) => setEditReference(e.target.value)} />
            </Field>
            <Field label="Notes">
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </Field>
            {(editPay?.status || "posted") === "posted" && (
              <Field label="Reason">
                <Textarea
                  autoFocus
                  rows={3}
                  value={editPayReason}
                  onChange={(e) => setEditPayReason(e.target.value)}
                  placeholder="e.g. Corrected from bank statement"
                />
              </Field>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPay(null)}>
              Cancel
            </Button>
            <Button onClick={applyEditPay} disabled={isReadOnly}>
              Confirm changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete payment dialog */}
      <Dialog open={!!delPay} onOpenChange={(v) => !v && setDelPay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {(delPay?.status || "posted") === "posted"
                ? "Delete Payment to Vendor?"
                : "Delete Draft Payment?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {(delPay?.status || "posted") === "posted"
              ? "This will remove the payment and add it back to our owed balance. A reason is required."
              : "This will permanently delete this draft payment."}
          </p>
          {(delPay?.status || "posted") === "posted" && (
            <Field label="Reason">
              <Textarea
                autoFocus
                rows={3}
                value={delReason}
                onChange={(e) => setDelReason(e.target.value)}
                placeholder="Reason for deletion"
              />
            </Field>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelPay(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={applyDeletePay} disabled={isReadOnly}>
              Delete payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Privileged Deletion Challenge Modal */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setMasterPassword("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Confirm Privileged Deletion
            </DialogTitle>
            <DialogDescription>
              You are about to delete a change history entry:{" "}
              <strong>{deleteTarget?.reason}</strong>. This operation requires verification of the
              Master Password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDeleteConfirm} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="master-password-input">Master Password</Label>
              <Input
                id="master-password-input"
                type="password"
                required
                placeholder="Enter Master Password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteTarget(null);
                  setMasterPassword("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Unified Change History Modal */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Change History (Audit Trail)
            </DialogTitle>
            <DialogDescription>
              Chronological log of edits and deletions of posted GRNs and payments
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto flex-1 rounded-md border mt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Was</TableHead>
                  <TableHead className="text-right">Became</TableHead>
                  <TableHead className="text-right w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinedHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No changes found
                    </TableCell>
                  </TableRow>
                ) : (
                  combinedHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="tabular whitespace-nowrap">
                        {formatDate(item.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {item.type === "grn" ? "GRN" : "Payment"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={item.action === "delete" ? "destructive" : "secondary"}
                          className="capitalize"
                        >
                          {item.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={item.reason}>
                        {item.reason}
                      </TableCell>
                      <TableCell className="text-right figure">
                        {formatMoney(item.was, settings.currency)}
                      </TableCell>
                      <TableCell className="text-right figure font-medium">
                        {formatMoney(item.became, settings.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                          onClick={() => {
                            setDeleteTarget({
                              id: item.id,
                              reason: item.reason,
                              table: item.table,
                            });
                          }}
                          title="Delete entry"
                          disabled={isReadOnly}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>
              Close
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
