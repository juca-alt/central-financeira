-- =====================================================================
-- Conector de escrita v2 -- T4: aplicar_lote (dry_run) + desfazer +
-- historico_alteracoes.  (Central Financeira, 2026-10-01)
-- Requer t1, t2, t3.
--
-- aplicar_lote: lista de chamadas as tools de escrita. TUDO OU NADA.
--   dry_run=true (padrao): executa tudo numa subtransacao, captura o diff
--   (antes/depois) e DESFAZ -- nada gravado, nem auditoria.
--   dry_run=false: grava tudo com o mesmo lote_id.
-- desfazer: reverte pela auditoria, do mais novo pro mais antigo. Registro
--   criado vira 'cancelado' (nunca DELETE). Se o registro mudou depois da
--   alteracao, RECUSA (nada revertido). O proprio desfazer e auditado
--   (tool 'desfazer', lote novo) e marca revertido_em nas linhas originais.
-- Idempotente. ASCII puro.
-- =====================================================================

-- visao de cada linha de auditoria (filtro de permissao do historico)
alter table public.cf_mcp_audit
  add column if not exists visao text generated always as (coalesce(depois ->> 'visao', antes ->> 'visao')) stored;

create or replace function public.cf_tools_lote()
returns text[] language sql immutable as $$
  select array['editar_previsto', 'cancelar_previsto', 'lancar_conta_a_receber', 'dar_baixa', 'adiar_ocorrencia',
               'pular_ocorrencia', 'conciliar', 'desconciliar', 'editar_movimento', 'aplicar_tag', 'remover_tag']
$$;

