-- Migration: Add shipping (freight) columns to invoice_items and vendor_grn_items tables
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS shipping numeric DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS shipping_formula text;
ALTER TABLE public.vendor_grn_items ADD COLUMN IF NOT EXISTS shipping numeric DEFAULT 0;
ALTER TABLE public.vendor_grn_items ADD COLUMN IF NOT EXISTS shipping_formula text;
