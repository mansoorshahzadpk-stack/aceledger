-- Add discount column to invoices (default 0, not null)
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0;

-- Add discount column to vendor_grns (default 0, not null)
ALTER TABLE public.vendor_grns ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0;
