-- Semente FICTICIA pro e2e local (banco cf_teste, depois do run-local.sh). Nunca em producao.
do $$ begin if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if; end $$;
grant anon, authenticated, service_role to authenticator;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
insert into public.app_usuarios (email, nome, admin) values ('t-escreve@exemplo.invalid', 'Teste Escreve', false);
insert into public.usuario_visoes values ('t-escreve@exemplo.invalid', 'FAMILIA', true, true), ('t-escreve@exemplo.invalid', 'PJ', true, false);
insert into public.mcp_tokens (email, token) values ('t-escreve@exemplo.invalid', 'tok-escreve');
insert into public.categorias (id, nome, tipo, visao) values
  ('00000000-0000-4000-8000-0000000000c1', 'Zz Educacao Teste', 'saida', 'FAMILIA'),
  ('00000000-0000-4000-8000-0000000000c3', 'Zz Receita Teste', 'entrada', 'FAMILIA');
insert into public.contas (id, nome, tipo, visao) values ('00000000-0000-4000-8000-0000000000a1', 'Zz Conta Teste Familia', 'corrente', 'FAMILIA');
insert into public.previstos (id, descricao, valor, vencimento, tipo, status, visao, recorrencia) values
  ('00000000-0000-4000-8000-000000000001', 'Zz Formatura teste', 166, '2026-09-30', 'pagar', 'aberto', 'FAMILIA', 'mensal'),
  ('00000000-0000-4000-8000-000000000003', 'Zz PJ teste', 900, '2026-10-10', 'pagar', 'aberto', 'PJ', null),
  ('00000000-0000-4000-8000-000000000005', 'Zz Avulsa velha', 40, '2026-10-02', 'pagar', 'aberto', 'FAMILIA', null);
