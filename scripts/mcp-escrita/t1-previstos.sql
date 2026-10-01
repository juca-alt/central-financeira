-- =====================================================================
-- Conector de escrita v2 -- T1: auditoria + editar/cancelar previsto +
-- lancar conta a receber.  (Central Financeira, 2026-10-01)
--
-- FONTE UNICA: a regra de negocio mora aqui (funcoes cf_*, SECURITY
-- DEFINER). A Edge Function mcp-financeiro so valida entrada e chama a RPC;
-- o app, se precisar da mesma acao, chama a mesma RPC.
--
-- Contrato de toda RPC de tool:  cf_<tool>(p_usuario text, p_args jsonb,
--   p_lote uuid default null) returns jsonb {ok, msg, id, ...}
--  - p_usuario: so vale quando quem chama e o service_role (conector) ou o
--    SQL Editor; logado no app, a identidade vem do JWT e o parametro e
--    ignorado. 'dono' = token do dono (tudo).
--  - erro = exception (nada gravado). Toda escrita grava 1 linha por
--    registro tocado em cf_mcp_audit (antes/depois) -- base do desfazer.
--  - NUNCA DELETE: "apagar" = status 'cancelado'.
--
-- Idempotente (create or replace / if not exists). ASCII puro (erro 33).
-- =====================================================================

-- ---------------------------------------------------------------- audit
create table if not exists public.cf_mcp_audit (
  id           bigserial primary key,
  criado_em    timestamptz not null default now(),
  usuario      text not null,
  tool         text not null,
  lote_id      uuid,
  tabela       text not null,
  registro_id  uuid not null,
  antes        jsonb,          -- null = registro criado pela tool
  depois       jsonb,
  revertido_em timestamptz
);
create index if not exists cf_mcp_audit_lote_idx   on public.cf_mcp_audit (lote_id);
create index if not exists cf_mcp_audit_criado_idx on public.cf_mcp_audit (criado_em desc);
create index if not exists cf_mcp_audit_reg_idx    on public.cf_mcp_audit (tabela, registro_id);
alter table public.cf_mcp_audit enable row level security;
revoke all on table public.cf_mcp_audit from anon, authenticated;
revoke all on sequence public.cf_mcp_audit_id_seq from anon, authenticated;

-- -------------------------------------------------------------- helpers
-- identidade de quem chama
create or replace function public.cf_ator(p_usuario text)
returns text language plpgsql stable security definer set search_path = public as $$
declare v text := public.app_email();
begin
  if v <> '' then return v; end if;   -- logado no app: vale o JWT, nunca o parametro
  if coalesce(auth.role(), '') = 'service_role' or session_user in ('postgres', 'supabase_admin') then
    v := lower(trim(coalesce(p_usuario, '')));
    if v = '' then raise exception 'usuario obrigatorio'; end if;
    return v;
  end if;
  raise exception 'sem identidade: chame logado no app ou pelo conector';
end $$;

