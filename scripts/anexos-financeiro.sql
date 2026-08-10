-- ==========================================================================
-- ANEXOS — documentos financeiros (boletos, comprovantes, notas) por visão.
-- Bucket privado + tabela public.anexos com RLS espelhando previstos (app_pode).
-- 100% ADITIVO: não altera nenhuma tabela/função/política existente.
-- Rodar UMA vez no SQL Editor do projeto mieqsiojvfiqrhectquc (Central Financeira).
-- Idempotente: pode rodar de novo sem quebrar.
-- ==========================================================================

-- 1) bucket privado (só PDF/imagem, 15 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anexos-financeiro','anexos-financeiro', false, 15728640,
        array['application/pdf','image/png','image/jpeg','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

-- 2) helper: extrai a visão do 1º segmento do path com cast seguro (null se inválido)
create or replace function public.anexo_visao(p text)
  returns public.visao language plpgsql immutable as $$
begin
  return p::public.visao;
exception when others then
  return null;
end $$;

-- 3) tabela de metadados
create table if not exists public.anexos(
  id           uuid primary key default gen_random_uuid(),
  visao        public.visao not null,
  previsto_id  uuid references public.previstos(id)  on delete cascade,
  movimento_id uuid references public.movimentos(id) on delete cascade,
  nome         text not null,
  path         text not null,
  mime         text,
  tamanho      bigint,
  created_at   timestamptz not null default now(),
  created_by   text default public.app_email()
);
create index if not exists anexos_previsto_idx  on public.anexos(previsto_id);
create index if not exists anexos_movimento_idx on public.anexos(movimento_id);

alter table public.anexos enable row level security;

-- 4) grants (revoga anon por segurança — o app loga como authenticated)
revoke all on public.anexos from anon;
grant select, insert, update, delete on public.anexos to authenticated;

-- 5) RLS da tabela — espelho fiel de previstos
drop policy if exists vis_sel_anexos on public.anexos;
drop policy if exists vis_ins_anexos on public.anexos;
drop policy if exists vis_upd_anexos on public.anexos;
drop policy if exists vis_del_anexos on public.anexos;
create policy vis_sel_anexos on public.anexos for select using (public.app_pode(visao));
create policy vis_ins_anexos on public.anexos for insert with check (public.app_pode(visao, true));
create policy vis_upd_anexos on public.anexos for update using (public.app_pode(visao, true)) with check (public.app_pode(visao, true));
create policy vis_del_anexos on public.anexos for delete using (public.app_pode(visao, true));

-- 6) RLS do storage — acesso pela visão embutida no 1º segmento do path (<VISAO>/...)
drop policy if exists anexos_stg_sel on storage.objects;
drop policy if exists anexos_stg_ins on storage.objects;
drop policy if exists anexos_stg_del on storage.objects;
create policy anexos_stg_sel on storage.objects for select to authenticated
  using (bucket_id='anexos-financeiro' and public.app_pode(public.anexo_visao((storage.foldername(name))[1])));
create policy anexos_stg_ins on storage.objects for insert to authenticated
  with check (bucket_id='anexos-financeiro' and public.app_pode(public.anexo_visao((storage.foldername(name))[1]), true));
create policy anexos_stg_del on storage.objects for delete to authenticated
  using (bucket_id='anexos-financeiro' and public.app_pode(public.anexo_visao((storage.foldername(name))[1]), true));

-- pronto. o app (v6.6.0+) já mostra "📎 Anexos" no detalhe de cada conta a pagar
-- (Modo Financeiro) e no editar de cada lançamento (Movimentos).
