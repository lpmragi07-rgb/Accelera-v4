-- ============================================================
-- LIGARAUT — Migração: um único time pra toda a operação
-- Execute no SQL Editor do Supabase (após migration_teams.sql).
--
-- migration_teams.sql criava um time pessoal separado pra cada conta
-- nova, exigindo um código de convite pra unir os times. Esta migração
-- simplifica pro caso real de uso: uma operação só, todo mundo no
-- mesmo time — sem convite, sem código. A partir daqui:
--   1) consolida todos os times já existentes num único time;
--   2) troca o trigger de conta nova pra já entrar direto nesse time.
-- ============================================================

-- 1. CONSOLIDA TUDO NO TIME MAIS ANTIGO ----------------------------------
do $$
declare
  v_main_team_id uuid;
begin
  select id into v_main_team_id from public.teams order by created_at asc limit 1;

  if v_main_team_id is null then
    return; -- nenhum time ainda (banco novo) — nada a consolidar.
  end if;

  -- Tira "primário" de qualquer membership fora do time principal, senão o
  -- índice único (um primário por pessoa) barra o próximo passo.
  update public.team_members
    set is_primary = false
    where team_id <> v_main_team_id;

  -- Todo mundo que já era membro de ALGUM time vira membro do time
  -- principal (se ainda não for), sempre como primário.
  insert into public.team_members (team_id, user_id, is_primary)
  select distinct v_main_team_id, tm.user_id, true
  from public.team_members tm
  where not exists (
    select 1 from public.team_members m
    where m.team_id = v_main_team_id and m.user_id = tm.user_id
  );

  update public.team_members
    set is_primary = true
    where team_id = v_main_team_id;

  -- Move os dados de qualquer time secundário pro time principal.
  update public.operators set team_id = v_main_team_id where team_id <> v_main_team_id;
  update public.campaigns set team_id = v_main_team_id where team_id <> v_main_team_id;
  update public.leads     set team_id = v_main_team_id where team_id <> v_main_team_id;

  -- Apaga os times secundários (agora vazios de dados e de membros).
  delete from public.teams where id <> v_main_team_id;
end $$;

-- 2. CONTA NOVA JÁ ENTRA DIRETO NO TIME ÚNICO, SEM CÓDIGO ----------------
create or replace function public.handle_new_user_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  select id into v_team_id from public.teams order by created_at asc limit 1;

  -- Só cria um time novo se este for literalmente o primeiro cadastro
  -- do banco (nenhum time existe ainda).
  if v_team_id is null then
    insert into public.teams (name, owner_id)
    values ('Accelera — Equipe', new.id)
    returning id into v_team_id;
  end if;

  insert into public.team_members (team_id, user_id, is_primary)
  values (v_team_id, new.id, true)
  on conflict (team_id, user_id) do update set is_primary = true;

  return new;
end;
$$;
-- (o trigger on_auth_user_created_team já criado em migration_teams.sql
--  passa a usar esta versão nova da função automaticamente.)
