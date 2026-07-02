-- ============================================================
-- LIGARAUT — Migração: separar "em ligação" da intenção do operador
-- Execute no SQL Editor (após as migrações anteriores).
-- ============================================================

-- 'status' passa a representar a INTENÇÃO do usuário:
--   available = aceita chamadas | busy = pausado | offline = desconectado.
-- 'on_call' é controlado pelo SISTEMA: true enquanto o operador está numa
-- ligação. Assim, marcar "Ocupado"/"Offline" no painel realmente pausa o
-- operador (ele não recebe novos clientes), sem conflitar com o estado real.
alter table public.operators
  add column if not exists on_call boolean not null default false;

create index if not exists idx_operators_dispatch
  on public.operators(status, on_call);
