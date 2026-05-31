

-- ==========================================
-- MIGRATION: 20260526115736_00f45265-2854-46b1-89a5-b457572b94a5.sql
-- ==========================================


-- Enums
create type public.app_role as enum ('admin', 'user');
create type public.invoice_status as enum ('draft', 'posted');
create type public.payment_method as enum ('cash', 'bank', 'cheque', 'mobile', 'other');
create type public.currency_code as enum ('PKR', 'USD', 'EUR');
create type public.ui_theme as enum ('light', 'dark', 'contrast');
create type public.doc_template as enum ('classic', 'modern', 'compact');

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- Profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using (auth.uid() = user_id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = user_id);
create policy "own profile update" on public.profiles for update using (auth.uid() = user_id);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- user_roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique (user_id, role)
);
alter table public.user_roles enable row level security;
create policy "view own roles" on public.user_roles for select using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

-- Auto-create profile + default role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  insert into public.app_settings (user_id) values (new.id);
  return new;
end; $$;

-- app_settings
create table public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency currency_code not null default 'PKR',
  theme ui_theme not null default 'light',
  default_doc_template doc_template not null default 'classic',
  business_name text,
  business_address text,
  business_phone text,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
create policy "own settings select" on public.app_settings for select using (auth.uid() = user_id);
create policy "own settings insert" on public.app_settings for insert with check (auth.uid() = user_id);
create policy "own settings update" on public.app_settings for update using (auth.uid() = user_id);
create trigger settings_updated before update on public.app_settings for each row execute function public.set_updated_at();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Vendors
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  opening_balance numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.vendors enable row level security;
create policy "vendors all own" on public.vendors for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger vendors_updated before update on public.vendors for each row execute function public.set_updated_at();

create table public.vendor_grns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  grn_number text not null,
  material text not null,
  quantity numeric(14,3) not null default 0,
  unit text not null default 'kg',
  unit_price numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  grn_date date not null default current_date,
  doc_template doc_template not null default 'classic',
  notes text,
  created_at timestamptz not null default now()
);
alter table public.vendor_grns enable row level security;
create policy "grns all own" on public.vendor_grns for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.vendor_grns(vendor_id);

create table public.vendor_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  amount numeric(14,2) not null,
  payment_date date not null default current_date,
  method payment_method not null default 'bank',
  reference text,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.vendor_payments enable row level security;
create policy "vpay all own" on public.vendor_payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.vendor_payments(vendor_id);

-- Clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  opening_balance numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.clients enable row level security;
create policy "clients all own" on public.clients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger clients_updated before update on public.clients for each row execute function public.set_updated_at();

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  invoice_number text not null,
  status invoice_status not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  doc_template doc_template not null default 'classic',
  notes text,
  posted_at timestamptz,
  current_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.invoices enable row level security;
create policy "invoices all own" on public.invoices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger invoices_updated before update on public.invoices for each row execute function public.set_updated_at();
create index on public.invoices(client_id);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(14,3) not null default 1,
  unit_price numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  sort_order int not null default 0
);
alter table public.invoice_items enable row level security;
create policy "items via invoice" on public.invoice_items for all
  using (exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid()))
  with check (exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid()));

create table public.invoice_amendments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  previous_total numeric(14,2) not null,
  new_total numeric(14,2) not null,
  created_at timestamptz not null default now()
);
alter table public.invoice_amendments enable row level security;
create policy "amend all own" on public.invoice_amendments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.client_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  amount numeric(14,2) not null,
  payment_date date not null default current_date,
  method payment_method not null default 'cash',
  reference text,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.client_payments enable row level security;
create policy "cpay all own" on public.client_payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.client_payments(client_id);
create index on public.client_payments(payment_date desc);


-- ==========================================
-- MIGRATION: 20260526115803_ac9bb394-75c4-41e9-88aa-8b1a58cd1f6a.sql
-- ==========================================


create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

revoke execute on function public.has_role(uuid, app_role) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;


-- ==========================================
-- MIGRATION: 20260526124508_b03172fe-2c95-43c1-acdc-df6f93de3a64.sql
-- ==========================================


-- 1. business_logo_url on app_settings
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS business_logo_url text;

-- 2. products table
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  sku text,
  description text,
  unit text NOT NULL DEFAULT 'pcs',
  default_price numeric NOT NULL DEFAULT 0,
  default_tax_rate numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products all own" ON public.products FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_products_user ON public.products(user_id);

