-- Temporary migration to inspect database
CREATE OR REPLACE FUNCTION public.debug_run_sql(p_sql text)
RETURNS json
SECURITY DEFINER
AS $$
DECLARE
  v_res json;
BEGIN
  EXECUTE 'SELECT json_agg(t) FROM (' || p_sql || ') t' INTO v_res;
  RETURN v_res;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.debug_run_sql(text) TO anon, authenticated, service_role;
