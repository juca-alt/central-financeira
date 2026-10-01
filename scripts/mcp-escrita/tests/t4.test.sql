-- =====================================================================
-- Testes T4 (genericos): aplicar_lote (dry_run / tudo-ou-nada), desfazer,
-- historico_alteracoes. BEGIN ... ROLLBACK com fixtures FICTICIAS.
-- =====================================================================
\set ON_ERROR_STOP on
begin;

insert into public.app_usuarios (email, nome, admin) values
  ('t-escreve@exemplo.invalid', 'Teste Escreve', false), ('t-le@exemplo.invalid', 'Teste Le', false);
insert into public.usuario_visoes (email, visao, ler, escrever) values
  ('t-escreve@exemplo.invalid', 'FAMILIA', true, true), ('t-le@exemplo.invalid', 'FAMILIA', true, false);
insert into public.categorias (id, nome, tipo, visao) values ('00000000-0000-4000-8000-0000000000c1', 'Zz Casa Teste', 'saida', 'FAMILIA');
insert into public.contas (id, nome, tipo, visao) values ('00000000-0000-4000-8000-0000000000a1', 'Zz Conta Teste', 'corrente', 'FAMILIA');
insert into public.tags (id, nome, visao) values ('00000000-0000-4000-8000-0000000000b1', 'ZZPJ', 'AMBOS');
insert into public.previstos (id, descricao, valor, vencimento, tipo, status, visao, recorrencia, observacao) values
  ('00000000-0000-4000-8000-000000000031', 'Zz Condominio teste', 1740, '2026-09-10', 'pagar', 'aberto', 'FAMILIA', 'mensal', 'serie'),
  ('00000000-0000-4000-8000-000000000032', 'Zz Formatura teste', 166, '2026-09-30', 'pagar', 'aberto', 'FAMILIA', 'mensal', null),
  ('00000000-0000-4000-8000-000000000033', 'Zz Avulsa teste', 50, '2026-10-05', 'pagar', 'aberto', 'FAMILIA', null, null),
  ('00000000-0000-4000-8000-000000000034', 'Zz PJ teste', 900, '2026-10-05', 'pagar', 'aberto', 'PJ', null, null);
insert into public.movimentos (id, conta_id, data, descricao_original, valor, sinal, visao, hash) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000a1', '2026-09-10', 'PIX CONDOMINIO', 1636.91, -1, 'FAMILIA', 'zz-h1'),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000a1', '2026-09-11', 'MERCADO', 80, -1, 'FAMILIA', 'zz-h2');

create temp table _t (n int, ok text) on commit drop;
create temp table _snap_p on commit drop as select * from public.previstos;
create temp table _snap_m on commit drop as select * from public.movimentos;
create temp table _snap_t on commit drop as select movimento_id, tag_id from public.movimento_tags;

-- lote de referencia (3 validas)
create temp table _lote (ops jsonb) on commit drop;
insert into _lote values ('[
  {"tool":"editar_previsto","args":{"previsto_id":"00000000-0000-4000-8000-000000000032","campos":{"vencimento":"2026-10-30","observacao":"adiado"}}},
  {"tool":"dar_baixa","args":{"previsto_id":"00000000-0000-4000-8000-000000000031","valor_real":1636.91,"movimento_id":"00000000-0000-4000-8000-0000000000e1"}},
  {"tool":"aplicar_tag","args":{"movimento_ids":["00000000-0000-4000-8000-0000000000e1","00000000-0000-4000-8000-0000000000e2"],"tag":"ZZPJ"}}
]');

-- A8: 3 validas + 1 invalida, dry_run=false -> erro, NADA gravado
do $$ declare v_ops jsonb; n_aud int; begin
  select ops || '[{"tool":"cancelar_previsto","args":{"previsto_id":"00000000-0000-4000-8000-0000000000ff","motivo":"x"}}]'::jsonb into v_ops from _lote;
  begin
    perform public.cf_aplicar_lote('dono', jsonb_build_object('operacoes', v_ops, 'dry_run', false));
    raise exception 'FALHOU: A8';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like 'operacao 4 (cancelar_previsto): previsto % nao encontrado. Nada foi gravado%', 'A8 msg ' || sqlerrm; end;
  assert not exists (select * from public.previstos p where not exists (select 1 from _snap_p s where s.id = p.id and s.vencimento = p.vencimento and s.status = p.status and s.valor = p.valor and s.recorrencia is not distinct from p.recorrencia)), 'A8 previstos intactos';
  assert (select count(*) from public.previstos) = (select count(*) from _snap_p), 'A8 count';
  assert (select count(*) from public.movimento_tags) = (select count(*) from _snap_t), 'A8 tags';
  assert (select conciliado_previsto_id from public.movimentos where id = '00000000-0000-4000-8000-0000000000e1') is null, 'A8 mov';
  select count(*) into n_aud from public.cf_mcp_audit; assert n_aud = 0, 'A8 audit ' || n_aud;
  insert into _t values (8, 'aplicar_lote 3 validas + 1 invalida: erro e NADA gravado');
