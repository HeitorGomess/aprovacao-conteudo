create table if not exists public.posts (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.panel_editors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'programador'
);

alter table public.panel_editors
  add column if not exists role text not null default 'programador';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'panel_editors_role_check'
      and conrelid = 'public.panel_editors'::regclass
  ) then
    alter table public.panel_editors
      add constraint panel_editors_role_check
      check (role in ('programador', 'revisor'));
  end if;
end;
$$;

alter table public.posts enable row level security;
alter table public.panel_editors enable row level security;

grant select, insert, update, delete on public.posts to authenticated;
grant select on public.panel_editors to authenticated;

drop policy if exists posts_authenticated_all on public.posts;
drop policy if exists posts_select_editors on public.posts;
drop policy if exists posts_insert_programmers on public.posts;
drop policy if exists posts_update_programmers on public.posts;
drop policy if exists posts_delete_programmers on public.posts;

create policy posts_select_editors
  on public.posts
  for select
  to authenticated
  using (
    exists (
      select 1 from public.panel_editors
      where user_id = (select auth.uid())
        and role in ('programador', 'revisor')
    )
  );

create policy posts_insert_programmers
  on public.posts
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.panel_editors
      where user_id = (select auth.uid()) and role = 'programador'
    )
  );

create policy posts_update_programmers
  on public.posts
  for update
  to authenticated
  using (
    exists (
      select 1 from public.panel_editors
      where user_id = (select auth.uid()) and role = 'programador'
    )
  )
  with check (
    exists (
      select 1 from public.panel_editors
      where user_id = (select auth.uid()) and role = 'programador'
    )
  );

create policy posts_delete_programmers
  on public.posts
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.panel_editors
      where user_id = (select auth.uid()) and role = 'programador'
    )
  );

drop policy if exists panel_editors_read_self on public.panel_editors;
create policy panel_editors_read_self
  on public.panel_editors
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.submit_review_decision(
  p_post_id text,
  p_status text,
  p_comment text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  editor_role text;
  post_data jsonb;
  decision_at text := pg_catalog.to_char(
    pg_catalog.clock_timestamp() at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
begin
  if (select auth.uid()) is null then
    raise exception 'É necessário entrar para enviar um parecer.';
  end if;

  select role into editor_role
  from public.panel_editors
  where user_id = (select auth.uid());

  if editor_role is null or editor_role not in ('programador', 'revisor') then
    raise exception 'Seu perfil não pode revisar publicações.';
  end if;

  if p_status is null or p_status not in ('aprovado', 'ajustes') then
    raise exception 'Decisão de revisão inválida.';
  end if;

  if pg_catalog.length(pg_catalog.btrim(coalesce(p_comment, ''))) = 0 then
    raise exception 'Escreva um comentário para registrar seu parecer.';
  end if;

  select data into post_data
  from public.posts
  where id = p_post_id
  for update;

  if not found then
    raise exception 'A publicação não existe mais.';
  end if;

  if post_data ->> 'status' is distinct from 'revisao' then
    raise exception 'Esta publicação não está aguardando revisão.';
  end if;

  update public.posts
  set data = post_data || pg_catalog.jsonb_build_object(
    'status', p_status,
    'updatedAt', decision_at,
    'history',
      (case
        when pg_catalog.jsonb_typeof(post_data -> 'history') = 'array' then post_data -> 'history'
        else '[]'::jsonb
      end) || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object('status', p_status, 'at', decision_at)
      ),
    'reviewComments',
      (case
        when pg_catalog.jsonb_typeof(post_data -> 'reviewComments') = 'array' then post_data -> 'reviewComments'
        else '[]'::jsonb
      end) || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'at', decision_at,
          'author', coalesce((select auth.jwt() ->> 'email'), 'Revisor'),
          'comment', pg_catalog.btrim(p_comment),
          'decision', p_status
        )
      )
  )
  where id = p_post_id;
end;
$$;

revoke all on function public.submit_review_decision(text, text, text) from public;
grant execute on function public.submit_review_decision(text, text, text) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'posts'
  ) then
    execute 'alter publication supabase_realtime add table public.posts';
  end if;
end;
$$;
