-- Shaq's Poke Stock: private per-user collection storage.
-- Run in the Supabase SQL Editor before enabling cloud accounts.
create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_name text not null check (char_length(item_name) between 1 and 140),
  item_type text not null check (item_type in ('single','graded','sealed','other')),
  language text not null default 'Other',
  quantity integer not null default 1 check (quantity between 1 and 9999),
  condition text not null default 'Not specified',
  purchase_price numeric(12,2) not null default 0 check (purchase_price >= 0),
  current_value numeric(12,2) not null default 0 check (current_value >= 0),
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);
alter table public.collection_items enable row level security;
drop policy if exists "Users can read their own collection" on public.collection_items;
create policy "Users can read their own collection" on public.collection_items
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can add to their own collection" on public.collection_items;
create policy "Users can add to their own collection" on public.collection_items
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their own collection" on public.collection_items;
create policy "Users can update their own collection" on public.collection_items
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own collection" on public.collection_items;
create policy "Users can delete their own collection" on public.collection_items
  for delete to authenticated using (auth.uid() = user_id);
create index if not exists collection_items_user_created_idx on public.collection_items(user_id, created_at desc);

-- Collector metadata fields used by the collection dashboard.
alter table public.collection_items
  add column if not exists grader text not null default '',
  add column if not exists grade text not null default '',
  add column if not exists certificate text not null default '',
  add column if not exists subgrades text not null default '';
