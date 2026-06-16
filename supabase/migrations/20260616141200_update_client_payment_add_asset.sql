-- Drop the old function signature
DROP FUNCTION IF EXISTS public.update_client_payment(
  p_payment_id uuid,
  p_amount numeric,
  p_date date,
  p_method text,
  p_reference text,
  p_reason text,
  p_user_id uuid
);

-- Create the new function signature including p_asset_id
CREATE OR REPLACE FUNCTION public.update_client_payment(
  p_payment_id uuid,
  p_amount numeric,
  p_date date,
  p_method text,
  p_reference text,
  p_reason text,
  p_user_id uuid,
  p_asset_id uuid
) RETURNS void AS $$
DECLARE
  v_old_amount numeric;
  v_client_id uuid;
  v_status text;
BEGIN
  -- Fetch existing payment details
  SELECT amount, client_id, status INTO v_old_amount, v_client_id, v_status
  FROM public.client_payments
  WHERE id = p_payment_id AND user_id = p_user_id;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Payment record not found';
  END IF;

  -- Validation: Amount must be positive
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  -- Validation: Method check
  IF p_method NOT IN ('cash', 'bank', 'cheque', 'mobile') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_method;
  END IF;

  -- Check if posted
  IF v_status = 'posted' THEN
    -- Validate reason is at least 5 chars
    IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
      RAISE EXCEPTION 'A reason of at least 5 characters is required for amending posted payments';
    END IF;

    -- Insert audit log entry into payment_amendments
    INSERT INTO public.payment_amendments (
      user_id,
      payment_id,
      client_id,
      action,
      previous_amount,
      new_amount,
      reason,
      created_at
    ) VALUES (
      p_user_id,
      p_payment_id,
      v_client_id,
      'edit'::public.amend_action,
      v_old_amount,
      p_amount,
      trim(p_reason),
      now()
    );
  END IF;

  -- Update client_payments payment details including asset_id
  UPDATE public.client_payments
  SET amount = p_amount,
      payment_date = p_date,
      method = p_method::public.payment_method,
      reference = NULLIF(trim(p_reference), ''),
      asset_id = p_asset_id
  WHERE id = p_payment_id AND user_id = p_user_id;

END;
$$ LANGUAGE plpgsql;
