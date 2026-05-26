import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { Package, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: InventoryPage,
  head: () => ({
    meta: [
      { title: "Inventory — Ace Ledger" },
      { name: "description", content: "Live stock-on-hand by material, computed from GRNs and invoice usage." },
      { property: "og:title", content: "Inventory — Ace Ledger" },
      { property: "og:description", content: "Live stock-on-hand by material, computed from GRNs and invoice usage." },
      { property: "og:url", content: "https://aceledger.lovable.app/inventory" },
    ],
    links: [{ rel: "canonical", href: "https://aceledger.lovable.app/inventory" }],
  }),
});

type Material = { id: string; name: string; sku: string | null; unit: string };
type GRN = { id: string; product_id: string | null; material: string; quantity: number; unit: string; unit_price: number; total_amount: number };
type InvItem = { id: string; product_id: string | null; quantity: number; description: string; invoice_id: string };
type Inv = { id: string; status: string };

function InventoryPage() {
  const { settings, user } = useApp();
  const c = settings.currency;

  const { data, isLoading } = useQuery({
    queryKey: ["inventory", user?.id],
    queryFn: async () => {
      const [{ data: materials }, { data: grns }, { data: items }, { data: invs }] = await Promise.all([
        supabase.from("products" as any).select("id, name, sku, unit").order("name"),
        supabase.from("vendor_grns").select("id, product_id, material, quantity, unit, unit_price, total_amount"),
        supabase.from("invoice_items").select("id, product_id, quantity, description, invoice_id"),
        supabase.from("invoices").select("id, status"),
      ]);
      return {
        materials: (materials ?? []) as unknown as Material[],
        grns: (grns ?? []) as unknown as GRN[],
        items: (items ?? []) as unknown as InvItem[],
        invs: (invs ?? []) as unknown as Inv[],
      };
    },
    enabled: !!user,
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const postedInv = new Set(data.invs.filter((i) => i.status === "posted").map((i) => i.id));

    type Agg = { id: string; name: string; sku: string | null; unit: string; received: number; delivered: number; receivedValue: number };
    const map = new Map<string, Agg>();

    data.materials.forEach((m) => {
      map.set(m.id, { id: m.id, name: m.name, sku: m.sku, unit: m.unit, received: 0, delivered: 0, receivedValue: 0 });
    });

    data.grns.forEach((g) => {
      const key = g.product_id ?? `_name:${(g.material || "").toLowerCase().trim()}`;
      let row = map.get(key);
      if (!row) {
        row = { id: key, name: g.material || "(unlinked)", sku: null, unit: g.unit, received: 0, delivered: 0, receivedValue: 0 };
        map.set(key, row);
      }
      row.received += Number(g.quantity);
      row.receivedValue += Number(g.total_amount);
    });

    data.items.forEach((it) => {
      if (!postedInv.has(it.invoice_id)) return; // only posted invoices consume inventory
      const key = it.product_id ?? `_name:${(it.description || "").toLowerCase().trim().split(" (")[0]}`;
      const row = map.get(key);
      if (row) row.delivered += Number(it.quantity);
    });

    return Array.from(map.values())
      .map((r) => {
        const onHand = r.received - r.delivered;
        const avgCost = r.received > 0 ? r.receivedValue / r.received : 0;
        return { ...r, onHand, avgCost, value: onHand * avgCost };
      })
      .sort((a, b) => b.onHand - a.onHand);
  }, [data]);

  const totals = useMemo(() => ({
    materials: rows.length,
    onHandValue: rows.reduce((s, r) => s + Math.max(0, r.value), 0),
    overDelivered: rows.filter((r) => r.onHand < 0).length,
  }), [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-sm text-muted-foreground">Material received from vendors minus delivered to clients (via posted invoices)</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Materials tracked</p><p className="mt-2 figure text-2xl font-semibold font-serif">{totals.materials}</p></div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Package className="h-5 w-5" /></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div><p className="text-xs uppercase tracking-wide text-muted-foreground">On-hand value</p><p className="mt-2 figure text-2xl font-semibold font-serif">{formatMoney(totals.onHandValue, c)}</p></div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success"><Package className="h-5 w-5" /></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Over-delivered</p><p className="mt-2 figure text-2xl font-semibold font-serif">{totals.overDelivered}</p><p className="mt-1 text-xs text-muted-foreground">Materials with negative on-hand</p></div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/15 text-warning"><AlertTriangle className="h-5 w-5" /></div>
          </div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Material balances</CardTitle>
          <CardDescription>
            Anything received from a vendor that has not yet been billed to a client shows here at the vendor cost.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Material</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">On-hand</TableHead>
                <TableHead className="text-right">Avg cost</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No materials yet</TableCell></TableRow>}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.sku ?? "—"}</TableCell>
                    <TableCell className="text-right figure">{r.received.toLocaleString("en-US", { maximumFractionDigits: 2 })} {r.unit}</TableCell>
                    <TableCell className="text-right figure">{r.delivered.toLocaleString("en-US", { maximumFractionDigits: 2 })} {r.unit}</TableCell>
                    <TableCell className={`text-right figure font-semibold ${r.onHand < 0 ? "text-destructive" : r.onHand === 0 ? "text-muted-foreground" : "text-success"}`}>
                      {r.onHand.toLocaleString("en-US", { maximumFractionDigits: 2 })} {r.unit}
                      {r.onHand < 0 && <Badge variant="destructive" className="ml-2">over-delivered</Badge>}
                    </TableCell>
                    <TableCell className="text-right figure">{formatMoney(r.avgCost, c)}</TableCell>
                    <TableCell className="text-right figure">{formatMoney(Math.max(0, r.value), c)}</TableCell>
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
