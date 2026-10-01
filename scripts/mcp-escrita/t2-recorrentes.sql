-- =====================================================================
-- Conector de escrita v2 -- T2: dar_baixa aceitando recorrente +
-- adiar_ocorrencia + pular_ocorrencia.  (Central Financeira, 2026-10-01)
-- Requer t1-previstos.sql. Mesmo contrato: cf_<tool>(p_usuario, p_args, p_lote).
--
-- REGRA DA SERIE (recorrente): a linha recorrente ABERTA e a ancora = a
-- proxima ocorrencia devida.
--  - dar_baixa: a ancora atual vira AVULSA quitada (recorrencia null,
--    status pago/recebido, valor = valor_real) e nasce a proxima ancora
--    (vencimento + 1 periodo, aberta, mesma recorrencia, valor_proxima).
--  - adiar_ocorrencia: a ocorrencia atual vira AVULSA aberta na nova data e
--    a serie segue numa ancora nova no vencimento original + 1 periodo.
--  - pular_ocorrencia: a ancora anda 1 periodo; nada pago e criado.
-- Idempotente. ASCII puro.
-- =====================================================================

-- proxima data da serie
create or replace function public.cf_proxima(p_data date, p_rec text)
returns date language plpgsql immutable as $$
begin
  return case public.cf_recorrencia(p_rec)
    when 'semanal'    then p_data + 7
    when 'quinzenal'  then p_data + 14
    when 'mensal'     then (p_data + interval '1 month')::date
    when 'bimestral'  then (p_data + interval '2 months')::date
    when 'trimestral' then (p_data + interval '3 months')::date
    when 'semestral'  then (p_data + interval '6 months')::date
    when 'anual'      then (p_data + interval '1 year')::date
  end;
end $$;

-- copia de um previsto como nova ancora aberta (mesmos campos)
create or replace function public.cf_nova_ancora(p public.previstos, p_venc date, p_valor numeric)
returns public.previstos language plpgsql security definer set search_path = public as $$
declare n public.previstos;
begin
  insert into public.previstos (descricao, valor, vencimento, tipo, status, categoria_id, conta_id, visao,
                                recorrencia, observacao, entidade_id, competencia)
  values (p.descricao, coalesce(p_valor, p.valor), p_venc, p.tipo, 'aberto', p.categoria_id, p.conta_id, p.visao,
          p.recorrencia, p.observacao, p.entidade_id,
          case when p.competencia is null then null
               else date_trunc('month', public.cf_proxima(p.competencia, p.recorrencia))::date end)
  returning * into n;
  return n;
end $$;

-- dar_baixa: {previsto_id, movimento_id?, valor_real?, valor_proxima?}
create or replace function public.cf_dar_baixa(p_usuario text, p_args jsonb, p_lote uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user  text := public.cf_ator(p_usuario);
  v_id    uuid := public.cf_uuid(p_args ->> 'previsto_id', 'previsto_id');
  v_mid   uuid := case when coalesce(p_args ->> 'movimento_id', '') = '' then null else public.cf_uuid(p_args ->> 'movimento_id', 'movimento_id') end;
  v_real  numeric := case when coalesce(p_args ->> 'valor_real', '') = '' then null else public.cf_valor(p_args -> 'valor_real', 'valor_real') end;
  v_prox  numeric := case when coalesce(p_args ->> 'valor_proxima', '') = '' then null else public.cf_valor(p_args -> 'valor_proxima', 'valor_proxima') end;
  p public.previstos; n public.previstos; nx public.previstos;
  m public.movimentos; m2 public.movimentos;
  v_st public.status_previsto;
begin
  select * into p from public.previstos where id = v_id for update;
  if not found then raise exception 'previsto % nao encontrado', v_id; end if;
  perform public.cf_exige_escrita(v_user, p.visao);
  if p.status in ('pago', 'recebido') then
    return jsonb_build_object('ok', true, 'id', v_id, 'mudou', false, 'msg', 'Essa conta ja esta como ' || p.status || ' (id ' || v_id || ').');
  end if;
  if p.status = 'cancelado' then raise exception 'previsto esta cancelado; reabra com editar_previsto (status aberto) antes de dar baixa'; end if;
  if v_prox is not null and p.recorrencia is null then raise exception 'valor_proxima so vale pra conta recorrente'; end if;

  if v_mid is not null then
    select * into m from public.movimentos where id = v_mid for update;
    if not found then raise exception 'movimento % nao encontrado', v_mid; end if;
    perform public.cf_exige_escrita(v_user, m.visao);
    if m.conciliado_previsto_id is not null and m.conciliado_previsto_id <> v_id then
      raise exception 'movimento ja conciliado com outro previsto (%); desconcilie antes', m.conciliado_previsto_id;
    end if;
    if p.movimento_id_realizado is not null and p.movimento_id_realizado <> v_mid then
      raise exception 'previsto ja conciliado com outro movimento (%); desconcilie antes', p.movimento_id_realizado;
    end if;
  end if;

  v_st := case when p.tipo = 'receber' then 'recebido' else 'pago' end;
  if p.recorrencia is not null then
    nx := public.cf_nova_ancora(p, public.cf_proxima(p.vencimento, p.recorrencia), coalesce(v_prox, p.valor));
    perform public.cf_audit_add(v_user, 'dar_baixa', p_lote, 'previstos', nx.id, null, to_jsonb(nx));
  end if;
  update public.previstos
     set status = v_st, recorrencia = null, valor = coalesce(v_real, p.valor),
         movimento_id_realizado = coalesce(v_mid, p.movimento_id_realizado)
   where id = v_id returning * into n;
  perform public.cf_audit_add(v_user, 'dar_baixa', p_lote, 'previstos', v_id, to_jsonb(p), to_jsonb(n));
  if v_mid is not null and m.conciliado_previsto_id is distinct from v_id then
    update public.movimentos set conciliado_previsto_id = v_id where id = v_mid returning * into m2;
    perform public.cf_audit_add(v_user, 'dar_baixa', p_lote, 'movimentos', v_mid, to_jsonb(m), to_jsonb(m2));
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'mudou', true, 'proxima_id', nx.id,
    'msg', 'Baixa dada: "' || p.descricao || '" ' || public.cf_brl(n.valor) || ' marcada como ' || v_st
      || case when v_real is not null and v_real <> p.valor then ' (previsto era ' || public.cf_brl(p.valor) || ')' else '' end
      || case when v_mid is not null then ' e conciliada ao movimento ' || v_mid else '' end
      || ' (id ' || v_id || ').'
      || case when nx.id is not null then ' Proxima ocorrencia (' || nx.recorrencia || ') criada pra ' || nx.vencimento
              || ' com ' || public.cf_brl(nx.valor) || ' [id ' || nx.id || '].' else '' end);
