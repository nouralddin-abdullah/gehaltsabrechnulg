create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  firma text not null default '',
  mandant text not null default '',
  roc_code text not null default '',
  default_template text not null default 'datev-classic',
  created_at timestamptz not null default now()
);

alter table public.companies enable row level security;

create policy "companies_select_own" on public.companies
  for select using (auth.uid() = owner_id);
create policy "companies_insert_own" on public.companies
  for insert with check (auth.uid() = owner_id);
create policy "companies_update_own" on public.companies
  for update using (auth.uid() = owner_id);
create policy "companies_delete_own" on public.companies
  for delete using (auth.uid() = owner_id);

create index companies_owner_idx on public.companies (owner_id);
