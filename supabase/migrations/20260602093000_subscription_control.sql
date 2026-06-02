-- 1. Helper function to check if tenant is active
CREATE OR REPLACE FUNCTION public.is_tenant_active(_user_id uuid)
RETURNS boolean SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE
  _status text;
  _trial_ends timestamptz;
BEGIN
  SELECT status, trial_ends_at INTO _status, _trial_ends
  FROM public.tenant_profiles
  WHERE user_id = _user_id;

  IF _status = 'active' THEN
    RETURN true;
  ELSIF _status = 'trialing' AND _trial_ends >= now() THEN
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END; $$;

-- 2. Restrict document counters increment function
CREATE OR REPLACE FUNCTION public.next_doc_number(_business_id uuid, _kind text)
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
  
  -- Validate tenant is active
  IF NOT public.is_tenant_active(_uid) THEN
    RAISE EXCEPTION 'unauthorized tenant access (inactive subscription)';
  END IF;

  -- Validate user owns business
  IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = _business_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'unauthorized business access';
  END IF;

  IF _kind = 'invoice' THEN _prefix := 'INV-';
  ELSIF _kind = 'grn' THEN _prefix := 'GRN-';
  ELSE RAISE EXCEPTION 'invalid kind %', _kind; END IF;

  INSERT INTO public.doc_counters (user_id, business_id, kind, last_value)
    VALUES (_uid, _business_id, _kind, 1)
  ON CONFLICT (business_id, kind) DO UPDATE
    SET last_value = public.doc_counters.last_value + 1,
        updated_at = now()
  RETURNING last_value INTO _next;

  RETURN _prefix || lpad(_next::text, 4, '0');
END $$;

-- 3. Redefine RLS policies for all data tables to block writes for inactive/suspended tenants
-- businesses
DROP POLICY IF EXISTS "businesses all own" ON public.businesses;
CREATE POLICY "businesses select own" ON public.businesses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "businesses insert own" ON public.businesses FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "businesses update own" ON public.businesses FOR UPDATE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid())) WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "businesses delete own" ON public.businesses FOR DELETE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));

-- vendors
DROP POLICY IF EXISTS "vendors all own" ON public.vendors;
CREATE POLICY "vendors select own" ON public.vendors FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "vendors insert own" ON public.vendors FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "vendors update own" ON public.vendors FOR UPDATE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid())) WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "vendors delete own" ON public.vendors FOR DELETE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));

-- clients
DROP POLICY IF EXISTS "clients all own" ON public.clients;
CREATE POLICY "clients select own" ON public.clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "clients insert own" ON public.clients FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "clients update own" ON public.clients FOR UPDATE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid())) WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "clients delete own" ON public.clients FOR DELETE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));

-- products
DROP POLICY IF EXISTS "products all own" ON public.products;
CREATE POLICY "products select own" ON public.products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "products insert own" ON public.products FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "products update own" ON public.products FOR UPDATE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid())) WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "products delete own" ON public.products FOR DELETE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));

-- vendor_grns
DROP POLICY IF EXISTS "grns all own" ON public.vendor_grns;
CREATE POLICY "grns select own" ON public.vendor_grns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "grns insert own" ON public.vendor_grns FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "grns update own" ON public.vendor_grns FOR UPDATE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid())) WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "grns delete own" ON public.vendor_grns FOR DELETE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));

-- vendor_payments
DROP POLICY IF EXISTS "vpay all own" ON public.vendor_payments;
CREATE POLICY "vpay select own" ON public.vendor_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "vpay insert own" ON public.vendor_payments FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "vpay update own" ON public.vendor_payments FOR UPDATE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid())) WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "vpay delete own" ON public.vendor_payments FOR DELETE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));

-- invoices
DROP POLICY IF EXISTS "invoices all own" ON public.invoices;
CREATE POLICY "invoices select own" ON public.invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "invoices insert own" ON public.invoices FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "invoices update own" ON public.invoices FOR UPDATE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid())) WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "invoices delete own" ON public.invoices FOR DELETE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));

-- client_payments
DROP POLICY IF EXISTS "cpay all own" ON public.client_payments;
CREATE POLICY "cpay select own" ON public.client_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cpay insert own" ON public.client_payments FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "cpay update own" ON public.client_payments FOR UPDATE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid())) WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "cpay delete own" ON public.client_payments FOR DELETE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));

-- assets
DROP POLICY IF EXISTS "assets all own" ON public.assets;
CREATE POLICY "assets select own" ON public.assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "assets insert own" ON public.assets FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "assets update own" ON public.assets FOR UPDATE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid())) WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "assets delete own" ON public.assets FOR DELETE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));

-- ledger_transactions
DROP POLICY IF EXISTS "ledger_tx all own" ON public.ledger_transactions;
CREATE POLICY "ledger_tx select own" ON public.ledger_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ledger_tx insert own" ON public.ledger_transactions FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "ledger_tx update own" ON public.ledger_transactions FOR UPDATE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid())) WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "ledger_tx delete own" ON public.ledger_transactions FOR DELETE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));

-- invoice_amendments
DROP POLICY IF EXISTS "amend all own" ON public.invoice_amendments;
CREATE POLICY "amend select own" ON public.invoice_amendments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "amend insert own" ON public.invoice_amendments FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "amend update own" ON public.invoice_amendments FOR UPDATE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid())) WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "amend delete own" ON public.invoice_amendments FOR DELETE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));

-- grn_amendments
DROP POLICY IF EXISTS "grn_amend all own" ON public.grn_amendments;
CREATE POLICY "grn_amend select own" ON public.grn_amendments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "grn_amend insert own" ON public.grn_amendments FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "grn_amend update own" ON public.grn_amendments FOR UPDATE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid())) WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "grn_amend delete own" ON public.grn_amendments FOR DELETE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));

-- payment_amendments
DROP POLICY IF EXISTS "pay_amend all own" ON public.payment_amendments;
CREATE POLICY "pay_amend select own" ON public.payment_amendments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "pay_amend insert own" ON public.payment_amendments FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "pay_amend update own" ON public.payment_amendments FOR UPDATE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid())) WITH CHECK (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));
CREATE POLICY "pay_amend delete own" ON public.payment_amendments FOR DELETE USING (auth.uid() = user_id AND public.is_tenant_active(auth.uid()));

-- invoice_items (child table of invoices)
DROP POLICY IF EXISTS "items via invoice" ON public.invoice_items;
CREATE POLICY "items select via invoice" ON public.invoice_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid()));
CREATE POLICY "items insert via invoice" ON public.invoice_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid()) AND public.is_tenant_active(auth.uid()));
CREATE POLICY "items update via invoice" ON public.invoice_items FOR UPDATE USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid() AND public.is_tenant_active(auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid() AND public.is_tenant_active(auth.uid())));
CREATE POLICY "items delete via invoice" ON public.invoice_items FOR DELETE USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid() AND public.is_tenant_active(auth.uid())));
