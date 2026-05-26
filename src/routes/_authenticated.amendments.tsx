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
});

function AuditLog() {
  const { settings, user } = useApp();

  const { data } = useQuery({
    queryKey: ["amendments", user?.id],
    queryFn: async () => {
      const [{ data: inv }, { data: grn }, { data: pay }, invDocs, grnDocs, payClients] = await Promise.all([
        supabase.from("invoice_amendments").select("*").order("created_at", { ascending: false }),
        supabase.from("grn_amendments").select("*").order("created_at", { ascending: false }),
        supabase.from("payment_amendments").select("*").order("created_at", { ascending: false }),
        supabase.from("invoices").select("id, invoice_number"),
        supabase.from("vendor_grns").select("id, grn_number"),
        supabase.from("clients").select("id, name"),
      ]);
      const invMap = new Map((invDocs.data ?? []).map((r) => [r.id, r.invoice_number]));
      const grnMap = new Map((grnDocs.data ?? []).map((r) => [r.id, r.grn_number]));
      const clMap = new Map((payClients.data ?? []).map((r) => [r.id, r.name]));
      const rows = [
        ...(inv ?? []).map((a: any) => ({
          id: `i-${a.id}`, type: "Invoice", action: "edit", ref: invMap.get(a.invoice_id) ?? "—",
          link: `/invoices/${a.invoice_id}`, prev: a.previous_total, next: a.new_total,
          reason: a.reason, created_at: a.created_at,
        })),
        ...(grn ?? []).map((a: any) => ({
          id: `g-${a.id}`, type: "GRN", action: a.action, ref: grnMap.get(a.grn_id) ?? "—",
          link: null, prev: a.previous_total, next: a.new_total,
          reason: a.reason, created_at: a.created_at,
        })),
        ...(pay ?? []).map((a: any) => ({
          id: `p-${a.id}`, type: "Payment Received", action: a.action, ref: clMap.get(a.client_id) ?? "—",
          link: `/clients/${a.client_id}`, prev: a.previous_amount, next: a.new_amount,
          reason: a.reason, created_at: a.created_at,
        })),
      ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      return rows;
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">All amendments and deletions on posted invoices, GRNs and payments received</p>
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
