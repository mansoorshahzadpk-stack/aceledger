-- 1. Create deleted accounts registry table
CREATE TABLE IF NOT EXISTS public.deleted_accounts_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  metadata_hash text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deleted_accounts_registry ENABLE ROW LEVEL SECURITY;

-- Allow select to authenticated users
CREATE POLICY "deleted_accounts_registry select" ON public.deleted_accounts_registry
  FOR SELECT TO authenticated USING (true);

-- 2. Redefine handle_new_user() trigger function to enforce 7-day penalty for repeated sign-ups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  default_biz_id uuid;
  is_repeated boolean := false;
  trial_days_limit interval := '30 days';
BEGIN
  -- Check if email matches a deleted account in registry
  SELECT EXISTS (
    SELECT 1 FROM public.deleted_accounts_registry 
    WHERE email = NEW.email
  ) INTO is_repeated;

  IF is_repeated THEN
    trial_days_limit := '7 days';
  END IF;

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

  -- Create tenant profile with custom trial expiration
  INSERT INTO public.tenant_profiles (user_id, email, status, trial_ends_at)
  VALUES (NEW.id, NEW.email, 'trialing', now() + trial_days_limit);

  RETURN NEW;
END; $$;
