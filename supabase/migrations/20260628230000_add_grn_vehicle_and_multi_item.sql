-- Add vehicle_number to public.vendor_grns
ALTER TABLE public.vendor_grns ADD COLUMN IF NOT EXISTS vehicle_number text;

-- Create vendor_grn_items table
CREATE TABLE IF NOT EXISTS public.vendor_grn_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id uuid NOT NULL REFERENCES public.vendor_grns(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  material text NOT NULL,
  quantity numeric(14,3) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kg',
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  quantity_formula text,
  unit_price_formula text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS for vendor_grn_items
ALTER TABLE public.vendor_grn_items ENABLE ROW LEVEL SECURITY;

-- Create policies for vendor_grn_items
CREATE POLICY "items select via grn" ON public.vendor_grn_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.vendor_grns g WHERE g.id = grn_id AND g.user_id = auth.uid()));
CREATE POLICY "items insert via grn" ON public.vendor_grn_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.vendor_grns g WHERE g.id = grn_id AND g.user_id = auth.uid()) AND public.is_tenant_active(auth.uid()));
CREATE POLICY "items update via grn" ON public.vendor_grn_items FOR UPDATE USING (EXISTS (SELECT 1 FROM public.vendor_grns g WHERE g.id = grn_id AND g.user_id = auth.uid() AND public.is_tenant_active(auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.vendor_grns g WHERE g.id = grn_id AND g.user_id = auth.uid() AND public.is_tenant_active(auth.uid())));
CREATE POLICY "items delete via grn" ON public.vendor_grn_items FOR DELETE USING (EXISTS (SELECT 1 FROM public.vendor_grns g WHERE g.id = grn_id AND g.user_id = auth.uid() AND public.is_tenant_active(auth.uid())));

-- Backfill existing GRNs' item data into vendor_grn_items
INSERT INTO public.vendor_grn_items (grn_id, product_id, material, quantity, unit, unit_price, quantity_formula, unit_price_formula)
SELECT id, product_id, material, quantity, unit, unit_price, quantity_formula, unit_price_formula
FROM public.vendor_grns;
