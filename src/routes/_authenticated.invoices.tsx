import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatDate } from "@/lib/format";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/invoices")({
  component: InvoicesPage,
});

function InvoicesPage() {
  const { settings, user } = useApp();
  const [filter, setFilter] = useState<"all" | "draft" | "posted">("all");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", user?.id],
    queryFn: async () => (await supabase.from("invoices").select("*, clients(name)").order("issue_date", { ascending: false })).data ?? [],
    enabled: !!user,
  });

  const filtered = (invoices ?? []).filter((i) => filter === "all" || i.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">Drafts and posted invoices</p>
        </div>
        <Button asChild><Link to="/invoices/new"><Plus className="mr-2 h-4 w-4" />New Invoice</Link></Button>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all">All ({invoices?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="draft">Drafts ({(invoices ?? []).filter((i) => i.status === "draft").length})</TabsTrigger>
          <TabsTrigger value="posted">Posted ({(invoices ?? []).filter((i) => i.status === "posted").length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader><CardTitle>Invoice list</CardTitle><CardDescription>Drafts don't affect customer balance until posted</CardDescription></CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>#</TableHead><TableHead>Client</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
                {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No invoices</TableCell></TableRow>}
                {filtered.map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell className="tabular">{formatDate(i.issue_date)}</TableCell>
                    <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
                    <TableCell>{i.clients?.name ?? "—"}</TableCell>
                    <TableCell><Badge variant={i.status === "posted" ? "default" : "secondary"} className="capitalize">{i.status}</Badge></TableCell>
                    <TableCell className="text-right figure">{formatMoney(i.total, settings.currency)}</TableCell>
                    <TableCell className="text-right"><Button asChild variant="ghost" size="sm"><Link to="/invoices/$id" params={{ id: i.id }}>Open</Link></Button></TableCell>
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
