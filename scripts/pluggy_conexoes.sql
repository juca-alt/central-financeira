-- =====================================================================
-- Tabela pluggy_conexoes — mapeia cada item da Pluggy a uma conta/visao.
-- Roda uma vez no SQL Editor do Supabase (projeto mieqsiojvfiqrhectquc).
--
-- Fluxo:
--   1) rode este CREATE (cria a tabela com RLS ligado)
--   2) conecte os bancos pela pluggy-connect.html -> pega os item_id
--   3) rode os INSERT (a propria pagina gera o SQL pronto), trocando o
--      conta_id pelo id da conta certa em `contas`
-- =====================================================================

create table if not exists public.pluggy_conexoes (
  item_id     text primary key,                 -- id do item na Pluggy (1 por login de banco)
  conta_id    uuid not null references public.contas(id) on delete cascade,
  visao       text not null,                    -- FAMILIA (Nubank) | JUCA (Inter PF) | PIPEX (C6)
  banco       text,                             -- rotulo legivel
  account_id  text,                             -- opcional: fixa um account especifico do item
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- RLS: ligado. So o service_role (sync no GitHub Actions) e o dono leem/escrevem.
alter table public.pluggy_conexoes enable row level security;

-- Politica para o usuario logado dono (mesmo padrao das outras tabelas do app).
-- Ajuste se o seu schema usa outra coluna de dono; o sync usa service_role e ignora RLS.
drop policy if exists pluggy_conexoes_owner on public.pluggy_conexoes;
create policy pluggy_conexoes_owner on public.pluggy_conexoes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Exemplo de mapeamento (a pluggy-connect.html gera isso pronto):
-- insert into pluggy_conexoes (item_id, conta_id, visao, banco) values
--   ('SEU_ITEM_ID', 'SEU_CONTA_ID', 'FAMILIA', 'Nubank')
--   on conflict (item_id) do update set conta_id=excluded.conta_id, visao=excluded.visao, banco=excluded.banco;
