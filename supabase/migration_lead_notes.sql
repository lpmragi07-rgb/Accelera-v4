-- ============================================================
-- LIGARAUT — Observações por lead
-- Adiciona a coluna "notes" na tabela leads, usada pelo operador
-- para anotar informações do cliente (ex.: "cliente pediu para
-- ligar dia 20", dados de contato, etc.).
--
-- Rode no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS notes text;
