-- Add mathematical expression audit trail columns

-- Invoice Items table
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS quantity_formula text;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS unit_price_formula text;

-- Invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_formula text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_formula text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS shipping_formula text;

-- Vendor Goods Received Notes (GRN) table
ALTER TABLE vendor_grns ADD COLUMN IF NOT EXISTS quantity_formula text;
ALTER TABLE vendor_grns ADD COLUMN IF NOT EXISTS unit_price_formula text;
ALTER TABLE vendor_grns ADD COLUMN IF NOT EXISTS discount_formula text;
ALTER TABLE vendor_grns ADD COLUMN IF NOT EXISTS tax_formula text;
ALTER TABLE vendor_grns ADD COLUMN IF NOT EXISTS shipping_formula text;
