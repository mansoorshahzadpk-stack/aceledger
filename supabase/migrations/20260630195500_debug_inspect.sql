-- Temporary debug migration to inspect grns and grn items bypassing RLS
CREATE OR REPLACE FUNCTION public.debug_inspect_grns()
RETURNS json
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'items', (SELECT json_agg(t) FROM (SELECT id, grn_id, material, quantity, unit_price, quantity_formula, unit_price_formula, shipping FROM public.vendor_grn_items WHERE material ILIKE '%maize%') t),
    'grns', (SELECT json_agg(t) FROM (SELECT id, grn_number, material, quantity, unit_price, status FROM public.vendor_grns WHERE material ILIKE '%maize%') t)
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.debug_inspect_grns() TO anon, authenticated, service_role;
