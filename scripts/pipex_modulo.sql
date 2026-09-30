-- =====================================================================
-- Módulo Pipe X (parceria com o Daniel) — visão FINANCEIRA. v1 (30/09/26)
-- Projeto mieqsiojvfiqrhectquc. IDEMPOTENTE: rodar 2x = mesmo estado.
--
-- Substitui os 4 artefatos HTML soltos e o snapshot `pipex_state`.
-- Reaproveita: `previstos` (a receber), `movimentos` (Pix do Daniel).
-- `lp_carteira` segue como cadastro do livro inteiro do Daniel (override
-- MFB); `lp_comissao_*` fica congelada (legado da tela Comissões LP).
--
-- REGRA (fonte única — nenhuma tela recalcula por conta própria):
--   parte Pipe X = comissão do Daniel × % do cliente × (1 − 6% Simples)
--   · realizado  : arredonda a 2 casas POR APÓLICE × competência
--                  (pipex_parte / view pipex_v_apuracao)
--   · projeção   : mesmo fator, arredonda só o TOTAL do mês (pipex_projecao)
--   · % é por cliente e por competência (pipex_acordo_pct, com vigência)
--   · competência = janela do extrato (~21→20); vencimento = dia 05 seguinte
--   · quem não aparece no extrato "não compensou" (não é cancelamento)
--
-- Dados reais (carteira, %, extratos, pagamentos) NUNCA entram aqui:
-- vão por SQL Editor/MCP (carga fora do git) ou pelo importador do app.
-- =====================================================================

-- ---------- tabelas --------------------------------------------------

-- Clientes/apólices do acordo + base da projeção (última parcela vista
-- no extrato e valores de UMA parcela). A base é atualizada no fechamento.
create table if not exists public.pipex_acordo (
  apolice          text primary key,
  segurado         text not null,
  ativo            boolean not null default true,
  ult_parcela      int,
  comissao_mensal  numeric(12,2),
  premio_mensal    numeric(12,2),
  base_comp        text,
  owner_id         uuid not null default auth.uid(),
  criado_em        timestamptz not null default now()
);

-- % por cliente com vigência: vale a linha de maior `desde` <= competência.
-- Mudar o % = inserir nova linha (o histórico fica preservado).
create table if not exists public.pipex_acordo_pct (
  apolice    text not null references public.pipex_acordo(apolice) on delete cascade,
  desde      text not null check (desde ~ '^\d{4}-\d{2}$'),
  pct        numeric(5,2) not null check (pct between 0 and 100),
  owner_id   uuid not null default auth.uid(),
  criado_em  timestamptz not null default now(),
  primary key (apolice, desde)
);

-- Uma linha por competência: extrato importado + fechamento.
create table if not exists public.pipex_competencias (
  competencia    text primary key check (competencia ~ '^\d{4}-\d{2}$'),
  rotulo         text not null,                       -- 'Set/26'
  periodo_ini    date,
  periodo_fim    date,
  vencimento     date,                                -- dia 05 do mês seguinte
  total_extrato  numeric(12,2),                       -- Σ comissão do extrato inteiro
  n_linhas       int,
  fonte          text not null default 'extrato' check (fonte in ('extrato','historico')),
  status         text not null default 'aberta' check (status in ('aberta','fechada')),
  devido         numeric(12,2),                       -- congelado no fechamento
  previsto_id    uuid references public.previstos(id) on delete set null,
  fechada_em     timestamptz,
  owner_id       uuid not null default auth.uid(),
  criado_em      timestamptz not null default now()
);

-- Linhas REAIS do extrato (o livro inteiro do Daniel, não só o acordo).
-- Identidade: competência + apólice + cobertura + parcela + data de geração.
-- Parcelas atrasadas que compensam juntas são linhas distintas (entram cheias).
create table if not exists public.pipex_extrato_linhas (
  id              bigint generated always as identity primary key,
  competencia     text not null references public.pipex_competencias(competencia) on delete cascade,
  apolice         text not null,
  cobertura       text not null default '',
  parcela         int  not null default 0,
  dt_geracao      date not null,
  segurado        text,
  premio_liquido  numeric(12,2),
  pct_comissao    numeric(7,3),
  comissao        numeric(12,2) not null,
  dt_emissao      date,
  tipo            text,
  fonte           text not null default 'extrato' check (fonte in ('extrato','historico')),
  owner_id        uuid not null default auth.uid(),
  criado_em       timestamptz not null default now(),
  unique (competencia, apolice, cobertura, parcela, dt_geracao)
);
create index if not exists pipex_linhas_apolice on public.pipex_extrato_linhas (apolice);

