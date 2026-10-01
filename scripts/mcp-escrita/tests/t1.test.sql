-- =====================================================================
-- Testes T1 (genericos): editar_previsto, cancelar_previsto,
-- lancar_conta_a_receber, auditoria e permissao.
-- Tudo em BEGIN ... ROLLBACK: cria fixtures FICTICIAS e nao sobra nada.
-- Pode rodar no Postgres local (run-local.sh) ou no SQL Editor.
-- =====================================================================
\set ON_ERROR_STOP on
begin;

-- fixtures ficticias ----------------------------------------------------
insert into public.app_usuarios (email, nome, admin) values
  ('t-escreve@exemplo.invalid', 'Teste Escreve', false),
  ('t-le@exemplo.invalid', 'Teste Le', false);
insert into public.usuario_visoes (email, visao, ler, escrever) values
  ('t-escreve@exemplo.invalid', 'FAMILIA', true, true),
  ('t-escreve@exemplo.invalid', 'PJ', true, false),
  ('t-le@exemplo.invalid', 'FAMILIA', true, false);
insert into public.categorias (id, nome, tipo, visao) values
  ('00000000-0000-4000-8000-0000000000c1', 'Zz Educacao Teste', 'saida', 'FAMILIA'),
  ('00000000-0000-4000-8000-0000000000c2', 'Zz Moradia Teste', 'saida', 'FAMILIA'),
  ('00000000-0000-4000-8000-0000000000c3', 'Zz Receita Teste', 'entrada', 'FAMILIA'),
  ('00000000-0000-4000-8000-0000000000c4', 'Zz Prolabore Teste', 'saida', 'PJ');
insert into public.contas (id, nome, tipo, visao) values
  ('00000000-0000-4000-8000-0000000000a1', 'Zz Conta Teste Familia', 'corrente', 'FAMILIA');
insert into public.previstos (id, descricao, valor, vencimento, tipo, status, visao, recorrencia, categoria_id, observacao) values
  ('00000000-0000-4000-8000-000000000001', 'Zz Formatura teste', 166.00, '2026-09-30', 'pagar', 'aberto', 'FAMILIA', 'mensal', '00000000-0000-4000-8000-0000000000c1', 'obs antiga'),
  ('00000000-0000-4000-8000-000000000002', 'Zz Avulsa teste', 50.00, '2026-10-05', 'pagar', 'aberto', 'FAMILIA', null, null, null),
  ('00000000-0000-4000-8000-000000000003', 'Zz PJ teste', 900.00, '2026-10-10', 'pagar', 'aberto', 'PJ', null, '00000000-0000-4000-8000-0000000000c4', null),
  ('00000000-0000-4000-8000-000000000004', 'Zz Paga teste', 70.00, '2026-09-01', 'pagar', 'pago', 'FAMILIA', null, null, null);

create temp table _t (n int, ok text) on commit drop;

-- A1: editar_previsto muda vencimento, recorrencia segue, obs anexada, 1 audit
do $$ declare r jsonb; p public.previstos; a public.cf_mcp_audit; n int;
begin
  r := public.cf_editar_previsto('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000001","campos":{"vencimento":"2026-10-30","observacao":"escola adiou"}}');
  select * into p from public.previstos where id = '00000000-0000-4000-8000-000000000001';
  assert p.vencimento = '2026-10-30', 'A1 vencimento';
  assert p.recorrencia = 'mensal', 'A1 recorrencia';
  assert p.observacao like 'obs antiga | __/__: escola adiou', 'A1 observacao: ' || p.observacao;
  select count(*) into n from public.cf_mcp_audit where registro_id = p.id;
  assert n = 1, 'A1 audit count ' || n;
  select * into a from public.cf_mcp_audit where registro_id = p.id;
  assert a.antes ->> 'vencimento' = '2026-09-30' and a.depois ->> 'vencimento' = '2026-10-30', 'A1 audit antes/depois';
  assert a.tool = 'editar_previsto' and a.usuario = 'dono' and a.lote_id is null, 'A1 audit meta';
  assert r ->> 'msg' like '%vencimento: 2026-09-30 -> 2026-10-30%', 'A1 msg ' || (r ->> 'msg');
  insert into _t values (1, 'editar_previsto: vencimento + obs anexada + 1 audit');
