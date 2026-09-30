-- =====================================================================
-- Autoteste do módulo Pipe X — dados SINTÉTICOS, termina em ROLLBACK.
-- Pode rodar no SQL Editor de produção: não deixa rastro.
-- Falhou → o `assert` aborta e mostra qual regra quebrou.
-- Apólices 99xxxxx e competências 2099-xx não colidem com dado real.
-- =====================================================================
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', coalesce(auth.uid(), gen_random_uuid()), 'role', 'authenticated')::text, true);

-- acordo: A 50% (vira 20% em 2099-03), B 20%, C 0%, D 50% (não compensa)
insert into pipex_acordo (apolice, segurado, ult_parcela, comissao_mensal, premio_mensal) values
  ('9900001','CLIENTE A',null,null,null), ('9900002','CLIENTE B',null,null,null),
  ('9900003','CLIENTE C',null,null,null), ('9900004','CLIENTE D',11,100,1000);
insert into pipex_acordo_pct (apolice, desde, pct) values
  ('9900001','2099-01',50), ('9900001','2099-03',20),
  ('9900002','2099-01',20), ('9900003','2099-01',0), ('9900004','2099-01',50);

do $$
declare r jsonb; v numeric; n int; t text; lin jsonb := '[
  {"apolice":"9900001","cobertura":"1","parcela":4,"dt_geracao":"2099-01-09","comissao":100.33,"premio_liquido":250},
  {"apolice":"9900001","cobertura":"1","parcela":5,"dt_geracao":"2099-01-10","comissao":100.33,"premio_liquido":250},
  {"apolice":"9900001","cobertura":"1","parcela":6,"dt_geracao":"2099-01-11","comissao":100.33,"premio_liquido":250},
  {"apolice":"9900002","cobertura":"1","parcela":2,"dt_geracao":"2099-01-09","comissao":150.55,"premio_liquido":390},
  {"apolice":"9900003","cobertura":"1","parcela":5,"dt_geracao":"2099-01-11","comissao":99.99,"premio_liquido":330},
  {"apolice":"9900009","cobertura":"1","parcela":1,"dt_geracao":"2099-01-11","comissao":-50.00,"premio_liquido":100}
]';
begin
  -- regra
  assert pipex_parte(800.00, 50) = 376.00, 'parte 50%';
  assert pipex_parte(150.55, 20) = 28.30,  'parte 20%';
  assert pipex_parte(99.99, 0)   = 0,      'parte 0%';
  assert pipex_rotulo('2099-09') = 'Set/99', 'rótulo';

  -- total do arquivo ≠ soma das linhas → bloqueia
  begin
    perform pipex_importar_extrato('2099-01','2098-12-21','2099-01-20', 999, lin);
    assert false, 'import com total errado deveria bloquear';
  exception when raise_exception then null; end;

  -- chave repetida dentro do arquivo → bloqueia (senão perderia linha em silêncio)
  begin
    perform pipex_importar_extrato('2099-02','2099-01-21','2099-02-20', 200.66,
      '[{"apolice":"9900001","cobertura":"1","parcela":4,"dt_geracao":"2099-02-09","comissao":100.33},
        {"apolice":"9900001","cobertura":"1","parcela":4,"dt_geracao":"2099-02-09","comissao":100.33}]');
    assert false, 'chave duplicada deveria bloquear';
  exception when raise_exception then null; end;
  assert not exists (select 1 from pipex_extrato_linhas where competencia = '2099-02'), 'bloqueio não fez rollback';

  -- import ok + reimport idempotente
  r := pipex_importar_extrato('2099-01','2098-12-21','2099-01-20', 501.53, lin);
  assert (r->>'novas')::int = 6 and (r->>'linhas')::int = 6, 'import 1: ' || r;
  r := pipex_importar_extrato('2099-01','2098-12-21','2099-01-20', 501.53, lin);
  assert (r->>'novas')::int = 0 and (r->>'total')::numeric = 501.53, 'reimport: ' || r;

  -- apuração: A parcelas 4,5,6 cheias (300,99 × 50% × 0,94 = 141,47); B 28,30; C 0; D não compensou; 9900009 fora
  select parte into v from pipex_v_apuracao where competencia = '2099-01' and apolice = '9900001';
  assert v = 141.47, 'parte A = ' || v;
  select string_agg(apolice || ':' || situacao, ',' order by apolice) into t
    from (select apolice, situacao from pipex_v_apuracao where competencia = '2099-01' and apolice like '99%') z;
  assert t = '9900001:rateio,9900002:rateio,9900003:fora_rateio,9900004:nao_compensou,9900009:fora_carteira', 'situações: ' || t;
  select sum(parte) into v from pipex_v_apuracao where competencia = '2099-01' and apolice like '99%';
  assert v = 169.77, 'devido = ' || v;

  -- % por competência: em 2099-03 A cai pra 20%, 2099-01 continua 50%
  assert pipex_pct('9900001','2099-02') = 50 and pipex_pct('9900001','2099-03') = 20, 'vigência do %';

  -- fechar: congela devido, cria previsto a receber venc. dia 05 seguinte, atualiza base da projeção
  r := pipex_fechar('2099-01');
  select valor into v from previstos where id = (r->>'previsto_id')::uuid
     and tipo = 'receber' and status = 'aberto' and vencimento = '2099-02-05';
  assert v = 169.77, 'previsto do fechamento';
  select ult_parcela into n from pipex_acordo where apolice = '9900001';
  assert n = 6, 'base da projeção (última parcela) = ' || n;

  -- fechada + linha nova → bloqueia; mesmo arquivo → passa
  begin
    perform pipex_importar_extrato('2099-01', null, null, 601.53,
      lin || '[{"apolice":"9900001","cobertura":"2","parcela":6,"dt_geracao":"2099-01-11","comissao":100}]');
    assert false, 'competência fechada aceitou linha nova';
  exception when raise_exception then null; end;

  -- projeção: D na parcela 11 → FYC 12ª (100) + renovação 13ª–24ª (8% × 1000 = 80/mês)
  select count(*), sum(comissao) into n, v from pipex_projecao('2099-02') where apolice = '9900004';
  assert n = 13 and v = 100 + 12 * 80, 'projeção D: ' || n || ' parcelas, ' || v;
  select sum(parte) into v from pipex_projecao('2099-02', '{"9900004":100}') where apolice = '9900004' and mes = '2099-02';
  assert v = 94, 'cenário Cheio = 100% × 0,94';

  raise notice 'pipex_selftest: OK';
end $$;
rollback;
