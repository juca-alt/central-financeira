-- =====================================================================
-- Testes T2 (genericos): dar_baixa (recorrente e avulsa), adiar_ocorrencia,
-- pular_ocorrencia. BEGIN ... ROLLBACK com fixtures FICTICIAS.
-- =====================================================================
\set ON_ERROR_STOP on
begin;

insert into public.app_usuarios (email, nome, admin) values ('t-escreve@exemplo.invalid', 'Teste Escreve', false);
insert into public.usuario_visoes (email, visao, ler, escrever) values ('t-escreve@exemplo.invalid', 'FAMILIA', true, true);
insert into public.contas (id, nome, tipo, visao) values ('00000000-0000-4000-8000-0000000000a1', 'Zz Conta Teste', 'corrente', 'FAMILIA');
insert into public.previstos (id, descricao, valor, vencimento, tipo, status, visao, recorrencia, competencia, observacao) values
  ('00000000-0000-4000-8000-000000000011', 'Zz Condominio teste', 1740.00, '2026-09-10', 'pagar', 'aberto', 'FAMILIA', 'mensal', null, 'serie'),
  ('00000000-0000-4000-8000-000000000012', 'Zz Plano saude teste', 1013.24, '2026-09-20', 'pagar', 'aberto', 'FAMILIA', 'mensal', '2026-09-01', null),
  ('00000000-0000-4000-8000-000000000013', 'Zz Escola teste', 800.00, '2026-10-05', 'pagar', 'aberto', 'FAMILIA', 'mensal', null, null),
  ('00000000-0000-4000-8000-000000000014', 'Zz Avulsa teste', 99.90, '2026-10-01', 'pagar', 'aberto', 'FAMILIA', null, null, null),
  ('00000000-0000-4000-8000-000000000015', 'Zz Aluguel recebe teste', 2000.00, '2026-10-05', 'receber', 'aberto', 'FAMILIA', 'trimestral', null, null),
  ('00000000-0000-4000-8000-000000000016', 'Zz Cancelada teste', 10.00, '2026-10-05', 'pagar', 'cancelado', 'FAMILIA', null, null, null);
insert into public.movimentos (id, conta_id, data, descricao_original, valor, sinal, visao, hash) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000a1', '2026-09-10', 'PIX CONDOMINIO', 1636.91, -1, 'FAMILIA', 'zz-hash-e1'),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000a1', '2026-10-01', 'PIX AVULSA', 99.90, -1, 'FAMILIA', 'zz-hash-e2');

create temp table _t (n int, ok text) on commit drop;

-- A3: baixa de recorrente mensal com valor_real e movimento
do $$ declare r jsonb; p public.previstos; nx public.previstos; m public.movimentos; na int;
begin
  r := public.cf_dar_baixa('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000011","valor_real":1636.91,"movimento_id":"00000000-0000-4000-8000-0000000000e1"}');
  select * into p from public.previstos where id = '00000000-0000-4000-8000-000000000011';
  assert p.status = 'pago' and p.recorrencia is null and p.valor = 1636.91, 'A3 atual';
  assert p.movimento_id_realizado = '00000000-0000-4000-8000-0000000000e1', 'A3 vinculo previsto';
  select * into m from public.movimentos where id = '00000000-0000-4000-8000-0000000000e1';
  assert m.conciliado_previsto_id = p.id, 'A3 vinculo movimento';
  select * into nx from public.previstos where id = (r ->> 'proxima_id')::uuid;
  assert nx.status = 'aberto' and nx.recorrencia = 'mensal' and nx.vencimento = '2026-10-10' and nx.valor = 1740.00, 'A3 proxima';
  assert nx.descricao = p.descricao and nx.visao = p.visao and nx.tipo = 'pagar' and nx.observacao = 'serie', 'A3 proxima copia campos';
  select count(*) into na from public.cf_mcp_audit where tool = 'dar_baixa';
  assert na = 3, 'A3 audit 3 linhas (atual, proxima, movimento): ' || na;
  assert r ->> 'msg' like 'Baixa dada: "Zz Condominio teste" R$ 1.636,91 marcada como pago (previsto era R$ 1.740,00) e conciliada%', 'A3 msg ' || (r ->> 'msg');
  insert into _t values (3, 'dar_baixa recorrente: atual avulsa paga, proxima aberta 10/10, conciliado nos 2 lados');
end $$;

-- A4: valor_proxima + competencia anda junto
do $$ declare r jsonb; nx public.previstos;
begin
  r := public.cf_dar_baixa('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000012","valor_proxima":993.05}');
  select * into nx from public.previstos where id = (r ->> 'proxima_id')::uuid;
  assert nx.valor = 993.05 and nx.vencimento = '2026-10-20' and nx.competencia = '2026-10-01', 'A4 proxima';
  assert (select valor from public.previstos where id = '00000000-0000-4000-8000-000000000012') = 1013.24, 'A4 atual mantem valor';
  insert into _t values (4, 'dar_baixa com valor_proxima: proxima nasce com o valor novo');
end $$;

