-- Add status column to vendor_payments with DEFAULT 'draft'
ALTER TABLE public.vendor_payments ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft' CHECK (status IN ('draft', 'posted'));

-- Update existing vendor_payments to be 'posted' so legacy payments remain posted
UPDATE public.vendor_payments SET status = 'posted';

-- Make status NOT NULL
ALTER TABLE public.vendor_payments ALTER COLUMN status SET NOT NULL;

-- Add posted_at column
ALTER TABLE public.vendor_payments ADD COLUMN IF NOT EXISTS posted_at timestamp with time zone;

-- Set posted_at for existing posted vendor_payments to their created_at time
UPDATE public.vendor_payments SET posted_at = created_at WHERE status = 'posted' AND posted_at IS NULL;

-- Create vendor_payment_amendments audit table
CREATE TABLE IF NOT EXISTS public.vendor_payment_amendments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id uuid,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  action public.amend_action NOT NULL DEFAULT 'edit',
  previous_amount numeric NOT NULL,
  new_amount numeric NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_payment_amendments TO authenticated;
GRANT ALL ON public.vendor_payment_amendments TO service_role;

ALTER TABLE public.vendor_payment_amendments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vpay_amend select own" ON public.vendor_payment_amendments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "vpay_amend insert own" ON public.vendor_payment_amendments FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "vpay_amend update own" ON public.vendor_payment_amendments FOR UPDATE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid())) WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "vpay_amend delete own" ON public.vendor_payment_amendments FOR DELETE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));

-- Create update_vendor_payment function
CREATE OR REPLACE FUNCTION public.update_vendor_payment(
  p_payment_id uuid,
  p_amount numeric,
  p_date date,
  p_method text,
  p_reference text,
  p_notes text,
  p_reason text,
  p_user_id uuid,
  p_asset_id uuid
) RETURNS void AS $$
DECLARE
  v_old_amount numeric;
  v_vendor_id uuid;
  v_status text;
BEGIN
  -- Fetch existing payment details
  SELECT amount, vendor_id, status INTO v_old_amount, v_vendor_id, v_status
  FROM public.vendor_payments
  WHERE id = p_payment_id AND user_id = p_user_id;

  IF v_vendor_id IS NULL THEN
    RAISE EXCEPTION 'Payment record not found';
  END IF;

  -- Validation: Amount must be positive
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  -- Validation: Method check
  IF p_method NOT IN ('cash', 'bank', 'cheque', 'mobile', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_method;
  END IF;

  -- Check if posted
  IF v_status = 'posted' THEN
    -- Validate reason is at least 5 chars
    IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
      RAISE EXCEPTION 'A reason of at least 5 characters is required for amending posted payments';
    END IF;

    -- Insert audit log entry into vendor_payment_amendments
    INSERT INTO public.vendor_payment_amendments (
      user_id,
      payment_id,
      vendor_id,
      action,
      previous_amount,
      new_amount,
      reason,
      created_at
    ) VALUES (
      p_user_id,
      p_payment_id,
      v_vendor_id,
      'edit'::public.amend_action,
      v_old_amount,
      p_amount,
      trim(p_reason),
      now()
    );
  END IF;

  -- Update vendor_payments payment details including asset_id
  UPDATE public.vendor_payments
  SET amount = p_amount,
      payment_date = p_date,
      method = p_method::public.payment_method,
      reference = NULLIF(trim(p_reference), ''),
      notes = NULLIF(trim(p_notes), ''),
      asset_id = p_asset_id
  WHERE id = p_payment_id AND user_id = p_user_id;

END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.update_vendor_payment TO authenticated;
