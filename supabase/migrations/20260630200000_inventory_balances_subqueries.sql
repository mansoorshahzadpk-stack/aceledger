-- Overwrite get_inventory_balances RPC function with strict subquery logic and explicit cache reload
CREATE OR REPLACE FUNCTION public.get_inventory_balances(p_business_id uuid)
RETURNS TABLE (
  material_id uuid,
  name text,
  sku text,
  unit text,
  received numeric,
  delivered numeric,
  received_value numeric
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as material_id,
    m.name,
    m.sku,
    m.unit,
    -- Total Received (isolated subquery sum grouped by material)
    COALESCE(
      (SELECT SUM(gi.quantity)::numeric
       FROM public.vendor_grn_items gi 
       JOIN public.vendor_grns g ON gi.grn_id = g.id 
       WHERE (gi.product_id = m.id OR (gi.product_id IS NULL AND LOWER(TRIM(SPLIT_PART(gi.material, ' (', 1))) = LOWER(TRIM(m.name))))
         AND g.business_id = p_business_id 
         AND g.status = 'posted'
      ), 0
    ) as received,
    -- Total Delivered (isolated subquery sum grouped by material)
    COALESCE(
      (SELECT SUM(ii.quantity)::numeric
       FROM public.invoice_items ii 
       JOIN public.invoices i ON ii.invoice_id = i.id 
       WHERE (ii.product_id = m.id OR (ii.product_id IS NULL AND LOWER(TRIM(SPLIT_PART(ii.description, ' (', 1))) = LOWER(TRIM(m.name))))
         AND i.business_id = p_business_id 
         AND i.status = 'posted'
      ), 0
    ) as delivered,
    -- Total Received Value (isolated subquery sum grouped by material)
    COALESCE(
      (SELECT SUM((gi.quantity * gi.unit_price) + COALESCE(gi.shipping, 0))::numeric
       FROM public.vendor_grn_items gi 
       JOIN public.vendor_grns g ON gi.grn_id = g.id 
       WHERE (gi.product_id = m.id OR (gi.product_id IS NULL AND LOWER(TRIM(SPLIT_PART(gi.material, ' (', 1))) = LOWER(TRIM(m.name))))
         AND g.business_id = p_business_id 
         AND g.status = 'posted'
      ), 0
    ) as received_value
  FROM public.products m
  WHERE m.business_id = p_business_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_inventory_balances(uuid) TO anon, authenticated, service_role;

-- Force PostgREST to immediately clear cache and reload schema to pick up the new function
NOTIFY pgrst, 'reload schema';
