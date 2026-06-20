-- =====================================================================
-- Central Financeira — Migração para MULTI-INQUILINO (ADIADA / DRAFT)
-- =====================================================================
-- STATUS (2026-06-20): ADIADO por decisão do Gustavo. Hoje o banco já está
-- seguro contra acesso ANÔNIMO (RLS ligado + políticas só p/ authenticated),
-- e só existe 1 usuário. Esta migração só vale quando for cadastrar OUTRAS
-- pessoas com finanças isoladas. Não rode antes disso.
--
-- ESTADO REAL DO BANCO (verificado ao vivo, NÃO é o que eu supunha antes):
--   • RLS JÁ está habilitado em todas as tabelas (não precisa "enable").
--   • As tabelas do financeiro têm política `auth_all_<tabela>`:
--        FOR ALL TO authenticated USING (true)  → "todo logado vê tudo".
--     Pra isolar por usuário é preciso TROCAR (drop) essa política, não só
--     adicionar — Postgres soma políticas permissivas com OR, então a `true`
--     antiga continuaria vazando tudo.
--   • As tabelas têm coluna `visao`, mas NÃO têm `user_id` (só o Pipe X tem).
--   • O banco é COMPARTILHADO com o Pipe X (tabelas pipex_*, já isoladas por
--     auth.uid()) — NÃO TOCAR nelas. Idem tabelas *_backup_*.
--   • Seu user_id (único usuário hoje): f23f70d9-2859-4664-8842-bbf82762aecb
--
-- PRÉ-REQUISITO: backup/snapshot (Dashboard → Database → Backups).
-- Rode FASE POR FASE conferindo cada checkpoint.
-- =====================================================================

-- Tabelas-alvo do FINANCEIRO (confirmadas). Revise se 'importacoes' e
-- 'ingest_tokens' devem entrar (são do app financeiro? guardam dados por usuário?).
-- NÃO inclua pipex_* nem *_backup_*.

-- ---------------------------------------------------------------------
-- FASE 1 — coluna user_id (default = quem inserir). Seguro/idempotente.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'contas','categorias','movimentos','cartao_transacoes',
    'previstos','regras_classificacao','glossario_termos'
  ] loop
    execute format(
      'alter table public.%I add column if not exists user_id uuid references auth.users(id) default auth.uid();', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- FASE 2 — BACKFILL: carimba os dados existentes como SEUS.
--   (hoje todos os dados são seus; ajuste o uuid se necessário)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'contas','categorias','movimentos','cartao_transacoes',
    'previstos','regras_classificacao','glossario_termos'
  ] loop
    execute format(
      'update public.%I set user_id = ''f23f70d9-2859-4664-8842-bbf82762aecb'' where user_id is null;', t);
  end loop;
end $$;

-- CHECKPOINT FASE 2 — deve dar 0 em todas:
-- select 'movimentos' t, count(*) from public.movimentos where user_id is null
-- union all select 'contas', count(*) from public.contas where user_id is null
-- union all select 'categorias', count(*) from public.categorias where user_id is null
-- union all select 'cartao_transacoes', count(*) from public.cartao_transacoes where user_id is null
-- union all select 'previstos', count(*) from public.previstos where user_id is null
-- union all select 'regras_classificacao', count(*) from public.regras_classificacao where user_id is null
-- union all select 'glossario_termos', count(*) from public.glossario_termos where user_id is null;

-- ---------------------------------------------------------------------
-- FASE 3 — TROCA a política permissiva (true) pela isolada por usuário.
--   Remove a `auth_all_<t>` e cria `own_<t>` (auth.uid() = user_id).
--   RLS já está ligado — não precisa enable. Faça 1 tabela, teste o app, siga.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'contas','categorias','movimentos','cartao_transacoes',
    'previstos','regras_classificacao','glossario_termos'
  ] loop
    execute format('drop policy if exists %I on public.%I;', 'auth_all_'||t, t);
    execute format('drop policy if exists %I on public.%I;', 'own_'||t, t);
    execute format($p$
      create policy %I on public.%I
        for all to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $p$, 'own_'||t, t);
  end loop;
end $$;

-- CHECKPOINT FASE 3 — cada tabela deve ter só a política own_<t>, qual = (user_id = auth.uid()):
-- select tablename, policyname, cmd, roles::text, qual from pg_policies
--   where schemaname='public' and tablename in
--   ('contas','categorias','movimentos','cartao_transacoes','previstos','regras_classificacao','glossario_termos')
--   order by tablename;

-- LEMBRETE: os syncs (Inter/Organizze) usam service_role (ignora RLS) e já
-- foram patchados pra carimbar user_id SE o secret OWNER_USER_ID estiver setado.
-- Defina OWNER_USER_ID = f23f70d9-2859-4664-8842-bbf82762aecb no GitHub Actions.

-- ---------------------------------------------------------------------
-- ROLLBACK (se travar) — volta pra política "todo logado vê tudo".
-- ---------------------------------------------------------------------
-- do $$
-- declare t text;
-- begin
--   foreach t in array array['contas','categorias','movimentos','cartao_transacoes','previstos','regras_classificacao','glossario_termos'] loop
--     execute format('drop policy if exists %I on public.%I;', 'own_'||t, t);
--     execute format('create policy %I on public.%I for all to authenticated using (true) with check (true);', 'auth_all_'||t, t);
--   end loop;
-- end $$;
