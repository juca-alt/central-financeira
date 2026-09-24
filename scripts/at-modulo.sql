-- ============================================================================
-- Modulo "AT Controle Financeiro" -> Central Financeira (07/09/2026)
-- Projeto Supabase: central-financeira (ref mieqsiojvfiqrhectquc)
--
-- ESTRUTURA APENAS (idempotente). Pode ir ao git (repo publico).
-- O SEED com dados reais (guias/lotes/repasses) NAO entra no git:
-- roda pelo SQL Editor / MCP, fora do repo.
--
-- CIRURGICO: so cria objetos com prefixo at_. Nao toca em nada existente.
-- ASCII PURO (clipboard do Mac corrompe UTF-8 na colagem do Monaco).
-- RLS: padrao do dominio familia -> owner uuid = auth.uid().
-- Nomes (beneficiario, prestadora, plano) moram NAS COLUNAS, nunca no codigo.
-- ============================================================================

-- ------------------------------- DDL ----------------------------------------
create table if not exists public.at_guias (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid(),
  numero text,
  tipo text,
  beneficiario text,
  prestador_nome text,
  prestador_cnpj text,
  prestador_apelido text,                    -- como a familia chama a prestadora (rotulos da tela)
  plano text,                                -- plano de saude que paga os lotes
  processo text,
  data_inicio date,
  data_fim date,
  horas_totais int,
  horas_por_sessao int default 4,
  valor_sessao_bruto numeric default 600,
  inss_pct numeric default 5,
  minha_parte_sessao numeric default 120,   -- R$/sessao efetivo quando parte_modo='reais'
  parte_modo text default 'reais',          -- 'reais' | 'pct'
  parte_pct numeric default 20,             -- % do bruto quando parte_modo='pct'
  status text,                              -- autorizada|vigente|vencida|em_renovacao|renovada|quitada
  observacoes text,
  atualizado timestamptz not null default now(),
  unique(owner, numero)
);

-- guias criadas antes desta versao ganham as colunas novas (idempotente)
alter table public.at_guias add column if not exists processo text;
alter table public.at_guias add column if not exists prestador_apelido text;
alter table public.at_guias add column if not exists plano text;
alter table public.at_guias add column if not exists parte_modo text default 'reais';
alter table public.at_guias add column if not exists parte_pct numeric default 20;

create table if not exists public.at_lotes (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid(),
  guia_id uuid references public.at_guias(id) on delete cascade,
  protocolo text unique,
  tipo_guia text default 'SP/SADT',
  dt_envio date,
  dt_pagamento date,
  valor_bruto numeric,
  status text,   -- digitacao|gerado|aguardando_liberacao|liberado|pago|cancelado
  observacoes text,
  atualizado timestamptz not null default now()
);

create table if not exists public.at_repasses (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid(),
  guia_id uuid references public.at_guias(id) on delete cascade,
  data date,
  valor numeric,
  metodo text,
  id_transacao text,       -- E2E do comprovante, para dedup
  lote_id uuid references public.at_lotes(id) on delete set null,
  observacoes text,
  atualizado timestamptz not null default now()
);

create index if not exists at_lotes_guia_idx    on public.at_lotes(guia_id);
create index if not exists at_repasses_guia_idx  on public.at_repasses(guia_id);
create index if not exists at_repasses_lote_idx  on public.at_repasses(lote_id);

-- ------------------------------- RLS ----------------------------------------
alter table public.at_guias    enable row level security;
alter table public.at_lotes    enable row level security;
alter table public.at_repasses enable row level security;

drop policy if exists at_guias_all    on public.at_guias;
drop policy if exists at_lotes_all    on public.at_lotes;
drop policy if exists at_repasses_all on public.at_repasses;

create policy at_guias_all    on public.at_guias    for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy at_lotes_all    on public.at_lotes    for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy at_repasses_all on public.at_repasses for all using (owner = auth.uid()) with check (owner = auth.uid());

-- ----------------------------------------------------------------------------
-- Acesso da Camila (esposa): PREPARADO, NAO LIGADO (decisao do Gustavo 07/09:
-- "nao preparar agora"). Fase futura = allowlist familia OU tabela at_membros.
-- ----------------------------------------------------------------------------
-- TODO fase 2: importar lotes do portal do plano + anexar comprovantes dos repasses.
