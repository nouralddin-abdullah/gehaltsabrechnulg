-- 0005_serial_counter.sql — single global counter; allocation only via SECURITY DEFINER fn
create table public.serial_counter (
  id boolean primary key default true,
  value bigint not null,
  constraint serial_counter_singleton check (id)
);

insert into public.serial_counter (id, value)
values (true, 80000)
on conflict (id) do nothing;

alter table public.serial_counter enable row level security;
-- intentionally NO policies: direct table access is denied to all clients.

create or replace function public.allocate_serial()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  next_val bigint;
begin
  update public.serial_counter
     set value = value + 1
   where id = true
  returning value into next_val;
  return next_val;
end;
$$;

revoke all on function public.allocate_serial() from public;
grant execute on function public.allocate_serial() to authenticated;
