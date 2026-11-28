-- Shaq's Poke Stock business ledger. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.business_stock (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 sku text not null,
 item_name text not null,
 category text not null default 'single' check(category in ('single','sealed','graded','supplies','other')),
 language text not null default 'Other',
 source text not null default '',
 quantity_purchased integer not null default 0 check(quantity_purchased >= 0),
 quantity_remaining integer not null default 0 check(quantity_remaining >= 0),
 total_cost numeric(12,2) not null default 0 check(total_cost >= 0),
 unit_cost numeric(12,4) generated always as (case when quantity_purchased > 0 then total_cost / quantity_purchased else 0 end) stored,
 purchase_date date not null default current_date,
 notes text not null default '',
 created_at timestamptz not null default now(),
 unique(user_id,sku)
);
create table if not exists public.business_sales (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 platform text not null check(platform in ('ebay','whatnot','manual')),
 external_order_id text not null,
 external_line_id text not null default '',
 sale_date timestamptz not null,
 item_name text not null,
 sku text,
 quantity integer not null default 1 check(quantity > 0),
 gross_item_amount numeric(12,2) not null default 0,
 buyer_shipping numeric(12,2) not null default 0,
 platform_fee numeric(12,2) not null default 0,
 postage_cost numeric(12,2) not null default 0,
 other_fee numeric(12,2) not null default 0,
 cost_of_goods numeric(12,2) not null default 0,
 refund_amount numeric(12,2) not null default 0,
 currency text not null default 'AUD',
 show_name text not null default '',
 status text not null default 'completed',
 raw_data jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 unique(user_id,platform,external_order_id,external_line_id)
);
create table if not exists public.business_sync_runs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 platform text not null,
 status text not null,
 imported_count integer not null default 0,
 error_message text not null default '',
 started_at timestamptz not null default now(),
 finished_at timestamptz
);
create index if not exists business_stock_user_idx on public.business_stock(user_id,purchase_date desc);
create index if not exists business_sales_user_date_idx on public.business_sales(user_id,sale_date desc);
create index if not exists business_sales_platform_idx on public.business_sales(user_id,platform,sale_date desc);
alter table public.business_stock enable row level security;
alter table public.business_sales enable row level security;
alter table public.business_sync_runs enable row level security;
drop policy if exists "own stock" on public.business_stock;
create policy "own stock" on public.business_stock for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "own sales" on public.business_sales;
create policy "own sales" on public.business_sales for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "own sync runs" on public.business_sync_runs;
create policy "own sync runs" on public.business_sync_runs for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
