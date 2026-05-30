import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/pl")({
  component: PLPage,
  head: () => ({
    meta: [
      { title: "P&L Report — Ace Ledger" },
      { name: "description", content: "Profit and loss report grouped by day, week, month, quarter, or year." },
      { property: "og:title", content: "P&L Report — Ace Ledger" },
      { property: "og:description", content: "Profit and loss report grouped by day, week, month, quarter, or year." },
      { property: "og:url", content: "https://aceledger.top/reports/pl" },
    ],
    links: [{ rel: "canonical", href: "https://aceledger.top/reports/pl" }],
  }),
});

type GroupBy = "day" | "week" | "month" | "quarter" | "year";

function startOfPeriod(d: Date, g: GroupBy): string {
  const dt = new Date(d);
  if (g === "day") return dt.toISOString().slice(0, 10);
  if (g === "week") {
    const day = dt.getUTCDay(); const diff = (day + 6) % 7;
    dt.setUTCDate(dt.getUTCDate() - diff);
    return dt.toISOString().slice(0, 10);
  }
  if (g === "month") return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
  if (g === "quarter") return `${dt.getUTCFullYear()}-Q${Math.floor(dt.getUTCMonth() / 3) + 1}`;
  return String(dt.getUTCFullYear());
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function isoDaysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

function PLPage() {
  const { settings, user } = useApp();
  const c = settings.currency;
  const [from, setFrom] = useState(isoDaysAgo(90));
  const [to, setTo] = useState(todayISO());
  const [group, setGroup] = useState<GroupBy>("month");

  const preset = (kind: "month" | "quarter" | "year") => {
    const now = new Date();
    if (kind === "month") {
      setFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
      setTo(todayISO()); setGroup("day");
    } else if (kind === "quarter") {
      const q = Math.floor(now.getMonth() / 3);
      setFrom(new Date(now.getFullYear(), q * 3, 1).toISOString().slice(0, 10));
      setTo(todayISO()); setGroup("month");
    } else {
      setFrom(new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10));
      setTo(todayISO()); setGroup("month");
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["pl", user?.id, from, to],
    queryFn: async () => {
      const [{ data: invs }, { data: grns }] = await Promise.all([
        supabase.from("invoices").select("issue_date, total, status").eq("status", "posted").gte("issue_date", from).lte("issue_date", to),
        supabase.from("vendor_grns").select("grn_date, total_amount").gte("grn_date", from).lte("grn_date", to),
      ]);
      return { invs: invs ?? [], grns: grns ?? [] };
    },
    enabled: !!user,
  });

  const rows = useMemo(() => {
    const map = new Map<string, { revenue: number; cost: number }>();
    (data?.invs ?? []).forEach((i: any) => {
      const key = startOfPeriod(new Date(i.issue_date), group);
      const r = map.get(key) ?? { revenue: 0, cost: 0 };
      r.revenue += Number(i.total); map.set(key, r);
    });
    (data?.grns ?? []).forEach((g: any) => {
      const key = startOfPeriod(new Date(g.grn_date), group);
      const r = map.get(key) ?? { revenue: 0, cost: 0 };
      r.cost += Number(g.total_amount); map.set(key, r);
    });
    return Array.from(map.entries())
      .map(([period, v]) => ({ period, ...v, profit: v.revenue - v.cost, margin: v.revenue > 0 ? ((v.revenue - v.cost) / v.revenue) * 100 : 0 }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [data, group]);

  const totals = useMemo(() => {
    const rev = rows.reduce((s, r) => s + r.revenue, 0);
    const cost = rows.reduce((s, r) => s + r.cost, 0);
    return { revenue: rev, cost, profit: rev - cost, margin: rev > 0 ? ((rev - cost) / rev) * 100 : 0 };
  }, [rows]);

  const maxAbs = Math.max(1, ...rows.map((r) => Math.max(r.revenue, r.cost)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profit &amp; Loss</h1>
        <p className="text-sm text-muted-foreground">Revenue from posted invoices vs. cost from goods received</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            <Field label="Group by">
              <Select value={group} onValueChange={(v) => setGroup(v as GroupBy)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="quarter">Quarter</SelectItem>
                  <SelectItem value="year">Year</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Quick presets">
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => preset("month")}>Month</Button>
                <Button size="sm" variant="outline" onClick={() => preset("quarter")}>Quarter</Button>
                <Button size="sm" variant="outline" onClick={() => preset("year")}>Year</Button>
              </div>
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Revenue" value={formatMoney(totals.revenue, c)} icon={TrendingUp} tone="success" />
        <Kpi label="Cost (GRNs)" value={formatMoney(totals.cost, c)} icon={TrendingDown} tone="warning" />
        <Kpi label="Gross Profit" value={formatMoney(totals.profit, c)} icon={Wallet} tone={totals.profit >= 0 ? "success" : "destructive"} />
        <Kpi label="Margin" value={`${totals.margin.toFixed(1)}%`} icon={TrendingUp} tone={totals.margin >= 0 ? "success" : "destructive"} />
      </div>

      <Card>
        <CardHeader><CardTitle>Period breakdown</CardTitle><CardDescription>Bars compare revenue and cost per period</CardDescription></CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && rows.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No data in this range</p>}
          {rows.length > 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                {rows.map((r) => (
                  <div key={r.period} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{r.period}</span>
                      <span className="text-muted-foreground">Profit: <span className={r.profit >= 0 ? "text-success" : "text-destructive"}>{formatMoney(r.profit, c)}</span></span>
                    </div>
                    <div className="flex h-2 gap-0.5 overflow-hidden rounded">
                      <div className="bg-success/70" style={{ width: `${(r.revenue / maxAbs) * 50}%` }} title={`Revenue ${formatMoney(r.revenue, c)}`} />
                      <div className="bg-warning/70" style={{ width: `${(r.cost / maxAbs) * 50}%` }} title={`Cost ${formatMoney(r.cost, c)}`} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="overflow-auto rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Period</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Profit</TableHead><TableHead className="text-right">Margin</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.period}>
                        <TableCell className="tabular">{r.period}</TableCell>
                        <TableCell className="text-right figure">{formatMoney(r.revenue, c)}</TableCell>
                        <TableCell className="text-right figure">{formatMoney(r.cost, c)}</TableCell>
                        <TableCell className={`text-right figure font-medium ${r.profit >= 0 ? "text-success" : "text-destructive"}`}>{formatMoney(r.profit, c)}</TableCell>
                        <TableCell className="text-right figure">{r.margin.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: "success" | "warning" | "destructive" }) {
  const map = { success: "text-success bg-success/10", warning: "text-warning bg-warning/15", destructive: "text-destructive bg-destructive/10" } as const;
  return (
    <Card><CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 figure text-2xl font-semibold font-serif">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${map[tone]}`}><Icon className="h-5 w-5" /></div>
      </div>
    </CardContent></Card>
  );
}
