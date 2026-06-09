-- Add status column to client_payments with DEFAULT 'draft'
ALTER TABLE public.client_payments ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft' CHECK (status IN ('draft', 'posted'));

-- Update existing client_payments to be 'posted' so legacy payments remain posted
UPDATE public.client_payments SET status = 'posted';

-- Make status NOT NULL
ALTER TABLE public.client_payments ALTER COLUMN status SET NOT NULL;

-- Add posted_at column
ALTER TABLE public.client_payments ADD COLUMN IF NOT EXISTS posted_at timestamp with time zone;

-- Set posted_at for existing posted client_payments to their created_at time
UPDATE public.client_payments SET posted_at = created_at WHERE status = 'posted' AND posted_at IS NULL;
