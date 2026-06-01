create table public.employees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.employees enable row level security;

create policy "employees_select_own" on public.employees
  for select using (auth.uid() = owner_id);
create policy "employees_insert_own" on public.employees
  for insert with check (auth.uid() = owner_id);
create policy "employees_update_own" on public.employees
  for update using (auth.uid() = owner_id);
create policy "employees_delete_own" on public.employees
  for delete using (auth.uid() = owner_id);

create index employees_owner_idx on public.employees (owner_id);
create index employees_company_idx on public.employees (company_id);
