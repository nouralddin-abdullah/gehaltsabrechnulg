-- 0006_companies_mandant_box.sql — Mandant box value, distinct from the "oben" mandant line
alter table public.companies
  add column if not exists mandant_box text not null default '';