end $$;

-- tool fora da lista -> recusada antes de executar
do $$ begin
  begin
    perform public.cf_aplicar_lote('dono', '{"operacoes":[{"tool":"desfazer","args":{}}],"dry_run":false}');
    raise exception 'FALHOU: tool';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like 'operacao 1: tool "desfazer" nao permitida%', sqlerrm; end;
  insert into _t values (81, 'aplicar_lote recusa tool fora da lista (sem SQL livre, sem recursao)');
end $$;

-- A9: dry_run=true -> diff, nada alterado, nenhuma auditoria
do $$ declare r jsonb; begin
  r := public.cf_aplicar_lote('dono', jsonb_build_object('operacoes', (select ops from _lote)));  -- dry_run default
  assert (r ->> 'dry_run')::boolean and r ->> 'lote_id' is null, 'A9 flags';
  assert jsonb_array_length(r -> 'resultados') = 3, 'A9 resultados';
  -- editar(1) + baixa(proxima criada, atual, movimento = 3) + 2 tags = 6
  assert jsonb_array_length(r -> 'mudancas') = 6, 'A9 mudancas ' || jsonb_array_length(r -> 'mudancas');
  assert exists (select 1 from jsonb_array_elements(r -> 'mudancas') x
                  where x ->> 'registro_id' = '00000000-0000-4000-8000-000000000032'
                    and x #>> '{diff,vencimento,de}' = '2026-09-30' and x #>> '{diff,vencimento,para}' = '2026-10-30'), 'A9 diff venc';
  assert (select vencimento from public.previstos where id = '00000000-0000-4000-8000-000000000032') = '2026-09-30', 'A9 nada alterado';
  assert (select count(*) from public.previstos) = (select count(*) from _snap_p), 'A9 count';
  assert (select count(*) from public.movimento_tags) = (select count(*) from _snap_t), 'A9 tags';
  assert (select count(*) from public.cf_mcp_audit) = 0, 'A9 sem auditoria';
  insert into _t values (9, 'aplicar_lote dry_run: devolve diff, nada alterado, 0 auditoria');
end $$;

-- A10: aplica de verdade e desfaz pelo lote_id
do $$ declare r jsonb; v_lote uuid; d jsonb; v_prox uuid; begin
  r := public.cf_aplicar_lote('t-escreve@exemplo.invalid', jsonb_build_object('operacoes', (select ops from _lote), 'dry_run', false));
  v_lote := (r ->> 'lote_id')::uuid;
  assert v_lote is not null and (select count(*) from public.cf_mcp_audit where lote_id = v_lote) = 6, 'A10 aplicado';
  assert (select vencimento from public.previstos where id = '00000000-0000-4000-8000-000000000032') = '2026-10-30', 'A10 gravou';
  select registro_id into v_prox from public.cf_mcp_audit where lote_id = v_lote and antes is null;

  d := public.cf_desfazer('t-escreve@exemplo.invalid', jsonb_build_object('lote_id', v_lote));
  assert (d ->> 'revertidos')::int = 6 and (d ->> 'cancelados')::int = 1, 'A10 contagem ' || d::text;
  -- registros que existiam voltam ao antes (campos de negocio)
  assert not exists (
    select 1 from _snap_p s join public.previstos p using (id)
     where (p.descricao, p.valor, p.vencimento, p.status, p.recorrencia, p.observacao, p.movimento_id_realizado, p.categoria_id, p.visao)
           is distinct from (s.descricao, s.valor, s.vencimento, s.status, s.recorrencia, s.observacao, s.movimento_id_realizado, s.categoria_id, s.visao)), 'A10 previstos de volta';
  assert not exists (
    select 1 from _snap_m s join public.movimentos m using (id)
     where (m.observacao, m.visao, m.categoria_id, m.conciliado_previsto_id) is distinct from (s.observacao, s.visao, s.categoria_id, s.conciliado_previsto_id)), 'A10 movimentos de volta';
  assert (select count(*) from public.movimento_tags) = (select count(*) from _snap_t), 'A10 tags de volta';
  -- o que o lote criou fica cancelado (nada deletado)
  assert (select status from public.previstos where id = v_prox) = 'cancelado', 'A10 criado cancelado';
  assert (select count(*) from public.previstos) = (select count(*) from _snap_p) + 1, 'A10 nada deletado';
  assert not exists (select 1 from public.cf_mcp_audit where lote_id = v_lote and revertido_em is null), 'A10 revertido_em';
  assert (select count(*) from public.cf_mcp_audit where tool = 'desfazer') = 6, 'A10 desfazer auditado';
  begin
    perform public.cf_desfazer('dono', jsonb_build_object('lote_id', v_lote));
    raise exception 'FALHOU: 2x';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like 'isso ja foi desfeito%', sqlerrm; end;
  insert into _t values (10, 'desfazer(lote): tudo volta ao antes, criado fica cancelado, revertido_em marcado');
end $$;

-- conflito: registro mudou depois -> desfazer recusa e nada reverte
do $$ declare r jsonb; v_lote uuid; begin
  r := public.cf_aplicar_lote('dono', '{"dry_run":false,"operacoes":[
    {"tool":"editar_previsto","args":{"previsto_id":"00000000-0000-4000-8000-000000000033","campos":{"valor":60}}},
    {"tool":"editar_previsto","args":{"previsto_id":"00000000-0000-4000-8000-000000000032","campos":{"valor":170}}}]}');
  v_lote := (r ->> 'lote_id')::uuid;
  perform public.cf_editar_previsto('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000033","campos":{"valor":70}}');
  begin
    perform public.cf_desfazer('dono', jsonb_build_object('lote_id', v_lote));
    raise exception 'FALHOU: conflito';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like 'previsto "Zz Avulsa teste" mudou depois dessa alteracao (valor)%', sqlerrm; end;
  assert (select valor from public.previstos where id = '00000000-0000-4000-8000-000000000032') = 170, 'conflito: nada revertido';
  -- desfazer so a linha mais nova (audit_id) funciona
  perform public.cf_desfazer('dono', jsonb_build_object('audit_id', (select max(id) from public.cf_mcp_audit where tool = 'editar_previsto' and lote_id is null)));
  assert (select valor from public.previstos where id = '00000000-0000-4000-8000-000000000033') = 60, 'audit_id';
  perform public.cf_desfazer('dono', jsonb_build_object('lote_id', v_lote));
  assert (select valor from public.previstos where id = '00000000-0000-4000-8000-000000000033') = 50, 'lote apos';
  insert into _t values (11, 'desfazer recusa se mudou depois; audit_id desfaz 1 linha; ordem reversa');