-- aplicar_lote: {operacoes: [{tool, args}], dry_run: true|false}
create or replace function public.cf_aplicar_lote(p_usuario text, p_args jsonb, p_lote uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user text := public.cf_ator(p_usuario);
  v_ops  jsonb := p_args -> 'operacoes';
  v_dry  boolean := coalesce(lower(p_args ->> 'dry_run'), 'true') not in ('false', '0', 'nao', 'no');
  v_lote uuid := gen_random_uuid();
  v_res  jsonb := '[]'::jsonb; v_mud jsonb; r jsonb; op jsonb; v_tool text; i int := 0;
begin
  if jsonb_typeof(v_ops) <> 'array' or jsonb_array_length(v_ops) = 0 then raise exception 'operacoes deve ser uma lista com pelo menos 1 item'; end if;
  if jsonb_array_length(v_ops) > 200 then raise exception 'maximo 200 operacoes por lote'; end if;
  for op in select * from jsonb_array_elements(v_ops) loop
    i := i + 1;
    v_tool := op ->> 'tool';
    if v_tool is null or not v_tool = any (public.cf_tools_lote()) then
      raise exception 'operacao %: tool "%" nao permitida no lote (use: %)', i, coalesce(v_tool, '?'), array_to_string(public.cf_tools_lote(), ', ');
    end if;
    if jsonb_typeof(coalesce(op -> 'args', '{}'::jsonb)) <> 'object' then raise exception 'operacao %: args deve ser objeto', i; end if;
  end loop;

  begin
    i := 0;
    for op in select * from jsonb_array_elements(v_ops) loop
      i := i + 1;
      v_tool := op ->> 'tool';
      begin
        execute format('select public.%I($1, $2, $3)', 'cf_' || v_tool) into r using v_user, coalesce(op -> 'args', '{}'::jsonb), v_lote;
      exception when others then
        raise exception 'operacao % (%): %. Nada foi gravado (lote inteiro desfeito).', i, v_tool, sqlerrm;
      end;
      v_res := v_res || jsonb_build_array(jsonb_build_object('i', i, 'tool', v_tool, 'mudou', r -> 'mudou', 'msg', r ->> 'msg'));
    end loop;
    select coalesce(jsonb_agg(jsonb_build_object(
             'tool', tool, 'tabela', tabela, 'registro_id', registro_id,
             'acao', case when antes is null then 'criado' else 'alterado' end,
             'diff', public.cf_diff(antes, depois)) order by id), '[]'::jsonb)
      into v_mud from public.cf_mcp_audit where lote_id = v_lote;
    if v_dry then
      raise exception using errcode = 'CFDRY', message = 'cf_dry_run';
    end if;
  exception when sqlstate 'CFDRY' then
    -- subtransacao desfeita: nada gravado, nem auditoria. v_res/v_mud sobrevivem.
    null;
  end;

  return jsonb_build_object('ok', true, 'dry_run', v_dry, 'lote_id', case when v_dry then null else v_lote end,
    'n', jsonb_array_length(v_ops), 'resultados', v_res, 'mudancas', v_mud,
    'msg', case when v_dry then 'SIMULACAO (nada gravado): ' else 'LOTE APLICADO (lote_id ' || v_lote || '): ' end
           || jsonb_array_length(v_ops) || ' operacao(oes), ' || jsonb_array_length(v_mud) || ' registro(s) alterado(s)/criado(s).'
           || case when v_dry then ' Pra gravar, chame de novo com dry_run=false.' else ' Pra reverter: desfazer com esse lote_id.' end);
end $$;

-- desfazer: {lote_id} ou {audit_id}
create or replace function public.cf_desfazer(p_usuario text, p_args jsonb, p_lote uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user  text := public.cf_ator(p_usuario);
  v_lote  uuid := case when coalesce(p_args ->> 'lote_id', '') = '' then null else public.cf_uuid(p_args ->> 'lote_id', 'lote_id') end;
  v_aid   bigint;
  v_novo  uuid := coalesce(p_lote, gen_random_uuid());
  a public.cf_mcp_audit; p public.previstos; pn public.previstos; ra public.previstos;
  m public.movimentos; mn public.movimentos;
  v_dif jsonb; v_lig boolean; v_tag uuid; n int := 0; n_canc int := 0;
begin
  if coalesce(p_args ->> 'audit_id', '') <> '' then
    begin v_aid := (p_args ->> 'audit_id')::bigint;
    exception when others then raise exception 'audit_id invalido: "%"', p_args ->> 'audit_id'; end;
  end if;
  if (v_lote is null) = (v_aid is null) then raise exception 'informe lote_id OU audit_id (um dos dois)'; end if;
  if not exists (select 1 from public.cf_mcp_audit where (lote_id = v_lote or id = v_aid) and revertido_em is null) then
    if exists (select 1 from public.cf_mcp_audit where lote_id = v_lote or id = v_aid) then
      raise exception 'isso ja foi desfeito antes (nada a fazer)';
    end if;
    raise exception 'nada encontrado na auditoria com esse %', case when v_lote is not null then 'lote_id' else 'audit_id' end;
  end if;

  for a in select * from public.cf_mcp_audit
            where (lote_id = v_lote or id = v_aid) and revertido_em is null
            order by id desc for update loop
    if a.antes ->> 'visao' is not null then perform public.cf_exige_escrita(v_user, (a.antes ->> 'visao')::public.visao); end if;
    if a.depois ->> 'visao' is not null then perform public.cf_exige_escrita(v_user, (a.depois ->> 'visao')::public.visao); end if;

    if a.tabela = 'previstos' then
      select * into p from public.previstos where id = a.registro_id for update;
      if not found then raise exception 'previsto % nao existe mais; desfazer recusado (nada revertido)', a.registro_id; end if;
      v_dif := public.cf_diff(to_jsonb(p), a.depois);
      if v_dif <> '{}'::jsonb then
        raise exception 'previsto "%" mudou depois dessa alteracao (%); desfazer recusado, nada revertido', p.descricao,
          (select string_agg(k, ', ') from jsonb_object_keys(v_dif) k);
      end if;
      if a.antes is null then
        update public.previstos set status = 'cancelado',
               observacao = public.cf_obs_anexar(p.observacao, 'desfeito (criado por ' || a.tool || ')')
         where id = p.id returning * into pn;
        n_canc := n_canc + 1;
      else
        ra := jsonb_populate_record(null::public.previstos, a.antes);
        update public.previstos set
          descricao = ra.descricao, valor = ra.valor, vencimento = ra.vencimento, tipo = ra.tipo, status = ra.status,
          categoria_id = ra.categoria_id, conta_id = ra.conta_id, visao = ra.visao, recorrencia = ra.recorrencia,
          movimento_id_realizado = ra.movimento_id_realizado, observacao = ra.observacao,
          entidade_id = ra.entidade_id, competencia = ra.competencia
        where id = p.id returning * into pn;
      end if;
      perform public.cf_audit_add(v_user, 'desfazer', v_novo, 'previstos', p.id, to_jsonb(p), to_jsonb(pn));

    elsif a.tabela = 'movimentos' then
      select * into m from public.movimentos where id = a.registro_id for update;
      if not found then raise exception 'movimento % nao existe mais; desfazer recusado (nada revertido)', a.registro_id; end if;
      -- so os campos que o conector escreve
      if (to_jsonb(m) -> 'observacao', to_jsonb(m) -> 'visao', to_jsonb(m) -> 'categoria_id', to_jsonb(m) -> 'conciliado_previsto_id')
         is distinct from (a.depois -> 'observacao', a.depois -> 'visao', a.depois -> 'categoria_id', a.depois -> 'conciliado_previsto_id') then
        raise exception 'movimento "%" mudou depois dessa alteracao; desfazer recusado, nada revertido', m.descricao_original;
      end if;
      update public.movimentos set
        observacao = a.antes ->> 'observacao', visao = (a.antes ->> 'visao')::public.visao,
        categoria_id = (a.antes ->> 'categoria_id')::uuid, conciliado_previsto_id = (a.antes ->> 'conciliado_previsto_id')::uuid
      where id = m.id returning * into mn;
      perform public.cf_audit_add(v_user, 'desfazer', v_novo, 'movimentos', m.id, to_jsonb(m), to_jsonb(mn));

    elsif a.tabela = 'movimento_tags' then
      v_tag := (a.depois ->> 'tag_id')::uuid;
      v_lig := exists (select 1 from public.movimento_tags where movimento_id = a.registro_id and tag_id = v_tag);
      if v_lig <> (a.depois ->> 'ligado')::boolean then
        raise exception 'tag % do movimento % mudou depois dessa alteracao; desfazer recusado, nada revertido', a.depois ->> 'tag', a.registro_id;
      end if;
      if (a.antes ->> 'ligado')::boolean then
        insert into public.movimento_tags (movimento_id, tag_id) values (a.registro_id, v_tag) on conflict do nothing;
      else
        delete from public.movimento_tags where movimento_id = a.registro_id and tag_id = v_tag;
      end if;
      perform public.cf_audit_add(v_user, 'desfazer', v_novo, 'movimento_tags', a.registro_id, a.depois, a.antes);
    else
      raise exception 'tabela % nao suportada no desfazer', a.tabela;
    end if;

    update public.cf_mcp_audit set revertido_em = now() where id = a.id;
    n := n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'mudou', true, 'lote_desfazer', v_novo, 'revertidos', n, 'cancelados', n_canc,
    'msg', 'Desfeito: ' || n || ' alteracao(oes) revertida(s)'
      || case when n_canc > 0 then ', ' || n_canc || ' registro(s) criado(s) pelo lote ficaram cancelados' else '' end
      || '. (o proprio desfazer ficou auditado no lote ' || v_novo || ')');
end $$;

-- historico_alteracoes: {dias=7, visao?, limite=100} -- so visoes que o usuario LE
create or replace function public.cf_historico_alteracoes(p_usuario text, p_args jsonb default '{}'::jsonb, p_lote uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_user text := public.cf_ator(p_usuario);
  v_dias int; v_lim int; v_vis text;
  v_rows jsonb;
begin
  begin
    v_dias := least(greatest(coalesce((p_args ->> 'dias')::int, 7), 1), 365);
    v_lim  := least(greatest(coalesce((p_args ->> 'limite')::int, 100), 1), 500);
  exception when others then raise exception 'dias/limite devem ser numeros'; end;
  v_vis := case when coalesce(p_args ->> 'visao', '') = '' then null else public.cf_visao(p_args ->> 'visao')::text end;
  select coalesce(jsonb_agg(x order by (x ->> 'id')::bigint desc), '[]'::jsonb) into v_rows from (
    select jsonb_build_object(
      'id', a.id, 'criado_em', a.criado_em, 'usuario', a.usuario, 'tool', a.tool, 'lote_id', a.lote_id,
      'tabela', a.tabela, 'registro_id', a.registro_id, 'visao', a.visao, 'revertido_em', a.revertido_em,
      'rotulo', coalesce(a.depois ->> 'descricao', a.antes ->> 'descricao', a.depois ->> 'descricao_original', a.antes ->> 'descricao_original',
                         case when a.tabela = 'movimento_tags' then 'tag ' || (a.depois ->> 'tag') end, a.registro_id::text),
      'resumo', case when a.tabela = 'movimento_tags' then 'tag ' || (a.depois ->> 'tag') || case when (a.depois ->> 'ligado')::boolean then ' aplicada' else ' removida' end
                     when a.antes is null then 'criado: ' || coalesce(a.depois ->> 'vencimento', a.depois ->> 'data', '') || ' ' || public.cf_brl((a.depois ->> 'valor')::numeric)
                     else public.cf_diff_txt(a.antes, a.depois) end) as x
      from public.cf_mcp_audit a
     where a.criado_em >= now() - make_interval(days => v_dias)
       and (v_vis is null or a.visao = v_vis)
       and (a.visao is null or public.visao_segura(a.visao) is null or public.cf_pode(v_user, public.visao_segura(a.visao), false))
     order by a.id desc limit v_lim) s;
  return jsonb_build_object('ok', true, 'mudou', false, 'itens', v_rows, 'n', jsonb_array_length(v_rows),
    'msg', jsonb_array_length(v_rows) || ' alteracao(oes) nos ultimos ' || v_dias || ' dia(s)');
end $$;

revoke all on function public.cf_tools_lote() from public, anon;
do $$ declare f text; begin
  foreach f in array array['cf_aplicar_lote', 'cf_desfazer', 'cf_historico_alteracoes'] loop
    execute format('revoke all on function public.%I(text, jsonb, uuid) from public, anon', f);
    execute format('grant execute on function public.%I(text, jsonb, uuid) to authenticated, service_role', f);
  end loop;
end $$;
