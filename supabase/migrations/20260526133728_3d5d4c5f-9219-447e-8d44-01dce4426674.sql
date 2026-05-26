
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS shipping numeric NOT NULL DEFAULT 0;
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS grn_ref text,
  ADD COLUMN IF NOT EXISTS vehicle_ref text;
ALTER TABLE public.vendor_grns ADD COLUMN IF NOT EXISTS product_id uuid;

DO $$ BEGIN
  CREATE TYPE public.amend_action AS ENUM ('edit', 'delete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.grn_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  grn_id uuid NOT NULL,
  reason text NOT NULL,
  previous_total numeric NOT NULL,
  new_total numeric NOT NULL,
  action public.amend_action NOT NULL DEFAULT 'edit',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grn_amendments TO authenticated;
GRANT ALL ON public.grn_amendments TO service_role;
ALTER TABLE public.grn_amendments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grn_amend all own" ON public.grn_amendments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.doc_counters (
  user_id uuid NOT NULL,
  kind text NOT NULL,
  last_value integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind)
);
GRANT SELECT ON public.doc_counters TO authenticated;
GRANT ALL ON public.doc_counters TO service_role;
ALTER TABLE public.doc_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "counters select own" ON public.doc_counters FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.next_doc_number(_kind text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _next integer;
  _prefix text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _kind = 'invoice' THEN _prefix := 'INV-';
  ELSIF _kind = 'grn' THEN _prefix := 'GRN-';
  ELSE RAISE EXCEPTION 'invalid kind %', _kind; END IF;

  INSERT INTO public.doc_counters (user_id, kind, last_value)
    VALUES (_uid, _kind, 1)
  ON CONFLICT (user_id, kind) DO UPDATE
    SET last_value = public.doc_counters.last_value + 1,
        updated_at = now()
  RETURNING last_value INTO _next;

  RETURN _prefix || lpad(_next::text, 4, '0');
END $$;

GRANT EXECUTE ON FUNCTION public.next_doc_number(text) TO authenticated;