-- Quanto de cada pagamento vai pra cada competência (um Pix pode cobrir
-- mais de um mês — ex.: "Maio + parte de Junho").
create table if not exists public.pipex_pagamentos (
  id            uuid primary key default gen_random_uuid(),
  competencia   text not null references public.pipex_competencias(competencia) on delete cascade,
  valor         numeric(12,2) not null check (valor > 0),
  data          date,
  movimento_id  uuid references public.movimentos(id) on delete set null,
  obs           text,
  owner_id      uuid not null default auth.uid(),
  criado_em     timestamptz not null default now()
);
create unique index if not exists pipex_pag_ident on public.pipex_pagamentos (competencia, data, valor);

-- ---------- RLS: só o dono ------------------------------------------
do $$ declare t text; begin
  foreach t in array array['pipex_acordo','pipex_acordo_pct','pipex_competencias','pipex_extrato_linhas','pipex_pagamentos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all_%s on public.%I', t, t);
    execute format('create policy owner_all_%s on public.%I for all using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t, t);
  end loop;
end $$;

-- ---------- regra (fonte única) --------------------------------------

-- Fator da parte Pipe X sobre a comissão do Daniel: % do cliente × (1 − Simples).
create or replace function public.pipex_fator(p_pct numeric)
returns numeric language sql immutable as $$
  select coalesce(p_pct, 0) / 100 * (1 - 0.06)
$$;

-- Parte realizada de UMA apólice numa competência (arredonda por apólice).
create or replace function public.pipex_parte(p_comissao numeric, p_pct numeric)
returns numeric language sql immutable as $$
  select round(coalesce(p_comissao, 0) * public.pipex_fator(p_pct), 2)
$$;

-- % vigente do cliente na competência (null = fora do acordo nessa época).
create or replace function public.pipex_pct(p_apolice text, p_comp text)
returns numeric language sql stable set search_path = public as $$
  select pct from public.pipex_acordo_pct
   where apolice = p_apolice and desde <= p_comp
   order by desde desc limit 1
$$;

create or replace function public.pipex_rotulo(p_comp text)
returns text language sql immutable as $$
  select (array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'])[substr(p_comp,6,2)::int]
         || '/' || substr(p_comp,3,2)
$$;

-- ---------- views (security_invoker: respeitam a RLS de quem lê) ----

-- Apuração por competência × apólice: quem compensou (linhas do extrato)
-- + quem está no acordo e não apareceu ("não compensou").
create or replace view public.pipex_v_apuracao with (security_invoker = true) as
with l as (
  select competencia, apolice, max(segurado) segurado,
         sum(comissao) comissao, count(*)::int n_linhas,
         string_agg(distinct parcela::text, ',') parcelas,
         max(parcela) ult_parcela
    from public.pipex_extrato_linhas
   group by competencia, apolice
), a as (
  select c.competencia, a.apolice, a.segurado
    from public.pipex_competencias c
    cross join public.pipex_acordo a
   where public.pipex_pct(a.apolice, c.competencia) is not null
)
select coalesce(l.competencia, a.competencia)            as competencia,
       coalesce(l.apolice, a.apolice)                    as apolice,
       coalesce(a.segurado, l.segurado)                  as segurado,
       (a.apolice is not null)                           as no_acordo,
       p.pct,
       coalesce(l.comissao, 0)                           as comissao,
       coalesce(l.n_linhas, 0)                           as n_linhas,
       l.parcelas,
       l.ult_parcela,
       coalesce(l.comissao, 0) * coalesce(p.pct, 0) / 100 as bruto,
       case when a.apolice is null then 0
            else public.pipex_parte(l.comissao, p.pct) end as parte,
       case when a.apolice is null then 'fora_carteira'
            when l.apolice is null then 'nao_compensou'
            when p.pct = 0          then 'fora_rateio'
            else 'rateio' end                            as situacao
  from l
  full join a on a.competencia = l.competencia and a.apolice = l.apolice
  cross join lateral (select public.pipex_pct(coalesce(l.apolice, a.apolice),
                                              coalesce(l.competencia, a.competencia)) as pct) p;

-- Resumo por competência: extrato, apuração, devido, pago, saldo, previsto.
create or replace view public.pipex_v_competencias with (security_invoker = true) as
with ap as (
  select competencia,
         sum(comissao) filter (where no_acordo)            as comissao_acordo,
         round(sum(bruto) filter (where no_acordo), 2)     as bruto_rateio,
         sum(parte)                                        as parte
    from public.pipex_v_apuracao group by competencia
), pg as (
  select competencia, sum(valor) pago, max(data) ult_pagamento
    from public.pipex_pagamentos group by competencia
)
select c.competencia, c.rotulo, c.periodo_ini, c.periodo_fim, c.vencimento,
       c.total_extrato, c.n_linhas, c.fonte, c.status, c.fechada_em, c.previsto_id,
       coalesce(ap.comissao_acordo, 0)                         as comissao_acordo,
       coalesce(ap.bruto_rateio, 0)                            as bruto_rateio,
       coalesce(ap.bruto_rateio, 0) - coalesce(ap.parte, 0)    as simples,
       coalesce(ap.parte, 0)                                   as devido_calc,
       case when c.status = 'fechada' then c.devido else coalesce(ap.parte, 0) end as devido,
       coalesce(pg.pago, 0)                                    as pago,
       pg.ult_pagamento,
       (case when c.status = 'fechada' then c.devido else coalesce(ap.parte, 0) end) - coalesce(pg.pago, 0) as saldo,
       pv.status::text                                         as previsto_status,
       pv.valor                                                as previsto_valor
  from public.pipex_competencias c
  left join ap on ap.competencia = c.competencia
  left join pg on pg.competencia = c.competencia
  left join public.previstos pv on pv.id = c.previsto_id;

-- ---------- importador de extrato ------------------------------------
-- Recebe as linhas já lidas do .xls. Bloqueia (rollback) se:
--   · a soma das linhas enviadas ≠ total informado do arquivo
--   · depois da gravação, o banco não ficar com EXATAMENTE as linhas e o
--     total do arquivo (chave repetida no arquivo ou extrato diferente do
--     já importado nessa competência)
--   · a competência já estiver fechada e o arquivo trouxer linha nova
-- Reimportar o mesmo arquivo = 0 linhas novas, mesmos totais.
create or replace function public.pipex_importar_extrato(
  p_comp text, p_ini date, p_fim date, p_total numeric, p_linhas jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_n_arq int := jsonb_array_length(coalesce(p_linhas, '[]'::jsonb));
  v_tot_arq numeric; v_novas int; v_tot numeric; v_n int; v_status text;
begin
  if p_comp !~ '^\d{4}-\d{2}$' then raise exception 'competência inválida: %', p_comp; end if;
  if v_n_arq = 0 then raise exception 'extrato sem linhas'; end if;
  select round(sum((x->>'comissao')::numeric), 2) into v_tot_arq from jsonb_array_elements(p_linhas) x;
  if v_tot_arq <> round(p_total, 2) then
    raise exception 'soma das linhas (%) não bate com o total do extrato (%)', v_tot_arq, round(p_total, 2);
  end if;

  select status into v_status from pipex_competencias where competencia = p_comp;
  insert into pipex_competencias (competencia, rotulo, periodo_ini, periodo_fim, vencimento, fonte)
  values (p_comp, pipex_rotulo(p_comp), p_ini, p_fim,
          (to_date(p_comp, 'YYYY-MM') + interval '1 month' + interval '4 day')::date, 'extrato')
  on conflict (competencia) do nothing;

  insert into pipex_extrato_linhas (competencia, apolice, cobertura, parcela, dt_geracao, segurado,
                                    premio_liquido, pct_comissao, comissao, dt_emissao, tipo, fonte)
  select p_comp, x.apolice, coalesce(x.cobertura, ''), coalesce(x.parcela, 0), x.dt_geracao, x.segurado,
         x.premio_liquido, x.pct_comissao, x.comissao, x.dt_emissao, x.tipo, 'extrato'
    from jsonb_to_recordset(p_linhas) as x(apolice text, cobertura text, parcela int, dt_geracao date,
         segurado text, premio_liquido numeric, pct_comissao numeric, comissao numeric, dt_emissao date, tipo text)
  on conflict (competencia, apolice, cobertura, parcela, dt_geracao) do nothing;
  get diagnostics v_novas = row_count;

  if v_status = 'fechada' and v_novas > 0 then
    raise exception 'competência % já está fechada — reabra antes de importar linhas novas', p_comp;
  end if;

  select round(sum(comissao), 2), count(*) into v_tot, v_n from pipex_extrato_linhas where competencia = p_comp;
  if v_tot <> v_tot_arq or v_n <> v_n_arq then
    raise exception 'importação bloqueada: o banco ficaria com % linhas / R$ % e o extrato tem % linhas / R$ %',
      v_n, v_tot, v_n_arq, v_tot_arq;
  end if;

  update pipex_competencias
     set total_extrato = v_tot, n_linhas = v_n,
         periodo_ini = coalesce(p_ini, periodo_ini), periodo_fim = coalesce(p_fim, periodo_fim)
   where competencia = p_comp;
  return jsonb_build_object('competencia', p_comp, 'novas', v_novas, 'linhas', v_n, 'total', v_tot);
end $$;

-- ---------- fechamento: congela o devido e gera o previsto a receber ----
create or replace function public.pipex_fechar(p_comp text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare c pipex_competencias; v_dev numeric; v_pid uuid; v_desc text;
begin
  select * into c from pipex_competencias where competencia = p_comp for update;
  if not found then raise exception 'competência % não existe', p_comp; end if;
  select coalesce(sum(parte), 0) into v_dev from pipex_v_apuracao where competencia = p_comp;
  v_desc := 'Comissão LP Daniel · ' || c.rotulo;

  v_pid := c.previsto_id;
  if v_pid is null then
    select id into v_pid from previstos
     where descricao = v_desc and visao = 'PIPEX' and tipo = 'receber' and status <> 'cancelado'
     order by created_at limit 1;
  end if;
  if v_pid is null then
    insert into previstos (descricao, valor, vencimento, tipo, status, visao, competencia, conta_id)
    values (v_desc, v_dev, c.vencimento, 'receber', 'aberto', 'PIPEX', to_date(p_comp, 'YYYY-MM'),
            (select conta_id from previstos                -- mesma conta dos meses anteriores
              where descricao like 'Comissão LP Daniel · %' and visao = 'PIPEX' and conta_id is not null
              order by vencimento desc limit 1))
    returning id into v_pid;
  else
    update previstos set valor = v_dev, vencimento = coalesce(c.vencimento, vencimento),
                         competencia = to_date(p_comp, 'YYYY-MM')
     where id = v_pid and status = 'aberto';
  end if;

  update pipex_competencias
     set status = 'fechada', devido = v_dev, previsto_id = v_pid, fechada_em = coalesce(fechada_em, now())
   where competencia = p_comp;

  -- base da projeção: última parcela vista e valores de UMA parcela dela
  update pipex_acordo a
     set ult_parcela = b.parcela, comissao_mensal = b.com, premio_mensal = b.prem, base_comp = p_comp
    from (select l.apolice, l.parcela, sum(l.comissao) com, sum(l.premio_liquido) prem
            from pipex_extrato_linhas l
           where l.competencia = p_comp and l.fonte = 'extrato'
             and l.parcela = (select max(parcela) from pipex_extrato_linhas m
                               where m.competencia = p_comp and m.apolice = l.apolice and m.fonte = 'extrato')
           group by l.apolice, l.parcela) b
   where a.apolice = b.apolice and (a.base_comp is null or a.base_comp <= p_comp);

  return jsonb_build_object('competencia', p_comp, 'devido', v_dev, 'previsto_id', v_pid);
end $$;

create or replace function public.pipex_reabrir(p_comp text)
returns void language sql security invoker set search_path = public as $$
  update pipex_competencias set status = 'aberta' where competencia = p_comp
$$;

-- ---------- projeção --------------------------------------------------
-- A partir de p_inicio ('YYYY-MM'), cada cliente ativo paga uma parcela por
-- mês (premissa: todos em dia): FYC até a 12ª (comissão mensal), depois
-- renovação 13ª–24ª a 8% do prêmio líquido mensal.
-- p_cenario = {"<apolice>": pct} sobrepõe o % do acordo (Daniel=0, Cheio=100).
create or replace function public.pipex_projecao(p_inicio text, p_cenario jsonb default '{}'::jsonb)
returns table (mes text, apolice text, segurado text, parcela int, tipo text,
               comissao numeric, pct numeric, parte numeric)
language sql stable security invoker set search_path = public as $$
  with a as (
    select a.apolice, a.segurado, a.ult_parcela, a.comissao_mensal, a.premio_mensal,
           coalesce((p_cenario ->> a.apolice)::numeric, pipex_pct(a.apolice, p_inicio), 0) pct
      from pipex_acordo a
     where a.ativo and a.ult_parcela is not null and a.ult_parcela < 24
  )
  select to_char(to_date(p_inicio, 'YYYY-MM') + (g.k - 1) * interval '1 month', 'YYYY-MM'),
         a.apolice, a.segurado, a.ult_parcela + g.k,
         case when a.ult_parcela + g.k <= 12 then 'fyc' else 'renovacao' end,
         case when a.ult_parcela + g.k <= 12 then a.comissao_mensal else 0.08 * a.premio_mensal end,
         a.pct,
         (case when a.ult_parcela + g.k <= 12 then a.comissao_mensal else 0.08 * a.premio_mensal end)
           * pipex_fator(a.pct)
    from a cross join lateral generate_series(1, 24 - a.ult_parcela) g(k)
$$;

grant execute on function public.pipex_fator(numeric), public.pipex_parte(numeric, numeric),
  public.pipex_pct(text, text), public.pipex_rotulo(text),
  public.pipex_importar_extrato(text, date, date, numeric, jsonb), public.pipex_fechar(text),
  public.pipex_reabrir(text), public.pipex_projecao(text, jsonb) to authenticated;
grant select on public.pipex_v_apuracao, public.pipex_v_competencias to authenticated;
