-- =====================================================================
-- Comissoes LP (Pipe X / Daniel) — divisao de comissao do Life Planner.
-- Roda uma vez no SQL Editor do Supabase (projeto mieqsiojvfiqrhectquc).
--
-- Modelo: o Juca passou clientes (apolices) pro Daniel (franquia DSC);
-- o Daniel repassa 50% da comissao, menos imposto, dos clientes marcados,
-- todo mes (periodo compensatorio dia 21 -> 20). A tela "Comissoes LP"
-- (visao PIPEX do app) le o extrato .xls do Daniel, marca quem entra,
-- fecha o mes aqui e lanca o liquido em `previstos` (tipo=receber).
--
-- Prefixo lp_ de proposito: o banco e compartilhado com o app Pipe X
-- (tabelas pipex_*) — nao colidir.
--
-- Fluxo:
--   1) rode este CREATE (cria as 3 tabelas com RLS ligado)
--   2) rode a carga inicial (carga-lp-pipex.local.sql — fora do repo,
--      contem dados pessoais) com a carteira e o historico
--   3) use a tela "Comissoes LP" no shell pipex/ do app
-- =====================================================================

-- Carteira: apolices que o Juca passou pro Daniel. `no_fluxo` persiste a
-- selecao recorrente ("quem voce marcar este mes continua no fluxo").
create table if not exists public.lp_carteira (
  apolice        text primary key,
  segurado       text not null,
  premio         numeric,
  periodicidade  text,                          -- Mensal | Anual
  no_fluxo       boolean not null default false,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now()
);

-- Um registro por mes fechado (competencia = YYYY-MM do fim do periodo).
create table if not exists public.lp_comissao_meses (
  competencia  text primary key,                -- ex.: '2026-05'
  mes_label    text,                            -- ex.: 'Mai/26'
  periodo_ini  date,
  periodo_fim  date,
  pct_div      numeric not null default 50,
  pct_imp      numeric not null default 6,
  base         numeric not null default 0,      -- soma das comissoes marcadas
  liquido      numeric not null default 0,      -- base x div x (1 - imp)
  status       text not null default 'aberto',  -- aberto | recebido
  recebido_em  date,
  previsto_id  bigint,                          -- FK logico -> previstos.id (lancamento a receber)
  criado_em    timestamptz not null default now()
);

-- Itens do mes: uma linha por apolice do extrato do Daniel (agregado).
create table if not exists public.lp_comissao_itens (
  id           bigint generated always as identity primary key,
  competencia  text not null references public.lp_comissao_meses(competencia) on delete cascade,
  apolice      text not null,
  segurado     text,
  comissao     numeric not null default 0,      -- base cheia do Daniel (negativa = estorno)
  linhas       int not null default 0,          -- qtas linhas do extrato viraram este item
  situacao     text,                            -- fluxo | carteira | fora
  selecionado  boolean not null default false,
  unique (competencia, apolice)
);

-- RLS: mesmo padrao das demais tabelas do app (todo logado ve tudo).
alter table public.lp_carteira        enable row level security;
alter table public.lp_comissao_meses  enable row level security;
alter table public.lp_comissao_itens  enable row level security;

drop policy if exists auth_all_lp_carteira on public.lp_carteira;
create policy auth_all_lp_carteira on public.lp_carteira
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists auth_all_lp_comissao_meses on public.lp_comissao_meses;
create policy auth_all_lp_comissao_meses on public.lp_comissao_meses
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists auth_all_lp_comissao_itens on public.lp_comissao_itens;
create policy auth_all_lp_comissao_itens on public.lp_comissao_itens
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
