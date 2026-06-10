-- Shorten master password recovery token lifespan to 15 minutes
-- Ensure public and extensions schemas are in the search path
SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.request_master_password_recovery(
  p_user_id uuid
) RETURNS text AS $$
DECLARE
  v_token text;
BEGIN
  v_token := gen_random_uuid()::text;
  
  UPDATE public.app_settings
  SET master_password_reset_token = v_token,
      master_password_reset_expires_at = now() + interval '15 minutes'
  WHERE user_id = p_user_id;
  
  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;
