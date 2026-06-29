-- Add vehicle_number to public.vendor_grn_items
ALTER TABLE public.vendor_grn_items ADD COLUMN IF NOT EXISTS vehicle_number text;

-- Backfill data: copy existing grns' vehicle_number to their items
UPDATE public.vendor_grn_items i
SET vehicle_number = g.vehicle_number
FROM public.vendor_grns g
WHERE i.grn_id = g.id;
