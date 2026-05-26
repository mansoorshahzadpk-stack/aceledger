import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney, formatDate } from "@/lib/format";
import { TrendingDown, TrendingUp, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — Ace Ledger" },
      { name: "description", content: "Executive dashboard for outstanding receivables, vendor payables, and weekly collections in your B2B ledger." },
      { property: "og:title", content: "Dashboard — Ace Ledger" },
      { property: "og:description", content: "Executive dashboard for outstanding receivables, vendor payables, and weekly collections in your B2B ledger." },
      { property: "og:url", content: "https://aceledger.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://aceledger.lovable.app/" }],
  }),
});

function Dashboard() {
  const { settings, user } = useApp();
  const c = settings.currency;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: async () => {
      const [clients, invoices, cpay, vendors, grns, vpay] = await Promise.all([
        supabase.from("clients").select("id, opening_balance"),
        supabase.from("invoices").select("id, total, status, client_id"),
        supabase.from("client_payments").select("id, amount, payment_date, method, client_id, clients(name)").order("payment_date", { ascending: false }).limit(20),
        supabase.from("vendors").select("id, opening_balance"),
        supabase.from("vendor_grns").select("id, total_amount"),
        supabase.from("vendor_payments").select("id, amount"),
      ]);
      const clientOpening = (clients.data ?? []).reduce((s, x) => s + Number(x.opening_balance), 0);
      const postedTotal = (invoices.data ?? []).filter((i) => i.status === "posted").reduce((s, x) => s + Number(x.total), 0);
      const paidIn = (cpay.data ?? []).reduce((s, x) => s + Number(x.amount), 0);
      const outstanding = clientOpening + postedTotal - paidIn;

      const vendorOpening = (vendors.data ?? []).reduce((s, x) => s + Number(x.opening_balance), 0);
      const grnTotal = (grns.data ?? []).reduce((s, x) => s + Number(x.total_amount), 0);
      const paidOut = (vpay.data ?? []).reduce((s, x) => s + Number(x.amount), 0);
      const owed = vendorOpening + grnTotal - paidOut;

      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const weekCollections = (cpay.data ?? []).filter((p) => new Date(p.payment_date) >= weekAgo)
        .reduce((s, x) => s + Number(x.amount), 0);

      return { outstanding, owed, weekCollections, recent: cpay.data ?? [], counts: { clients: clients.data?.length ?? 0, vendors: vendors.data?.length ?? 0, invoices: invoices.data?.length ?? 0 } };
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Executive Dashboard</h1>
        <p className="text-sm text-muted-foreground">Real-time inflow, outflow, and weekly collections</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Outstanding from Industries"
          value={formatMoney(data?.outstanding ?? 0, c)}
          hint={`${data?.counts.clients ?? 0} active clients`}
          tone="warning"
          icon={ArrowDownRight}
        />
        <KpiCard
          label="Owed to Vendors"
          value={formatMoney(data?.owed ?? 0, c)}
          hint={`${data?.counts.vendors ?? 0} vendors`}
          tone="destructive"
          icon={ArrowUpRight}
        />
        <KpiCard
          label="Collections (last 7 days)"
          value={formatMoney(data?.weekCollections ?? 0, c)}
          hint="Weekly installments received"
          tone="success"
          icon={TrendingUp}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent Weekly Collections</CardTitle>
            <CardDescription>Latest installments received from industry clients</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm"><Link to="/clients">View clients</Link></Button>
        </CardHeader>
        <CardContent>
          <div className="max-h-[420px] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/60">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && data?.recent.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No payments yet. Head to <Link to="/clients" className="underline">Clients</Link> and log a weekly installment.
                  </TableCell></TableRow>
                )}
                {data?.recent.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="tabular">{formatDate(p.payment_date)}</TableCell>
                    <TableCell>{p.clients?.name ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{p.method}</Badge></TableCell>
                    <TableCell className="text-right figure font-medium text-success">{formatMoney(p.amount, c)}</TableCell>
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

function KpiCard({ label, value, hint, tone, icon: Icon }: {
  label: string; value: string; hint: string; tone: "success" | "warning" | "destructive"; icon: any;
}) {
  const colorMap = {
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/15",
    destructive: "text-destructive bg-destructive/10",
  } as const;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 figure text-2xl font-semibold font-serif">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorMap[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
