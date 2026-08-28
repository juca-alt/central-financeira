-- ============================================================
-- orcamentos.sql  (Central Financeira)
-- Move o orcamento (envelopes) do localStorage 'cfin_orc_v1' para o Supabase.
-- Rodar no SQL Editor do projeto mieqsiojvfiqrhectquc (o MCP e read-only).
-- ASCII puro de proposito: SQL com acento vira mojibake no pbcopy.
-- Idempotente: pode rodar mais de uma vez sem erro.
-- Shape de origem (localStorage): { "YYYY-MM": { "<categoria>": <valor>, ... }, ... }
-- Modelo destino: 1 linha por (visao, mes, categoria) = valor orcado (planejado).
-- ============================================================

-- 1) Tabela
create table if not exists public.orcamentos (
  id           uuid    primary key default gen_random_uuid(),
  visao        visao   not null default 'PJ',
  mes          text    not null,                                   -- formato 'YYYY-MM'
  categoria_id uuid    not null references public.categorias(id) on delete cascade,
  valor        numeric not null default 0,                         -- valor orcado (planejado)
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  constraint orcamentos_mes_fmt check (mes ~ '^[0-9]{4}-[0-9]{2}$'),
  constraint orcamentos_uniq unique (visao, mes, categoria_id)
);

comment on table public.orcamentos is
  'Orcamento planejado por visao/mes/categoria. Substitui o localStorage cfin_orc_v1.';

create index if not exists idx_orcamentos_visao_mes on public.orcamentos (visao, mes);

-- 2) updated_at automatico (mesma funcao das outras tabelas)
drop trigger if exists trg_orcamentos_updated on public.orcamentos;
create trigger trg_orcamentos_updated
  before update on public.orcamentos
  for each row execute function set_updated_at();

-- 3) RLS por visao (espelho exato de previstos/categorias)
alter table public.orcamentos enable row level security;

drop policy if exists vis_sel_orcamentos on public.orcamentos;
create policy vis_sel_orcamentos on public.orcamentos
  for select to authenticated using (app_pode(visao));

drop policy if exists vis_ins_orcamentos on public.orcamentos;
create policy vis_ins_orcamentos on public.orcamentos
  for insert to authenticated with check (app_pode(visao, true));

drop policy if exists vis_upd_orcamentos on public.orcamentos;
create policy vis_upd_orcamentos on public.orcamentos
  for update to authenticated using (app_pode(visao, true)) with check (app_pode(visao, true));

drop policy if exists vis_del_orcamentos on public.orcamentos;
create policy vis_del_orcamentos on public.orcamentos
  for delete to authenticated using (app_pode(visao, true));

-- 4) Grants: authenticated opera; anon NUNCA le.
--    (Supabase concede anon por DEFAULT PRIVILEGES em tabela nova -> revogar explicito.)
grant select, insert, update, delete on public.orcamentos to authenticated;
revoke all on public.orcamentos from anon;

-- 5) (OPCIONAL) trilha de auditoria, igual previstos. Descomente se quiser log em audit_log:
-- drop trigger if exists trg_audit_orcamentos on public.orcamentos;
-- create trigger trg_audit_orcamentos
--   after insert or update or delete on public.orcamentos
--   for each row execute function fn_audit();

-- 6) Verificacao (rode depois e confira):
--   select count(*) from public.orcamentos;                                   -- 0 (tabela nova)
--   select relrowsecurity from pg_class where oid = 'public.orcamentos'::regclass;   -- t
--   select policyname, cmd from pg_policies where tablename = 'orcamentos';    -- 4 linhas
--   select has_table_privilege('anon','public.orcamentos','select');          -- f
