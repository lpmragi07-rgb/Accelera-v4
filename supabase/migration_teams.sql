-- ============================================================
-- LIGARAUT — Migração: times (contas compartilhadas)
-- Execute no SQL Editor do Supabase (após todas as migrações anteriores).
--
-- Problema que resolve: operators/campaigns/leads são hoje visíveis só
-- pra quem os criou (RLS por user_id). Se duas pessoas se cadastram com
-- contas separadas (ex.: um operador cria a própria conta), uma nunca
-- vê os dados da outra — nem no ranking do relatório, nem em lugar
-- nenhum. Esta migração introduz "times": várias contas (auth.users)
-- podem compartilhar o mesmo conjunto de operadores/campanhas/leads.
-- ============================================================

-- 1. TABELAS -----------------------------------------------------------

create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- Garante no máximo um time "ativo" (is_primary) por pessoa.
create unique index if not exists idx_team_members_one_primary
  on public.team_members(user_id)
  where is_primary;

create index if not exists idx_team_members_user on public.team_members(user_id);

-- 2. FUNÇÃO AUXILIAR (evita recursão de RLS) ----------------------------
-- Qualquer política que precisar checar "sou membro deste time" usa esta
-- função em vez de fazer "select ... from team_members" direto dentro da
-- própria política de team_members — isso causaria recursão infinita.
-- SECURITY DEFINER: roda ignorando RLS internamente, mas só devolve os
-- times do PRÓPRIO auth.uid(), então não vaza nada de ninguém.
create or replace function public.my_team_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select team_id from public.team_members where user_id = auth.uid()
$$;

grant execute on function public.my_team_ids() to authenticated;

-- 3. AUTO-CRIA UM TIME PESSOAL PRA CADA CONTA NOVA ----------------------
create or replace function public.handle_new_user_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  insert into public.teams (name, owner_id)
  values (coalesce(split_part(new.email, '@', 1), 'Minha') || ' — Equipe', new.id)
  returning id into v_team_id;

  insert into public.team_members (team_id, user_id, is_primary)
  values (v_team_id, new.id, true);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_team on auth.users;
create trigger on_auth_user_created_team
  after insert on auth.users
  for each row execute function public.handle_new_user_team();

-- 4. BACKFILL: contas que já existiam antes desta migração --------------
-- Cria um time pessoal + membership pra toda conta que ainda não tem
-- nenhum (cobre a conta principal e a de qualquer operador que já
-- tenha se cadastrado, mesmo sem ter criado operators/campaigns/leads).
do $$
declare
  u record;
  v_team_id uuid;
begin
  for u in
    select au.id, au.email
    from auth.users au
    where not exists (
      select 1 from public.team_members tm where tm.user_id = au.id
    )
  loop
    insert into public.teams (name, owner_id)
    values (coalesce(split_part(u.email, '@', 1), 'Minha') || ' — Equipe', u.id)
    returning id into v_team_id;

    insert into public.team_members (team_id, user_id, is_primary)
    values (v_team_id, u.id, true);
  end loop;
end $$;

-- 5. COLUNA team_id NAS TABELAS DE DADOS --------------------------------
alter table public.operators add column if not exists team_id uuid references public.teams(id);
alter table public.campaigns add column if not exists team_id uuid references public.teams(id);
alter table public.leads     add column if not exists team_id uuid references public.teams(id);

update public.operators o
  set team_id = tm.team_id
  from public.team_members tm
  where tm.user_id = o.user_id and tm.is_primary = true and o.team_id is null;

update public.campaigns c
  set team_id = tm.team_id
  from public.team_members tm
  where tm.user_id = c.user_id and tm.is_primary = true and c.team_id is null;

update public.leads l
  set team_id = tm.team_id
  from public.team_members tm
  where tm.user_id = l.user_id and tm.is_primary = true and l.team_id is null;

alter table public.operators alter column team_id set not null;
alter table public.campaigns alter column team_id set not null;
alter table public.leads     alter column team_id set not null;

create index if not exists idx_operators_team on public.operators(team_id);
create index if not exists idx_campaigns_team on public.campaigns(team_id);
create index if not exists idx_leads_team     on public.leads(team_id);

-- 6. RLS: teams ----------------------------------------------------------
alter table public.teams enable row level security;

drop policy if exists "teams_select_member" on public.teams;
create policy "teams_select_member" on public.teams
  for select using (id in (select public.my_team_ids()));

-- Sem política de insert/update/delete: times só são criados pelo
-- trigger (SECURITY DEFINER) e por join_team() abaixo.

