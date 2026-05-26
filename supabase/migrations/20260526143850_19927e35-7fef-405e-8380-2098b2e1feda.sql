-- Extend ui_theme enum
ALTER TYPE public.ui_theme ADD VALUE IF NOT EXISTS 'coloured';

-- Payment amendments audit table
CREATE TABLE IF NOT EXISTS public.payment_amendments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  payment_id uuid,
  client_id uuid NOT NULL,
  action public.amend_action NOT NULL DEFAULT 'edit',
  previous_amount numeric NOT NULL,
  new_amount numeric NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_amendments TO authenticated;
GRANT ALL ON public.payment_amendments TO service_role;

ALTER TABLE public.payment_amendments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pay_amend all own"
ON public.payment_amendments
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);