end $$;

-- adiar_ocorrencia: {previsto_id, nova_data, motivo?}
create or replace function public.cf_adiar_ocorrencia(p_usuario text, p_args jsonb, p_lote uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user text := public.cf_ator(p_usuario);
  v_id   uuid := public.cf_uuid(p_args ->> 'previsto_id', 'previsto_id');
  v_data date := public.cf_data(p_args ->> 'nova_data', 'nova_data');
  v_mot  text := nullif(trim(coalesce(p_args ->> 'motivo', '')), '');
  p public.previstos; n public.previstos; nx public.previstos;
begin
  select * into p from public.previstos where id = v_id for update;
  if not found then raise exception 'previsto % nao encontrado', v_id; end if;
  perform public.cf_exige_escrita(v_user, p.visao);
  if p.status <> 'aberto' then raise exception 'so da pra adiar previsto aberto (este esta %)', p.status; end if;
  if v_data = p.vencimento then
    return jsonb_build_object('ok', true, 'id', v_id, 'mudou', false, 'msg', 'Previsto "' || p.descricao || '" ja vence em ' || v_data || ' (nada a fazer).');
  end if;
  if p.recorrencia is not null then
    nx := public.cf_nova_ancora(p, public.cf_proxima(p.vencimento, p.recorrencia), p.valor);
    perform public.cf_audit_add(v_user, 'adiar_ocorrencia', p_lote, 'previstos', nx.id, null, to_jsonb(nx));
  end if;
  update public.previstos
     set vencimento = v_data, recorrencia = null,
         observacao = public.cf_obs_anexar(p.observacao, 'adiado de ' || to_char(p.vencimento, 'DD/MM/YYYY') || coalesce(': ' || v_mot, ''))
   where id = v_id returning * into n;
  perform public.cf_audit_add(v_user, 'adiar_ocorrencia', p_lote, 'previstos', v_id, to_jsonb(p), to_jsonb(n));
  return jsonb_build_object('ok', true, 'id', v_id, 'mudou', true, 'proxima_id', nx.id,
    'msg', 'Ocorrencia de "' || p.descricao || '" adiada de ' || p.vencimento || ' para ' || v_data
      || case when nx.id is not null then ' (virou avulsa). A serie ' || nx.recorrencia || ' segue em ' || nx.vencimento || ' [id ' || nx.id || '].' else '.' end
      || ' [id ' || v_id || ']');
end $$;

-- pular_ocorrencia: {previsto_id, motivo?} -- recorrente sem cobranca neste periodo
create or replace function public.cf_pular_ocorrencia(p_usuario text, p_args jsonb, p_lote uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user text := public.cf_ator(p_usuario);
  v_id   uuid := public.cf_uuid(p_args ->> 'previsto_id', 'previsto_id');
  v_mot  text := nullif(trim(coalesce(p_args ->> 'motivo', '')), '');
  p public.previstos; n public.previstos;
begin
  select * into p from public.previstos where id = v_id for update;
  if not found then raise exception 'previsto % nao encontrado', v_id; end if;
  perform public.cf_exige_escrita(v_user, p.visao);
  if p.recorrencia is null then raise exception 'previsto nao e recorrente; use adiar_ocorrencia ou cancelar_previsto'; end if;
  if p.status <> 'aberto' then raise exception 'so da pra pular ocorrencia de previsto aberto (este esta %)', p.status; end if;
  update public.previstos
     set vencimento = public.cf_proxima(p.vencimento, p.recorrencia),
         competencia = case when p.competencia is null then null
                            else date_trunc('month', public.cf_proxima(p.competencia, p.recorrencia))::date end,
         observacao = public.cf_obs_anexar(p.observacao, 'pulou ' || to_char(p.vencimento, 'DD/MM/YYYY') || coalesce(': ' || v_mot, ''))
   where id = v_id returning * into n;
  perform public.cf_audit_add(v_user, 'pular_ocorrencia', p_lote, 'previstos', v_id, to_jsonb(p), to_jsonb(n));
  return jsonb_build_object('ok', true, 'id', v_id, 'mudou', true,
    'msg', 'Ocorrencia de ' || p.vencimento || ' de "' || p.descricao || '" pulada; proxima em ' || n.vencimento || ' [id ' || v_id || ']');
end $$;

revoke all on function public.cf_nova_ancora(public.previstos, date, numeric) from public, anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['cf_dar_baixa', 'cf_adiar_ocorrencia', 'cf_pular_ocorrencia'] loop
    execute format('revoke all on function public.%I(text, jsonb, uuid) from public, anon', f);
    execute format('grant execute on function public.%I(text, jsonb, uuid) to authenticated, service_role', f);
  end loop;
end $$;
