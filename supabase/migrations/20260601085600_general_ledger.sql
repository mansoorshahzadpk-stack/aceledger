-- 1. Create Assets Table
CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('bank_account', 'petty_cash', 'property_equipment')),
  initial_balance numeric(14,2) NOT NULL DEFAULT 0,
  current_valuation numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS and add policies
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assets all own" ON public.assets;
CREATE POLICY "assets all own" ON public.assets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS assets_updated ON public.assets;
CREATE TRIGGER assets_updated BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Create Ledger Transactions Table
CREATE TABLE IF NOT EXISTS public.ledger_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  transaction_date date NOT NULL DEFAULT current_date,
  category text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('debit', 'credit')),
  amount numeric(14,2) NOT NULL,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  reconciled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS and add policies
ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ledger_tx all own" ON public.ledger_transactions;
CREATE POLICY "ledger_tx all own" ON public.ledger_transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS ledger_tx_updated ON public.ledger_transactions;
CREATE TRIGGER ledger_tx_updated BEFORE UPDATE ON public.ledger_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Update client_payments and vendor_payments tables
ALTER TABLE public.client_payments ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL;
ALTER TABLE public.client_payments ADD COLUMN IF NOT EXISTS reconciled boolean NOT NULL DEFAULT false;

ALTER TABLE public.vendor_payments ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL;
ALTER TABLE public.vendor_payments ADD COLUMN IF NOT EXISTS reconciled boolean NOT NULL DEFAULT false;
