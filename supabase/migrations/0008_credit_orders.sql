-- 0008_credit_orders.sql — real credit purchases via Whop checkout.
--
-- Flow:
--   1. User clicks "Buy" → server action creates a PENDING credit_orders row for
--      the signed-in user (create_credit_order, runs with the user's session) and
--      opens a Whop checkout carrying the order id in metadata.
--   2. User pays on Whop. Whop calls our webhook (payment.succeeded) with the
--      order id + a unique payment id.
--   3. The webhook (service_role, no user session) calls fulfill_credit_order,
--      which idempotently marks the order paid, credits the wallet and writes the
--      ledger row — reusing the same user_credits / credit_transactions tables as
--      the print flow (migration 0007).
--
-- Security: like 0007, the wallet tables are never client-writable. Orders are
-- select-own; only the SECURITY DEFINER functions below mutate them. Fulfillment
-- is restricted to service_role (the webhook), so the public anon key can never
-- credit an account without a real Whop payment.

-- ── orders ───────────────────────────────────────────────────────────────────
create table public.credit_orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  pack_id          text not null,
  credits          integer not null check (credits > 0),
  amount           numeric(10, 2) not null check (amount >= 0),
  currency         text not null default 'eur',
  status           text not null default 'pending'
                     check (status in ('pending', 'paid', 'failed')),
  whop_checkout_id text,
  whop_payment_id  text unique,                  -- idempotency: one fulfilment/payment
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.credit_orders enable row level security;

create policy credit_orders_select_own
  on public.credit_orders for select
  using (auth.uid() = user_id);
-- intentionally NO insert/update/delete policies: only the RPCs (definer) write.

create index credit_orders_user_idx
  on public.credit_orders (user_id, created_at desc);

-- ── create_credit_order: open a pending order for the caller ─────────────────
create or replace function public.create_credit_order(
  p_pack_id text,
  p_credits int,
  p_amount  numeric,
  p_currency text default 'eur'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_credits is null or p_credits <= 0 then raise exception 'invalid credits'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'invalid amount'; end if;

  insert into public.credit_orders (user_id, pack_id, credits, amount, currency)
  values (v_uid, p_pack_id, p_credits, p_amount, coalesce(p_currency, 'eur'))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_credit_order(text, int, numeric, text) from public;
grant execute on function public.create_credit_order(text, int, numeric, text) to authenticated;

-- ── attach_checkout: remember the Whop checkout id on a pending order ─────────
create or replace function public.attach_checkout(p_order_id uuid, p_checkout_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  update public.credit_orders
     set whop_checkout_id = p_checkout_id, updated_at = now()
   where id = p_order_id and user_id = v_uid and status = 'pending';
end;
$$;

revoke all on function public.attach_checkout(uuid, text) from public;
grant execute on function public.attach_checkout(uuid, text) to authenticated;

-- ── fulfill_credit_order: credit the wallet after a confirmed payment ─────────
-- Called only by the webhook (service_role). Idempotent: a redelivered or
-- duplicated payment.succeeded never double-credits. Returns the action taken so
-- the webhook can log it.
create or replace function public.fulfill_credit_order(
  p_order_id        uuid,
  p_whop_payment_id text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order   public.credit_orders;
  v_balance int;
begin
  select * into v_order
    from public.credit_orders
   where id = p_order_id
   for update;
  if not found then
    return json_build_object('ok', false, 'reason', 'order_not_found');
  end if;

  -- Already fulfilled (redelivery) → no-op, but report success so Whop stops retrying.
  if v_order.status = 'paid' then
    return json_build_object('ok', true, 'already', true);
  end if;
  if v_order.status <> 'pending' then
    return json_build_object('ok', false, 'reason', 'order_' || v_order.status);
  end if;

  update public.credit_orders
     set status = 'paid',
         whop_payment_id = p_whop_payment_id,
         updated_at = now()
   where id = p_order_id;

  insert into public.user_credits (user_id, balance)
  values (v_order.user_id, v_order.credits)
  on conflict (user_id)
    do update set balance = public.user_credits.balance + excluded.balance,
                  updated_at = now()
  returning balance into v_balance;

  insert into public.credit_transactions (user_id, delta, reason)
  values (v_order.user_id, v_order.credits, 'purchase:' || v_order.pack_id);

  return json_build_object('ok', true, 'credited', v_order.credits, 'balance', v_balance);
end;
$$;

revoke all on function public.fulfill_credit_order(uuid, text) from public;
grant execute on function public.fulfill_credit_order(uuid, text) to service_role;
