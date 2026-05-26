import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from "recharts";

export const Route = createFileRoute("/_authenticated/reports/analytics")({
  component: AnalyticsPage,
});

const COLORS = ["#6366f1", "#06b6d4", "#f97316", "#ec4899", "#10b981", "#eab308", "#8b5cf6", "#ef4444"];
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

function AnalyticsPage() {
  const { settings, user } = useApp();
  const [from, setFrom] = useState(daysAgo(90));
  const [to, setTo] = useState(today());

  const { data } = useQuery({
    queryKey: ["analytics", user?.id, from, to],
    queryFn: async () => {
      const [{ data: grns }, { data: invs }, { data: pays }, { data: vendors }, { data: clients }] = await Promise.all([
        supabase.from("vendor_grns").select("*").gte("grn_date", from).lte("grn_date", to),
        supabase.from("invoices").select("*").gte("issue_date", from).lte("issue_date", to),
        supabase.from("client_payments").select("*").gte("payment_date", from).lte("payment_date", to),
        supabase.from("vendors").select("id, name"),
        supabase.from("clients").select("id, name"),
      ]);
      return { grns: grns ?? [], invs: invs ?? [], pays: pays ?? [], vendors: vendors ?? [], clients: clients ?? [] };
    },
    enabled: !!user,
  });

  const series = useMemo(() => {
    if (!data) return [];
    const rangeDays = Math.max(1, Math.ceil((+new Date(to) - +new Date(from)) / 86400000));
    const bucket = rangeDays > 365 ? "month" : rangeDays > 60 ? "week" : "day";
    const keyOf = (s: string) => {
      const d = new Date(s);
      if (bucket === "day") return d.toISOString().slice(0, 10);
      if (bucket === "week") { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); return x.toISOString().slice(0, 10); }
      return d.toISOString().slice(0, 7);
    };
    const map = new Map<string, { date: string; supplies: number; invoiced: number; received: number }>();
    const ensure = (k: string) => { if (!map.has(k)) map.set(k, { date: k, supplies: 0, invoiced: 0, received: 0 }); return map.get(k)!; };
    data.grns.forEach((g: any) => { ensure(keyOf(g.grn_date)).supplies += Number(g.total_amount); });
    data.invs.filter((i: any) => i.status === "posted").forEach((i: any) => { ensure(keyOf(i.issue_date)).invoiced += Number(i.total); });
    data.pays.forEach((p: any) => { ensure(keyOf(p.payment_date)).received += Number(p.amount); });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, from, to]);

  const topVendors = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, number>();
    data.grns.forEach((g: any) => m.set(g.vendor_id, (m.get(g.vendor_id) ?? 0) + Number(g.total_amount)));
    return Array.from(m.entries()).map(([id, value]) => ({ name: data.vendors.find((v) => v.id === id)?.name ?? "—", value }))
      .sort((a, b) => b.value - a.value).slice(0, 5);
  }, [data]);

  const topClients = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, number>();
    data.invs.filter((i: any) => i.status === "posted").forEach((i: any) => m.set(i.client_id, (m.get(i.client_id) ?? 0) + Number(i.total)));
    return Array.from(m.entries()).map(([id, value]) => ({ name: data.clients.find((c) => c.id === id)?.name ?? "—", value }))
      .sort((a, b) => b.value - a.value).slice(0, 5);
  }, [data]);

  const materialMix = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, number>();
    data.grns.forEach((g: any) => m.set(g.material, (m.get(g.material) ?? 0) + Number(g.quantity)));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [data]);

  const totals = useMemo(() => {
    if (!data) return { supplies: 0, invoiced: 0, received: 0 };
    return {
      supplies: data.grns.reduce((s, g: any) => s + Number(g.total_amount), 0),
      invoiced: data.invs.filter((i: any) => i.status === "posted").reduce((s, i: any) => s + Number(i.total), 0),
      received: data.pays.reduce((s, p: any) => s + Number(p.amount), 0),
    };
  }, [data]);

  const tooltipMoney = (v: any) => formatMoney(Number(v), settings.currency);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Select a date range to analyse supplies, sales and money flow</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Date range</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wide text-muted-foreground">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wide text-muted-foreground">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => { setFrom(daysAgo(30)); setTo(today()); }}>Last 30 days</Button>
            <Button variant="outline" size="sm" onClick={() => { setFrom(daysAgo(90)); setTo(today()); }}>Last 90 days</Button>
            <Button variant="outline" size="sm" onClick={() => { const d = new Date(); setFrom(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)); setTo(today()); }}>This month</Button>
            <Button variant="outline" size="sm" onClick={() => { const d = new Date(); setFrom(new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10)); setTo(today()); }}>This year</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Supplies received" value={formatMoney(totals.supplies, settings.currency)} />
        <StatCard label="Invoiced (posted)" value={formatMoney(totals.invoiced, settings.currency)} />
        <StatCard label="Payments received" value={formatMoney(totals.received, settings.currency)} />
      </div>

      <Card>
        <CardHeader><CardTitle>Money flow over time</CardTitle><CardDescription>Invoiced vs received</CardDescription></CardHeader>
        <CardContent style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={tooltipMoney} />
              <Legend />
              <Line type="monotone" dataKey="invoiced" stroke="#6366f1" strokeWidth={2} />
              <Line type="monotone" dataKey="received" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Supplies received</CardTitle></CardHeader>
        <CardContent style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={tooltipMoney} />
              <Bar dataKey="supplies" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Top vendors (by supplies)</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topVendors} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                <Tooltip formatter={tooltipMoney} />
                <Bar dataKey="value" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top clients (by invoiced)</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topClients} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                <Tooltip formatter={tooltipMoney} />
                <Bar dataKey="value" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Material mix (by quantity)</CardTitle></CardHeader>
        <CardContent style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={materialMix} dataKey="value" nameKey="name" innerRadius={50} outerRadius={110} label>
                {materialMix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="figure mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
