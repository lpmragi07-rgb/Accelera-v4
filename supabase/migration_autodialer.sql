-- ============================================================
-- LIGARAUT — Migração: modo discagem automática contínua
-- Execute no SQL Editor do Supabase (após schema.sql + migration_api4com.sql).
-- ============================================================

-- Reivindica (de forma ATÔMICA) o próximo lead pendente de uma campanha e o
-- vincula a um operador, evitando que duas chamadas peguem o mesmo lead.
-- Usa FOR UPDATE SKIP LOCKED para concorrência segura entre webhooks paralelos.
create or replace function public.claim_next_lead(
  p_campaign_id uuid,
  p_operator_id uuid
)
returns public.leads
language plpgsql
as $$
declare
  v_lead public.leads;
begin
  select * into v_lead
  from public.leads
  where campaign_id = p_campaign_id
    and status = 'pending'
  order by created_at
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.leads
  set status = 'calling',
      operator_id = p_operator_id,
      error_message = null
  where id = v_lead.id
  returning * into v_lead;

  return v_lead;
end;
$$;

-- Permite chamar a função tanto pelo usuário logado (painel) quanto pelo
-- service_role (webhooks). O RLS continua valendo para o role 'authenticated'.
grant execute on function public.claim_next_lead(uuid, uuid) to authenticated, service_role;
