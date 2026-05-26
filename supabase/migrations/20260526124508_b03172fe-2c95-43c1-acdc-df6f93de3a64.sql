
-- 1. business_logo_url on app_settings
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS business_logo_url text;

-- 2. products table
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  sku text,
  description text,
  unit text NOT NULL DEFAULT 'pcs',
  default_price numeric NOT NULL DEFAULT 0,
  default_tax_rate numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products all own" ON public.products FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_products_user ON public.products(user_id);

-- 3. business-assets storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('business-assets', 'business-assets', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "business-assets public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'business-assets');
CREATE POLICY "business-assets own insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'business-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "business-assets own update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'business-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "business-assets own delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'business-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