-- 7. RLS: team_members ----------------------------------------------------
alter table public.team_members enable row level security;

drop policy if exists "team_members_select_same_team" on public.team_members;
create policy "team_members_select_same_team" on public.team_members
  for select using (team_id in (select public.my_team_ids()));

drop policy if exists "team_members_insert_self" on public.team_members;
create policy "team_members_insert_self" on public.team_members
  for insert with check (user_id = auth.uid());

drop policy if exists "team_members_update_self" on public.team_members;
create policy "team_members_update_self" on public.team_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 8. RLS: operators / campaigns / leads — troca "_own" (user_id) por
--    "_team" (team_id), usando sempre my_team_ids() ------------------

-- OPERATORS
drop policy if exists "operators_select_own" on public.operators;
drop policy if exists "operators_insert_own" on public.operators;
drop policy if exists "operators_update_own" on public.operators;
drop policy if exists "operators_delete_own" on public.operators;

create policy "operators_select_team" on public.operators
  for select using (team_id in (select public.my_team_ids()));
create policy "operators_insert_team" on public.operators
  for insert with check (team_id in (select public.my_team_ids()));
create policy "operators_update_team" on public.operators
  for update using (team_id in (select public.my_team_ids()))
  with check (team_id in (select public.my_team_ids()));
create policy "operators_delete_team" on public.operators
  for delete using (team_id in (select public.my_team_ids()));

-- CAMPAIGNS
drop policy if exists "campaigns_select_own" on public.campaigns;
drop policy if exists "campaigns_insert_own" on public.campaigns;
drop policy if exists "campaigns_update_own" on public.campaigns;
drop policy if exists "campaigns_delete_own" on public.campaigns;

create policy "campaigns_select_team" on public.campaigns
  for select using (team_id in (select public.my_team_ids()));
create policy "campaigns_insert_team" on public.campaigns
  for insert with check (team_id in (select public.my_team_ids()));
create policy "campaigns_update_team" on public.campaigns
  for update using (team_id in (select public.my_team_ids()))
  with check (team_id in (select public.my_team_ids()));
create policy "campaigns_delete_team" on public.campaigns
  for delete using (team_id in (select public.my_team_ids()));

-- LEADS
drop policy if exists "leads_select_own" on public.leads;
drop policy if exists "leads_insert_own" on public.leads;
drop policy if exists "leads_update_own" on public.leads;
drop policy if exists "leads_delete_own" on public.leads;

create policy "leads_select_team" on public.leads
  for select using (team_id in (select public.my_team_ids()));
create policy "leads_insert_team" on public.leads
  for insert with check (team_id in (select public.my_team_ids()));
create policy "leads_update_team" on public.leads
  for update using (team_id in (select public.my_team_ids()))
  with check (team_id in (select public.my_team_ids()));
create policy "leads_delete_team" on public.leads
  for delete using (team_id in (select public.my_team_ids()));

-- 9. ENTRAR EM OUTRO TIME -------------------------------------------------
-- SECURITY DEFINER é necessário aqui: o passo "o time p_team_id existe?"
-- precisa enxergar um time que o chamador AINDA NÃO é membro (senão o RLS
-- de teams_select_member esconderia o time exatamente no caso de uso que
-- essa função existe pra resolver). Isso não abre brecha de segurança:
-- toda escrita dentro da função já vem explicitamente filtrada por
-- "user_id = auth.uid()", então cada pessoa só move/junta os PRÓPRIOS
-- registros, com ou sem RLS ativo.
create or replace function public.join_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_team_id uuid;
begin
  if not exists (select 1 from public.teams where id = p_team_id) then
    raise exception 'Time não encontrado.';
  end if;

  select team_id into v_old_team_id
  from public.team_members
  where user_id = auth.uid() and is_primary = true
  limit 1;

  update public.team_members
    set is_primary = false
    where user_id = auth.uid() and is_primary = true;

  insert into public.team_members (team_id, user_id, is_primary)
  values (p_team_id, auth.uid(), true)
  on conflict (team_id, user_id) do update set is_primary = true;

  if v_old_team_id is not null and v_old_team_id <> p_team_id then
    update public.operators set team_id = p_team_id where team_id = v_old_team_id and user_id = auth.uid();
    update public.campaigns set team_id = p_team_id where team_id = v_old_team_id and user_id = auth.uid();
    update public.leads     set team_id = p_team_id where team_id = v_old_team_id and user_id = auth.uid();
  end if;
end;
$$;

grant execute on function public.join_team(uuid) to authenticated;
