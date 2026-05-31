-- Add tax and shipping columns to vendor_grns (default 0, not null)
ALTER TABLE public.vendor_grns ADD COLUMN IF NOT EXISTS tax numeric NOT NULL DEFAULT 0;
ALTER TABLE public.vendor_grns ADD COLUMN IF NOT EXISTS shipping numeric NOT NULL DEFAULT 0;
