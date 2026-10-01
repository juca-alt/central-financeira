-- =====================================================================
-- Testes T3 (genericos): conciliar/desconciliar, editar_movimento,
-- aplicar_tag/remover_tag. BEGIN ... ROLLBACK com fixtures FICTICIAS.
-- =====================================================================
\set ON_ERROR_STOP on
begin;

insert into public.app_usuarios (email, nome, admin) values ('t-escreve@exemplo.invalid', 'Teste Escreve', false);
insert into public.usuario_visoes (email, visao, ler, escrever) values
  ('t-escreve@exemplo.invalid', 'FAMILIA', true, true), ('t-escreve@exemplo.invalid', 'PJ', true, false);
insert into public.categorias (id, nome, tipo, visao) values
  ('00000000-0000-4000-8000-0000000000c1', 'Zz Mercado Teste', 'saida', 'FAMILIA'),
  ('00000000-0000-4000-8000-0000000000c4', 'Zz Escritorio Teste', 'saida', 'PJ');
insert into public.contas (id, nome, tipo, visao) values ('00000000-0000-4000-8000-0000000000a1', 'Zz Conta Teste', 'corrente', 'FAMILIA');
insert into public.tags (id, nome, visao) values
  ('00000000-0000-4000-8000-0000000000b1', 'ZZPJ', 'AMBOS'), ('00000000-0000-4000-8000-0000000000b2', 'ZZCAMILA', 'AMBOS');
insert into public.previstos (id, descricao, valor, vencimento, tipo, status, visao) values
  ('00000000-0000-4000-8000-000000000021', 'Zz Luz teste', 300, '2026-10-10', 'pagar', 'aberto', 'FAMILIA'),
  ('00000000-0000-4000-8000-000000000022', 'Zz Agua teste', 120, '2026-10-12', 'pagar', 'aberto', 'FAMILIA');
insert into public.movimentos (id, conta_id, data, descricao_original, valor, sinal, visao, hash, categoria_id, observacao) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000a1', '2026-10-10', 'DEBITO LUZ', 300, -1, 'FAMILIA', 'zz-h1', null, null),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000a1', '2026-10-11', 'COMPRA MERCADO', 80, -1, 'FAMILIA', 'zz-h2', '00000000-0000-4000-8000-0000000000c1', 'nota'),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000a1', '2026-10-12', 'PAPELARIA', 40, -1, 'PJ', 'zz-h3', null, null);

create temp table _t (n int, ok text) on commit drop;

-- conciliar: vinculo nos 2 lados, status nao muda; repetir = no-op; conflito = erro
do $$ declare r jsonb; begin
  r := public.cf_conciliar('t-escreve@exemplo.invalid', '{"previsto_id":"00000000-0000-4000-8000-000000000021","movimento_id":"00000000-0000-4000-8000-0000000000e1"}');
  assert (select movimento_id_realizado from public.previstos where id = '00000000-0000-4000-8000-000000000021') = '00000000-0000-4000-8000-0000000000e1', 'conc prev';
  assert (select conciliado_previsto_id from public.movimentos where id = '00000000-0000-4000-8000-0000000000e1') = '00000000-0000-4000-8000-000000000021', 'conc mov';
  assert (select status from public.previstos where id = '00000000-0000-4000-8000-000000000021') = 'aberto', 'conc status';
  assert (select count(*) from public.cf_mcp_audit where tool = 'conciliar') = 2, 'conc audit 2';
  r := public.cf_conciliar('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000021","movimento_id":"00000000-0000-4000-8000-0000000000e1"}');
  assert (r ->> 'mudou')::boolean = false, 'conc idempotente';
  begin
    perform public.cf_conciliar('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000022","movimento_id":"00000000-0000-4000-8000-0000000000e1"}');
    raise exception 'FALHOU: conflito';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like 'movimento ja conciliado com outro previsto%', sqlerrm; end;
  insert into _t values (1, 'conciliar: 2 lados, idempotente, recusa conflito');
end $$;

-- desconciliar: limpa os 2 lados
do $$ declare r jsonb; begin
  r := public.cf_desconciliar('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000021"}');
  assert (select movimento_id_realizado from public.previstos where id = '00000000-0000-4000-8000-000000000021') is null, 'desc prev';
  assert (select conciliado_previsto_id from public.movimentos where id = '00000000-0000-4000-8000-0000000000e1') is null, 'desc mov';
  r := public.cf_desconciliar('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000021"}');
  assert (r ->> 'mudou')::boolean = false, 'desc idempotente';
  insert into _t values (2, 'desconciliar: limpa os 2 lados; repetir = no-op');
end $$;

