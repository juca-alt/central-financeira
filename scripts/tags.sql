-- ============================================================
-- tags.sql  (Central Financeira)
-- Tags (rotulos) para classificar transacoes por TIPO/ORIGEM correta (PJ, PF, ...)
-- INDEPENDENTE de qual conta o dinheiro saiu. Enquanto as contas estao baguncadas,
-- a tag diz onde aquele $$ deveria estar. Multiplas tags por movimento (N:N).
-- Rodar no SQL Editor do projeto mieqsiojvfiqrhectquc (o MCP e read-only).
-- ASCII puro (SQL com acento vira mojibake no pbcopy). Idempotente.
-- ============================================================

-- 1) Vocabulario de tags. Compartilhado por padrao (visao AMBOS), igual categorias:
--    uma tag "PF" precisa aparecer mesmo num movimento que esta na conta PJ.
create table if not exists public.tags (
  id         uuid    primary key default gen_random_uuid(),
  nome       text    not null,
  cor        text,                                 -- hex opcional p/ o chip (ex '#2f6f5e')
  visao      visao   default 'AMBOS',
  ativo      boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint tags_nome_visao_uniq unique (nome, visao)
);
comment on table public.tags is
  'Rotulos para classificar transacoes por tipo/origem, independente da conta. AMBOS = compartilhada.';

-- 2) Ligacao N:N tag <-> movimento
create table if not exists public.movimento_tags (
  movimento_id uuid not null references public.movimentos(id) on delete cascade,
  tag_id       uuid not null references public.tags(id)       on delete cascade,
  created_at   timestamptz default now(),
  primary key (movimento_id, tag_id)
);
create index if not exists idx_movtags_tag on public.movimento_tags (tag_id);
create index if not exists idx_movtags_mov on public.movimento_tags (movimento_id);

-- 3) updated_at automatico nas tags (mesma funcao das outras tabelas)
drop trigger if exists trg_tags_updated on public.tags;
create trigger trg_tags_updated
  before update on public.tags
  for each row execute function set_updated_at();

-- 4) RLS
-- 4a) tags: vocabulario compartilhado, mesmo padrao de categorias (app_pode(visao); AMBOS = todos veem)
alter table public.tags enable row level security;

drop policy if exists vis_sel_tags on public.tags;
create policy vis_sel_tags on public.tags
  for select to authenticated using (app_pode(visao));

drop policy if exists vis_ins_tags on public.tags;
create policy vis_ins_tags on public.tags
  for insert to authenticated with check (app_pode(visao, true));

drop policy if exists vis_upd_tags on public.tags;
create policy vis_upd_tags on public.tags
  for update to authenticated using (app_pode(visao, true)) with check (app_pode(visao, true));

drop policy if exists vis_del_tags on public.tags;
create policy vis_del_tags on public.tags
  for delete to authenticated using (app_pode(visao, true));

-- 4b) movimento_tags: pode ligar/ver tag num movimento que a pessoa ENXERGA
--     (escopo pela visao do movimento pai, via subquery)
alter table public.movimento_tags enable row level security;

drop policy if exists vis_sel_movtags on public.movimento_tags;
create policy vis_sel_movtags on public.movimento_tags
  for select to authenticated
  using (exists (select 1 from public.movimentos m where m.id = movimento_id and app_pode(m.visao)));

drop policy if exists vis_ins_movtags on public.movimento_tags;
create policy vis_ins_movtags on public.movimento_tags
  for insert to authenticated
  with check (exists (select 1 from public.movimentos m where m.id = movimento_id and app_pode(m.visao, true)));

drop policy if exists vis_del_movtags on public.movimento_tags;
create policy vis_del_movtags on public.movimento_tags
  for delete to authenticated
  using (exists (select 1 from public.movimentos m where m.id = movimento_id and app_pode(m.visao, true)));

-- 5) Grants: authenticated opera; anon NUNCA le
--    (Supabase concede anon por DEFAULT PRIVILEGES em tabela nova -> revogar explicito.)
grant select, insert, update, delete on public.tags to authenticated;
grant select, insert, delete on public.movimento_tags to authenticated;
revoke all on public.tags from anon;
revoke all on public.movimento_tags from anon;

-- 6) Verificacao (rode depois e confira):
--   select count(*) from public.tags;                                                        -- 0
--   select tablename, count(*) from pg_policies where tablename in ('tags','movimento_tags') group by 1;  -- tags 4, movimento_tags 3
--   select has_table_privilege('anon','public.tags','select');                               -- f
--   select has_table_privilege('anon','public.movimento_tags','select');                     -- f
--   select has_table_privilege('authenticated','public.movimento_tags','insert');            -- t
