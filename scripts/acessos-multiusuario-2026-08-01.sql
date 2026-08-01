-- =====================================================================
-- ACESSO MULTIUSUARIO POR VISAO  --  2026-08-01
-- =====================================================================
-- O QUE FAZ: troca o RLS atual ("qualquer usuario logado ve tudo") por
-- permissao POR VISAO, controlada por voce no painel Configuracoes >
-- Acessos. A Camila entra com o Google dela e so enxerga as visoes que
-- voce marcar.
--
-- POR QUE POR E-MAIL (e nao por user_id): assim voce pre-autoriza a
-- Camila ANTES do primeiro login dela. O Supabase so cria o user_id
-- quando a pessoa entra pela primeira vez; o e-mail do Google ja da
-- pra amarrar a permissao antes disso.
--
-- SEGURANCA DO SEU PROPRIO ACESSO: o seed abaixo te cadastra como ADMIN
-- com TODAS as visoes ANTES de qualquer politica mudar, e as funcoes
-- auxiliares sao SECURITY DEFINER (leem o cadastro sem depender de RLS).
-- Se mesmo assim algo sair errado, o rollback esta no fim do arquivo.
--
-- NAO TOCA: tabelas pipex_* (app do Pipe X, isoladas por auth.uid()),
-- backups bkp_* e movimentos_backup_*.
--
-- COMO RODAR: SQL Editor do Supabase, projeto mieqsiojvfiqrhectquc,
-- ABA NOVA, tudo de uma vez. No fim ele imprime a verificacao.
-- =====================================================================

-- ---------- 1. CADASTRO DE USUARIOS E PERMISSOES ---------------------
create table if not exists public.app_usuarios (
  email      text primary key,
  nome       text,
  admin      boolean not null default false,
  criado_em  timestamptz not null default now()
);

create table if not exists public.usuario_visoes (
  email     text not null references public.app_usuarios(email) on delete cascade,
  visao     visao not null,
  ler       boolean not null default true,
  escrever  boolean not null default false,
  primary key (email, visao)
);

-- ---------- 2. SEED: VOCE, ADMIN, TODAS AS VISOES --------------------
-- (roda ANTES de mexer em politica: se algo falhar daqui pra frente,
--  voce ja esta cadastrado e o rollback devolve o acesso)
insert into public.app_usuarios (email, nome, admin)
values ('juca@segurocomjuca.com', 'Gustavo Juca', true)
on conflict (email) do update set admin = true;

insert into public.usuario_visoes (email, visao, ler, escrever)
select 'juca@segurocomjuca.com', v, true, true
from unnest(enum_range(null::visao)) v
on conflict (email, visao) do update set ler = true, escrever = true;

-- ---------- 3. FUNCOES AUXILIARES ------------------------------------
-- SECURITY DEFINER: conseguem ler o cadastro mesmo com RLS ligado nele.
create or replace function public.app_email() returns text
  language sql stable as
$$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.app_is_admin() returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.app_usuarios u
      where u.email = public.app_email() and u.admin
   ) $$;

-- Regra de leitura/escrita numa visao.
-- 'AMBOS' = linha compartilhada (categorias globais): quem tem QUALQUER
-- visao liberada enxerga; escrever nela exige escrita em alguma visao.
create or replace function public.app_pode(v visao, escrita boolean default false)
  returns boolean language sql stable security definer set search_path = public as
$$ select
     public.app_is_admin()
     or exists (
       select 1 from public.usuario_visoes p
        where p.email = public.app_email()
          and (p.visao = v or v = 'AMBOS')
          and (case when escrita then p.escrever else p.ler end)
     ) $$;

-- ---------- 4. RLS DO PROPRIO CADASTRO -------------------------------
alter table public.app_usuarios  enable row level security;
alter table public.usuario_visoes enable row level security;

drop policy if exists app_usuarios_leitura  on public.app_usuarios;
drop policy if exists app_usuarios_admin    on public.app_usuarios;
drop policy if exists usuario_visoes_leitura on public.usuario_visoes;
drop policy if exists usuario_visoes_admin   on public.usuario_visoes;

