-- 1. Create businesses table
CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  phone text,
  logo_url text,
  currency currency_code NOT NULL DEFAULT 'PKR',
  owner_name text,
  business_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS and add policies
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "businesses all own" ON public.businesses;
CREATE POLICY "businesses all own" ON public.businesses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS businesses_updated ON public.businesses;
CREATE TRIGGER businesses_updated BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Add active_business_id to app_settings
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS active_business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

-- 3. Create default business for existing users and set active_business_id
DO $$
DECLARE
  user_rec record;
  default_biz_id uuid;
BEGIN
  FOR user_rec IN 
    SELECT s.user_id, s.business_name, s.business_address, s.business_phone, s.business_logo_url, s.currency
    FROM public.app_settings s
  LOOP
    -- Check if a business already exists for this user, if not create default
    IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE user_id = user_rec.user_id) THEN
      -- Insert default business
      INSERT INTO public.businesses (user_id, name, address, phone, logo_url, currency)
      VALUES (
        user_rec.user_id,
        COALESCE(user_rec.business_name, 'My Business'),
        user_rec.business_address,
        user_rec.business_phone,
        user_rec.business_logo_url,
        COALESCE(user_rec.currency, 'PKR')
      )
      RETURNING id INTO default_biz_id;

      -- Update active_business_id in app_settings
      UPDATE public.app_settings
      SET active_business_id = default_biz_id
      WHERE user_id = user_rec.user_id;
    END IF;
  END LOOP;
END $$;

-- 4. Add business_id column to data tables
-- vendors
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;
UPDATE public.vendors v SET business_id = (SELECT s.active_business_id FROM public.app_settings s WHERE s.user_id = v.user_id) WHERE business_id IS NULL;
ALTER TABLE public.vendors ALTER COLUMN business_id SET NOT NULL;

-- clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;
UPDATE public.clients c SET business_id = (SELECT s.active_business_id FROM public.app_settings s WHERE s.user_id = c.user_id) WHERE business_id IS NULL;
ALTER TABLE public.clients ALTER COLUMN business_id SET NOT NULL;

-- products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;
UPDATE public.products p SET business_id = (SELECT s.active_business_id FROM public.app_settings s WHERE s.user_id = p.user_id) WHERE business_id IS NULL;
ALTER TABLE public.products ALTER COLUMN business_id SET NOT NULL;

-- vendor_grns
ALTER TABLE public.vendor_grns ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;
UPDATE public.vendor_grns vg SET business_id = (SELECT s.active_business_id FROM public.app_settings s WHERE s.user_id = vg.user_id) WHERE business_id IS NULL;
ALTER TABLE public.vendor_grns ALTER COLUMN business_id SET NOT NULL;

-- vendor_payments
ALTER TABLE public.vendor_payments ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;
UPDATE public.vendor_payments vp SET business_id = (SELECT s.active_business_id FROM public.app_settings s WHERE s.user_id = vp.user_id) WHERE business_id IS NULL;
ALTER TABLE public.vendor_payments ALTER COLUMN business_id SET NOT NULL;

-- invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;
UPDATE public.invoices i SET business_id = (SELECT s.active_business_id FROM public.app_settings s WHERE s.user_id = i.user_id) WHERE business_id IS NULL;
ALTER TABLE public.invoices ALTER COLUMN business_id SET NOT NULL;

-- client_payments
ALTER TABLE public.client_payments ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;
UPDATE public.client_payments cp SET business_id = (SELECT s.active_business_id FROM public.app_settings s WHERE s.user_id = cp.user_id) WHERE business_id IS NULL;
ALTER TABLE public.client_payments ALTER COLUMN business_id SET NOT NULL;

-- doc_counters
ALTER TABLE public.doc_counters ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;
UPDATE public.doc_counters dc SET business_id = (SELECT s.active_business_id FROM public.app_settings s WHERE s.user_id = dc.user_id) WHERE business_id IS NULL;
ALTER TABLE public.doc_counters DROP CONSTRAINT IF EXISTS doc_counters_pkey;
ALTER TABLE public.doc_counters ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.doc_counters add primary key (business_id, kind);

-- 5. Business limit enforcement trigger
CREATE OR REPLACE FUNCTION public.check_business_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  biz_count int;
BEGIN
  SELECT count(*) INTO biz_count FROM public.businesses WHERE user_id = NEW.user_id;
  IF biz_count >= 10 THEN
    RAISE EXCEPTION 'Maximum limit of 10 businesses reached';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS enforce_business_limit ON public.businesses;
CREATE TRIGGER enforce_business_limit
  BEFORE INSERT ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.check_business_limit();

-- 6. Redefine next_doc_number trigger function to be business-aware
CREATE OR REPLACE FUNCTION public.next_doc_number(_business_id uuid, _kind text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _next integer;
  _prefix text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  -- Validate user owns business
  IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = _business_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'unauthorized business access';
  END IF;

  IF _kind = 'invoice' THEN _prefix := 'INV-';
  ELSIF _kind = 'grn' THEN _prefix := 'GRN-';
  ELSE RAISE EXCEPTION 'invalid kind %', _kind; END IF;

  INSERT INTO public.doc_counters (user_id, business_id, kind, last_value)
    VALUES (_uid, _business_id, _kind, 1)
  ON CONFLICT (business_id, kind) DO UPDATE
    SET last_value = public.doc_counters.last_value + 1,
        updated_at = now()
  RETURNING last_value INTO _next;

  RETURN _prefix || lpad(_next::text, 4, '0');
END $$;

-- 7. Update handle_new_user() trigger function to provision default business
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  default_biz_id uuid;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, display_name) 
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));

  -- Create default business
  INSERT INTO public.businesses (user_id, name, currency)
  VALUES (NEW.id, 'My Business', 'PKR')
  RETURNING id INTO default_biz_id;

  -- Create user role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  -- Create app_settings with active_business_id
  INSERT INTO public.app_settings (user_id, active_business_id) 
  VALUES (NEW.id, default_biz_id);

  RETURN NEW;
END; $$;
