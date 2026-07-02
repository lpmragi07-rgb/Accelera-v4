-- ============================================================
-- LIGARAUT — Schema do Auto Dialer (Supabase / PostgreSQL)
-- Execute no SQL Editor do Supabase.
-- ============================================================

-- 1. ENUM para status do lead/chamada
do $$ begin
  create type lead_status as enum (
    'pending',          -- aguardando disparo
    'queued',           -- enviado para fila do Twilio
    'calling',          -- chamada em andamento
    'human_answered',   -- humano detectado (AMD)
    'transferred',      -- transferido para operador
    'voicemail',        -- caiu na caixa postal (máquina)
    'no_answer',        -- não atendeu
    'failed',           -- falha técnica
    'completed'         -- finalizado com sucesso
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type operator_status as enum ('available', 'busy', 'offline');
exception when duplicate_object then null; end $$;

-- 2. Função utilitária para atualizar updated_at automaticamente
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- TABELA: operators (operadores que recebem as transferências)
-- ============================================================
create table if not exists public.operators (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  extension   text,                                -- ramal da API4Com (ex.: "1000")
  phone       text,                                -- opcional (referência)
  status      operator_status not null default 'offline', -- intenção do usuário
  on_call     boolean not null default false,      -- sistema: em ligação agora
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- TABELA: campaigns (cada upload de CSV vira uma campanha)
-- ============================================================
create table if not exists public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  status        text not null default 'draft',     -- draft | running | paused | finished
  total_leads   integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- TABELA: leads (cada linha do CSV)
-- ============================================================
create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  campaign_id     uuid not null references public.campaigns(id) on delete cascade,
  company_name    text,
  phone           text not null,                   -- E.164
  status           lead_status not null default 'pending',
  provider_call_id text,                           -- id de cancelamento da API4Com
  answered_by      text,                           -- reservado p/ detalhes de detecção
  operator_id      uuid references public.operators(id) on delete set null,
  record_url       text,                           -- URL da gravação (API4Com)
  outcome          text,                           -- operador: interested | callback | discarded
  outcome_at       timestamptz,
  error_message    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 3. Índices para performance
create index if not exists idx_leads_campaign  on public.leads(campaign_id);
create index if not exists idx_leads_user      on public.leads(user_id);
create index if not exists idx_leads_status    on public.leads(status);
create index if not exists idx_leads_provider_call_id on public.leads(provider_call_id);
create index if not exists idx_operators_user  on public.operators(user_id);
create index if not exists idx_campaigns_user  on public.campaigns(user_id);

-- 4. Triggers de updated_at
drop trigger if exists set_updated_at on public.operators;
create trigger set_updated_at before update on public.operators
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at on public.campaigns;
create trigger set_updated_at before update on public.campaigns
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at on public.leads;
create trigger set_updated_at before update on public.leads
  for each row execute function public.handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — rígido: cada usuário só vê o seu
-- ============================================================
alter table public.operators enable row level security;
alter table public.campaigns enable row level security;
alter table public.leads     enable row level security;

-- OPERATORS
drop policy if exists "operators_select_own" on public.operators;
create policy "operators_select_own" on public.operators
  for select using (auth.uid() = user_id);

drop policy if exists "operators_insert_own" on public.operators;
create policy "operators_insert_own" on public.operators
  for insert with check (auth.uid() = user_id);

drop policy if exists "operators_update_own" on public.operators;
create policy "operators_update_own" on public.operators
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "operators_delete_own" on public.operators;
create policy "operators_delete_own" on public.operators
  for delete using (auth.uid() = user_id);

-- CAMPAIGNS
drop policy if exists "campaigns_select_own" on public.campaigns;
create policy "campaigns_select_own" on public.campaigns
  for select using (auth.uid() = user_id);

drop policy if exists "campaigns_insert_own" on public.campaigns;
create policy "campaigns_insert_own" on public.campaigns
  for insert with check (auth.uid() = user_id);

drop policy if exists "campaigns_update_own" on public.campaigns;
create policy "campaigns_update_own" on public.campaigns
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "campaigns_delete_own" on public.campaigns;
create policy "campaigns_delete_own" on public.campaigns
  for delete using (auth.uid() = user_id);

-- LEADS
drop policy if exists "leads_select_own" on public.leads;
create policy "leads_select_own" on public.leads
  for select using (auth.uid() = user_id);

drop policy if exists "leads_insert_own" on public.leads;
create policy "leads_insert_own" on public.leads
  for insert with check (auth.uid() = user_id);

drop policy if exists "leads_update_own" on public.leads;
create policy "leads_update_own" on public.leads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "leads_delete_own" on public.leads;
create policy "leads_delete_own" on public.leads
  for delete using (auth.uid() = user_id);
