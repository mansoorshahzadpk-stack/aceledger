import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/amendments")({
  component: AuditLog,
  head: () => ({
    meta: [
      { title: "Audit Log — Ace Ledger" },
      { name: "description", content: "Chronological audit trail of amendments to invoices, payments, and master records." },
      { property: "og:title", content: "Audit Log — Ace Ledger" },
      { property: "og:description", content: "Chronological audit trail of amendments to invoices, payments, and master records." },
      { property: "og:url", content: "https://aceledger.top/amendments" },
    ],
    links: [{ rel: "canonical", href: "https://aceledger.top/amendments" }],
  }),
});

function AuditLog() {
  const { settings, user, activeBusinessId } = useApp();

  const { data } = useQuery({
    queryKey: ["amendments", user?.id, activeBusinessId],
    enabled: !!activeBusinessId && !!user,
    queryFn: async () => {
      const [{ data: inv }, { data: grn }, { data: pay }, { data: trf }, invDocs, grnDocs, payClients, assetDocs] = await Promise.all([
        supabase.from("invoice_amendments").select("*").eq("user_id", user?.id || "").order("created_at", { ascending: false }),
        supabase.from("grn_amendments").select("*").eq("user_id", user?.id || "").order("created_at", { ascending: false }),
        supabase.from("payment_amendments").select("*").eq("user_id", user?.id || "").order("created_at", { ascending: false }),
        supabase.from("transfer_logs" as any).select("*").eq("user_id", user?.id || "").order("created_at", { ascending: false }),
        supabase.from("invoices").select("id, invoice_number").eq("business_id", activeBusinessId || "").eq("user_id", user?.id || ""),
        supabase.from("vendor_grns").select("id, grn_number").eq("business_id", activeBusinessId || "").eq("user_id", user?.id || ""),
        supabase.from("clients").select("id, name").eq("business_id", activeBusinessId || "").eq("user_id", user?.id || ""),
        supabase.from("assets").select("id, name").eq("business_id", activeBusinessId || "").eq("user_id", user?.id || ""),
      ]);
      const invMap = new Map((invDocs.data ?? []).map((r) => [r.id, r.invoice_number]));
      const grnMap = new Map((grnDocs.data ?? []).map((r) => [r.id, r.grn_number]));
      const clMap = new Map((payClients.data ?? []).map((r) => [r.id, r.name]));
      const assetMap = new Map((assetDocs.data ?? []).map((r) => [r.id, r.name]));
      const rows = [
        ...(inv ?? [])
          .filter((a: any) => invMap.has(a.invoice_id))
          .map((a: any) => ({
            id: `i-${a.id}`, type: "Invoice", action: "edit", ref: invMap.get(a.invoice_id) ?? "—",
            link: `/invoices/${a.invoice_id}`, prev: a.previous_total, next: a.new_total,
            reason: a.reason, created_at: a.created_at,
          })),
        ...(grn ?? [])
          .filter((a: any) => grnMap.has(a.grn_id))
          .map((a: any) => ({
            id: `g-${a.id}`, type: "GRN", action: a.action, ref: grnMap.get(a.grn_id) ?? "—",
            link: null, prev: a.previous_total, next: a.new_total,
            reason: a.reason, created_at: a.created_at,
          })),
        ...(pay ?? [])
          .filter((a: any) => clMap.has(a.client_id))
          .map((a: any) => ({
            id: `p-${a.id}`, type: "Payment Received", action: a.action, ref: clMap.get(a.client_id) ?? "—",
            link: `/clients/${a.client_id}`, prev: a.previous_amount, next: a.new_amount,
            reason: a.reason, created_at: a.created_at,
          })),
        ...(trf ?? []).map((a: any) => ({
          id: `t-${a.id}`, type: "Fund Transfer", action: "transfer", ref: `${assetMap.get(a.from_asset_id) ?? "—"} ➔ ${assetMap.get(a.to_asset_id) ?? "—"}`,
          link: null, prev: 0, next: a.amount,
          reason: a.remarks || "Internal transfer of funds", created_at: a.created_at,
        })),
      ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      return rows;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">All amendments, deletions, and internal fund transfers tracked for audit transparency</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Recent activity</CardTitle><CardDescription>Newest first</CardDescription></CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Action</TableHead>
                <TableHead>Document</TableHead><TableHead>Reason</TableHead>
                <TableHead className="text-right">Was</TableHead><TableHead className="text-right">Became</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(data ?? []).length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No amendments yet</TableCell></TableRow>}
                {data?.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="tabular whitespace-nowrap">{formatDate(r.created_at)}</TableCell>
                    <TableCell><Badge variant="outline">{r.type}</Badge></TableCell>
                    <TableCell><Badge variant={r.action === "delete" ? "destructive" : "secondary"} className="capitalize">{r.action}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.link ? <Link to={r.link} className="hover:underline">{r.ref}</Link> : r.ref}
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={r.reason}>{r.reason}</TableCell>
                    <TableCell className="text-right figure">{formatMoney(r.prev, settings.currency)}</TableCell>
                    <TableCell className="text-right figure font-medium">{formatMoney(r.next, settings.currency)}</TableCell>
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
