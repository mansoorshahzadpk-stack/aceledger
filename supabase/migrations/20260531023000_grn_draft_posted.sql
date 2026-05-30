-- Add status column to vendor_grns with CHECK constraint and default 'posted' (so existing GRNs remain active)
ALTER TABLE public.vendor_grns ADD COLUMN IF NOT EXISTS status text DEFAULT 'posted' CHECK (status IN ('draft', 'posted'));

-- Add posted_at column to vendor_grns
ALTER TABLE public.vendor_grns ADD COLUMN IF NOT EXISTS posted_at timestamp with time zone;

-- Set posted_at for existing posted GRNs to their created_at time
UPDATE public.vendor_grns SET posted_at = created_at WHERE status = 'posted' AND posted_at IS NULL;
