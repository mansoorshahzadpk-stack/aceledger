-- Rename vehicle_number to details in public.vendor_grns
ALTER TABLE public.vendor_grns RENAME COLUMN vehicle_number TO details;

-- Rename vehicle_number to line_details in public.vendor_grn_items
ALTER TABLE public.vendor_grn_items RENAME COLUMN vehicle_number TO line_details;

-- Force Supabase schema cache refresh
NOTIFY pgrst, 'reload schema';