-- A5: adiar a ocorrencia de 10/10 (criada no A3) pra 30/10
do $$ declare v_occ uuid; r jsonb; p public.previstos; nx public.previstos; n_out int;
begin
  select id into v_occ from public.previstos where descricao = 'Zz Condominio teste' and status = 'aberto';
  r := public.cf_adiar_ocorrencia('t-escreve@exemplo.invalid', jsonb_build_object('previsto_id', v_occ, 'nova_data', '2026-10-30', 'motivo', 'boleto atrasou'));
  select * into p from public.previstos where id = v_occ;
  assert p.vencimento = '2026-10-30' and p.recorrencia is null and p.status = 'aberto', 'A5 avulsa 30/10';
  assert p.observacao like 'serie | __/__: adiado de 10/10/2026: boleto atrasou', 'A5 obs ' || p.observacao;
  select * into nx from public.previstos where id = (r ->> 'proxima_id')::uuid;
  assert nx.vencimento = '2026-11-10' and nx.recorrencia = 'mensal' and nx.status = 'aberto', 'A5 ancora 10/11';
  select count(*) into n_out from public.previstos where descricao = 'Zz Condominio teste' and status = 'aberto'
     and vencimento between '2026-10-01' and '2026-10-31';
  assert n_out = 1, 'A5 sem duplicata em outubro: ' || n_out;
  insert into _t values (5, 'adiar_ocorrencia: avulsa 30/10 + ancora mensal 10/11, outubro sem duplicata');
end $$;

-- A5b: adiar avulsa so muda a data
do $$ declare r jsonb; begin
  r := public.cf_adiar_ocorrencia('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000014","nova_data":"2026-10-08"}');
  assert (select vencimento from public.previstos where id = '00000000-0000-4000-8000-000000000014') = '2026-10-08', 'A5b';
  assert r ->> 'proxima_id' is null, 'A5b sem ancora';
  insert into _t values (6, 'adiar_ocorrencia avulsa: so o vencimento muda');
end $$;

-- A6: pular_ocorrencia num mensal: +1 mes, nada pago criado
do $$ declare n0 int; n1 int; begin
  select count(*) into n0 from public.previstos where status in ('pago', 'recebido');
  perform public.cf_pular_ocorrencia('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000013","motivo":"ferias"}');
  select count(*) into n1 from public.previstos where status in ('pago', 'recebido');
  assert (select vencimento from public.previstos where id = '00000000-0000-4000-8000-000000000013') = '2026-11-05', 'A6 vencimento';
  assert n0 = n1, 'A6 nada pago';
  begin
    perform public.cf_pular_ocorrencia('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000014"}');
    raise exception 'FALHOU: pular avulsa';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if;
    assert sqlerrm like 'previsto nao e recorrente%', 'A6 avulsa ' || sqlerrm; end;
  insert into _t values (7, 'pular_ocorrencia: +1 periodo, sem registro pago; avulsa recusa');
end $$;

-- A14: baixa de avulsa = mesmo comportamento/mensagem de antes
do $$ declare r jsonb; p public.previstos; begin
  r := public.cf_dar_baixa('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000014","movimento_id":"00000000-0000-4000-8000-0000000000e2"}');
  select * into p from public.previstos where id = '00000000-0000-4000-8000-000000000014';
  assert p.status = 'pago' and r ->> 'proxima_id' is null, 'A14 avulsa';
  assert r ->> 'msg' = 'Baixa dada: "Zz Avulsa teste" R$ 99,90 marcada como pago e conciliada ao movimento 00000000-0000-4000-8000-0000000000e2 (id 00000000-0000-4000-8000-000000000014).', 'A14 msg ' || (r ->> 'msg');
  r := public.cf_dar_baixa('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000014"}');
  assert r ->> 'msg' like 'Essa conta ja esta como pago%', 'A14 repetida';
  insert into _t values (8, 'dar_baixa avulsa: mesma mensagem da v2.0; repetir nao duplica');
end $$;

-- receber trimestral -> recebido + proxima em 3 meses
do $$ declare r jsonb; begin
  r := public.cf_dar_baixa('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000015"}');
  assert (select status from public.previstos where id = '00000000-0000-4000-8000-000000000015') = 'recebido', 'receber status';
  assert (select vencimento from public.previstos where id = (r ->> 'proxima_id')::uuid) = '2027-01-05', 'trimestral +3m';
  insert into _t values (9, 'receber trimestral: recebido + proxima +3 meses');
end $$;

-- recusas: cancelado, movimento ja usado, valor_proxima em avulsa
do $$ begin
  begin perform public.cf_dar_baixa('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000016"}'); raise exception 'FALHOU: cancelado';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; assert sqlerrm like 'previsto esta cancelado%', sqlerrm; end;
  begin perform public.cf_dar_baixa('dono', '{"previsto_id":"00000000-0000-4000-8000-000000000013","movimento_id":"00000000-0000-4000-8000-0000000000e1"}'); raise exception 'FALHOU: mov usado';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; assert sqlerrm like 'movimento ja conciliado com outro previsto%', sqlerrm; end;
  assert (select status from public.previstos where id = '00000000-0000-4000-8000-000000000013') = 'aberto', 'recusa nao gravou';
  insert into _t values (10, 'recusas: cancelado, movimento ja conciliado (nada gravado)');
end $$;

select n, 'PASS' as resultado, ok as teste from _t order by n;
rollback;
