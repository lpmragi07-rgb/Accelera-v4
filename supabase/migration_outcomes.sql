-- ============================================================
-- LIGARAUT — Migração: qualificação manual do lead pelo operador
-- Execute no SQL Editor (após as migrações anteriores).
-- ============================================================

-- 'outcome' é o desfecho que o OPERADOR marca após falar com o cliente:
--   interested = aceitou, contatar depois (lista separada)
--   callback   = não atendeu / "vou pensar" — ligar novamente depois
--   discarded  = recusou — descartado
-- É independente do 'status' técnico da chamada (calling, transferred, etc.).
alter table public.leads
  add column if not exists outcome text;

alter table public.leads
  add column if not exists outcome_at timestamptz;

create index if not exists idx_leads_outcome on public.leads(outcome);