end $$;

-- A1b: editar categoria por nome, recorrencia -> avulsa, competencia YYYY-MM
do $$ declare p public.previstos;
begin
  perform public.cf_editar_previsto('t-escreve@exemplo.invalid', '{"previsto_id":"00000000-0000-4000-8000-000000000001","campos":{"categoria":"zz moradia teste","recorrencia":null,"competencia":"2026-10"}}');
  select * into p from public.previstos where id = '00000000-0000-4000-8000-000000000001';
  assert p.categoria_id = '00000000-0000-4000-8000-0000000000c2', 'A1b categoria';
  assert p.recorrencia is null, 'A1b recorrencia null';
  assert p.competencia = '2026-10-01', 'A1b competencia';
  insert into _t values (2, 'editar_previsto: categoria por nome, vira avulsa, competencia');
end $$;

-- A1c: nada mudou = sem audit
do $$ declare r jsonb; n0 int; n1 int;
begin
  select count(*) into n0 from public.cf_mcp_audit;
  r := public.cf_editar_previsto('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000002","campos":{"valor":50}}');
  select count(*) into n1 from public.cf_mcp_audit;
  assert (r ->> 'mudou')::boolean = false and n1 = n0, 'A1c no-op';
  insert into _t values (3, 'editar_previsto: sem mudanca nao audita');
end $$;

-- A2: cancelar_previsto -> cancelado, nada deletado
do $$ declare n0 int; n1 int; p public.previstos;
begin
  select count(*) into n0 from public.previstos;
  perform public.cf_cancelar_previsto('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000002","motivo":"duplicado"}');
  select count(*) into n1 from public.previstos;
  select * into p from public.previstos where id = '00000000-0000-4000-8000-000000000002';
  assert p.status = 'cancelado', 'A2 status';
  assert p.observacao like '| __/__: cancelado: duplicado', 'A2 obs ' || p.observacao;
  assert n0 = n1, 'A2 count';
  insert into _t values (4, 'cancelar_previsto: status cancelado, count igual');
end $$;

-- A11: sem escrita em PJ -> erro, nada alterado, nada auditado
do $$ declare n0 int; n1 int; v numeric;
begin
  select count(*) into n0 from public.cf_mcp_audit;
  begin
    perform public.cf_editar_previsto('t-escreve@exemplo.invalid', '{"previsto_id":"00000000-0000-4000-8000-000000000003","campos":{"valor":1}}');
    raise exception 'FALHOU: A11 deveria recusar';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like 'sem permissao de escrita na visao PJ%', 'A11 msg ' || sqlerrm;
  end;
  select valor into v from public.previstos where id = '00000000-0000-4000-8000-000000000003';
  select count(*) into n1 from public.cf_mcp_audit;
  assert v = 900 and n1 = n0, 'A11 nada gravado';
  insert into _t values (5, 'permissao: sem escrita na visao -> erro, 0 linhas');
end $$;

-- A11b: mover previsto pra visao sem escrita -> erro
do $$ begin
  begin
    perform public.cf_editar_previsto('t-escreve@exemplo.invalid', '{"previsto_id":"00000000-0000-4000-8000-000000000001","campos":{"visao":"PJ","categoria":null}}');
    raise exception 'FALHOU: A11b';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like 'sem permissao de escrita na visao PJ%', 'A11b msg ' || sqlerrm;
  end;
  insert into _t values (6, 'permissao: exige escrita tambem na visao de destino');
end $$;

-- A11c: logado no app (JWT) o p_usuario e ignorado
do $$ begin
  perform set_config('request.jwt.claims', '{"email":"t-le@exemplo.invalid","role":"authenticated"}', true);
  begin
    perform public.cf_editar_previsto('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000001","campos":{"valor":1}}');
    raise exception 'FALHOU: A11c';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like 'sem permissao de escrita na visao FAMILIA%', 'A11c msg ' || sqlerrm;
  end;
  perform set_config('request.jwt.claims', '', true);
  insert into _t values (7, 'identidade: JWT do app vence o parametro p_usuario');