-- editar_movimento: obs anexada, categoria por nome; valor/data recusados; visao exige escrita
do $$ declare m public.movimentos; begin
  perform public.cf_editar_movimento('t-escreve@exemplo.invalid', '{"movimento_id":"00000000-0000-4000-8000-0000000000e1","campos":{"observacao":"conta de setembro","categoria":"zz mercado teste"}}');
  select * into m from public.movimentos where id = '00000000-0000-4000-8000-0000000000e1';
  assert m.observacao like '| __/__: conta de setembro' and m.categoria_id = '00000000-0000-4000-8000-0000000000c1', 'edmov';
  begin
    perform public.cf_editar_movimento('dono', '{"movimento_id":"00000000-0000-4000-8000-0000000000e1","campos":{"valor":1}}');
    raise exception 'FALHOU: valor';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like 'campo "valor" nao editavel%', sqlerrm; end;
  begin
    perform public.cf_editar_movimento('t-escreve@exemplo.invalid', '{"movimento_id":"00000000-0000-4000-8000-0000000000e1","campos":{"visao":"PJ","categoria":null}}');
    raise exception 'FALHOU: visao';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like 'sem permissao de escrita na visao PJ%', sqlerrm; end;
  begin
    perform public.cf_editar_movimento('dono', '{"movimento_id":"00000000-0000-4000-8000-0000000000e2","campos":{"visao":"PJ"}}');
    raise exception 'FALHOU: cat';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like 'a categoria atual e da visao FAMILIA%', sqlerrm; end;
  perform public.cf_editar_movimento('dono', '{"movimento_id":"00000000-0000-4000-8000-0000000000e2","campos":{"visao":"PJ","categoria":"Zz Escritorio"},"observacao_modo":"substituir"}');
  select * into m from public.movimentos where id = '00000000-0000-4000-8000-0000000000e2';
  assert m.visao = 'PJ' and m.categoria_id = '00000000-0000-4000-8000-0000000000c4' and m.observacao = 'nota', 'edmov visao';
  insert into _t values (3, 'editar_movimento: whitelist, categoria por nome, troca de visao com permissao');
end $$;

-- A7: aplicar_tag 2x em 2 movimentos = exatamente 2 linhas novas
do $$ declare n0 int; n1 int; r jsonb; begin
  select count(*) into n0 from public.movimento_tags;
  r := public.cf_aplicar_tag('dono', '{"movimento_ids":["00000000-0000-4000-8000-0000000000e1","00000000-0000-4000-8000-0000000000e2"],"tag":"zzpj"}');
  r := public.cf_aplicar_tag('dono', '{"movimento_ids":["00000000-0000-4000-8000-0000000000e1","00000000-0000-4000-8000-0000000000e2"],"tag":"ZZPJ"}');
  select count(*) into n1 from public.movimento_tags;
  assert n1 - n0 = 2, 'A7 linhas novas: ' || (n1 - n0);
  assert (r ->> 'alterados')::int = 0 and (r ->> 'ja_estavam')::int = 2, 'A7 2a chamada no-op';
  assert (select count(*) from public.cf_mcp_audit where tool = 'aplicar_tag') = 2, 'A7 audit 2';
  insert into _t values (7, 'aplicar_tag 2x: exatamente 2 linhas novas (idempotente)');
end $$;

-- remover_tag, tag inexistente, permissao
do $$ declare r jsonb; begin
  r := public.cf_remover_tag('dono', '{"movimento_ids":["00000000-0000-4000-8000-0000000000e1"],"tag":"ZZPJ"}');
  assert not exists (select 1 from public.movimento_tags where movimento_id = '00000000-0000-4000-8000-0000000000e1' and tag_id = '00000000-0000-4000-8000-0000000000b1'), 'remover';
  begin
    perform public.cf_aplicar_tag('dono', '{"movimento_ids":["00000000-0000-4000-8000-0000000000e1"],"tag":"NAOEXISTE"}');
    raise exception 'FALHOU: tag';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like 'tag "NAOEXISTE" nao existe%ZZCAMILA%', sqlerrm; end;
  begin  -- lote misto: 1 com escrita + 1 PJ sem escrita = nada gravado
    perform public.cf_aplicar_tag('t-escreve@exemplo.invalid', '{"movimento_ids":["00000000-0000-4000-8000-0000000000e1","00000000-0000-4000-8000-0000000000e3"],"tag":"ZZCAMILA"}');
    raise exception 'FALHOU: perm';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like 'sem permissao de escrita na visao PJ%', sqlerrm; end;
  assert not exists (select 1 from public.movimento_tags where tag_id = '00000000-0000-4000-8000-0000000000b2'), 'perm nada gravado';
  insert into _t values (8, 'remover_tag; tag inexistente lista as validas; sem escrita = nada gravado');
end $$;

select n, 'PASS' as resultado, ok as teste from _t order by n;
rollback;