end $$;

-- sem escrita na visao -> desfazer recusado
do $$ declare r jsonb; begin
  r := public.cf_aplicar_lote('dono', '{"dry_run":false,"operacoes":[{"tool":"editar_previsto","args":{"previsto_id":"00000000-0000-4000-8000-000000000034","campos":{"valor":901}}}]}');
  begin
    perform public.cf_desfazer('t-escreve@exemplo.invalid', jsonb_build_object('lote_id', r ->> 'lote_id'));
    raise exception 'FALHOU: perm';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like 'sem permissao de escrita na visao PJ%', sqlerrm; end;
  insert into _t values (12, 'desfazer exige escrita na visao');
end $$;

-- historico: filtra por visao que o usuario LE
do $$ declare h jsonb; begin
  h := public.cf_historico_alteracoes('dono', '{"dias":7}');
  assert (h ->> 'n')::int > 0 and exists (select 1 from jsonb_array_elements(h -> 'itens') x where x ->> 'visao' = 'PJ'), 'hist dono ve PJ';
  h := public.cf_historico_alteracoes('t-le@exemplo.invalid', '{}');
  assert (h ->> 'n')::int > 0, 'hist le ve FAMILIA';
  assert not exists (select 1 from jsonb_array_elements(h -> 'itens') x where x ->> 'visao' <> 'FAMILIA'), 'hist le nao ve PJ';
  assert exists (select 1 from jsonb_array_elements(h -> 'itens') x where x ->> 'tool' = 'aplicar_tag' and x ->> 'resumo' = 'tag ZZPJ aplicada'), 'hist resumo tag';
  insert into _t values (13, 'historico_alteracoes: so visoes que o usuario le; resumo legivel');
end $$;

select n, 'PASS' as resultado, ok as teste from _t order by n;
rollback;
