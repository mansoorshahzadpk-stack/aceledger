import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { Package, AlertTriangle, Download, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: InventoryPage,
  head: () => ({
    meta: [
      { title: "Inventory — Ace Ledger" },
      {
        name: "description",
        content: "Live stock-on-hand by material, computed from GRNs and invoice usage.",
      },
      { property: "og:title", content: "Inventory — Ace Ledger" },
      {
        property: "og:description",
        content: "Live stock-on-hand by material, computed from GRNs and invoice usage.",
      },
      { property: "og:url", content: "https://aceledger.top/inventory" },
    ],
    links: [{ rel: "canonical", href: "https://aceledger.top/inventory" }],
  }),
});

type Material = { id: string; name: string; sku: string | null; unit: string };
type GRNHeader = {
  id: string;
  status: string;
  grn_number: string | null;
  grn_date: string | null;
  vendor_id: string | null;
  created_at: string | null;
};
type GRNItem = {
  id: string;
  grn_id: string;
  product_id: string | null;
  material: string;
  quantity: number;
  unit: string;
  unit_price: number;
  shipping: number;
  line_details: string | null;
};
type InvItem = {
  id: string;
  product_id: string | null;
  quantity: number;
  description: string;
  invoice_id: string;
  vehicle_ref: string | null;
};
type Inv = {
  id: string;
  status: string;
  invoice_number: string | null;
  issue_date: string | null;
  client_id: string | null;
  created_at: string | null;
};
type Vendor = { id: string; name: string };
type Client = { id: string; name: string };

