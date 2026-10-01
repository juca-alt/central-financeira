-- =====================================================================
-- REPLICA LOCAL do schema da Central Financeira (so ESTRUTURA, sem dado)
-- Uso: SO no Postgres local de teste (run-local.sh). NUNCA rodar em producao.
-- Espelha as tabelas/funcoes que as RPCs cf_* tocam, conferidas por MCP
-- (read-only) em 01/10/2026. Stub do schema auth do Supabase.
-- =====================================================================
create extension if not exists pgcrypto;

create schema if not exists auth;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''),
                  nullif(current_setting('request.jwt.claims', true), ''))::jsonb $$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

do $$ begin
  create type public.visao as enum ('PJ','PF','AMBOS','FAMILIA','PIPEX','RC','JUCA');
  create type public.status_previsto as enum ('aberto','pago','recebido','cancelado');
  create type public.tipo_previsto as enum ('pagar','receber');
  create type public.tipo_categoria as enum ('entrada','saida');
  create type public.tipo_conta as enum ('corrente','cartao','investimento','caixa');
exception when duplicate_object then null; end $$;

create table if not exists public.app_usuarios (
  email text primary key, nome text, admin boolean not null default false,
  criado_em timestamptz not null default now(), visao_padrao public.visao,
  ultimo_acesso timestamptz, tema text, cor text);
create table if not exists public.usuario_visoes (
  email text not null references public.app_usuarios(email) on delete cascade,
  visao public.visao not null, ler boolean not null default true, escrever boolean not null default false,
  primary key (email, visao));
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(), nome text not null, tipo public.tipo_categoria not null,
  visao public.visao default 'AMBOS', cor text, icone text,
  parent_id uuid references public.categorias(id) on delete set null,
  ativo boolean default true, ordem int default 0, created_at timestamptz default now(),
  updated_at timestamptz default now(), grupo_dre text);
create table if not exists public.contas (
  id uuid primary key default gen_random_uuid(), nome text not null, tipo public.tipo_conta not null,
  banco text, saldo_inicial numeric default 0, moeda text default 'BRL', ativo boolean default true,
  ordem int default 0, created_at timestamptz default now(), updated_at timestamptz default now(),
  visao public.visao default 'PJ', saldo_atual numeric, saldo_atualizado_em timestamptz);
create table if not exists public.entidades (
  id uuid primary key default gen_random_uuid(), nome text not null, tipo text not null default 'pessoa',
  visao public.visao not null default 'AMBOS', apelidos text[] not null default '{}', telefone text,
  email text, documento text, observacao text, ativo boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.movimentos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid references public.contas(id) on delete restrict,
  data date not null, descricao_original text not null, descricao_limpa text,
  valor numeric not null, sinal smallint not null check (sinal = any (array[-1, 1])),
  categoria_id uuid references public.categorias(id) on delete set null,
  visao public.visao default 'PJ', hash text not null unique, observacao text,
  conciliado_previsto_id uuid, importacao_id uuid,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  external_id text, fonte text, entidade_id uuid references public.entidades(id) on delete set null);
create table if not exists public.previstos (
  id uuid primary key default gen_random_uuid(), descricao text not null, valor numeric not null,
  vencimento date not null, tipo public.tipo_previsto not null,
  status public.status_previsto default 'aberto',
  categoria_id uuid references public.categorias(id) on delete set null,
  conta_id uuid references public.contas(id) on delete set null,
  visao public.visao default 'PJ', recorrencia text,
  movimento_id_realizado uuid references public.movimentos(id) on delete set null,
  observacao text, created_at timestamptz default now(), updated_at timestamptz default now(),
  entidade_id uuid references public.entidades(id) on delete set null, competencia date);
do $$ begin
  alter table public.movimentos add constraint movimentos_conciliado_previsto_id_fkey
    foreign key (conciliado_previsto_id) references public.previstos(id) on delete set null;
exception when duplicate_object then null; end $$;
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(), nome text not null, cor text,
  visao public.visao default 'AMBOS', ativo boolean default true,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint tags_nome_visao_uniq unique (nome, visao));
create table if not exists public.movimento_tags (
  movimento_id uuid not null references public.movimentos(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz default now(), primary key (movimento_id, tag_id));
create table if not exists public.audit_log (
  id bigserial primary key, tabela text not null, registro_id uuid, acao text not null, visao text,
  autor text, antes jsonb, depois jsonb, campos text[], criado_em timestamptz not null default now());

create or replace function public.app_email() returns text language sql stable as
$$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;
create or replace function public.app_is_admin() returns boolean language sql stable security definer
set search_path to 'public' as
$$ select exists (select 1 from public.app_usuarios u where u.email = public.app_email() and u.admin) $$;
create or replace function public.visao_segura(p text) returns public.visao language plpgsql immutable as $$
begin return p::public.visao; exception when others then return null; end $$;
create or replace function public.set_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end; $$;
create or replace function public.fn_audit() returns trigger language plpgsql security definer
set search_path to 'public' as $$
declare v_antes jsonb; v_depois jsonb; v_campos text[]; v_id uuid; v_visao text;
begin
  if tg_op = 'INSERT' then v_depois := to_jsonb(new); v_id := new.id;
  elsif tg_op = 'DELETE' then v_antes := to_jsonb(old); v_id := old.id;
  else
    v_antes := to_jsonb(old); v_depois := to_jsonb(new); v_id := new.id;
    select coalesce(array_agg(k), '{}') into v_campos from jsonb_object_keys(v_depois) k
     where k <> 'updated_at' and (v_antes -> k) is distinct from (v_depois -> k);
    if v_campos = '{}' then return null; end if;
  end if;
  v_visao := coalesce(v_depois ->> 'visao', v_antes ->> 'visao');
  insert into public.audit_log (tabela, registro_id, acao, visao, autor, antes, depois, campos)
  values (tg_table_name, v_id, tg_op, v_visao, coalesce(nullif(public.app_email(), ''), 'sistema'),
          v_antes, v_depois, v_campos);
  return null;
end $$;
drop trigger if exists trg_audit on public.previstos;
create trigger trg_audit after insert or delete or update on public.previstos for each row execute function fn_audit();
drop trigger if exists trg_previstos_updated on public.previstos;
create trigger trg_previstos_updated before update on public.previstos for each row execute function set_updated_at();
drop trigger if exists trg_audit on public.movimentos;
create trigger trg_audit after insert or delete or update on public.movimentos for each row execute function fn_audit();
drop trigger if exists trg_movimentos_updated on public.movimentos;
create trigger trg_movimentos_updated before update on public.movimentos for each row execute function set_updated_at();

create table if not exists public.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  email text not null references public.app_usuarios(email) on delete cascade,
  token text not null unique, label text, ativo boolean not null default true,
  criado_em timestamptz not null default now(), ultimo_uso timestamptz, revogado_em timestamptz);

-- papeis do PostgREST local (e2e): service_role ignora RLS, como no Supabase
alter role service_role bypassrls;
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
