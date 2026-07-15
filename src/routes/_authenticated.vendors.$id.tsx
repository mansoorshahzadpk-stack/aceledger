import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useRef } from "react";
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
import { ArrowLeft, Plus, Printer, Pencil, Trash2, History, Send, Maximize2, Minimize2, ChevronDown, Package, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderDocument } from "@/lib/document-templates";
import {
  parseMath,
  parsePercentageOrMath,
  formatOnFocus,
  formatOnBlur,
  getFormulaPart,
  encodeFormula,
  decodeFormula,
} from "@/lib/math-parser";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";


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
  product_id?: string | null;
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
  details?: string | null;
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

  const handleExportLedger = async (format: "csv" | "xlsx" | "pdf") => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to export ledger");
        return;
      }
      
      const token = session.access_token;
      const params = new URLSearchParams({
        type: "vendor",
        id: id,
        format: format,
        business_id: activeBusinessId || ""
      });

      const baseUrl = `/client/api/export/ledger/index.php`;

      if (format === "pdf") {
        params.append("token", token);
        const url = `${baseUrl}?${params.toString()}`;
        const newWindow = window.open(url, "_blank");
        if (!newWindow) {
          toast.error("Popup blocked! Please allow popups for this site.");
        }
      } else {
        const url = `${baseUrl}?${params.toString()}`;
        const response = await fetch(url, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error("Export failed");
        }
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `vendor_ledger_${id}.${format === 'xlsx' ? 'xls' : format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
        toast.success("Ledger exported successfully");
      }
    } catch (err) {
      console.error(err);
      toast.error("Export failed. Please try again.");
    }
  };

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
  // Cache whether the vendor_payments table has a 'status' column.
  // Checked once at load time to avoid per-save round-trips.
  const hasStatusColRef = useRef<boolean | null>(null);

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
  const [openPickerIndex, setOpenPickerIndex] = useState<number | null>(null);

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
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });
  const [editForm, setEditForm] = useState<any>(null);
  const [editReason, setEditReason] = useState("");

  const [deleteGrn, setDeleteGrn] = useState<GRN | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const isDraft = editGrn && (editGrn.status || "posted") === "draft";

  const editSubtotal = useMemo(() => {
    if (!editForm) return 0;
    if (isDraft) {
      if (!editForm.items) return 0;
      return editForm.items.reduce((sum: number, it: any) => {
        const q = parseMath(it.quantity) || 0;
        const p = parseMath(it.unit_price) || 0;
        return sum + (q * p);
      }, 0);
    } else {
      const q = parseMath(editForm.quantity) || 0;
      const p = parseMath(editForm.unit_price) || 0;
      return q * p;
    }
  }, [editForm, isDraft]);

  const editDiscountNum = useMemo(() => {
    if (!editForm) return 0;
    return parsePercentageOrMath(editForm.discount, editSubtotal);
  }, [editForm?.discount, editSubtotal]);

  const editTaxNum = useMemo(() => {
    if (!editForm) return 0;
    const postDiscountSubtotal = editSubtotal - editDiscountNum;
    return parsePercentageOrMath(editForm.tax, postDiscountSubtotal);
  }, [editForm?.tax, editSubtotal, editDiscountNum]);

  const editShipNum = useMemo(() => {
    if (!editForm) return 0;
    return editForm.items.reduce((s: number, it: any) => {
      const rowSubtotal = (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0);
      return s + (parsePercentageOrMath(it.shipping || "0", rowSubtotal) || 0);
    }, 0);
  }, [editForm?.items]);

  const editTotal = useMemo(() => {
    return editSubtotal - editDiscountNum + editTaxNum + editShipNum;
  }, [editSubtotal, editDiscountNum, editTaxNum, editShipNum]);

  const setEditItem = (idx: number, patch: any) => {
    if (!editForm) return;
    const newItems = [...editForm.items];
    newItems[idx] = { ...newItems[idx], ...patch };
    setEditForm({ ...editForm, items: newItems });
  };

  const addEditItem = () => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      items: [
        ...editForm.items,
        {
          material: "",
          quantity: "0",
          unit: "kg",
          unit_price: "0",
          product_id: null,
          line_details: "",
        },
      ],
    });
  };

  const removeEditItem = (idx: number) => {
    if (!editForm || editForm.items.length <= 1) return;
    const newItems = editForm.items.filter((_: any, i: number) => i !== idx);
    setEditForm({ ...editForm, items: newItems });
  };

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
      // Payments: null status = legacy pre-column record → treat as posted for backwards compat.
      // Explicit "draft" status = intentionally not posted → exclude from balance.
      const paid = (pays ?? [])
        .filter((p: any) => (p.status ?? "posted") !== "draft")
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

    const basePayload: any = {
      user_id: user.id,
      business_id: activeBusinessId,
      vendor_id: id,
      amount: parseFloat(pay.amount) || 0,
      payment_date: pay.payment_date,
      method: pay.method as any,
      reference: pay.reference || null,
      notes: pay.notes || null,
      asset_id: pay.asset_id === "" ? null : pay.asset_id,
    };

    // Always send status explicitly so DB DEFAULT 'posted' is never triggered accidentally
    const payloadWithStatus = { ...basePayload, status };

    const { error } = await supabase.from("vendor_payments").insert(payloadWithStatus);

    if (error) {
      // Only retry without status if the error is specifically about the status column missing
      const isStatusColMissing =
        error.code === "42703" ||
        (error.message?.toLowerCase().includes("could not find") &&
          error.message?.toLowerCase().includes("status")) ||
        error.message?.toLowerCase().includes("schema cache");

      if (isStatusColMissing) {
        // Column doesn't exist — fall back to insert without status (legacy mode)
        const { error: retryError } = await supabase.from("vendor_payments").insert(basePayload);
        if (retryError) {
          toast.error(retryError.message);
          return;
        }
        // In legacy mode all payments count as posted (no draft support without the column)
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
    if (status === "posted") {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
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

  const openEdit = async (g: GRN) => {
    setEditGrn(g);
    
    // Fetch items
    const { data: itemsData } = await supabase
      .from("vendor_grn_items" as any)
      .select("*")
      .eq("grn_id", g.id);

    const items = itemsData || [];
    if (items.length === 0) {
      const qDec = decodeFormula(g.quantity_formula);
      const pDec = decodeFormula(g.unit_price_formula);
      const sDec = decodeFormula(g.shipping_formula);
      items.push({
        material: g.material,
        quantity: qDec ? `${qDec} = ${g.quantity}` : String(g.quantity),
        unit: g.unit,
        unit_price: pDec ? `${pDec} = ${g.unit_price}` : String(g.unit_price),
        product_id: g.product_id || null,
        line_details: (g as any).details || (g as any).vehicle_number || "",
        shipping: sDec
          ? sDec.endsWith("%")
            ? sDec
            : `${sDec} = ${g.shipping}`
          : String(g.shipping ?? 0),
      } as any);
    } else {
      items.forEach((it: any) => {
        const qDec = decodeFormula(it.quantity_formula);
        const pDec = decodeFormula(it.unit_price_formula);
        const sDec = decodeFormula(it.shipping_formula);
        it.quantity = qDec ? `${qDec} = ${it.quantity}` : String(it.quantity);
        it.unit_price = pDec ? `${pDec} = ${it.unit_price}` : String(it.unit_price);
        it.line_details = it.line_details || it.vehicle_number || "";
        it.shipping = sDec
          ? sDec.endsWith("%")
            ? sDec
            : `${sDec} = ${it.shipping}`
          : String(it.shipping ?? 0);
      });
    }

    const dDec = decodeFormula(g.discount_formula);
    const tDec = decodeFormula(g.tax_formula);
    const sDecMain = decodeFormula(g.shipping_formula);
    const qDecMain = decodeFormula(g.quantity_formula);
    const pDecMain = decodeFormula(g.unit_price_formula);

    setEditForm({
      grn_number: g.grn_number,
      grn_date: g.grn_date,
      details: (g as any).details || (g as any).vehicle_number || "",
      notes: g.notes ?? "",
      discount: dDec
        ? dDec.endsWith("%")
          ? dDec
          : `${dDec} = ${g.discount}`
        : String(g.discount ?? 0),
      tax: tDec
        ? tDec.endsWith("%")
          ? tDec
          : `${tDec} = ${g.tax}`
        : String(g.tax ?? 0),
      shipping: sDecMain
        ? sDecMain.endsWith("%")
          ? sDecMain
          : `${sDecMain} = ${g.shipping}`
        : String(g.shipping ?? 0),
      items: items,
      material: g.material,
      quantity: qDecMain ? `${qDecMain} = ${g.quantity}` : String(g.quantity),
      unit: g.unit,
      unit_price: pDecMain
        ? `${pDecMain} = ${g.unit_price}`
        : String(g.unit_price),
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

    const isPosted = (editGrn.status || "posted") === "posted";

    if (isDraft) {
      // 1. Delete and insert items
      const { error: delError } = await supabase
        .from("vendor_grn_items" as any)
        .delete()
        .eq("grn_id", editGrn.id);

      if (delError) {
        toast.error("Failed to delete old GRN items: " + delError.message);
        return;
      }

      const insertItems = editForm.items.map((it: any) => {
        const rowSubtotal = (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0);
        return {
          grn_id: editGrn.id,
          product_id: it.product_id || null,
          material: it.material,
          quantity: parseMath(it.quantity) || 0,
          unit: it.unit,
          unit_price: parseMath(it.unit_price) || 0,
          quantity_formula: encodeFormula(getFormulaPart(it.quantity)),
          unit_price_formula: encodeFormula(getFormulaPart(it.unit_price)),
          line_details: it.line_details || null,
          shipping: parsePercentageOrMath(it.shipping || "0", rowSubtotal) || 0,
          shipping_formula: encodeFormula(getFormulaPart(it.shipping)),
        };
      });

      let { error: insError } = await supabase
        .from("vendor_grn_items" as any)
        .insert(insertItems);

      if (insError && (insError.message.includes("shipping_formula") || insError.message.includes("column"))) {
        const fallbackInsertItems = editForm.items.map((it: any) => {
          const rowSubtotal = (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0);
          return {
            grn_id: editGrn.id,
            product_id: it.product_id || null,
            material: it.material,
            quantity_formula: encodeFormula(getFormulaPart(it.quantity)),
            unit_price_formula: encodeFormula(getFormulaPart(it.unit_price)),
            line_details: it.line_details || null,
            shipping: parsePercentageOrMath(it.shipping || "0", rowSubtotal) || 0,
          };
        });
        let fallbackRes = await supabase
          .from("vendor_grn_items" as any)
          .insert(fallbackInsertItems);
        insError = fallbackRes.error;
      }

      if (insError && (insError.message.includes("shipping") || insError.message.includes("column"))) {
        const fallbackInsertItems = editForm.items.map((it: any) => ({
          grn_id: editGrn.id,
          product_id: it.product_id || null,
          material: it.material,
          quantity: parseMath(it.quantity) || 0,
          unit: it.unit,
          unit_price: parseMath(it.unit_price) || 0,
          quantity_formula: encodeFormula(getFormulaPart(it.quantity)),
          unit_price_formula: encodeFormula(getFormulaPart(it.unit_price)),
          line_details: it.line_details || null,
        }));
        let fallbackRes = await supabase
          .from("vendor_grn_items" as any)
          .insert(fallbackInsertItems);
        insError = fallbackRes.error;
      }

      if (insError && (insError.message.includes("line_details") || insError.message.includes("column"))) {
        const fallbackInsertItems = editForm.items.map((it: any) => ({
          grn_id: editGrn.id,
          product_id: it.product_id || null,
          material: it.material,
          quantity: parseMath(it.quantity) || 0,
          unit: it.unit,
          unit_price: parseMath(it.unit_price) || 0,
          quantity_formula: encodeFormula(getFormulaPart(it.quantity)),
          unit_price_formula: encodeFormula(getFormulaPart(it.unit_price)),
          vehicle_number: it.line_details || null,
        }));
        let fallbackRes = await supabase
          .from("vendor_grn_items" as any)
          .insert(fallbackInsertItems);
        insError = fallbackRes.error;
      }

      if (insError) {
        toast.error("Failed to insert GRN items: " + insError.message);
        return;
      }

      // 2. Update parent header
      const firstItem = editForm.items[0];
      const qtySum = editForm.items.reduce((s: number, it: any) => s + (parseMath(it.quantity) || 0), 0);
      const materialsJoined = editForm.items.map((it: any) => it.material).join(", ");
      const detailsJoined = editForm.items
        .map((it: any) => it.line_details?.trim())
        .filter((v: string) => !!v)
        .filter((v: string, idx: number, arr: string[]) => arr.indexOf(v) === idx)
        .join(", ");

      let { error: updateError } = await supabase
        .from("vendor_grns")
        .update({
          grn_number: targetNum,
          grn_date: editForm.grn_date,
          material: materialsJoined,
          quantity: qtySum,
          unit: firstItem?.unit || "kg",
          unit_price: parseMath(firstItem?.unit_price) || 0,
          discount: editDiscountNum,
          tax: editTaxNum,
          shipping: editShipNum,
          total_amount: editTotal,
          notes: editForm.notes || null,
          quantity_formula: encodeFormula(getFormulaPart(firstItem?.quantity)),
          unit_price_formula: encodeFormula(getFormulaPart(firstItem?.unit_price)),
          discount_formula: encodeFormula(getFormulaPart(editForm.discount)),
          tax_formula: encodeFormula(getFormulaPart(editForm.tax)),
          shipping_formula: encodeFormula(getFormulaPart(editForm.shipping)),
          details: detailsJoined || null,
        } as any)
        .eq("id", editGrn.id)
        .eq("user_id", user.id);

      if (updateError && (updateError.message.includes("details") || updateError.message.includes("column"))) {
        const fallbackRes = await supabase
          .from("vendor_grns")
          .update({
            grn_number: targetNum,
            grn_date: editForm.grn_date,
            material: materialsJoined,
            quantity: qtySum,
            unit: firstItem?.unit || "kg",
            unit_price: parseMath(firstItem?.unit_price) || 0,
            discount: editDiscountNum,
            tax: editTaxNum,
            shipping: editShipNum,
            total_amount: editTotal,
            notes: editForm.notes || null,
            quantity_formula: encodeFormula(getFormulaPart(firstItem?.quantity)),
            unit_price_formula: encodeFormula(getFormulaPart(firstItem?.unit_price)),
            discount_formula: encodeFormula(getFormulaPart(editForm.discount)),
            tax_formula: encodeFormula(getFormulaPart(editForm.tax)),
            shipping_formula: encodeFormula(getFormulaPart(editForm.shipping)),
            vehicle_number: detailsJoined || null,
          } as any)
          .eq("id", editGrn.id)
          .eq("user_id", user.id);
        updateError = fallbackRes.error;
      }

      if (updateError) {
        toast.error("Failed to update GRN header: " + updateError.message);
        return;
      }
    } else {
      // Posted GRN path
      const qty = parseMath(editForm.quantity) || 0;
      const price = parseMath(editForm.unit_price) || 0;
      const subtotal = qty * price;
      const discount = parsePercentageOrMath(editForm.discount, subtotal);
      const tax = parsePercentageOrMath(editForm.tax, subtotal);
      const shipping = parsePercentageOrMath(editForm.shipping, subtotal);
      const newTotal = subtotal - discount + tax + shipping;

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

      let { error: updateError } = await supabase
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
          quantity_formula: encodeFormula(getFormulaPart(editForm.quantity)),
          unit_price_formula: encodeFormula(getFormulaPart(editForm.unit_price)),
          discount_formula: encodeFormula(getFormulaPart(editForm.discount)),
          tax_formula: encodeFormula(getFormulaPart(editForm.tax)),
          shipping_formula: encodeFormula(getFormulaPart(editForm.shipping)),
          details: editForm.details || null,
        } as any)
        .eq("id", editGrn.id)
        .eq("user_id", user.id);

      if (updateError && (updateError.message.includes("details") || updateError.message.includes("column"))) {
        const fallbackRes = await supabase
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
            quantity_formula: encodeFormula(getFormulaPart(editForm.quantity)),
            unit_price_formula: encodeFormula(getFormulaPart(editForm.unit_price)),
            discount_formula: encodeFormula(getFormulaPart(editForm.discount)),
            tax_formula: encodeFormula(getFormulaPart(editForm.tax)),
            shipping_formula: encodeFormula(getFormulaPart(editForm.shipping)),
            vehicle_number: editForm.details || null,
          } as any)
          .eq("id", editGrn.id)
          .eq("user_id", user.id);
        updateError = fallbackRes.error;
      }

      if (updateError) {
        toast.error("Failed to update GRN: " + updateError.message);
        return;
      }
    }

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

  const printGrn = async (grn: GRN) => {
    // Fetch items
    const { data: itemsData } = await supabase
      .from("vendor_grn_items" as any)
      .select("*")
      .eq("grn_id", grn.id);

    const items = itemsData || [];
    const docItems = items.length > 0 ? items.map((it: any) => ({
      description: it.material,
      quantity: (() => {
        const fExpr = decodeFormula(it.quantity_formula);
        return fExpr ? `${fExpr} = ${it.quantity}` : it.quantity;
      })(),
      unit_price: (() => {
        const fExpr = decodeFormula(it.unit_price_formula);
        return fExpr ? `${fExpr} = ${it.unit_price}` : it.unit_price;
      })(),
      line_total: it.quantity * it.unit_price,
      unit: it.unit,
      vehicle_ref: it.line_details || it.vehicle_number || (grn as any).details || (grn as any).vehicle_number,
      shipping: it.shipping,
      shipping_formula: it.shipping_formula,
    })) : [
      {
        description: grn.material,
        quantity: (() => {
          const fExpr = decodeFormula(grn.quantity_formula);
          return fExpr ? `${fExpr} = ${grn.quantity}` : grn.quantity;
        })(),
        unit_price: (() => {
          const fExpr = decodeFormula(grn.unit_price_formula);
          return fExpr ? `${fExpr} = ${grn.unit_price}` : grn.unit_price;
        })(),
        line_total: grn.quantity * grn.unit_price,
        unit: grn.unit,
        vehicle_ref: (grn as any).details || (grn as any).vehicle_number,
        shipping: grn.shipping,
        shipping_formula: grn.shipping_formula,
      }
    ];

    renderDocument({
      template: settings.default_doc_template as any,
      title: "Goods Received Note",
      number: grn.grn_number,
      date: grn.grn_date,
      currency: settings.currency,
      vehicle_number: (grn as any).details || (grn as any).vehicle_number,
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
      items: docItems,
      subtotal: items.length > 0 ? items.reduce((sum: number, it: any) => sum + (it.quantity * it.unit_price), 0) : (grn.quantity * grn.unit_price),
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
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExportLedger("xlsx")}
        >
          <Download className="mr-1 h-3.5 w-3.5" />
          Excel Ledger
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExportLedger("csv")}
        >
          <Download className="mr-1 h-3.5 w-3.5" />
          CSV Ledger
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExportLedger("pdf")}
        >
          <Printer className="mr-1 h-3.5 w-3.5" />
          PDF Ledger
        </Button>
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
                <DialogContent className="max-w-4xl lg:max-w-5xl w-[90vw]">
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
        <DialogContent className="max-w-4xl lg:max-w-5xl w-[90vw]">
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

              {isDraft ? (
                // Multi-item editing workspace
                <div className="space-y-3 border p-3 rounded-md bg-muted/5">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Items</Label>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs px-2" onClick={addEditItem}>
                      + Add Item
                    </Button>
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {editForm.items.map((it: any, idx: number) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex gap-2 items-start border p-2.5 rounded-md relative group transition-all duration-300",
                          idx % 2 === 1
                            ? "bg-muted/50 dark:bg-muted/20 border-border"
                            : "bg-background border-border"
                        )}
                      >
                        <div className="flex-1 grid grid-cols-12 gap-2">
                          <div className="col-span-8">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Material</Label>
                            <div className="flex gap-1.5">
                              <Input
                                value={it.material}
                                onChange={(e) => setEditItem(idx, { material: e.target.value, product_id: null })}
                                placeholder="Material name"
                                className="h-8 text-xs flex-1"
                              />
                              <Popover open={openPickerIndex === idx} onOpenChange={(open) => setOpenPickerIndex(open ? idx : null)}>
                                <PopoverTrigger asChild>
                                  <Button type="button" variant="outline" size="icon" className="h-8 w-8 px-0 shrink-0" title="Pick from catalog">
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-0" align="end">
                                  <Command>
                                    <CommandInput placeholder="Search materials…" />
                                    <CommandList>
                                      <CommandEmpty>
                                        No materials found. Add some in{" "}
                                        <a className="underline" href="/materials">
                                          Materials
                                        </a>
                                        .
                                      </CommandEmpty>
                                      <CommandGroup>
                                        {materials?.map((m) => (
                                          <CommandItem
                                            key={m.id}
                                            value={`${m.name} ${m.sku ?? ""}`}
                                            onSelect={() => {
                                              setEditItem(idx, {
                                                material: m.name,
                                                product_id: m.id,
                                                unit: m.unit,
                                                unit_price: m.default_price ? String(m.default_price) : "0",
                                              });
                                              setOpenPickerIndex(null);
                                            }}
                                          >
                                            <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                                            <div className="flex w-full items-center justify-between">
                                              <div>
                                                <div className="font-medium text-xs">{m.name}</div>
                                                {m.sku && (
                                                  <div className="text-[10px] text-muted-foreground">
                                                    {m.sku} · {m.unit}
                                                  </div>
                                                )}
                                              </div>
                                              <div className="figure text-xs font-mono">
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
                            </div>
                          </div>
                          <div className="col-span-4">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Details</Label>
                            <Input
                              value={it.line_details ?? ""}
                              onChange={(e) => setEditItem(idx, { line_details: e.target.value })}
                              placeholder="e.g., Vehicle No, Driver, or notes..."
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="col-span-3">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Qty</Label>
                            <Input
                              value={it.quantity}
                              onChange={(e) => setEditItem(idx, { quantity: e.target.value })}
                              onFocus={() => setEditItem(idx, { quantity: formatOnFocus(it.quantity) })}
                              onBlur={() => setEditItem(idx, { quantity: formatOnBlur(it.quantity) })}
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Unit</Label>
                            <Input
                              value={it.unit}
                              onChange={(e) => setEditItem(idx, { unit: e.target.value })}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="col-span-4">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Unit Price</Label>
                            <Input
                              value={it.unit_price}
                              onChange={(e) => setEditItem(idx, { unit_price: e.target.value })}
                              onFocus={() => setEditItem(idx, { unit_price: formatOnFocus(it.unit_price) })}
                              onBlur={() => setEditItem(idx, { unit_price: formatOnBlur(it.unit_price) })}
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                          <div className="col-span-3">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Shipping / Freight</Label>
                            <Input
                              value={it.shipping ?? "0"}
                              onChange={(e) => setEditItem(idx, { shipping: e.target.value })}
                              onFocus={() => setEditItem(idx, { shipping: formatOnFocus(it.shipping ?? "0") })}
                              onBlur={() => setEditItem(idx, { shipping: formatOnBlur(it.shipping ?? "0", (parseMath(it.quantity) || 0) * (parseMath(it.unit_price) || 0)) })}
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                        </div>
                        {editForm.items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 h-8 w-8 self-end mt-4"
                            onClick={() => removeEditItem(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                // Single item editing for legacy/posted GRNs
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <Field label="Material">
                        <Input
                          value={editForm.material}
                          onChange={(e) => setEditForm({ ...editForm, material: e.target.value })}
                        />
                      </Field>
                    </div>
                    <div className="col-span-1">
                      <Field label="Details">
                        <Input
                          value={editForm.details}
                          onChange={(e) => setEditForm({ ...editForm, details: e.target.value })}
                          placeholder="e.g., Vehicle No, Driver, or notes..."
                        />
                      </Field>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
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
                  </div>
                </>
              )}

              <div className="grid grid-cols-3 gap-3">
                <Field label="Discount">
                  <Input
                    type="text"
                    value={editForm.discount}
                    onChange={(e) => setEditForm({ ...editForm, discount: e.target.value })}
                    onFocus={() =>
                      setEditForm({ ...editForm, discount: formatOnFocus(editForm.discount) })
                    }
                    onBlur={() =>
                      setEditForm({ ...editForm, discount: formatOnBlur(editForm.discount, editSubtotal) })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setEditForm({ ...editForm, discount: formatOnBlur(editForm.discount, editSubtotal) });
                        e.preventDefault();
                      }
                    }}
                    className="text-right font-mono"
                  />
                </Field>
                <Field label="Tax">
                  <Input
                    type="text"
                    value={editForm.tax}
                    onChange={(e) => setEditForm({ ...editForm, tax: e.target.value })}
                    onFocus={() => setEditForm({ ...editForm, tax: formatOnFocus(editForm.tax) })}
                    onBlur={() =>
                      setEditForm({ ...editForm, tax: formatOnBlur(editForm.tax, editSubtotal - editDiscountNum) })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setEditForm({ ...editForm, tax: formatOnBlur(editForm.tax, editSubtotal - editDiscountNum) });
                        e.preventDefault();
                      }
                    }}
                    className="text-right font-mono"
                  />
                </Field>
                <Field label="Shipping / Freight">
                  <Input
                    type="text"
                    disabled
                    readOnly
                    value={formatMoney(editShipNum, settings.currency)}
                    className="bg-muted text-muted-foreground cursor-not-allowed text-right font-mono"
                  />
                </Field>
              </div>
              <Field label="Notes">
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                />
              </Field>

              <div className="flex justify-between items-center text-sm font-semibold border-t pt-2 mt-2">
                <span>Grand Total:</span>
                <span className="figure text-base text-primary">
                  {formatMoney(editTotal, settings.currency)}
                </span>
              </div>

              {!isDraft && (
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
              {isDraft ? "Save Draft" : "Save Amendment"}
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
        <DialogContent className="max-w-4xl lg:max-w-5xl w-[90vw]">
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