function InventoryPage() {
  const { settings, user, activeBusinessId } = useApp();
  const c = settings.currency;
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["inventory", user?.id, activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId || !user) return {
        materials: [], grnItems: [], grnHeaders: [], items: [], invs: [], vendors: [], clients: [],
      };

      const { data: invs } = await supabase
        .from("invoices")
        .select("id, status, invoice_number, issue_date, client_id, created_at")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user.id);
      const invoiceIds = invs?.map((i) => i.id) || [];

      const { data: grnHeaders } = await supabase
        .from("vendor_grns")
        .select("id, status, grn_number, grn_date, vendor_id, created_at")
        .eq("business_id", activeBusinessId)
        .eq("user_id", user.id);
      const grnIds = grnHeaders?.map((g) => g.id) || [];

      const [
        { data: materials },
        { data: grnItems },
        { data: items },
        { data: vendors },
        { data: clients },
      ] = await Promise.all([
        supabase
          .from("products" as any)
          .select("id, name, sku, unit")
          .eq("business_id", activeBusinessId)
          .eq("user_id", user.id)
          .order("name"),
        grnIds.length > 0
          ? supabase
              .from("vendor_grn_items" as any)
              .select("id, grn_id, product_id, material, quantity, unit, unit_price, shipping, line_details")
              .in("grn_id", grnIds)
          : Promise.resolve({ data: [] }),
        invoiceIds.length > 0
          ? supabase
              .from("invoice_items")
              .select("id, product_id, quantity, description, invoice_id, vehicle_ref")
              .in("invoice_id", invoiceIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from("vendors")
          .select("id, name")
          .eq("business_id", activeBusinessId)
          .eq("user_id", user.id),
        supabase
          .from("clients")
          .select("id, name")
          .eq("business_id", activeBusinessId)
          .eq("user_id", user.id),
      ]);

      return {
        materials: (materials ?? []) as unknown as Material[],
        grnItems: (grnItems ?? []) as unknown as GRNItem[],
        grnHeaders: (grnHeaders ?? []) as unknown as GRNHeader[],
        items: (items ?? []) as unknown as InvItem[],
        invs: (invs ?? []) as unknown as Inv[],
        vendors: (vendors ?? []) as unknown as Vendor[],
        clients: (clients ?? []) as unknown as Client[],
      };
    },
    enabled: !!user,
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const postedInv = new Set(data.invs.filter((i) => i.status === "posted").map((i) => i.id));
    const postedGrns = new Set(data.grnHeaders.filter((g) => (g.status || "posted") === "posted").map((g) => g.id));

    type Agg = {
      id: string;
      name: string;
      sku: string | null;
      unit: string;
      received: number;
      delivered: number;
      receivedValue: number;
    };
    const map = new Map<string, Agg>();

    data.materials.forEach((m) => {
      map.set(m.id, {
        id: m.id,
        name: m.name,
        sku: m.sku,
        unit: m.unit,
        received: 0,
        delivered: 0,
        receivedValue: 0,
      });
    });

    data.grnItems.forEach((gi) => {
      if (!postedGrns.has(gi.grn_id)) return;
      const nameClean = (gi.material || "").toLowerCase().trim().split(" (")[0];
      const key = gi.product_id ?? `_name:${nameClean}`;
      let row = map.get(key);
      if (!row) {
        row = {
          id: key,
          name: gi.material || "(unlinked)",
          sku: null,
          unit: gi.unit,
          received: 0,
          delivered: 0,
          receivedValue: 0,
        };
        map.set(key, row);
      }
      row.received += Number(gi.quantity || 0);
      const itemSubtotal = Number(gi.quantity || 0) * Number(gi.unit_price || 0);
      const itemShipping = Number(gi.shipping ?? 0);
      row.receivedValue += (itemSubtotal + itemShipping);
    });

    data.items.forEach((it) => {
      if (!postedInv.has(it.invoice_id)) return;
      const key =
        it.product_id ?? `_name:${(it.description || "").toLowerCase().trim().split(" (")[0]}`;
      const row = map.get(key);
      if (row) row.delivered += Number(it.quantity || 0);
    });

    return Array.from(map.values())
      .map((r) => {
        const onHand = r.received - r.delivered;
        const avgCost = r.received > 0 ? r.receivedValue / r.received : 0;
        return { ...r, onHand, avgCost, value: onHand * avgCost };
      })
      .sort((a, b) => b.onHand - a.onHand);
  }, [data]);

  const totals = useMemo(
    () => ({
      materials: rows.length,
      onHandValue: rows.reduce((s, r) => s + Math.max(0, r.value), 0),
      overDelivered: rows.filter((r) => r.onHand < 0).length,
    }),
    [rows],
  );

  // ─── Export Logic ────────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (!data) return;
    setExporting(true);
    try {
      const vendorMap = new Map<string, string>(
        data.vendors.map((v) => [v.id, v.name]),
      );
      const clientMap = new Map<string, string>(
        data.clients.map((cl) => [cl.id, cl.name]),
      );
      const grnHeaderMap = new Map<string, GRNHeader>(
        data.grnHeaders.map((g) => [g.id, g]),
      );
      const invMap = new Map<string, Inv>(
        data.invs.map((inv) => [inv.id, inv]),
      );
      const postedGrns = new Set(
        data.grnHeaders
          .filter((g) => (g.status || "posted") === "posted")
          .map((g) => g.id),
      );
      const postedInv = new Set(
        data.invs.filter((i) => i.status === "posted").map((i) => i.id),
      );

      // Build per-material key resolver (same as rows useMemo)
      const materialKeyByName = new Map<string, string>();
      const materialNameById = new Map<string, string>();
      data.materials.forEach((m) => {
        materialKeyByName.set(m.name.toLowerCase().trim(), m.id);
        materialNameById.set(m.id, m.name);
      });

      // Build canonical name for a key
      const resolveName = (key: string, fallback: string): string => {
        if (materialNameById.has(key)) return materialNameById.get(key)!;
        return fallback;
      };

      // Collect all ledger entries (INWARD from GRN items, OUTWARD from Invoice items)
      type LedgerEntry = {
        date: string;
        sortKey: string;
        materialKey: string;
        materialName: string;
        type: "INWARD (GRN)" | "OUTWARD (Invoice)";
        reference: string;
        party: string;
        details: string;
        qtyIn: number;
        qtyOut: number;
      };

      const entries: LedgerEntry[] = [];

      data.grnItems.forEach((gi) => {
        if (!postedGrns.has(gi.grn_id)) return;
        const header = grnHeaderMap.get(gi.grn_id);
        if (!header) return;
        const nameClean = (gi.material || "").toLowerCase().trim().split(" (")[0];
        const key = gi.product_id ?? `_name:${nameClean}`;
        const displayName = resolveName(key, gi.material || "(unlinked)");
        const date = header.grn_date || header.created_at?.slice(0, 10) || "";
        entries.push({
          date,
          sortKey: date + "_grn_" + gi.id,
          materialKey: key,
          materialName: displayName,
          type: "INWARD (GRN)",
          reference: header.grn_number || header.id.slice(0, 8).toUpperCase(),
          party: header.vendor_id ? (vendorMap.get(header.vendor_id) || header.vendor_id) : "—",
          details: gi.line_details || "",
          qtyIn: Number(gi.quantity || 0),
          qtyOut: 0,
        });
      });

      data.items.forEach((it) => {
        if (!postedInv.has(it.invoice_id)) return;
        const inv = invMap.get(it.invoice_id);
        if (!inv) return;
        const key =
          it.product_id ??
          `_name:${(it.description || "").toLowerCase().trim().split(" (")[0]}`;
        const displayName = resolveName(key, it.description || "(unlinked)");
        const date = inv.issue_date || inv.created_at?.slice(0, 10) || "";
        entries.push({
          date,
          sortKey: date + "_inv_" + it.id,
          materialKey: key,
          materialName: displayName,
          type: "OUTWARD (Invoice)",
          reference: inv.invoice_number || inv.id.slice(0, 8).toUpperCase(),
          party: inv.client_id ? (clientMap.get(inv.client_id) || inv.client_id) : "—",
          details: (it as any).vehicle_ref || "",
          qtyIn: 0,
          qtyOut: Number(it.quantity || 0),
        });
      });

      // Sort by date then sub-sort by id for stable ordering
      entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

      // Compute running balance per material
      const runningBalance = new Map<string, number>();

      type ExportRow = {
        "Date": string;
        "Material / SKU": string;
        "Transaction Type": string;
        "Reference #": string;
        "Party Name": string;
        "Details / Vehicle": string;
        "Quantity In": number | string;
        "Quantity Out": number | string;
        "Running Balance": number;
      };

      const exportRows: ExportRow[] = entries.map((e) => {
        const prev = runningBalance.get(e.materialKey) ?? 0;
        const newBalance = prev + e.qtyIn - e.qtyOut;
        runningBalance.set(e.materialKey, newBalance);

        return {
          "Date": e.date,
          "Material / SKU": e.materialName,
          "Transaction Type": e.type,
          "Reference #": e.reference,
          "Party Name": e.party,
          "Details / Vehicle": e.details,
          "Quantity In": e.qtyIn > 0 ? e.qtyIn : "",
          "Quantity Out": e.qtyOut > 0 ? e.qtyOut : "",
          "Running Balance": newBalance,
        };
      });

      if (exportRows.length === 0) {
        // Add a placeholder row if no data
        exportRows.push({
          "Date": "",
          "Material / SKU": "No transactions found",
          "Transaction Type": "",
          "Reference #": "",
          "Party Name": "",
          "Details / Vehicle": "",
          "Quantity In": "",
          "Quantity Out": "",
          "Running Balance": 0,
        });
      }

      // Build workbook
      const wb = XLSX.utils.book_new();

      // Sheet 1: Ledger
      const ws1 = XLSX.utils.json_to_sheet(exportRows);

      // Column widths
      ws1["!cols"] = [
        { wch: 12 }, // Date
        { wch: 20 }, // Material
        { wch: 20 }, // Transaction Type
        { wch: 18 }, // Reference #
        { wch: 22 }, // Party Name
        { wch: 24 }, // Details
        { wch: 16 }, // Qty In
        { wch: 16 }, // Qty Out
        { wch: 18 }, // Running Balance
      ];

      XLSX.utils.book_append_sheet(wb, ws1, "Inventory Ledger");

      // Sheet 2: Summary
      const summaryRows = rows.map((r) => ({
        "Material": r.name,
        "SKU": r.sku ?? "—",
        "Total Received": r.received,
        "Total Delivered": r.delivered,
        "On-hand": r.onHand,
        "Avg Cost": parseFloat(r.avgCost.toFixed(2)),
        "Value": parseFloat(Math.max(0, r.value).toFixed(2)),
      }));
      const ws2 = XLSX.utils.json_to_sheet(summaryRows);
      ws2["!cols"] = [
        { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, ws2, "Summary");

      // Download
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Inventory-Audit-Report-${today}.xlsx`);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [data, rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-sm text-muted-foreground">
          Material received from vendors minus delivered to clients (via posted invoices)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Materials tracked
                </p>
                <p className="mt-2 figure text-2xl font-semibold font-serif">{totals.materials}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Package className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  On-hand value
                </p>
                <p className="mt-2 figure text-2xl font-semibold font-serif">
                  {formatMoney(totals.onHandValue, c)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
                <Package className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Over-delivered
                </p>
                <p className="mt-2 figure text-2xl font-semibold font-serif">
                  {totals.overDelivered}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Materials with negative on-hand
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/15 text-warning">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Material balances</CardTitle>
              <CardDescription className="mt-1">
                Anything received from a vendor that has not yet been billed to a client shows here at
                the vendor cost.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 shrink-0 self-start"
              onClick={handleExport}
              disabled={exporting || isLoading || !data}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {exporting ? "Generating…" : "Export Audit Report"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">On-hand</TableHead>
                  <TableHead className="text-right">Avg cost</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No materials yet
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.sku ?? "—"}</TableCell>
                    <TableCell className="text-right figure">
                      {r.received.toLocaleString("en-US", { maximumFractionDigits: 2 })} {r.unit}
                    </TableCell>
                    <TableCell className="text-right figure">
                      {r.delivered.toLocaleString("en-US", { maximumFractionDigits: 2 })} {r.unit}
                    </TableCell>
                    <TableCell
                      className={`text-right figure font-semibold ${r.onHand < 0 ? "text-destructive" : r.onHand === 0 ? "text-muted-foreground" : "text-success"}`}
                    >
                      {r.onHand.toLocaleString("en-US", { maximumFractionDigits: 2 })} {r.unit}
                      {r.onHand < 0 && (
                        <Badge variant="destructive" className="ml-2">
                          over-delivered
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right figure">{formatMoney(r.avgCost, c)}</TableCell>
                    <TableCell className="text-right figure">
                      {formatMoney(Math.max(0, r.value), c)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
