-- ============================================================
-- LIGARAUT — Migração: Twilio -> API4Com
-- Execute no SQL Editor do Supabase (após já ter rodado schema.sql).
-- ============================================================

-- 1. Operadores agora usam RAMAL (extension) da API4Com.
--    Mantemos phone como opcional (referência), mas o discador usa o ramal.
alter table public.operators
  add column if not exists extension text;

alter table public.operators
  alter column phone drop not null;

-- 2. Leads: renomeia o id de chamada para algo agnóstico de provedor
--    e adiciona a URL da gravação fornecida pela API4Com.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads'
      and column_name = 'twilio_call_sid'
  ) then
    alter table public.leads rename column twilio_call_sid to provider_call_id;
  end if;
end $$;

alter table public.leads
  add column if not exists provider_call_id text;

alter table public.leads
  add column if not exists record_url text;

-- 3. Reaproveita o índice do id de chamada (renomeia se existir)
do $$ begin
  if exists (select 1 from pg_indexes where indexname = 'idx_leads_call_sid') then
    alter index idx_leads_call_sid rename to idx_leads_provider_call_id;
  end if;
end $$;

create index if not exists idx_leads_provider_call_id
  on public.leads(provider_call_id);
