-- 1. Create tenant_profiles table
CREATE TABLE IF NOT EXISTS public.tenant_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  status text NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'suspended'))
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.tenant_profiles ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies for tenant_profiles
DROP POLICY IF EXISTS "tenant_profiles own select" ON public.tenant_profiles;
CREATE POLICY "tenant_profiles own select" ON public.tenant_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tenant_profiles own update" ON public.tenant_profiles;
CREATE POLICY "tenant_profiles own update" ON public.tenant_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Populate tenant_profiles for existing users
INSERT INTO public.tenant_profiles (user_id, email)
SELECT id, email FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 3. Add missing foreign key constraints to existing tables
-- products (Warehouse Inventory)
ALTER TABLE public.products 
  DROP CONSTRAINT IF EXISTS fk_products_user,
  ADD CONSTRAINT fk_products_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- grn_amendments
ALTER TABLE public.grn_amendments 
  DROP CONSTRAINT IF EXISTS fk_grn_amendments_user,
  ADD CONSTRAINT fk_grn_amendments_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- payment_amendments
ALTER TABLE public.payment_amendments 
  DROP CONSTRAINT IF EXISTS fk_payment_amendments_user,
  ADD CONSTRAINT fk_payment_amendments_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- doc_counters
ALTER TABLE public.doc_counters 
  DROP CONSTRAINT IF EXISTS fk_doc_counters_user,
  ADD CONSTRAINT fk_doc_counters_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Redefine handle_new_user() trigger function to auto-provision tenant_profiles
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

  -- Create tenant profile
  INSERT INTO public.tenant_profiles (user_id, email)
  VALUES (NEW.id, NEW.email);

  RETURN NEW;
END; $$;
