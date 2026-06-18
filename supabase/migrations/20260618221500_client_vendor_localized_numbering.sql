-- Add columns to public.vendors
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS code_prefix text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS next_grn_sequence integer NOT NULL DEFAULT 1;

-- Add columns to public.clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS code_prefix text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS next_invoice_sequence integer NOT NULL DEFAULT 1;

-- Populate existing vendors' code_prefix using prefix generation logic in SQL
CREATE OR REPLACE FUNCTION public.sql_generate_code_prefix(name text)
RETURNS text AS $$
DECLARE
  clean text;
BEGIN
  clean := name;
  -- case-insensitive remove prefixes like 'the ', 'a ', 'an ', 'shop '
  clean := regexp_replace(clean, '^(the|a|an|shop)\s+', '', 'i');
  -- strip non-alphanumeric and spaces
  clean := regexp_replace(clean, '[^a-zA-Z0-9]', '', 'g');
  -- uppercase and first 3 chars, padded to 3 chars with 'X'
  clean := upper(substring(clean from 1 for 3));
  clean := rpad(clean, 3, 'X');
  RETURN clean;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

UPDATE public.vendors 
SET code_prefix = public.sql_generate_code_prefix(name) 
WHERE code_prefix IS NULL;

UPDATE public.clients 
SET code_prefix = public.sql_generate_code_prefix(name) 
WHERE code_prefix IS NULL;

-- Make code_prefix NOT NULL after populating
ALTER TABLE public.vendors ALTER COLUMN code_prefix SET NOT NULL;
ALTER TABLE public.clients ALTER COLUMN code_prefix SET NOT NULL;

-- Add triggers to auto-increment counters on insert in invoices and vendor_grns
CREATE OR REPLACE FUNCTION public.increment_vendor_grn_counter()
RETURNS TRIGGER AS $$
DECLARE
  _prefix text;
  _seq integer;
BEGIN
  SELECT code_prefix INTO _prefix FROM public.vendors WHERE id = NEW.vendor_id;
  
  IF NEW.grn_number ~ ('^GRN-' || _prefix || '-[0-9]{4}$') THEN
    _seq := (substring(NEW.grn_number from '[0-9]{4}$'))::integer;
    UPDATE public.vendors 
    SET next_grn_sequence = GREATEST(next_grn_sequence, _seq + 1)
    WHERE id = NEW.vendor_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_vendor_grn_inserted
  AFTER INSERT ON public.vendor_grns
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_vendor_grn_counter();

CREATE OR REPLACE FUNCTION public.increment_client_invoice_counter()
RETURNS TRIGGER AS $$
DECLARE
  _prefix text;
  _seq integer;
BEGIN
  SELECT code_prefix INTO _prefix FROM public.clients WHERE id = NEW.client_id;
  
  IF NEW.invoice_number ~ ('^INV-' || _prefix || '-[0-9]{4}$') THEN
    _seq := (substring(NEW.invoice_number from '[0-9]{4}$'))::integer;
    UPDATE public.clients 
    SET next_invoice_sequence = GREATEST(next_invoice_sequence, _seq + 1)
    WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_invoice_inserted
  AFTER INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_client_invoice_counter();

-- Functions to fetch next document number
CREATE OR REPLACE FUNCTION public.get_next_grn_number(_vendor_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _prefix text;
  _seq integer;
  _grn_num text;
  _exists boolean;
BEGIN
  SELECT code_prefix, next_grn_sequence INTO _prefix, _seq 
  FROM public.vendors 
  WHERE id = _vendor_id;
  
  IF _prefix IS NULL THEN
    RAISE EXCEPTION 'Vendor not found or prefix not set';
  END IF;
  
  LOOP
    _grn_num := 'GRN-' || _prefix || '-' || lpad(_seq::text, 4, '0');
    SELECT EXISTS (
      SELECT 1 FROM public.vendor_grns 
      WHERE vendor_id = _vendor_id AND grn_number = _grn_num
    ) INTO _exists;
    
    IF NOT _exists THEN
      EXIT;
    END IF;
    _seq := _seq + 1;
  END LOOP;
  
  RETURN _grn_num;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_invoice_number(_client_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _prefix text;
  _seq integer;
  _inv_num text;
  _exists boolean;
BEGIN
  SELECT code_prefix, next_invoice_sequence INTO _prefix, _seq 
  FROM public.clients 
  WHERE id = _client_id;
  
  IF _prefix IS NULL THEN
    RAISE EXCEPTION 'Client not found or prefix not set';
  END IF;
  
  LOOP
    _inv_num := 'INV-' || _prefix || '-' || lpad(_seq::text, 4, '0');
    SELECT EXISTS (
      SELECT 1 FROM public.invoices 
      WHERE client_id = _client_id AND invoice_number = _inv_num
    ) INTO _exists;
    
    IF NOT _exists THEN
      EXIT;
    END IF;
    _seq := _seq + 1;
  END LOOP;
  
  RETURN _inv_num;
END;
$$;

-- Grant execute permissions on functions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_next_grn_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_invoice_number(uuid) TO authenticated;
