
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
