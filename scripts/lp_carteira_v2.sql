-- =====================================================================
-- Carteira LP v2 — carteira COMPLETA do Daniel + flag do acordo Pipe X.
-- Roda uma vez no SQL Editor do Supabase (depois do lp_comissao.sql).
--
-- O que muda: lp_carteira deixa de ter so as apolices do acordo e passa
-- a guardar a carteira inteira do LP (base das duas frentes de receita):
--   1) Override MFB: 20% sobre o FYC de TODA a producao do Daniel
--   2) Acordo Pipe X (flag `acordo`): clientes repassados que geram os
--      50% (menos imposto) — e a previsao de receita do Pipe X
-- =====================================================================

alter table public.lp_carteira add column if not exists acordo boolean not null default false;
alter table public.lp_carteira add column if not exists status text;          -- Ativa | Cancelada | ...
alter table public.lp_carteira add column if not exists forma_pagto text;     -- Cartao de Credito | Debito | ...

-- Quem e acordo=true vem da CARGA (carga-lp-carteira.local.sql), que conhece
-- a lista de apolices repassadas — nada de update cego aqui (idempotencia).
