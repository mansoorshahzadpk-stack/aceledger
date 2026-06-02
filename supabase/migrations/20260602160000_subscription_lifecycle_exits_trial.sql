-- 1. Update is_tenant_active function to verify active user's expiration date
CREATE OR REPLACE FUNCTION public.is_tenant_active(_user_id uuid)
RETURNS boolean SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE
  _status text;
  _trial_ends timestamptz;
BEGIN
  SELECT status, trial_ends_at INTO _status, _trial_ends
  FROM public.tenant_profiles
  WHERE user_id = _user_id;

  IF _status = 'active' AND _trial_ends >= now() THEN
    RETURN true;
  ELSIF _status = 'trialing' AND _trial_ends >= now() THEN
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END; $$;

-- 2. Update admin_update_tenant_status to handle toggle switch state transitions
CREATE OR REPLACE FUNCTION public.admin_update_tenant_status(_target_user_id uuid, _new_status text)
RETURNS void 
SECURITY DEFINER 
SET search_path = public, auth
LANGUAGE plpgsql AS $$
DECLARE
  _caller_email text;
  _current_expiry timestamptz;
BEGIN
  -- Authorize caller
  SELECT u.email INTO _caller_email FROM auth.users u WHERE u.id = auth.uid();
  IF _caller_email IS NULL OR _caller_email != 'mansoorshahzadpk@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized: Only master administrator is allowed to modify tenant status.';
  END IF;

  IF _new_status NOT IN ('active', 'suspended') THEN
    RAISE EXCEPTION 'Invalid status: %', _new_status;
  END IF;

  SELECT trial_ends_at INTO _current_expiry FROM public.tenant_profiles WHERE user_id = _target_user_id;
  
  -- If enabling an expired account, set expiration to permanently active (2099)
  IF _new_status = 'active' AND (_current_expiry IS NULL OR _current_expiry < now()) THEN
    UPDATE public.tenant_profiles
    SET status = _new_status,
        trial_ends_at = '2099-01-01 00:00:00+00'::timestamptz
    WHERE user_id = _target_user_id;
  ELSE
    UPDATE public.tenant_profiles
    SET status = _new_status
    WHERE user_id = _target_user_id;
  END IF;
END; $$;

-- 3. Update admin_extend_trial function to set status to 'active' instead of 'trialing'
CREATE OR REPLACE FUNCTION public.admin_extend_trial(_target_user_id uuid, _days integer)
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
    RAISE EXCEPTION 'Unauthorized: Only master administrator is allowed to extend trials.';
  END IF;

  IF _days <= 0 THEN
    RAISE EXCEPTION 'Days must be greater than zero.';
  END IF;

  -- Update to 'active' status and extend expiration date
  UPDATE public.tenant_profiles
  SET status = 'active',
      trial_ends_at = now() + (_days || ' days')::interval
  WHERE user_id = _target_user_id;
END; $$;