-- 3. business-assets storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('business-assets', 'business-assets', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "business-assets public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'business-assets');
CREATE POLICY "business-assets own insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'business-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "business-assets own update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'business-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "business-assets own delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'business-assets' AND auth.uid()::text = (storage.foldername(name))[1]);


-- ==========================================
-- MIGRATION: 20260526133728_3d5d4c5f-9219-447e-8d44-01dce4426674.sql
-- ==========================================


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


-- ==========================================
-- MIGRATION: 20260526133927_31195f0d-41cb-4b98-b028-eb00a1bb799a.sql
-- ==========================================

ALTER TYPE public.doc_template ADD VALUE IF NOT EXISTS 'acelog';

-- ==========================================
-- MIGRATION: 20260526143850_19927e35-7fef-405e-8380-2098b2e1feda.sql
-- ==========================================

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

-- ==========================================
-- MIGRATION: 20260526143919_55066f9f-e672-4c91-b518-b179609a5da2.sql
-- ==========================================

ALTER TYPE public.currency_code ADD VALUE IF NOT EXISTS 'INR';
ALTER TYPE public.currency_code ADD VALUE IF NOT EXISTS 'BDT';
ALTER TYPE public.currency_code ADD VALUE IF NOT EXISTS 'AED';
ALTER TYPE public.currency_code ADD VALUE IF NOT EXISTS 'LKR';
ALTER TYPE public.currency_code ADD VALUE IF NOT EXISTS 'GBP';
ALTER TYPE public.currency_code ADD VALUE IF NOT EXISTS 'SAR';
ALTER TYPE public.currency_code ADD VALUE IF NOT EXISTS 'CNY';

-- ==========================================
-- MIGRATION: 20260526150926_bb76f48f-a767-4439-93e1-aa159ae1c902.sql
-- ==========================================

ALTER TYPE ui_theme ADD VALUE IF NOT EXISTS 'lavender';
ALTER TYPE ui_theme ADD VALUE IF NOT EXISTS 'maroon';
ALTER TYPE ui_theme ADD VALUE IF NOT EXISTS 'green';

-- ==========================================
-- MIGRATION: 20260526151200_b8fa3212-7537-4ed4-89a2-402f7a93f149.sql
-- ==========================================

UPDATE public.app_settings SET theme='lavender' WHERE theme='coloured';

-- ==========================================
-- MIGRATION: 20260526160730_5f680420-490d-4c6b-ae95-3ded8efde775.sql
-- ==========================================


-- 1) Tighten storage.objects policies for business-assets bucket
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "business-assets public read" ON storage.objects;
DROP POLICY IF EXISTS "business-assets read own" ON storage.objects;
DROP POLICY IF EXISTS "business-assets insert own" ON storage.objects;
DROP POLICY IF EXISTS "business-assets update own" ON storage.objects;
DROP POLICY IF EXISTS "business-assets delete own" ON storage.objects;

-- Public URL access (/object/public/*) bypasses RLS, so restricting SELECT
-- here prevents listing/browsing while logos still render via public URLs.
CREATE POLICY "business-assets read own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'business-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "business-assets insert own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'business-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "business-assets update own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'business-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "business-assets delete own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'business-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 2) doc_counters: add owner-scoped write policies
CREATE POLICY "counters insert own" ON public.doc_counters
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "counters update own" ON public.doc_counters
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "counters delete own" ON public.doc_counters
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3) Revoke EXECUTE on SECURITY DEFINER functions from anon/public.
--    Trigger-only functions: revoke from authenticated too.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

--    Callable functions: keep authenticated, drop anon/public.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.next_doc_number(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_doc_number(text) TO authenticated;


-- ==========================================
-- MIGRATION: 20260526160805_880c2e3c-f6f6-4e1d-9ef2-7503e98786da.sql
-- ==========================================

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;

-- ==========================================
-- MIGRATION: 20260531023000_grn_draft_posted.sql
-- ==========================================

-- Add status column to vendor_grns with CHECK constraint and default 'posted' (so existing GRNs remain active)
ALTER TABLE public.vendor_grns ADD COLUMN IF NOT EXISTS status text DEFAULT 'posted' CHECK (status IN ('draft', 'posted'));

-- Add posted_at column to vendor_grns
ALTER TABLE public.vendor_grns ADD COLUMN IF NOT EXISTS posted_at timestamp with time zone;

-- Set posted_at for existing posted GRNs to their created_at time
UPDATE public.vendor_grns SET posted_at = created_at WHERE status = 'posted' AND posted_at IS NULL;
