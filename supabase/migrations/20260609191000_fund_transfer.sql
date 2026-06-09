-- 1. Create Transfer Logs Table
CREATE TABLE IF NOT EXISTS public.transfer_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  from_asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  to_asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS and add policies
ALTER TABLE public.transfer_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transfer_logs all own" ON public.transfer_logs;
CREATE POLICY "transfer_logs all own" ON public.transfer_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Create transfer_funds atomic function
CREATE OR REPLACE FUNCTION public.transfer_funds(
  p_from_asset_id uuid,
  p_to_asset_id uuid,
  p_amount numeric,
  p_date date,
  p_remarks text,
  p_user_id uuid,
  p_business_id uuid
) RETURNS void AS $$
DECLARE
  v_from_initial numeric;
  v_from_client_inflow numeric;
  v_from_ledger_inflow numeric;
  v_from_vendor_outflow numeric;
  v_from_ledger_outflow numeric;
  v_from_balance numeric;
  v_from_name text;
  v_to_name text;
BEGIN
  -- Get names and initial balance of both accounts
  SELECT name, initial_balance INTO v_from_name, v_from_initial FROM public.assets WHERE id = p_from_asset_id;
  SELECT name INTO v_to_name FROM public.assets WHERE id = p_to_asset_id;

  IF v_from_name IS NULL OR v_to_name IS NULL THEN
    RAISE EXCEPTION 'Source or destination asset account not found';
  END IF;

  -- Calculate client payment inflow for source asset
  SELECT COALESCE(SUM(amount), 0) INTO v_from_client_inflow
  FROM public.client_payments
  WHERE asset_id = p_from_asset_id AND status = 'posted';

  -- Calculate ledger transaction inflow for source asset
  SELECT COALESCE(SUM(amount), 0) INTO v_from_ledger_inflow
  FROM public.ledger_transactions
  WHERE asset_id = p_from_asset_id AND type = 'debit';

  -- Calculate vendor payment outflow for source asset
  SELECT COALESCE(SUM(amount), 0) INTO v_from_vendor_outflow
  FROM public.vendor_payments
  WHERE asset_id = p_from_asset_id;

  -- Calculate ledger transaction outflow for source asset
  SELECT COALESCE(SUM(amount), 0) INTO v_from_ledger_outflow
  FROM public.ledger_transactions
  WHERE asset_id = p_from_asset_id AND type = 'credit';

  -- Compute running balance
  v_from_balance := v_from_initial + v_from_client_inflow + v_from_ledger_inflow - v_from_vendor_outflow - v_from_ledger_outflow;

  -- Check if there is sufficient balance
  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance in source account: % has % but tried to transfer %', v_from_name, v_from_balance, p_amount;
  END IF;

  -- Insert Credit transaction for source account (Money Out)
  INSERT INTO public.ledger_transactions (
    user_id,
    business_id,
    transaction_date,
    category,
    description,
    type,
    amount,
    asset_id,
    reconciled
  ) VALUES (
    p_user_id,
    p_business_id,
    p_date,
    'Fund Transfer',
    'Fund transfer to ' || v_to_name || COALESCE(' - ' || NULLIF(p_remarks, ''), ''),
    'credit',
    p_amount,
    p_from_asset_id,
    false
  );

  -- Insert Debit transaction for destination account (Money In)
  INSERT INTO public.ledger_transactions (
    user_id,
    business_id,
    transaction_date,
    category,
    description,
    type,
    amount,
    asset_id,
    reconciled
  ) VALUES (
    p_user_id,
    p_business_id,
    p_date,
    'Fund Transfer',
    'Fund transfer from ' || v_from_name || COALESCE(' - ' || NULLIF(p_remarks, ''), ''),
    'debit',
    p_amount,
    p_to_asset_id,
    false
  );

  -- Log the transfer in transfer_logs for Audit Log integration
  INSERT INTO public.transfer_logs (
    user_id,
    business_id,
    from_asset_id,
    to_asset_id,
    amount,
    remarks
  ) VALUES (
    p_user_id,
    p_business_id,
    p_from_asset_id,
    p_to_asset_id,
    p_amount,
    p_remarks
  );

END;
$$ LANGUAGE plpgsql;
