-- Ensure extensions schema is in the search path for compilation in Supabase
SET search_path TO public, extensions;

-- Enable pgcrypto extension for bcrypt hashing (ensuring it is in extensions schema)
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Recreate functions with the correct search path to locate pgcrypto functions (crypt, gen_salt)
CREATE OR REPLACE FUNCTION public.set_master_password(
  p_user_id uuid,
  p_password text
) RETURNS void AS $$
BEGIN
  UPDATE public.app_settings
  SET master_password_hash = crypt(p_password, gen_salt('bf')),
      master_password_reset_token = NULL,
      master_password_reset_expires_at = NULL,
      master_password_failed_attempts = 0,
      master_password_lockout_until = NULL
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.check_master_password(
  p_user_id uuid,
  p_password text
) RETURNS boolean AS $$
DECLARE
  v_hash text;
  v_attempts int;
  v_lockout timestamptz;
BEGIN
  SELECT master_password_hash, COALESCE(master_password_failed_attempts, 0), master_password_lockout_until
  INTO v_hash, v_attempts, v_lockout
  FROM public.app_settings
  WHERE user_id = p_user_id;

  IF v_hash IS NULL THEN
    RAISE EXCEPTION 'Master password is not configured.';
  END IF;

  -- Check lockout
  IF v_lockout IS NOT NULL AND v_lockout > now() THEN
    RAISE EXCEPTION 'Too many failed attempts. Locked out until %', v_lockout;
  END IF;

  -- Verify password
  IF v_hash = crypt(p_password, v_hash) THEN
    -- Success: reset attempts
    UPDATE public.app_settings
    SET master_password_failed_attempts = 0,
        master_password_lockout_until = NULL
    WHERE user_id = p_user_id;
    RETURN true;
  ELSE
    -- Failure: increment attempts
    v_attempts := v_attempts + 1;
    IF v_attempts >= 5 THEN
      v_lockout := now() + interval '15 minutes';
    ELSE
      v_lockout := NULL;
    END IF;

    UPDATE public.app_settings
    SET master_password_failed_attempts = v_attempts,
        master_password_lockout_until = v_lockout
    WHERE user_id = p_user_id;

    IF v_attempts >= 5 THEN
      RAISE EXCEPTION 'Incorrect master password. Locked out for 15 minutes.';
    ELSE
      RAISE EXCEPTION 'Incorrect master password. % attempts remaining.', (5 - v_attempts);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.reset_master_password_with_token(
  p_token text,
  p_new_password text
) RETURNS boolean AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.app_settings
  WHERE master_password_reset_token = p_token
    AND master_password_reset_expires_at > now();

  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.app_settings
  SET master_password_hash = crypt(p_new_password, gen_salt('bf')),
      master_password_reset_token = NULL,
      master_password_reset_expires_at = NULL,
      master_password_failed_attempts = 0,
      master_password_lockout_until = NULL
  WHERE user_id = v_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.delete_audit_log_entry(
  p_user_id uuid,
  p_password text,
  p_id uuid,
  p_type text
) RETURNS void AS $$
DECLARE
  v_valid boolean;
BEGIN
  -- Verify password
  v_valid := public.check_master_password(p_user_id, p_password);
  
  IF NOT COALESCE(v_valid, false) THEN
    RAISE EXCEPTION 'Incorrect master password';
  END IF;

  -- Delete from appropriate table
  IF p_type = 'invoice' THEN
    DELETE FROM public.invoice_amendments WHERE id = p_id AND user_id = p_user_id;
  ELSIF p_type = 'grn' THEN
    DELETE FROM public.grn_amendments WHERE id = p_id AND user_id = p_user_id;
  ELSIF p_type = 'payment' THEN
    DELETE FROM public.payment_amendments WHERE id = p_id AND user_id = p_user_id;
  ELSIF p_type = 'transfer' THEN
    DELETE FROM public.transfer_logs WHERE id = p_id AND user_id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Invalid audit type: %', p_type;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;
