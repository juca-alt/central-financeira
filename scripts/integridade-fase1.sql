-- ==========================================================================
-- INTEGRIDADE FASE 1 — Entidades (clientes/contrapartes) + Trilha de auditoria
-- Projeto mieqsiojvfiqrhectquc (Central Financeira). Rodar 1x no SQL Editor.
-- 100% ADITIVO e IDEMPOTENTE: não altera dado existente; pode rodar de novo.
--
-- O que cria:
--  1. public.entidades  — cadastro único de pessoas/empresas (Débora, Pedro
--     França, MJM...) com apelidos p/ matching; cada movimento/previsto pode
--     apontar pra uma entidade (entidade_id) = "ID de cliente".
--  2. public.audit_log  — TRILHA DE AUDITORIA automática: todo INSERT/UPDATE/
--     DELETE em movimentos, previstos, contas, categorias e entidades grava
--     quem mudou, quando, o antes/depois (jsonb) e quais campos mudaram.
--     Pega TODOS os escritores: app, cron do Pluggy/Inter, SQL Editor.
--  O app (v6.8.0+) já tem a UI dos dois — dormente até este SQL rodar.
-- ==========================================================================

-- ---------- helper: cast seguro de texto -> enum visao (null se inválido)
create or replace function public.visao_segura(p text)
  returns public.visao language plpgsql immutable as $$
begin
  return p::public.visao;
exception when others then
  return null;
end $$;

-- ---------- 1) ENTIDADES -------------------------------------------------
create table if not exists public.entidades(
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  tipo       text not null default 'pessoa',      -- pessoa | empresa | orgao
  visao      public.visao not null default 'AMBOS',
  apelidos   text[] not null default '{}',        -- nomes alternativos p/ matching
  telefone   text, email text, documento text, observacao text,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists entidades_nome_idx on public.entidades (lower(nome));

alter table public.previstos  add column if not exists entidade_id uuid references public.entidades(id) on delete set null;
alter table public.movimentos add column if not exists entidade_id uuid references public.entidades(id) on delete set null;
create index if not exists previstos_entidade_idx  on public.previstos(entidade_id);
create index if not exists movimentos_entidade_idx on public.movimentos(entidade_id);

alter table public.entidades enable row level security;
revoke all on public.entidades from anon;
grant select, insert, update, delete on public.entidades to authenticated;

drop policy if exists vis_sel_entidades on public.entidades;
drop policy if exists vis_ins_entidades on public.entidades;
drop policy if exists vis_upd_entidades on public.entidades;
drop policy if exists vis_del_entidades on public.entidades;
create policy vis_sel_entidades on public.entidades for select using (public.app_pode(visao));
create policy vis_ins_entidades on public.entidades for insert with check (public.app_pode(visao, true));
create policy vis_upd_entidades on public.entidades for update using (public.app_pode(visao, true)) with check (public.app_pode(visao, true));
create policy vis_del_entidades on public.entidades for delete using (public.app_pode(visao, true));

-- ---------- 2) TRILHA DE AUDITORIA ---------------------------------------
create table if not exists public.audit_log(
  id          bigint generated always as identity primary key,
  tabela      text not null,
  registro_id uuid,
  acao        text not null,                       -- INSERT | UPDATE | DELETE
  visao       text,
  autor       text,                                -- e-mail logado; 'sistema' = cron/service
  antes       jsonb,
  depois      jsonb,
  campos      text[],                              -- colunas alteradas (UPDATE)
  criado_em   timestamptz not null default now()
);
create index if not exists audit_reg_idx  on public.audit_log(tabela, registro_id);
create index if not exists audit_data_idx on public.audit_log(criado_em desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon;
grant select on public.audit_log to authenticated;   -- escrita: SÓ o trigger (definer)

drop policy if exists aud_sel on public.audit_log;
create policy aud_sel on public.audit_log for select
  using (public.app_is_admin()
         or (public.visao_segura(visao) is not null and public.app_pode(public.visao_segura(visao))));

create or replace function public.fn_audit()
  returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_antes  jsonb; v_depois jsonb; v_campos text[]; v_id uuid; v_visao text;
begin
  if tg_op = 'INSERT' then
    v_depois := to_jsonb(new); v_id := new.id;
  elsif tg_op = 'DELETE' then
    v_antes := to_jsonb(old);  v_id := old.id;
  else
    v_antes := to_jsonb(old); v_depois := to_jsonb(new); v_id := new.id;
    select coalesce(array_agg(k), '{}') into v_campos
      from jsonb_object_keys(v_depois) k
     where k <> 'updated_at' and (v_antes -> k) is distinct from (v_depois -> k);
    if v_campos = '{}' then return null; end if;   -- só updated_at mudou: ruído
  end if;
  v_visao := coalesce(v_depois ->> 'visao', v_antes ->> 'visao');
  insert into public.audit_log (tabela, registro_id, acao, visao, autor, antes, depois, campos)
  values (tg_table_name, v_id, tg_op, v_visao, coalesce(public.app_email(), 'sistema'), v_antes, v_depois, v_campos);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['movimentos','previstos','contas','categorias','entidades'] loop
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format('create trigger trg_audit after insert or update or delete on public.%I for each row execute function public.fn_audit()', t);
  end loop;
end $$;

-- ---------- verificação ---------------------------------------------------
select 'entidades' as objeto, count(*) from public.entidades
union all select 'audit_log', count(*) from public.audit_log
union all select 'triggers', count(*) from pg_trigger where tgname = 'trg_audit';
