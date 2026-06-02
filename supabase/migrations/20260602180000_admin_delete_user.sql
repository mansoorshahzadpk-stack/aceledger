-- Create secure admin user deletion RPC
CREATE OR REPLACE FUNCTION public.admin_delete_user(_target_user_id uuid)
RETURNS void 
SECURITY DEFINER 
SET search_path = public, auth
LANGUAGE plpgsql AS $$
DECLARE
  _caller_email text;
  _target_email text;
  _target_metadata jsonb;
  _metadata_hash text;
BEGIN
  -- 1. Authorize caller is mansoorshahzadpk@gmail.com
  SELECT u.email INTO _caller_email FROM auth.users u WHERE u.id = auth.uid();
  IF _caller_email IS NULL OR _caller_email != 'mansoorshahzadpk@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized: Only master administrator is allowed to delete user accounts.';
  END IF;

  -- 2. Fetch target user email and metadata
  SELECT u.email, u.raw_user_meta_data INTO _target_email, _target_metadata
  FROM auth.users u
  WHERE u.id = _target_user_id;

  IF _target_email IS NULL THEN
    RAISE EXCEPTION 'User not found.';
  END IF;

  -- 3. Compute SHA-256 metadata hash
  _metadata_hash := encode(sha256(coalesce(_target_metadata, '{}'::jsonb)::text::bytea), 'hex');

  -- 4. Log to registry table
  INSERT INTO public.deleted_accounts_registry (email, metadata_hash)
  VALUES (_target_email, _metadata_hash)
  ON CONFLICT (email) DO NOTHING;

  -- 5. Cascade delete user data across core tables (manual deletion as fallback)
  DELETE FROM public.client_payments WHERE user_id = _target_user_id;
  DELETE FROM public.vendor_payments WHERE user_id = _target_user_id;
  DELETE FROM public.invoices WHERE user_id = _target_user_id;
  DELETE FROM public.vendor_grns WHERE user_id = _target_user_id;
  DELETE FROM public.products WHERE user_id = _target_user_id;
  DELETE FROM public.clients WHERE user_id = _target_user_id;
  DELETE FROM public.vendors WHERE user_id = _target_user_id;
  DELETE FROM public.businesses WHERE user_id = _target_user_id;
  DELETE FROM public.tenant_profiles WHERE user_id = _target_user_id;
  DELETE FROM public.app_settings WHERE user_id = _target_user_id;

  -- 6. Delete the auth.users record (triggers cascading foreign-key deletion on other tables)
  DELETE FROM auth.users WHERE id = _target_user_id;

END; $$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
