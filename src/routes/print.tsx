import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { buildDocumentHtml } from "@/lib/document-templates";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Info, X, FileText } from "lucide-react";

const printSearchSchema = z.object({
  type: z.enum(["invoice", "grn"]),
  id: z.string(),
});

export const Route = createFileRoute("/print")({
  validateSearch: printSearchSchema,
  component: PrintPage,
});

function PrintPage() {
  const navigate = useNavigate();
  const { user, loadingAuth, settings } = useApp();
  const { type, id } = Route.useSearch();
  const [deviceType, setDeviceType] = useState<"ios" | "android" | "desktop">("desktop");
  const [showTips, setShowTips] = useState(true);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1)) {
      setDeviceType("ios");
    } else if (/android/i.test(ua)) {
      setDeviceType("android");
    } else {
      setDeviceType("desktop");
    }
  }, []);

  // Enforce authentication
  useEffect(() => {
    if (!loadingAuth && !user) {
      navigate({ to: "/login", replace: true });
    }
  }, [user, loadingAuth, navigate]);

  // Fetch document details
  const { data, isLoading, error } = useQuery({
    queryKey: ["print-doc", type, id],
    queryFn: async () => {
      if (type === "invoice") {
        const [{ data: inv, error: invErr }, { data: its, error: itsErr }] = await Promise.all([
          supabase.from("invoices").select("*, clients(*)").eq("id", id).single(),
          supabase.from("invoice_items").select("*").eq("invoice_id", id).order("sort_order"),
        ]);
        if (invErr) throw invErr;
        if (itsErr) throw itsErr;
        return { type, doc: inv, items: its };
      } else if (type === "grn") {
        const { data: grn, error: grnErr } = await supabase
          .from("vendor_grns")
          .select("*, vendors(*)")
          .eq("id", id)
          .single();
        if (grnErr) throw grnErr;
        return { type, doc: grn };
      }
      throw new Error("Invalid document type");
    },
    enabled: !!user && !!type && !!id,
  });

  // Automatically open the print dialog when the document is ready
  useEffect(() => {
    if (data) {
      const timer = setTimeout(() => {
        window.print();
      }, 800); // Give fonts/styles a moment to settle
      return () => clearTimeout(timer);
    }
  }, [data]);

  if (loadingAuth || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground bg-background">
        Loading document…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-md mx-auto text-center space-y-3 bg-background">
        <h1 className="text-lg font-semibold text-destructive">Failed to load document</h1>
        <p className="text-sm text-muted-foreground">{(error as any).message || "An unexpected error occurred."}</p>
        <Button onClick={() => window.history.back()}>Go Back</Button>
      </div>
    );
  }

  if (!data) return null;

  // Construct data input for document template
  let docInput;
  if (data.type === "invoice") {
    const inv = data.doc;
    docInput = {
      template: inv.doc_template as any,
      title: "Invoice",
      number: inv.invoice_number,
      date: inv.issue_date,
      due_date: inv.due_date,
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
      items: data.items.map((it: any) => ({
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        line_total: it.line_total,
        unit: it.unit,
        grn_ref: it.grn_ref,
        vehicle_ref: it.vehicle_ref,
      })),
      subtotal: inv.subtotal,
      tax: inv.tax,
      shipping: inv.shipping,
      total: inv.total,
      notes: inv.notes,
      status: inv.status,
    };
  } else {
    const grn = data.doc;
    docInput = {
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
        name: grn.vendors?.name,
        address: grn.vendors?.address,
        phone: grn.vendors?.phone,
      },
      items: [
        {
          description: grn.material,
          quantity: grn.quantity,
          unit_price: grn.unit_price,
          line_total: grn.total_amount,
          unit: grn.unit,
        },
      ],
      subtotal: grn.total_amount,
      tax: 0,
      shipping: 0,
      total: grn.total_amount,
      notes: grn.notes,
      showBalanceDue: false,
    };
  }

  const htmlContent = buildDocumentHtml(docInput);

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-900 pb-12">
      {/* Floating print action bar (hidden during print) */}
      <div className="print-toolbar no-print sticky top-0 z-50 flex items-center justify-between gap-3 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md border-b px-4 py-3 shadow-sm">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      {/* Helper banner for saving vector PDF (hidden during print) */}
      {showTips && (
        <div className="no-print max-w-4xl mx-auto mt-4 px-4">
          <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-blue-900 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-200 animate-in fade-in duration-300">
            <button
              onClick={() => setShowTips(false)}
              className="absolute right-3 top-3 rounded-md p-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex gap-3 pr-6">
              <div className="mt-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 p-1 text-blue-700 dark:text-blue-300">
                <Info className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> How to Download as High-Quality PDF
                </h3>
                <div className="mt-2 text-xs leading-relaxed space-y-1.5 text-blue-800 dark:text-blue-300">
                  {deviceType === "ios" && (
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Tap the <strong>Print / Save as PDF</strong> button above.</li>
                      <li>In the system print sheet that opens, <strong>pinch outwards (zoom in)</strong> on the page thumbnail with two fingers.</li>
                      <li>This converts it to a vector PDF! Tap the <strong>Share</strong> button and choose <strong>Save to Files</strong>.</li>
                    </ol>
                  )}
                  {deviceType === "android" && (
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Tap the <strong>Print / Save as PDF</strong> button above.</li>
                      <li>At the top of the print screen, select the printer dropdown and choose <strong>Save as PDF</strong>.</li>
                      <li>Tap the circular <strong>PDF button</strong> to save it directly to your downloads.</li>
                    </ol>
                  )}
                  {deviceType === "desktop" && (
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Click the <strong>Print / Save as PDF</strong> button above.</li>
                      <li>In the browser's print preview dialog, change the <strong>Destination</strong> to <strong>Save as PDF</strong>.</li>
                      <li>Click <strong>Save</strong> to download the PDF with selectable, copyable text.</li>
                    </ol>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Styled document view */}
      <div className="document-container max-w-4xl mx-auto my-6 bg-white shadow-lg border rounded-xl overflow-hidden">
        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
              .no-print { display: none !important; }
              body { padding: 0 !important; margin: 0 !important; background: #ffffff !important; }
              .document-container { max-w-none !important; width: 100% !important; margin: 0 !important; border: 0 !important; box-shadow: none !important; border-radius: 0 !important; }
            }
          `
        }} />
        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      </div>
    </div>
  );
}