create or replace function public.cf_pode(p_usuario text, p_visao public.visao, p_escrita boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select p_usuario = 'dono'
      or exists (select 1 from public.app_usuarios u where u.email = p_usuario and u.admin)
      or exists (select 1 from public.usuario_visoes v
                  where v.email = p_usuario and v.visao = p_visao and v.ler
                    and (not p_escrita or v.escrever))
$$;

create or replace function public.cf_exige_escrita(p_usuario text, p_visao public.visao)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.cf_pode(p_usuario, p_visao, true) then
    raise exception 'sem permissao de escrita na visao % (peca ao Gustavo: Configuracoes > Pessoas & acessos). Nada foi gravado.', p_visao;
  end if;
end $$;

-- visoes validas no conector (as mesmas da Edge Function)
create or replace function public.cf_visao(p text)
returns public.visao language plpgsql immutable as $$
declare v text := upper(trim(coalesce(p, '')));
begin
  if v not in ('PJ', 'PIPEX', 'RC', 'FAMILIA', 'JUCA') then
    raise exception 'visao invalida "%" (use PJ/PIPEX/RC/FAMILIA/JUCA)', p;
  end if;
  return v::public.visao;
end $$;

create or replace function public.cf_uuid(p text, p_campo text)
returns uuid language plpgsql immutable as $$
begin
  if p is null or trim(p) = '' then raise exception '% obrigatorio', p_campo; end if;
  return trim(p)::uuid;
exception when invalid_text_representation then
  raise exception '% invalido: "%"', p_campo, p;
end $$;

create or replace function public.cf_data(p text, p_campo text)
returns date language plpgsql immutable as $$
begin
  if p is null or p !~ '^\d{4}-\d{2}-\d{2}$' then raise exception '% deve ser YYYY-MM-DD (veio "%")', p_campo, p; end if;
  return p::date;
exception when datetime_field_overflow or invalid_datetime_format then
  raise exception '% invalida: "%"', p_campo, p;
end $$;

create or replace function public.cf_valor(p jsonb, p_campo text)
returns numeric language plpgsql immutable as $$
declare v numeric;
begin
  begin v := (p #>> '{}')::numeric;
  exception when others then raise exception '% deve ser numero (veio %)', p_campo, p; end;
  if v is null or v <= 0 then raise exception '% deve ser > 0', p_campo; end if;
  return round(v, 2);
end $$;

create or replace function public.cf_recorrencia(p text)
returns text language plpgsql immutable as $$
declare v text := lower(trim(coalesce(p, '')));
begin
  if v = '' or v in ('null', 'avulsa', 'pontual', 'nenhuma') then return null; end if;
  if v not in ('mensal', 'semanal', 'quinzenal', 'bimestral', 'trimestral', 'semestral', 'anual') then
    raise exception 'recorrencia invalida "%" (use mensal/semanal/quinzenal/bimestral/trimestral/semestral/anual, ou null = avulsa)', p;
  end if;
  return v;
end $$;

-- R$ 1.234,56 (independe do locale do servidor; mesmo formato do brl() da Edge)
create or replace function public.cf_brl(v numeric)
returns text language sql immutable as $$
  select 'R$ ' || translate(to_char(coalesce(v, 0), 'FM999,999,999,990.00'), ',.', '.,')
$$;

create or replace function public.cf_hoje()
returns date language sql stable as $$ select (now() at time zone 'America/Recife')::date $$;

-- observacao: modo anexar = "<atual> | dd/mm: <texto>"
create or replace function public.cf_obs_anexar(p_atual text, p_texto text)
returns text language sql stable as $$
  select case when coalesce(trim(p_texto), '') = '' then p_atual
              when coalesce(trim(p_atual), '') = '' then '| ' || to_char(public.cf_hoje(), 'DD/MM') || ': ' || trim(p_texto)
              else trim(p_atual) || ' | ' || to_char(public.cf_hoje(), 'DD/MM') || ': ' || trim(p_texto) end
$$;

-- categoria/conta por nome, na visao ou AMBOS. Exato (sem caixa) primeiro;
-- senao parcial unico; ambiguo ou ausente = erro (nada gravado).
create or replace function public.cf_resolve(p_tabela text, p_nome text, p_visao public.visao)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_ids uuid[]; v_nomes text; v_nome text := trim(coalesce(p_nome, ''));
begin
  if p_tabela not in ('categorias', 'contas') then raise exception 'cf_resolve: tabela invalida'; end if;
  if v_nome = '' then return null; end if;
  execute format('select array_agg(id) from public.%I where lower(nome) = lower($1) and visao in ($2, ''AMBOS'') and ativo is not false', p_tabela)
    into v_ids using v_nome, p_visao;
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    execute format('select array_agg(id), string_agg(nome, '', '' order by nome) from public.%I where nome ilike $1 and visao in ($2, ''AMBOS'') and ativo is not false', p_tabela)
      into v_ids, v_nomes using '%' || replace(replace(v_nome, '%', ''), '_', '\_') || '%', p_visao;
  end if;
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception '% "%" nao encontrada na visao %', case p_tabela when 'contas' then 'conta' else 'categoria' end, v_nome, p_visao;
  end if;
  if array_length(v_ids, 1) > 1 then
    raise exception '% "%" ambigua na visao %: %', case p_tabela when 'contas' then 'conta' else 'categoria' end, v_nome, p_visao, coalesce(v_nomes, 'mais de uma com o mesmo nome');
  end if;
  return v_ids[1];
end $$;

-- campos que mudaram: {campo: {de, para}} (ignora updated_at)
create or replace function public.cf_diff(p_antes jsonb, p_depois jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_object_agg(k, jsonb_build_object('de', p_antes -> k, 'para', p_depois -> k)), '{}'::jsonb)
    from (select jsonb_object_keys(coalesce(p_depois, p_antes, '{}'::jsonb)) k) s
   where k not in ('updated_at', 'created_at')
     and (p_antes is null or p_depois is null or (p_antes -> k) is distinct from (p_depois -> k))
$$;

create or replace function public.cf_diff_txt(p_antes jsonb, p_depois jsonb)
returns text language sql immutable as $$
  select coalesce(string_agg(k || ': ' || coalesce(p_antes ->> k, 'vazio') || ' -> ' || coalesce(p_depois ->> k, 'vazio'), '; ' order by k), 'nada mudou')
    from (select jsonb_object_keys(public.cf_diff(p_antes, p_depois)) k) s
$$;

create or replace function public.cf_audit_add(p_usuario text, p_tool text, p_lote uuid, p_tabela text,
                                               p_id uuid, p_antes jsonb, p_depois jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.cf_mcp_audit (usuario, tool, lote_id, tabela, registro_id, antes, depois)
  values (p_usuario, p_tool, p_lote, p_tabela, p_id, p_antes, p_depois)
$$;

-- ======================================================= TOOLS (T1)

-- editar_previsto: {previsto_id, campos{...}, observacao_modo: anexar|substituir}
create or replace function public.cf_editar_previsto(p_usuario text, p_args jsonb, p_lote uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user text := public.cf_ator(p_usuario);
  v_id   uuid := public.cf_uuid(p_args ->> 'previsto_id', 'previsto_id');
  c      jsonb := coalesce(p_args -> 'campos', '{}'::jsonb);
  v_modo text := lower(coalesce(p_args ->> 'observacao_modo', 'anexar'));
  p public.previstos; n public.previstos;
  k text; v_st text; v_cat_vis public.visao;
  ok_campos constant text[] := array['descricao', 'valor', 'vencimento', 'categoria', 'conta', 'visao',
    'observacao', 'recorrencia', 'competencia', 'entidade_id', 'status'];
begin
  select * into p from public.previstos where id = v_id for update;
  if not found then raise exception 'previsto % nao encontrado', v_id; end if;
  perform public.cf_exige_escrita(v_user, p.visao);
  if jsonb_typeof(c) <> 'object' or c = '{}'::jsonb then raise exception 'informe campos a editar'; end if;
  for k in select jsonb_object_keys(c) loop
    if not k = any (ok_campos) then
      raise exception 'campo "%" nao editavel por editar_previsto (permitidos: %)', k, array_to_string(ok_campos, ', ');
    end if;
  end loop;
  if v_modo not in ('anexar', 'substituir') then raise exception 'observacao_modo deve ser anexar ou substituir'; end if;

  n := p;
  if c ? 'visao' then
    n.visao := public.cf_visao(c ->> 'visao');
    if n.visao <> p.visao then
      perform public.cf_exige_escrita(v_user, n.visao);
      -- categoria/conta antigas precisam existir na visao nova (ou venha a troca junto)
      if not c ? 'categoria' and p.categoria_id is not null then
        select visao into v_cat_vis from public.categorias where id = p.categoria_id;
        if v_cat_vis not in (n.visao, 'AMBOS') then
          raise exception 'a categoria atual e da visao %; informe "categoria" (ou null) junto com a troca de visao', v_cat_vis;
        end if;
      end if;
      if not c ? 'conta' and p.conta_id is not null then
        select visao into v_cat_vis from public.contas where id = p.conta_id;
        if v_cat_vis not in (n.visao, 'AMBOS') then
          raise exception 'a conta atual e da visao %; informe "conta" (ou null) junto com a troca de visao', v_cat_vis;
        end if;
      end if;
    end if;
  end if;
  if c ? 'descricao' then
    n.descricao := nullif(trim(coalesce(c ->> 'descricao', '')), '');
    if n.descricao is null then raise exception 'descricao nao pode ficar vazia'; end if;
  end if;
  if c ? 'valor'       then n.valor := public.cf_valor(c -> 'valor', 'valor'); end if;
  if c ? 'vencimento'  then n.vencimento := public.cf_data(c ->> 'vencimento', 'vencimento'); end if;
  if c ? 'categoria'   then n.categoria_id := public.cf_resolve('categorias', c ->> 'categoria', n.visao); end if;
  if c ? 'conta'       then n.conta_id := public.cf_resolve('contas', c ->> 'conta', n.visao); end if;
  if c ? 'recorrencia' then n.recorrencia := public.cf_recorrencia(c ->> 'recorrencia'); end if;
  if c ? 'competencia' then
    n.competencia := case when coalesce(c ->> 'competencia', '') = '' then null
                          when c ->> 'competencia' ~ '^\d{4}-\d{2}$' then public.cf_data((c ->> 'competencia') || '-01', 'competencia')
                          else date_trunc('month', public.cf_data(c ->> 'competencia', 'competencia'))::date end;
  end if;
  if c ? 'entidade_id' then
    n.entidade_id := case when coalesce(c ->> 'entidade_id', '') = '' then null else public.cf_uuid(c ->> 'entidade_id', 'entidade_id') end;
    if n.entidade_id is not null and not exists (select 1 from public.entidades where id = n.entidade_id) then
      raise exception 'entidade % nao encontrada', n.entidade_id;
    end if;
  end if;
  if c ? 'status' then
    v_st := lower(coalesce(c ->> 'status', ''));
    if v_st not in ('aberto', 'cancelado') then
      raise exception 'status "%" nao pode ser definido por editar_previsto: pago/recebido so via dar_baixa', c ->> 'status';
    end if;
    if p.status in ('pago', 'recebido') and v_st <> p.status::text then
      raise exception 'previsto ja esta % (quitado); pra reabrir use desfazer', p.status;
    end if;
    n.status := v_st::public.status_previsto;
  end if;
  if n.recorrencia is not null and n.status in ('pago', 'recebido') then
    raise exception 'previsto quitado nao pode virar recorrente';
  end if;
  if c ? 'observacao' then
    n.observacao := case when v_modo = 'substituir' then nullif(trim(coalesce(c ->> 'observacao', '')), '')
                         else public.cf_obs_anexar(p.observacao, c ->> 'observacao') end;
  end if;

  if public.cf_diff(to_jsonb(p), to_jsonb(n)) = '{}'::jsonb then
    return jsonb_build_object('ok', true, 'id', v_id, 'mudou', false,
      'msg', 'Previsto "' || p.descricao || '": nada mudou (valores ja eram esses).');
  end if;

  update public.previstos set
    descricao = n.descricao, valor = n.valor, vencimento = n.vencimento, categoria_id = n.categoria_id,
    conta_id = n.conta_id, visao = n.visao, observacao = n.observacao, recorrencia = n.recorrencia,
    competencia = n.competencia, entidade_id = n.entidade_id, status = n.status
  where id = v_id returning * into n;
  perform public.cf_audit_add(v_user, 'editar_previsto', p_lote, 'previstos', v_id, to_jsonb(p), to_jsonb(n));
  return jsonb_build_object('ok', true, 'id', v_id, 'mudou', true,
    'diff', public.cf_diff(to_jsonb(p), to_jsonb(n)),
    'msg', 'Previsto "' || n.descricao || '" atualizado: ' || public.cf_diff_txt(to_jsonb(p), to_jsonb(n)) || ' [id ' || v_id || ']');
end $$;

-- cancelar_previsto: {previsto_id, motivo}. Nunca DELETE.
create or replace function public.cf_cancelar_previsto(p_usuario text, p_args jsonb, p_lote uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user   text := public.cf_ator(p_usuario);
  v_id     uuid := public.cf_uuid(p_args ->> 'previsto_id', 'previsto_id');
  v_motivo text := nullif(trim(coalesce(p_args ->> 'motivo', '')), '');
  p public.previstos; n public.previstos;
begin
  if v_motivo is null then raise exception 'motivo obrigatorio'; end if;
  select * into p from public.previstos where id = v_id for update;
  if not found then raise exception 'previsto % nao encontrado', v_id; end if;
  perform public.cf_exige_escrita(v_user, p.visao);
  if p.status = 'cancelado' then
    return jsonb_build_object('ok', true, 'id', v_id, 'mudou', false, 'msg', 'Previsto "' || p.descricao || '" ja estava cancelado.');
  end if;
  if p.status in ('pago', 'recebido') then
    raise exception 'previsto ja esta % (quitado); cancelar nao se aplica -- use desfazer', p.status;
  end if;
  update public.previstos
     set status = 'cancelado', observacao = public.cf_obs_anexar(p.observacao, 'cancelado: ' || v_motivo)
   where id = v_id returning * into n;
  perform public.cf_audit_add(v_user, 'cancelar_previsto', p_lote, 'previstos', v_id, to_jsonb(p), to_jsonb(n));
  return jsonb_build_object('ok', true, 'id', v_id, 'mudou', true,
    'diff', public.cf_diff(to_jsonb(p), to_jsonb(n)),
    'msg', 'Previsto "' || p.descricao || '" cancelado' || case when p.recorrencia is not null then ' (serie ' || p.recorrencia || ' encerrada)' else '' end
           || ': ' || v_motivo || ' [id ' || v_id || ']');
end $$;

-- lancar_conta_a_receber: espelho de lancar_conta_a_pagar com tipo 'receber'.
-- {descricao, valor, vencimento, visao, categoria?, conta?, recorrencia?, observacao?, competencia?, entidade_id?, via?}
create or replace function public.cf_lancar_conta_a_receber(p_usuario text, p_args jsonb, p_lote uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user text := public.cf_ator(p_usuario);
  v_vis  public.visao := public.cf_visao(p_args ->> 'visao');
  v_desc text := nullif(trim(coalesce(p_args ->> 'descricao', '')), '');
  v_obs  text;
  n public.previstos;
begin
  perform public.cf_exige_escrita(v_user, v_vis);
  if v_desc is null then raise exception 'descricao obrigatoria'; end if;
  v_obs := trim(coalesce(nullif(trim(p_args ->> 'observacao'), '') || ' ', '') || '[via MCP ' || coalesce(nullif(p_args ->> 'via', ''), v_user) || ']');
  insert into public.previstos (descricao, valor, vencimento, tipo, status, visao, recorrencia,
                                categoria_id, conta_id, observacao, competencia, entidade_id)
  values (v_desc, public.cf_valor(p_args -> 'valor', 'valor'), public.cf_data(p_args ->> 'vencimento', 'vencimento'),
          'receber', 'aberto', v_vis, public.cf_recorrencia(p_args ->> 'recorrencia'),
          public.cf_resolve('categorias', p_args ->> 'categoria', v_vis),
          public.cf_resolve('contas', p_args ->> 'conta', v_vis),
          v_obs,
          case when coalesce(p_args ->> 'competencia', '') = '' then null
               when p_args ->> 'competencia' ~ '^\d{4}-\d{2}$' then public.cf_data((p_args ->> 'competencia') || '-01', 'competencia')
               else date_trunc('month', public.cf_data(p_args ->> 'competencia', 'competencia'))::date end,
          case when coalesce(p_args ->> 'entidade_id', '') = '' then null else public.cf_uuid(p_args ->> 'entidade_id', 'entidade_id') end)
  returning * into n;
  perform public.cf_audit_add(v_user, 'lancar_conta_a_receber', p_lote, 'previstos', n.id, null, to_jsonb(n));
  return jsonb_build_object('ok', true, 'id', n.id, 'mudou', true,
    'msg', 'Conta a receber criada em ' || v_vis || ': "' || n.descricao || '" ' || public.cf_brl(n.valor)
           || ' prevista pra ' || n.vencimento || coalesce(' (' || n.recorrencia || ')', '') || ' [id ' || n.id || ']');
end $$;

-- ---------------------------------------------------------------- grants
-- helpers: so dentro das RPCs (dono = postgres executa)
revoke all on function public.cf_ator(text) from public, anon, authenticated;
revoke all on function public.cf_pode(text, public.visao, boolean) from public, anon, authenticated;
revoke all on function public.cf_exige_escrita(text, public.visao) from public, anon, authenticated;
revoke all on function public.cf_resolve(text, text, public.visao) from public, anon, authenticated;
revoke all on function public.cf_audit_add(text, text, uuid, text, uuid, jsonb, jsonb) from public, anon, authenticated;
-- tools: app logado (identidade do JWT) e conector (service_role)
do $$ declare f text; begin
  foreach f in array array['cf_editar_previsto', 'cf_cancelar_previsto', 'cf_lancar_conta_a_receber'] loop
    execute format('revoke all on function public.%I(text, jsonb, uuid) from public, anon', f);
    execute format('grant execute on function public.%I(text, jsonb, uuid) to authenticated, service_role', f);
  end loop;
end $$;