-- cada um le o proprio cadastro; admin le e escreve tudo
create policy app_usuarios_leitura on public.app_usuarios
  for select to authenticated using (email = public.app_email() or public.app_is_admin());
create policy app_usuarios_admin on public.app_usuarios
  for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());

create policy usuario_visoes_leitura on public.usuario_visoes
  for select to authenticated using (email = public.app_email() or public.app_is_admin());
create policy usuario_visoes_admin on public.usuario_visoes
  for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());

-- ---------- 5. TROCA DAS POLITICAS NAS TABELAS FINANCEIRAS -----------
-- Percorre TODA tabela do schema public que tenha coluna `visao`
-- (movimentos, contas, categorias, previstos, cartao_transacoes,
--  glossario_termos, pluggy_conexoes...), derruba as politicas antigas
-- e cria as 4 novas amarradas na permissao por visao.
do $$
declare
  t   text;
  pol text;
begin
  for t in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables tb
        on tb.table_schema = c.table_schema and tb.table_name = c.table_name
     where c.table_schema = 'public'
       and c.column_name  = 'visao'
       and tb.table_type  = 'BASE TABLE'
       and c.table_name not like 'pipex%'
       and c.table_name not like 'bkp\_%'
       and c.table_name not like 'movimentos\_backup%'
       and c.table_name not in ('usuario_visoes')
  loop
    execute format('alter table public.%I enable row level security', t);

    for pol in select policyname from pg_policies
                where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', pol, t);
    end loop;

    execute format($f$create policy vis_sel_%1$s on public.%1$I
      for select to authenticated using (public.app_pode(visao))$f$, t);
    execute format($f$create policy vis_ins_%1$s on public.%1$I
      for insert to authenticated with check (public.app_pode(visao, true))$f$, t);
    execute format($f$create policy vis_upd_%1$s on public.%1$I
      for update to authenticated using (public.app_pode(visao, true))
      with check (public.app_pode(visao, true))$f$, t);
    execute format($f$create policy vis_del_%1$s on public.%1$I
      for delete to authenticated using (public.app_pode(visao, true))$f$, t);

    raise notice 'politicas por visao aplicadas em %', t;
  end loop;
end $$;

-- ---------- 6. TABELAS SENSIVEIS SEM COLUNA `visao` → SO ADMIN -------
-- Comissoes da LP e as credenciais de conexao do Pluggy nao tem visao e
-- nao devem aparecer pra ninguem alem de voce.
do $$
declare t text; pol text;
begin
  for t in
    select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
       and (table_name like 'lp\_%' or table_name = 'pluggy_conexoes')
  loop
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname='public' and tablename=t
    loop execute format('drop policy %I on public.%I', pol, t); end loop;
    execute format($f$create policy admin_only_%1$s on public.%1$I
      for all to authenticated using (public.app_is_admin())
      with check (public.app_is_admin())$f$, t);
    raise notice 'admin-only aplicado em %', t;
  end loop;
end $$;

-- ---------- 7. VERIFICACAO -------------------------------------------
select 'voce e admin?' as check, public.app_is_admin()::text as resultado
union all
select 'suas visoes', string_agg(visao::text, ', ' order by visao::text)
  from public.usuario_visoes where email = 'juca@segurocomjuca.com'
union all
select 'tabelas com politica por visao', count(distinct tablename)::text
  from pg_policies where schemaname='public' and policyname like 'vis\_%'
union all
select 'movimentos que voce enxerga', count(*)::text from public.movimentos;

-- =====================================================================
-- ROLLBACK (se precisar voltar ao estado anterior: todo logado ve tudo)
-- =====================================================================
-- do $$
-- declare t text; pol text;
-- begin
--   for t in select distinct tablename from pg_policies
--             where schemaname='public'
--               and (policyname like 'vis\_%' or policyname like 'admin\_only\_%')
--   loop
--     for pol in select policyname from pg_policies
--                 where schemaname='public' and tablename=t
--     loop execute format('drop policy %I on public.%I', pol, t); end loop;
--     execute format($f$create policy auth_all_%1$s on public.%1$I
--       for all to authenticated using (true) with check (true)$f$, t);
--   end loop;
-- end $$;
