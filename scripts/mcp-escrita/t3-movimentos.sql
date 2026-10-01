-- =====================================================================
-- Conector de escrita v2 -- T3: conciliar/desconciliar, editar_movimento,
-- aplicar_tag/remover_tag.  (Central Financeira, 2026-10-01)
-- Requer t1. Mesmo contrato: cf_<tool>(p_usuario, p_args, p_lote).
-- Movimento: valor/data/hash NAO se editam aqui (data: corrigir_data_movimento).
-- Tag na auditoria: tabela 'movimento_tags', registro_id = movimento_id,
--   antes/depois = {tag_id, tag, visao, ligado}.
-- Idempotente. ASCII puro.
-- =====================================================================

-- conciliar: {previsto_id, movimento_id} -- so o vinculo, nos dois lados
create or replace function public.cf_conciliar(p_usuario text, p_args jsonb, p_lote uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user text := public.cf_ator(p_usuario);
  v_pid  uuid := public.cf_uuid(p_args ->> 'previsto_id', 'previsto_id');
  v_mid  uuid := public.cf_uuid(p_args ->> 'movimento_id', 'movimento_id');
  p public.previstos; p2 public.previstos; m public.movimentos; m2 public.movimentos;
begin
  select * into p from public.previstos where id = v_pid for update;
  if not found then raise exception 'previsto % nao encontrado', v_pid; end if;
  select * into m from public.movimentos where id = v_mid for update;
  if not found then raise exception 'movimento % nao encontrado', v_mid; end if;
  perform public.cf_exige_escrita(v_user, p.visao);
  perform public.cf_exige_escrita(v_user, m.visao);
  if p.movimento_id_realizado is not distinct from v_mid and m.conciliado_previsto_id is not distinct from v_pid then
    return jsonb_build_object('ok', true, 'id', v_pid, 'mudou', false, 'msg', 'Ja estavam conciliados (nada a fazer).');
  end if;
  if p.movimento_id_realizado is not null and p.movimento_id_realizado <> v_mid then
    raise exception 'previsto ja conciliado com outro movimento (%); desconcilie antes', p.movimento_id_realizado;
  end if;
  if m.conciliado_previsto_id is not null and m.conciliado_previsto_id <> v_pid then
    raise exception 'movimento ja conciliado com outro previsto (%); desconcilie antes', m.conciliado_previsto_id;
  end if;
  if p.movimento_id_realizado is distinct from v_mid then
    update public.previstos set movimento_id_realizado = v_mid where id = v_pid returning * into p2;
    perform public.cf_audit_add(v_user, 'conciliar', p_lote, 'previstos', v_pid, to_jsonb(p), to_jsonb(p2));
  end if;
  if m.conciliado_previsto_id is distinct from v_pid then
    update public.movimentos set conciliado_previsto_id = v_pid where id = v_mid returning * into m2;
    perform public.cf_audit_add(v_user, 'conciliar', p_lote, 'movimentos', v_mid, to_jsonb(m), to_jsonb(m2));
  end if;
  return jsonb_build_object('ok', true, 'id', v_pid, 'mudou', true,
    'msg', 'Conciliado: previsto "' || p.descricao || '" ' || public.cf_brl(p.valor) || ' <-> movimento "'
      || m.descricao_original || '" ' || m.data || ' ' || public.cf_brl(m.valor)
      || case when p.status = 'aberto' then '. Obs: o previsto segue ABERTO (pra quitar use dar_baixa com movimento_id).' else '.' end);
end $$;

-- desconciliar: {previsto_id} -- desfaz o vinculo nos dois lados (status nao muda)
create or replace function public.cf_desconciliar(p_usuario text, p_args jsonb, p_lote uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user text := public.cf_ator(p_usuario);
  v_pid  uuid := public.cf_uuid(p_args ->> 'previsto_id', 'previsto_id');
  p public.previstos; p2 public.previstos; m public.movimentos; m2 public.movimentos; n int := 0;
begin
  select * into p from public.previstos where id = v_pid for update;
  if not found then raise exception 'previsto % nao encontrado', v_pid; end if;
  perform public.cf_exige_escrita(v_user, p.visao);
  for m in select * from public.movimentos
            where conciliado_previsto_id = v_pid or id = p.movimento_id_realizado for update loop
    perform public.cf_exige_escrita(v_user, m.visao);
    if m.conciliado_previsto_id = v_pid then
      update public.movimentos set conciliado_previsto_id = null where id = m.id returning * into m2;
      perform public.cf_audit_add(v_user, 'desconciliar', p_lote, 'movimentos', m.id, to_jsonb(m), to_jsonb(m2));
      n := n + 1;
    end if;
  end loop;
  if p.movimento_id_realizado is not null then
    update public.previstos set movimento_id_realizado = null where id = v_pid returning * into p2;
    perform public.cf_audit_add(v_user, 'desconciliar', p_lote, 'previstos', v_pid, to_jsonb(p), to_jsonb(p2));
    n := n + 1;
  end if;
  if n = 0 then
    return jsonb_build_object('ok', true, 'id', v_pid, 'mudou', false, 'msg', 'Previsto "' || p.descricao || '" nao estava conciliado.');
  end if;
  return jsonb_build_object('ok', true, 'id', v_pid, 'mudou', true,
    'msg', 'Vinculo desfeito: previsto "' || p.descricao || '" sem movimento conciliado (status segue ' || p.status || ').');
end $$;

-- editar_movimento: {movimento_id, campos{observacao, visao, categoria}, observacao_modo}
create or replace function public.cf_editar_movimento(p_usuario text, p_args jsonb, p_lote uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user text := public.cf_ator(p_usuario);
  v_id   uuid := public.cf_uuid(p_args ->> 'movimento_id', 'movimento_id');
  c      jsonb := coalesce(p_args -> 'campos', '{}'::jsonb);
  v_modo text := lower(coalesce(p_args ->> 'observacao_modo', 'anexar'));
  m public.movimentos; n public.movimentos; k text; v_cat_vis public.visao;
begin
  select * into m from public.movimentos where id = v_id for update;
  if not found then raise exception 'movimento % nao encontrado', v_id; end if;
  perform public.cf_exige_escrita(v_user, m.visao);
  if jsonb_typeof(c) <> 'object' or c = '{}'::jsonb then raise exception 'informe campos a editar'; end if;
  for k in select jsonb_object_keys(c) loop
    if k not in ('observacao', 'visao', 'categoria') then
      raise exception 'campo "%" nao editavel por editar_movimento (permitidos: observacao, visao, categoria; data: corrigir_data_movimento)', k;
    end if;
  end loop;
  if v_modo not in ('anexar', 'substituir') then raise exception 'observacao_modo deve ser anexar ou substituir'; end if;
  n := m;
  if c ? 'visao' then
    n.visao := public.cf_visao(c ->> 'visao');
    if n.visao <> m.visao then
      perform public.cf_exige_escrita(v_user, n.visao);
      if not c ? 'categoria' and m.categoria_id is not null then
        select visao into v_cat_vis from public.categorias where id = m.categoria_id;
        if v_cat_vis not in (n.visao, 'AMBOS') then
          raise exception 'a categoria atual e da visao %; informe "categoria" (ou null) junto com a troca de visao', v_cat_vis;
        end if;
      end if;
    end if;
  end if;
  if c ? 'categoria' then n.categoria_id := public.cf_resolve('categorias', c ->> 'categoria', n.visao); end if;
  if c ? 'observacao' then
    n.observacao := case when v_modo = 'substituir' then nullif(trim(coalesce(c ->> 'observacao', '')), '')
                         else public.cf_obs_anexar(m.observacao, c ->> 'observacao') end;
  end if;
  if public.cf_diff(to_jsonb(m), to_jsonb(n)) = '{}'::jsonb then
    return jsonb_build_object('ok', true, 'id', v_id, 'mudou', false, 'msg', 'Movimento "' || m.descricao_original || '": nada mudou.');
  end if;
  update public.movimentos set observacao = n.observacao, visao = n.visao, categoria_id = n.categoria_id
   where id = v_id returning * into n;
  perform public.cf_audit_add(v_user, 'editar_movimento', p_lote, 'movimentos', v_id, to_jsonb(m), to_jsonb(n));
  return jsonb_build_object('ok', true, 'id', v_id, 'mudou', true, 'diff', public.cf_diff(to_jsonb(m), to_jsonb(n)),
    'msg', 'Movimento "' || m.descricao_original || '" ' || m.data || ' atualizado: ' || public.cf_diff_txt(to_jsonb(m), to_jsonb(n)) || ' [id ' || v_id || ']');
end $$;

-- nucleo de tag: liga (true) ou desliga (false). {movimento_ids[], tag}
create or replace function public.cf_tag_set(p_usuario text, p_args jsonb, p_lote uuid, p_ligar boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user text := public.cf_ator(p_usuario);
  v_tool text := case when p_ligar then 'aplicar_tag' else 'remover_tag' end;
  v_tag  text := nullif(trim(coalesce(p_args ->> 'tag', '')), '');
  v_ids  uuid[]; v_mid uuid; m public.movimentos; t public.tags; v_tem boolean;
  n_mud int := 0; n_ja int := 0; v_meta jsonb;
begin
  if v_tag is null then raise exception 'tag obrigatoria'; end if;
  if jsonb_typeof(p_args -> 'movimento_ids') <> 'array' or jsonb_array_length(p_args -> 'movimento_ids') = 0 then
    raise exception 'movimento_ids deve ser uma lista com pelo menos 1 id';
  end if;
  if jsonb_array_length(p_args -> 'movimento_ids') > 500 then raise exception 'maximo 500 movimentos por chamada'; end if;
  select array_agg(distinct public.cf_uuid(x, 'movimento_id')) into v_ids from jsonb_array_elements_text(p_args -> 'movimento_ids') x;
  foreach v_mid in array v_ids loop
    select * into m from public.movimentos where id = v_mid for update;
    if not found then raise exception 'movimento % nao encontrado', v_mid; end if;
    perform public.cf_exige_escrita(v_user, m.visao);
    select * into t from public.tags where lower(nome) = lower(v_tag) and visao in (m.visao, 'AMBOS') and ativo is not false
     order by (visao = m.visao) desc limit 1;
    if not found then
      raise exception 'tag "%" nao existe pra visao % (existentes: %)', v_tag, m.visao,
        coalesce((select string_agg(distinct nome, ', ' order by nome) from public.tags where visao in (m.visao, 'AMBOS') and ativo is not false), 'nenhuma');
    end if;
    v_tem := exists (select 1 from public.movimento_tags where movimento_id = v_mid and tag_id = t.id);
    if v_tem = p_ligar then n_ja := n_ja + 1; continue; end if;
    if p_ligar then
      insert into public.movimento_tags (movimento_id, tag_id) values (v_mid, t.id);
    else
      delete from public.movimento_tags where movimento_id = v_mid and tag_id = t.id;
    end if;
    v_meta := jsonb_build_object('tag_id', t.id, 'tag', t.nome, 'visao', m.visao);
    perform public.cf_audit_add(v_user, v_tool, p_lote, 'movimento_tags', v_mid,
      v_meta || jsonb_build_object('ligado', not p_ligar), v_meta || jsonb_build_object('ligado', p_ligar));
    n_mud := n_mud + 1;
  end loop;
  return jsonb_build_object('ok', true, 'mudou', n_mud > 0, 'alterados', n_mud, 'ja_estavam', n_ja,
    'msg', 'Tag ' || upper(v_tag) || case when p_ligar then ' aplicada em ' else ' removida de ' end || n_mud || ' movimento(s)'
      || case when n_ja > 0 then '; ' || n_ja || ' ja estava(m) assim' else '' end || '.');
end $$;

create or replace function public.cf_aplicar_tag(p_usuario text, p_args jsonb, p_lote uuid default null)
returns jsonb language sql security definer set search_path = public as $$
  select public.cf_tag_set(p_usuario, p_args, p_lote, true) $$;
create or replace function public.cf_remover_tag(p_usuario text, p_args jsonb, p_lote uuid default null)
returns jsonb language sql security definer set search_path = public as $$
  select public.cf_tag_set(p_usuario, p_args, p_lote, false) $$;

revoke all on function public.cf_tag_set(text, jsonb, uuid, boolean) from public, anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['cf_conciliar', 'cf_desconciliar', 'cf_editar_movimento', 'cf_aplicar_tag', 'cf_remover_tag'] loop
    execute format('revoke all on function public.%I(text, jsonb, uuid) from public, anon', f);
    execute format('grant execute on function public.%I(text, jsonb, uuid) to authenticated, service_role', f);
  end loop;
end $$;
