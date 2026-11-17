-- Shaq's Poke Stock: private Whatnot dashboard data.
-- Run AFTER creating and confirming the owner's Supabase Auth account.
-- Replace OWNER_EMAIL_REPLACE_ME below with that exact account email before running.
-- Never store the Whatnot personal access token in these tables or browser code.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.whatnot_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.whatnot_admins enable row level security;
revoke all on private.whatnot_admins from public, anon, authenticated;

create or replace function public.is_whatnot_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.whatnot_admins
    where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_whatnot_admin() from public, anon;
grant execute on function public.is_whatnot_admin() to authenticated;

create table if not exists public.whatnot_products (
  id text primary key,
  title text not null default '',
  sku text not null default '',
  status text not null default '',
  quantity integer not null default 0,
  price numeric(12,2),
  currency text not null default 'AUD',
  raw_data jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create table if not exists public.whatnot_orders (
  id text primary key,
  order_number text not null default '',
  status text not null default '',
  currency text not null default 'AUD',
  subtotal numeric(12,2) not null default 0,
  shipping numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  fees numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  sold_at timestamptz,
  raw_data jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create table if not exists public.whatnot_order_items (
  id text primary key,
  order_id text not null references public.whatnot_orders(id) on delete cascade,
  product_id text not null default '',
  title text not null default '',
  sku text not null default '',
  quantity integer not null default 1,
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  raw_data jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create table if not exists public.whatnot_sync_runs (
  id bigint generated always as identity primary key,
  resource text not null,
  outcome text not null,
  records_seen integer not null default 0,
  message text not null default '',
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.whatnot_products enable row level security;
alter table public.whatnot_orders enable row level security;
alter table public.whatnot_order_items enable row level security;
alter table public.whatnot_sync_runs enable row level security;

drop policy if exists "Whatnot admins only products" on public.whatnot_products;
create policy "Whatnot admins only products" on public.whatnot_products
  for all to authenticated using ((select public.is_whatnot_admin()))
  with check ((select public.is_whatnot_admin()));

drop policy if exists "Whatnot admins only orders" on public.whatnot_orders;
create policy "Whatnot admins only orders" on public.whatnot_orders
  for all to authenticated using ((select public.is_whatnot_admin()))
  with check ((select public.is_whatnot_admin()));

drop policy if exists "Whatnot admins only order items" on public.whatnot_order_items;
create policy "Whatnot admins only order items" on public.whatnot_order_items
  for all to authenticated using ((select public.is_whatnot_admin()))
  with check ((select public.is_whatnot_admin()));

drop policy if exists "Whatnot admins only sync runs" on public.whatnot_sync_runs;
create policy "Whatnot admins only sync runs" on public.whatnot_sync_runs
  for all to authenticated using ((select public.is_whatnot_admin()))
  with check ((select public.is_whatnot_admin()));

grant select, insert, update, delete on public.whatnot_products to authenticated;
grant select, insert, update, delete on public.whatnot_orders to authenticated;
grant select, insert, update, delete on public.whatnot_order_items to authenticated;
grant select, insert, update, delete on public.whatnot_sync_runs to authenticated;
grant usage, select on sequence public.whatnot_sync_runs_id_seq to authenticated;

-- Bootstrap exactly one approved administrator by email.
do $$
declare
  inserted_count integer;
begin
  insert into private.whatnot_admins (user_id)
  select id from auth.users
  where lower(email) = lower('OWNER_EMAIL_REPLACE_ME')
  on conflict (user_id) do nothing;
  get diagnostics inserted_count = row_count;
  if not exists (
    select 1 from private.whatnot_admins a
    join auth.users u on u.id = a.user_id
    where lower(u.email) = lower('OWNER_EMAIL_REPLACE_ME')
  ) then
    raise exception 'Owner account not found. Create and confirm the Supabase Auth account, replace OWNER_EMAIL_REPLACE_ME with its email, then rerun this SQL.';
  end if;
end $$;

-- Restrict the dashboard tables to the single bootstrapped owner.
-- Do not add public or anon policies to these tables.
