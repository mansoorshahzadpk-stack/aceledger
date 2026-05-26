import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { CURRENCY_LABELS, type CurrencyCode } from "@/lib/format";
import { toast } from "sonner";
import type { DocTemplate, UiTheme } from "@/lib/app-context";
import { Upload, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

const TEMPLATES: { id: DocTemplate; name: string; desc: string }[] = [
  { id: "acelog", name: "Acelog (Recommended)", desc: "Clean header, balance-due card, GRN/vehicle refs per line — matches the supplied sample" },
  { id: "classic", name: "Classic Professional", desc: "Serif typography, double-rule headers, traditional invoice feel" },
  { id: "modern", name: "Modern Minimalist", desc: "Clean sans-serif, generous whitespace, contemporary look" },
  { id: "compact", name: "Compact / High-Density", desc: "Maximum info per page, ideal for itemised bills" },
];

function SettingsPage() {
  const { settings, updateSettings, user } = useApp();
  const [bizName, setBizName] = useState(settings.business_name ?? "");
  const [bizAddr, setBizAddr] = useState(settings.business_address ?? "");
  const [bizPhone, setBizPhone] = useState(settings.business_phone ?? "");
  const [seeding, setSeeding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveBiz = async () => {
    await updateSettings({ business_name: bizName || null, business_address: bizAddr || null, business_phone: bizPhone || null });
    toast.success("Business details saved");
  };

  const uploadLogo = async (file: File) => {
    if (!user) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be 2 MB or smaller"); return; }
    if (!/^image\/(png|jpeg|jpg|webp|svg\+xml)$/.test(file.type)) { toast.error("Use PNG, JPG, WebP, or SVG"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("business-assets").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("business-assets").getPublicUrl(path);
      await updateSettings({ business_logo_url: pub.publicUrl });
      toast.success("Logo uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeLogo = async () => {
    await updateSettings({ business_logo_url: null });
    toast.success("Logo removed");
  };

  const seedDemo = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      const { data: existing } = await supabase.from("vendors").select("id").limit(1);
      if (existing && existing.length > 0) { toast.info("Demo data already loaded — skipping"); setSeeding(false); return; }

      const vendors = [
        { name: "Khan Cotton Mills", contact_person: "Ali Khan", phone: "+92 300 1234567", address: "Faisalabad, PK", opening_balance: 0 },
        { name: "Steel & Rod Co.", contact_person: "Sara N.", phone: "+92 321 9876543", opening_balance: 15000 },
        { name: "Polymer Source Ltd", phone: "+92 333 5556677", opening_balance: 0 },
        { name: "Eastern Pigments", contact_person: "Bilal", phone: "+92 345 2223344", opening_balance: 5000 },
      ].map((v) => ({ ...v, user_id: user.id }));
      const { data: vRows } = await supabase.from("vendors").insert(vendors).select();

      const clients = [
        { name: "Apex Textiles", contact_person: "M. Rauf", phone: "+92 300 1111111", opening_balance: 0 },
        { name: "Continental Plastics", phone: "+92 321 2222222", opening_balance: 0 },
        { name: "Karachi Fabrics Pvt", phone: "+92 333 3333333", opening_balance: 20000 },
        { name: "Metro Steel Works", phone: "+92 345 4444444", opening_balance: 0 },
        { name: "Punjab Garments", phone: "+92 312 5555555", opening_balance: 0 },
        { name: "United Industries", phone: "+92 301 6666666", opening_balance: 8000 },
      ].map((c) => ({ ...c, user_id: user.id }));
      const { data: cRows } = await supabase.from("clients").insert(clients).select();

      const products = [
        { name: "Cotton lint — Grade A", sku: "CL-A", unit: "kg", default_price: 450 },
        { name: "Steel rod 12mm", sku: "SR-12", unit: "kg", default_price: 320 },
        { name: "PE pellets — HDPE", sku: "PE-HD", unit: "kg", default_price: 280 },
        { name: "Pigment red oxide", sku: "PG-RED", unit: "kg", default_price: 180 },
        { name: "Packaging — woven sack", sku: "PK-50", unit: "pcs", default_price: 65 },
        { name: "Delivery / freight", sku: "FRT", unit: "trip", default_price: 5000 },
      ].map((p) => ({ ...p, user_id: user.id, active: true, default_tax_rate: 0 }));
      await supabase.from("products" as any).insert(products);

      // GRNs
      const grns: any[] = [];
      vRows?.forEach((v, idx) => {
        for (let i = 0; i < 2; i++) {
          const qty = 100 + Math.round(Math.random() * 400);
          const price = 150 + Math.round(Math.random() * 300);
          const date = new Date(); date.setDate(date.getDate() - (idx * 7 + i * 3));
          grns.push({
            user_id: user.id, vendor_id: v.id,
            grn_number: `GRN-${1000 + grns.length}`,
            material: ["Cotton lint", "Steel rod", "PE pellets", "Pigment"][idx % 4],
            quantity: qty, unit: "kg", unit_price: price, total_amount: qty * price,
            grn_date: date.toISOString().slice(0, 10), doc_template: "classic",
          });
        }
      });
      await supabase.from("vendor_grns").insert(grns);

      const vpays = vRows?.slice(0, 3).map((v, i) => ({
        user_id: user.id, vendor_id: v.id, amount: 20000 + i * 10000,
        payment_date: new Date(Date.now() - i * 5 * 86400000).toISOString().slice(0, 10),
        method: "bank" as const, reference: `TX-${1000 + i}`,
      })) ?? [];
      await supabase.from("vendor_payments").insert(vpays);

      const invoices: any[] = [];
      cRows?.forEach((c, idx) => {
        for (let i = 0; i < 2; i++) {
          const status = i === 1 && idx === 0 ? "draft" : "posted";
          const date = new Date(); date.setDate(date.getDate() - (idx * 6 + i * 4));
          const sub = 50000 + Math.round(Math.random() * 150000);
          invoices.push({
            user_id: user.id, client_id: c.id,
            invoice_number: `INV-${2000 + invoices.length}`,
            status, issue_date: date.toISOString().slice(0, 10),
            subtotal: sub, tax: 0, total: sub,
            doc_template: "classic",
            posted_at: status === "posted" ? date.toISOString() : null,
          });
        }
      });
      const { data: invRows } = await supabase.from("invoices").insert(invoices).select();
      const items: any[] = [];
      invRows?.forEach((inv) => {
        items.push({
          invoice_id: inv.id, description: "Raw material supply (per delivery note)",
          quantity: 1, unit_price: inv.total, line_total: inv.total, sort_order: 0,
        });
      });
      await supabase.from("invoice_items").insert(items);

      const cpays: any[] = [];
      cRows?.forEach((c, idx) => {
        for (let w = 0; w < 4; w++) {
          const date = new Date(); date.setDate(date.getDate() - (w * 7 + (idx % 3)));
          cpays.push({
            user_id: user.id, client_id: c.id,
            amount: 8000 + Math.round(Math.random() * 12000),
            payment_date: date.toISOString().slice(0, 10),
            method: (["cash", "bank", "cheque", "mobile"] as const)[w % 4],
            reference: `WK-${w}-${idx}`,
          });
        }
      });
      await supabase.from("client_payments").insert(cpays);

      toast.success("Demo data loaded — explore the dashboard!");
    } catch (e: any) {
      toast.error(e.message ?? "Seed failed");
    } finally { setSeeding(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Global preferences for currency, theme, and document templates</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="documents">Document Designer</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="demo">Demo Data</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Currency</CardTitle><CardDescription>Applies to all dashboards, invoices, GRNs and payments</CardDescription></CardHeader>
            <CardContent>
              <Select value={settings.currency} onValueChange={(v) => updateSettings({ currency: v as CurrencyCode })}>
                <SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CURRENCY_LABELS) as CurrencyCode[]).map((c) => <SelectItem key={c} value={c}>{CURRENCY_LABELS[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Theme</CardTitle><CardDescription>High-contrast is optimised for bright sunlight</CardDescription></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {(["light", "dark", "contrast"] as UiTheme[]).map((t) => (
                <button key={t} onClick={() => updateSettings({ theme: t })} className={`rounded-md border p-4 text-left transition-colors ${settings.theme === t ? "border-primary ring-2 ring-primary/30" : "hover:bg-muted/30"}`}>
                  <div className="font-medium capitalize">{t === "contrast" ? "High Contrast" : t}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t === "light" ? "Clean & bright" : t === "dark" ? "Easy on eyes" : "Outdoor / sunlight"}</div>
                </button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader><CardTitle>Default document template</CardTitle><CardDescription>Choose the default layout for invoices and GRNs. You can override per document.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => updateSettings({ default_doc_template: t.id })} className={`rounded-md border p-4 text-left transition-colors ${settings.default_doc_template === t.id ? "border-primary ring-2 ring-primary/30" : "hover:bg-muted/30"}`}>
                  <div className="font-medium">{t.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{t.desc}</div>
                  <div className="mt-3 h-16 rounded border bg-muted/40 px-2 py-1 text-[8px] leading-tight overflow-hidden">
                    {t.id === "acelog" && <div className="text-right text-xs font-light">Invoice <span className="text-[#4a90c2]">INV-0001</span></div>}
                    {t.id === "classic" && <div className="border-b-2 border-current pb-1 mb-1 font-serif font-bold">INVOICE</div>}
                    {t.id === "modern" && <div className="text-lg font-extralight">Invoice</div>}
                    {t.id === "compact" && <div className="border-b-2 border-current pb-0.5 mb-0.5 text-[10px] font-bold">INVOICE</div>}
                    <div>Line · Line · Line</div>
                    <div>Line · Line · Line</div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Company logo</CardTitle><CardDescription>Shown on invoices, GRNs and in the app header. PNG / JPG / SVG, up to 2 MB.</CardDescription></CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-md border bg-muted/30">
                {settings.business_logo_url ? (
                  <img src={settings.business_logo_url} alt="Company logo" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-muted-foreground">No logo</span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }}
                />
                <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="mr-2 h-4 w-4" />{uploading ? "Uploading…" : settings.business_logo_url ? "Replace logo" : "Upload logo"}
                </Button>
                {settings.business_logo_url && (
                  <Button variant="outline" onClick={removeLogo}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Business details</CardTitle><CardDescription>Shown on generated invoices and GRNs</CardDescription></CardHeader>
            <CardContent className="space-y-3 max-w-xl">
              <div><Label>Business name</Label><Input value={bizName} onChange={(e) => setBizName(e.target.value)} /></div>
              <div><Label>Address</Label><Textarea value={bizAddr} onChange={(e) => setBizAddr(e.target.value)} /></div>
              <div><Label>Phone</Label><Input value={bizPhone} onChange={(e) => setBizPhone(e.target.value)} /></div>
              <Button onClick={saveBiz}>Save</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demo">
          <Card>
            <CardHeader><CardTitle>Load demo data</CardTitle><CardDescription>Adds 4 vendors, 6 clients, products, GRNs, invoices and weekly payments. Skipped if data exists.</CardDescription></CardHeader>
            <CardContent>
              <Button onClick={seedDemo} disabled={seeding}>{seeding ? "Loading…" : "Load demo data"}</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
