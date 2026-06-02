-- 1. Get all tenant profiles with auth.users last_sign_in_at information
CREATE OR REPLACE FUNCTION public.admin_get_tenant_profiles()
RETURNS TABLE (
  user_id uuid,
  email text,
  created_at timestamptz,
  trial_ends_at timestamptz,
  status text,
  last_active_at timestamptz
) 
SECURITY DEFINER 
SET search_path = public, auth
LANGUAGE plpgsql AS $$
DECLARE
  _caller_email text;
BEGIN
  -- Authorize caller
  SELECT u.email INTO _caller_email FROM auth.users u WHERE u.id = auth.uid();
  IF _caller_email IS NULL OR _caller_email != 'mansoorshahzadpk@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized: Only master administrator is allowed to view this data.';
  END IF;

  RETURN QUERY
  SELECT tp.user_id, tp.email, tp.created_at, tp.trial_ends_at, tp.status,
         COALESCE(u.last_sign_in_at, tp.created_at) as last_active_at
  FROM public.tenant_profiles tp
  LEFT JOIN auth.users u ON u.id = tp.user_id;
END; $$;

-- 2. Update tenant status securely
CREATE OR REPLACE FUNCTION public.admin_update_tenant_status(_target_user_id uuid, _new_status text)
RETURNS void 
SECURITY DEFINER 
SET search_path = public, auth
LANGUAGE plpgsql AS $$
DECLARE
  _caller_email text;
BEGIN
  -- Authorize caller
  SELECT u.email INTO _caller_email FROM auth.users u WHERE u.id = auth.uid();
  IF _caller_email IS NULL OR _caller_email != 'mansoorshahzadpk@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized: Only master administrator is allowed to modify tenant status.';
  END IF;

  IF _new_status NOT IN ('active', 'suspended', 'trialing') THEN
    RAISE EXCEPTION 'Invalid status: %', _new_status;
  END IF;

  UPDATE public.tenant_profiles
  SET status = _new_status
  WHERE user_id = _target_user_id;
END; $$;