end $$;

-- A12: status pago via editar -> recusado
do $$ begin
  begin
    perform public.cf_editar_previsto('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000003","campos":{"status":"pago"}}');
    raise exception 'FALHOU: A12';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like '%so via dar_baixa%', 'A12 msg ' || sqlerrm;
  end;
  begin
    perform public.cf_editar_previsto('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000004","campos":{"status":"aberto"}}');
    raise exception 'FALHOU: A12b';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like '%quitado%', 'A12b msg ' || sqlerrm;
  end;
  insert into _t values (8, 'status pago/recebido so via baixa; quitado nao reabre');
end $$;

-- campo fora da whitelist / categoria inexistente -> erro, nada gravado
do $$ declare v numeric; begin
  begin
    perform public.cf_editar_previsto('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000003","campos":{"movimento_id_realizado":"00000000-0000-4000-8000-000000000009"}}');
    raise exception 'FALHOU: whitelist';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like 'campo "movimento_id_realizado" nao editavel%', 'whitelist msg ' || sqlerrm;
  end;
  begin
    perform public.cf_editar_previsto('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000003","campos":{"valor":5,"categoria":"nao existe xyz"}}');
    raise exception 'FALHOU: categoria';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like 'categoria "nao existe xyz" nao encontrada%', 'categoria msg ' || sqlerrm;
  end;
  select valor into v from public.previstos where id = '00000000-0000-4000-8000-000000000003';
  assert v = 900, 'valor intacto';
  insert into _t values (9, 'whitelist e categoria inexistente -> erro, nada gravado');
end $$;

-- troca de visao com categoria da visao antiga sem informar -> erro claro
do $$ begin
  begin
    perform public.cf_editar_previsto('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000003","campos":{"visao":"FAMILIA"}}');
    raise exception 'FALHOU: visao';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like 'a categoria atual e da visao PJ%', 'visao msg ' || sqlerrm;
  end;
  perform public.cf_editar_previsto('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000003","campos":{"visao":"FAMILIA","categoria":"Zz Moradia Teste"}}');
  assert (select visao from public.previstos where id = '00000000-0000-4000-8000-000000000003') = 'FAMILIA', 'visao trocada';
  insert into _t values (10, 'troca de visao valida categoria/conta');
end $$;

-- lancar_conta_a_receber: tipo receber, aberto, audit com antes null
do $$ declare r jsonb; p public.previstos; a public.cf_mcp_audit;
begin
  r := public.cf_lancar_conta_a_receber('t-escreve@exemplo.invalid', '{"descricao":"Zz Reembolso teste","valor":"120.5","vencimento":"2026-10-15","visao":"familia","categoria":"Zz Receita","conta":"Zz Conta Teste","recorrencia":"mensal","via":"Teste"}');
  select * into p from public.previstos where id = (r ->> 'id')::uuid;
  assert p.tipo = 'receber' and p.status = 'aberto' and p.valor = 120.50 and p.recorrencia = 'mensal', 'receber campos';
  assert p.categoria_id = '00000000-0000-4000-8000-0000000000c3' and p.conta_id = '00000000-0000-4000-8000-0000000000a1', 'receber cat/conta';
  assert p.observacao = '[via MCP Teste]', 'receber obs ' || p.observacao;
  select * into a from public.cf_mcp_audit where registro_id = p.id;
  assert a.antes is null and a.depois ->> 'tipo' = 'receber' and a.tool = 'lancar_conta_a_receber', 'receber audit';
  begin
    perform public.cf_lancar_conta_a_receber('t-le@exemplo.invalid', '{"descricao":"x","valor":1,"vencimento":"2026-10-15","visao":"FAMILIA"}');
    raise exception 'FALHOU: receber sem escrita';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like 'sem permissao de escrita%', 'receber perm ' || sqlerrm;
  end;
  insert into _t values (11, 'lancar_conta_a_receber: cria receber + audit; sem escrita recusa');
end $$;

select n, 'PASS' as resultado, ok as teste from _t order by n;
rollback;
