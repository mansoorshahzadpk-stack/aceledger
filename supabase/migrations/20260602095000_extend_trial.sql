-- 1. Extend user trial status securely for selected number of days
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

  UPDATE public.tenant_profiles
  SET status = 'trialing',
      trial_ends_at = now() + (_days || ' days')::interval
  WHERE user_id = _target_user_id;
END; $$;
