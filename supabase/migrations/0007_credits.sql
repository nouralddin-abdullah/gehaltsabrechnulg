-- 0007_credits.sql — credit wallet + per-employee print unlock + identity lock.
--
-- Model:
--   * Printing a payslip costs ONE credit, charged the FIRST time any payslip of
--     an employee is printed. That "unlocks" the employee: every later print /
--     reprint for that same employee is free (`employees.unlocked_at`).
--   * Each payslip still gets its own assign-once serial (reused on reprint).
--   * To stop people unlocking an employee for 1 credit and then reusing the row
--     for a different person, the identity fields (name, birthdate, personnel
--     number) lock 1 hour after the employee is unlocked.
--
-- Security: balances and the ledger are NEVER writable by the client. Tables have
-- a select-own policy and no insert/update/delete policies, so the only way to
-- move credits is through the SECURITY DEFINER functions below (same pattern as
-- serial_counter in 0005). `unlocked_at` is likewise only settable by the
-- privileged print function — a trigger pins it for ordinary client updates.

-- ── wallet ───────────────────────────────────────────────────────────────────
create table public.user_credits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

alter table public.user_credits enable row level security;

create policy user_credits_select_own
  on public.user_credits for select
  using (auth.uid() = user_id);
-- intentionally NO insert/update/delete policies: only the RPCs (definer) write.

-- ── ledger ───────────────────────────────────────────────────────────────────
create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null,                         -- + purchase, - spend
  reason text not null,                           -- 'purchase:<pack>' | 'print'
  employee_id uuid references public.employees (id) on delete set null,
  payslip_id uuid references public.payslips (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.credit_transactions enable row level security;

create policy credit_transactions_select_own
  on public.credit_transactions for select
  using (auth.uid() = user_id);
-- no write policies: written only by the definer functions below.

create index credit_transactions_user_idx
  on public.credit_transactions (user_id, created_at desc);

-- ── new columns ──────────────────────────────────────────────────────────────
alter table public.payslips  add column printed_at  timestamptz; -- last print
alter table public.employees add column unlocked_at timestamptz; -- first paid print

-- ── seed wallets for existing + future users ────────────────────────────────
insert into public.user_credits (user_id, balance)
  select id, 0 from public.profiles
on conflict (user_id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.email
  );
  insert into public.user_credits (user_id, balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- ── identity lock guard ──────────────────────────────────────────────────────
-- Pins `unlocked_at` against client edits and freezes the identity fields once
-- the employee has been unlocked for more than an hour. The privileged print
-- function opts in to changing `unlocked_at` via the `app.allow_unlock` GUC.
create or replace function public.guard_employee_identity()
returns trigger
language plpgsql
as $$
begin
  -- Only the print RPC may move unlocked_at; clients can never set/reset it.
  if current_setting('app.allow_unlock', true) is distinct from '1' then
    new.unlocked_at := old.unlocked_at;
  end if;

  -- Identity frozen 1 hour after the employee was unlocked.
  if old.unlocked_at is not null
     and now() - old.unlocked_at > interval '1 hour' then
    new.name := old.name;
    new.data := jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      new.data,
                      '{mitarbeiter,name}',
                      coalesce(old.data #> '{mitarbeiter,name}', '""'::jsonb),
                      true),
                    '{meta,geburtsdatum}',
                    coalesce(old.data #> '{meta,geburtsdatum}', '""'::jsonb),
                    true),
                  '{meta,persNr}',
                  coalesce(old.data #> '{meta,persNr}', '""'::jsonb),
                  true);
  end if;
  return new;
end;
$$;

create trigger employees_guard_identity
  before update on public.employees
  for each row execute function public.guard_employee_identity();

-- ── grant_credits: add to the caller's wallet (mock purchase for now) ────────
create or replace function public.grant_credits(p_amount int, p_reason text default 'purchase')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_balance int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid amount'; end if;

  insert into public.user_credits (user_id, balance)
  values (v_uid, p_amount)
  on conflict (user_id)
    do update set balance = public.user_credits.balance + excluded.balance,
                  updated_at = now()
  returning balance into v_balance;

  insert into public.credit_transactions (user_id, delta, reason)
  values (v_uid, p_amount, coalesce(p_reason, 'purchase'));

  return v_balance;
end;
$$;

revoke all on function public.grant_credits(int, text) from public;
grant execute on function public.grant_credits(int, text) to authenticated;

-- ── print_payslip: charge once per employee, assign-once serial per payslip ──
create or replace function public.print_payslip(p_payslip_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_employee uuid;
  v_serial bigint;
  v_emp_unlocked timestamptz;
  v_balance int;
  v_charged boolean := false;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select owner_id, employee_id, serial_number
    into v_owner, v_employee, v_serial
    from public.payslips
   where id = p_payslip_id
   for update;
  if not found then raise exception 'payslip not found'; end if;
  if v_owner <> v_uid then raise exception 'forbidden'; end if;

  select unlocked_at into v_emp_unlocked
    from public.employees where id = v_employee for update;

  -- First paid print for this employee: spend one credit and unlock them.
  if v_emp_unlocked is null then
    insert into public.user_credits (user_id, balance)
    values (v_uid, 0) on conflict (user_id) do nothing;

    update public.user_credits
       set balance = balance - 1, updated_at = now()
     where user_id = v_uid and balance > 0
     returning balance into v_balance;
    if not found then raise exception 'insufficient_credits'; end if;

    perform set_config('app.allow_unlock', '1', true);
    update public.employees set unlocked_at = now() where id = v_employee;

    insert into public.credit_transactions (user_id, delta, reason, employee_id, payslip_id)
    values (v_uid, -1, 'print', v_employee, p_payslip_id);

    v_charged := true;
  else
    select balance into v_balance from public.user_credits where user_id = v_uid;
    v_balance := coalesce(v_balance, 0);
  end if;

  -- Assign-once serial for this specific payslip; reuse it on every reprint.
  if v_serial is null then
    update public.serial_counter set value = value + 1 where id = true
      returning value into v_serial;
  end if;

  update public.payslips
     set serial_number = v_serial,
         status = 'issued',
         issued_at = coalesce(issued_at, now()),
         printed_at = now(),
         updated_at = now()
   where id = p_payslip_id;

  return json_build_object('balance', v_balance, 'serial', v_serial, 'charged', v_charged);
end;
$$;

revoke all on function public.print_payslip(uuid) from public;
grant execute on function public.print_payslip(uuid) to authenticated;
