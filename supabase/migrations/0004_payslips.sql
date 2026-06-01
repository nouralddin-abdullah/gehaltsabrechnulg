-- 0004_payslips.sql — one row per employee-month; stores inputs + computed snapshot
create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  year int not null,
  month int not null,
  status text not null default 'draft' check (status in ('draft', 'issued')),
  serial_number bigint,
  issued_at timestamptz,
  template_id text not null default 'datev-classic',
  data jsonb not null default '{}'::jsonb,
  computed_totals jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, year, month)
);

alter table public.payslips enable row level security;

create policy payslips_select_own on public.payslips
  for select using (auth.uid() = owner_id);
create policy payslips_insert_own on public.payslips
  for insert with check (auth.uid() = owner_id);
create policy payslips_update_own on public.payslips
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy payslips_delete_own on public.payslips
  for delete using (auth.uid() = owner_id);

create index payslips_employee_idx on public.payslips (employee_id);
create index payslips_owner_idx on public.payslips (owner_id);
