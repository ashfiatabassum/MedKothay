-- B1 core data. RLS starts enabled with no client policies or table grants;
-- the next migrations add the narrowly scoped read paths and stock RPCs.
create table public.pharmacies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  address text not null check (char_length(btrim(address)) between 5 and 300),
  area text not null check (char_length(btrim(area)) between 2 and 80),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  phone text not null check (phone ~ '^01[3-9][0-9]{8}$'),
  licence_number text not null check (char_length(btrim(licence_number)) between 3 and 80),
  licence_number_normalized text generated always as
    (upper(regexp_replace(licence_number, '[[:space:]]', '', 'g'))) stored,
  licence_photo_url text not null check (char_length(btrim(licence_photo_url)) between 1 and 500),
  licence_expiry date not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended')),
  rejection_reason text check (rejection_reason is null or char_length(btrim(rejection_reason)) between 10 and 300),
  previous_rejection_reason text,
  location_source text not null default 'area' check (location_source in ('area', 'device')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer', 'pharmacist', 'admin')),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 100),
  phone text not null check (phone ~ '^01[3-9][0-9]{8}$'),
  pharmacy_id uuid references public.pharmacies(id),
  check (role = 'pharmacist' or pharmacy_id is null)
);

alter table public.pharmacies add constraint pharmacies_reviewed_by_fkey
  foreign key (reviewed_by) references public.profiles(id) on delete set null;

create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null check (char_length(btrim(brand_name)) between 2 and 100),
  generic_name text not null check (char_length(btrim(generic_name)) between 2 and 160),
  manufacturer text not null check (char_length(btrim(manufacturer)) between 2 and 120),
  strength text not null check (char_length(btrim(strength)) between 1 and 80),
  form text not null check (form in ('tablet', 'capsule', 'syrup', 'injection')),
  prescription_only boolean not null default false
);
create unique index medicines_identity_idx on public.medicines
  (lower(brand_name), replace(lower(strength), ' ', ''), form);

create table public.pharmacy_stock (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id),
  medicine_id uuid not null references public.medicines(id),
  quantity integer not null default 0 check (quantity >= 0),
  held_quantity integer not null default 0 check (held_quantity >= 0 and held_quantity <= quantity),
  selling_price numeric(10,2) not null check (selling_price > 0),
  expiry_date date not null,
  updated_at timestamptz not null default now(),
  unique (pharmacy_id, medicine_id)
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id),
  customer_id uuid not null references public.profiles(id),
  client_request_id uuid not null,
  pickup_code text not null check (pickup_code ~ '^[0-9]{6}$'),
  status text not null default 'active'
    check (status in ('active', 'collected', 'cancelled', 'expired')),
  cancellation_reason text check (cancellation_reason is null or cancellation_reason = 'pharmacy_unavailable'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (customer_id, client_request_id),
  check (expires_at > created_at)
);

create table public.reservation_items (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id),
  medicine_id uuid not null references public.medicines(id),
  quantity integer not null check (quantity between 1 and 5),
  unit_price numeric(10,2) not null check (unit_price > 0),
  unique (reservation_id, medicine_id)
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id),
  total numeric(12,2) not null check (total >= 0),
  created_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  medicine_id uuid not null references public.medicines(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price > 0)
);

create index profiles_pharmacy_id_idx on public.profiles(pharmacy_id);
create index pharmacies_status_licence_idx on public.pharmacies(status, licence_expiry);
create index pharmacies_licence_normalized_idx on public.pharmacies(licence_number_normalized);
create index pharmacies_reviewed_by_idx on public.pharmacies(reviewed_by);
create index pharmacy_stock_medicine_idx on public.pharmacy_stock(medicine_id);
create index reservations_pharmacy_status_idx on public.reservations(pharmacy_id, status, expires_at);
create index reservations_customer_status_idx on public.reservations(customer_id, status, expires_at);
create index reservation_items_medicine_idx on public.reservation_items(medicine_id);
create index sales_pharmacy_created_idx on public.sales(pharmacy_id, created_at desc);
create index sale_items_sale_idx on public.sale_items(sale_id);
create index sale_items_medicine_idx on public.sale_items(medicine_id);

alter table public.pharmacies enable row level security;
alter table public.profiles enable row level security;
alter table public.medicines enable row level security;
alter table public.pharmacy_stock enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_items enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

revoke all on public.pharmacies, public.profiles, public.medicines,
  public.pharmacy_stock, public.reservations, public.reservation_items,
  public.sales, public.sale_items from public, anon, authenticated;

-- Metadata is read only at creation, and never used by RLS.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_name text;
  v_phone text;
begin
  v_role := case when new.raw_user_meta_data ->> 'account_type' = 'pharmacy'
    then 'pharmacist' else 'customer' end;
  v_name := left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 100);
  v_phone := coalesce(new.raw_user_meta_data ->> 'phone', '');
  if char_length(v_name) < 2 or v_phone !~ '^01[3-9][0-9]{8}$' then
    raise exception 'Valid name and Bangladeshi mobile number are required';
  end if;
  insert into public.profiles(id, role, full_name, phone)
    values (new.id, v_role, v_name, v_phone);
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
