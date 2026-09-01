-- =====================================================================
-- Frente 3 - assistente financeira no WhatsApp: tabelas de apoio.
--
-- COMO RODAR (Livro de Erros #6: o SQL Editor so executa o TOPO de um
-- arquivo grande colado - politicas no fim NAO entram):
--   1) cole e rode SO a PARTE 1;
--   2) cole e rode SO a PARTE 2;
--   3) confira por MCP que as duas tabelas existem, com rls ativo.
--
-- DENY-ALL AQUI E DE PROPOSITO. Quem le e escreve nestas tabelas e a Edge
-- Function wa-webhook, que usa service_role (bypassa RLS). O app no
-- browser nao toca nelas. Se uma sessao futura achar que "faltou politica"
-- como em orcamentos/tags: nao faltou, e o desenho.
--
-- Fonte em ASCII puro (colar acentuado no dashboard corrompe UTF-8).
-- =====================================================================


-- ============================== PARTE 1 ==============================
-- Tabelas + indices + RLS. Rode SO ate a linha "FIM DA PARTE 1".

-- Log de mensagens. O id e o wamid da Meta, entao a PK ja e a
-- idempotencia: a Meta reenvia o mesmo evento quando desconfia de falha,
-- e o insert repetido estoura em vez de processar a mensagem 2 vezes.
create table if not exists public.wa_mensagens (
  id          text primary key,
  telefone    text not null,
  direcao     text not null check (direcao in ('in','out')),
  texto       text,
  created_at  timestamptz not null default now()
);

create index if not exists wa_mensagens_tel_data
  on public.wa_mensagens (telefone, created_at desc);

-- Acao de escrita proposta pela IA, esperando o "ok" do Gustavo.
-- Nada e gravado no financeiro enquanto isto estiver 'aberta'.
create table if not exists public.wa_pendencias (
  id          uuid primary key default gen_random_uuid(),
  telefone    text not null,
  tool        text not null,
  argumentos  jsonb not null,
  resumo      text,
  status      text not null default 'aberta'
              check (status in ('aberta','executada','cancelada','substituida','erro')),
  created_at  timestamptz not null default now()
);

create index if not exists wa_pendencias_abertas
  on public.wa_pendencias (telefone, created_at desc) where status = 'aberta';

alter table public.wa_mensagens  enable row level security;
alter table public.wa_pendencias enable row level security;

-- ------------------------- FIM DA PARTE 1 ---------------------------


-- ============================== PARTE 2 ==============================
-- Grants. Sem politica nenhuma: service_role bypassa RLS, todo o resto
-- fica trancado. Livro de Erros #7: tabela nova herda privilegio pro
-- anon por DEFAULT PRIVILEGES, entao revogar e obrigatorio.

revoke all on public.wa_mensagens  from anon, authenticated;
revoke all on public.wa_pendencias from anon, authenticated;

grant all on public.wa_mensagens  to service_role;
grant all on public.wa_pendencias to service_role;

-- ------------------------- FIM DA PARTE 2 ---------------------------


-- ===================== CONFERENCIA (rode por MCP) ====================
-- select relname, relrowsecurity from pg_class
--   where relname in ('wa_mensagens','wa_pendencias');
-- select tablename, count(*) from pg_policies
--   where tablename in ('wa_mensagens','wa_pendencias') group by 1;
--   -> esperado: rls = true nas duas, e ZERO politicas (deny-all proposital).
