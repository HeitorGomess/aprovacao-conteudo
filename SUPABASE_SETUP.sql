create table if not exists public.posts (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.panel_editors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'programador'
);

create table if not exists public.panel_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
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

create or replace function public.sync_primary_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(coalesce(new.email, '')) = 'gomesheitorvp@gmail.com'
    and new.email_confirmed_at is not null then
    insert into public.panel_admins (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

    insert into public.panel_editors (user_id, role)
    values (new.id, 'programador')
    on conflict (user_id) do update set role = excluded.role;
  elsif tg_op = 'UPDATE'
    and lower(coalesce(old.email, '')) = 'gomesheitorvp@gmail.com'
    and lower(coalesce(new.email, '')) <> 'gomesheitorvp@gmail.com' then
    delete from public.panel_admins where user_id = new.id;
    delete from public.panel_editors where user_id = new.id;
  elsif new.email_confirmed_at is not null
    and lower(coalesce(new.email, '')) <> 'gomesheitorvp@gmail.com' then
    insert into public.panel_editors (user_id, role)
    values (new.id, 'revisor')
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_primary_admin() from public;

drop trigger if exists sync_primary_admin on auth.users;
create trigger sync_primary_admin
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.sync_primary_admin();

insert into public.panel_admins (user_id)
select id
from auth.users
where lower(coalesce(email, '')) = 'gomesheitorvp@gmail.com'
  and email_confirmed_at is not null
on conflict (user_id) do nothing;

insert into public.panel_editors (user_id, role)
select id, 'programador'
from auth.users
where lower(coalesce(email, '')) = 'gomesheitorvp@gmail.com'
  and email_confirmed_at is not null
on conflict (user_id) do update set role = excluded.role;

alter table public.posts enable row level security;
alter table public.panel_editors enable row level security;
alter table public.panel_admins enable row level security;

grant select, insert, update, delete on public.posts to authenticated;
grant select on public.panel_editors to authenticated;
grant select on public.panel_admins to authenticated;

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
    (
      data ->> 'status' in ('revisao', 'ajustes', 'aprovado')
      and exists (
        select 1 from public.panel_editors
        where user_id = (select auth.uid()) and role = 'revisor'
      )
    )
    or exists (
      select 1 from public.panel_editors
      where user_id = (select auth.uid()) and role = 'programador'
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

drop policy if exists panel_admins_read_self on public.panel_admins;
create policy panel_admins_read_self
  on public.panel_admins
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.list_panel_accounts()
returns table (
  user_id uuid,
  email text,
  role text,
  is_admin boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.panel_admins
    where panel_admins.user_id = (select auth.uid())
  ) then
    raise exception 'Somente administradores podem listar as contas.';
  end if;

  return query
  select
    users.id::uuid,
    coalesce(users.email, '')::text,
    (case
      when admins.user_id is not null then 'administrador'
      else coalesce(editors.role, 'sem_acesso')
    end)::text,
    (admins.user_id is not null)::boolean
  from auth.users as users
  left join public.panel_editors as editors on editors.user_id = users.id
  left join public.panel_admins as admins on admins.user_id = users.id
  order by lower(coalesce(users.email, ''));
end;
$$;

create or replace function public.set_panel_account_role(
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.panel_admins
    where panel_admins.user_id = (select auth.uid())
  ) then
    raise exception 'Somente administradores podem alterar os perfis.';
  end if;

  if p_user_id is null or p_role is null
    or p_role not in ('programador', 'revisor', 'sem_acesso') then
    raise exception 'Conta ou perfil inválido.';
  end if;

  if exists (
    select 1 from public.panel_admins
    where panel_admins.user_id = p_user_id
  ) then
    raise exception 'O perfil de administrador não pode ser alterado por esta tela.';
  end if;

  if p_role = 'sem_acesso' then
    delete from public.panel_editors where panel_editors.user_id = p_user_id;
  else
    insert into public.panel_editors (user_id, role)
    values (p_user_id, p_role)
    on conflict (user_id) do update set role = excluded.role;
  end if;
end;
$$;

revoke all on function public.list_panel_accounts() from public;
revoke all on function public.set_panel_account_role(uuid, text) from public;
grant execute on function public.list_panel_accounts() to authenticated;
grant execute on function public.set_panel_account_role(uuid, text) to authenticated;

drop function if exists public.submit_review_decision(uuid, text, text, text);

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

  if editor_role is distinct from 'revisor' then
    raise exception 'Somente revisores podem enviar pareceres.';
  end if;

  if p_status is null or p_status not in ('aprovado', 'ajustes') then
    raise exception 'Decisão de revisão inválida.';
  end if;

  if p_status = 'ajustes' and pg_catalog.length(pg_catalog.btrim(coalesce(p_comment, ''))) = 0 then
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
      end) || (case
        when pg_catalog.length(pg_catalog.btrim(coalesce(p_comment, ''))) > 0 then
          pg_catalog.jsonb_build_array(
            pg_catalog.jsonb_build_object(
              'at', decision_at,
              'author', coalesce((select auth.jwt() ->> 'email'), 'Revisor'),
              'comment', pg_catalog.btrim(p_comment),
              'decision', p_status
            )
          )
        else '[]'::jsonb
      end
      )
  )
  where id = p_post_id;
end;
$$;

revoke all on function public.submit_review_decision(text, text, text) from public;
grant execute on function public.submit_review_decision(text, text, text) to authenticated;

create or replace function public.reset_review_comments(p_post_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_data jsonb;
  reset_at text := pg_catalog.to_char(
    pg_catalog.clock_timestamp() at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
begin
  if (select auth.uid()) is null then
    raise exception 'É necessário entrar para resetar os pareceres.';
  end if;

  if not exists (
    select 1 from public.panel_admins
    where user_id = (select auth.uid())
  ) then
    raise exception 'Somente administradores podem resetar os pareceres.';
  end if;

  select data into post_data
  from public.posts
  where id = p_post_id
  for update;

  if not found then
    raise exception 'A publicação não existe mais.';
  end if;

  update public.posts
  set data = (post_data - 'reviewComments') || pg_catalog.jsonb_build_object('updatedAt', reset_at),
      updated_at = pg_catalog.clock_timestamp()
  where id = p_post_id;
end;
$$;

revoke all on function public.reset_review_comments(text) from public;
grant execute on function public.reset_review_comments(text) to authenticated;

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

do $$
begin
  if to_regclass('public.workspace_members') is not null
    and to_regclass('public.workspaces') is not null then
    execute $migration$
      insert into public.panel_editors (user_id, role)
      select member.user_id,
        case when member.role = 'revisor' then 'revisor' else 'programador' end
      from public.workspace_members as member
      join public.workspaces as workspace on workspace.id = member.workspace_id
      where workspace.slug = 'your-space'
      on conflict (user_id) do update set role = excluded.role
    $migration$;
  end if;
end;
$$;

drop policy if exists posts_select_workspace_members on public.posts;
drop policy if exists posts_insert_workspace_programmers on public.posts;
drop policy if exists posts_update_workspace_programmers on public.posts;
drop policy if exists posts_delete_workspace_programmers on public.posts;

do $$
begin
  if to_regclass('public.workspace_members') is not null then
    execute 'drop policy if exists workspace_members_read_accessible on public.workspace_members';
  end if;
  if to_regclass('public.workspaces') is not null then
    execute 'drop policy if exists workspaces_read_accessible on public.workspaces';
  end if;
end;
$$;

drop function if exists public.create_workspace(text, text);
drop function if exists public.list_user_workspaces();
drop function if exists public.verify_workspace_access(text);
drop function if exists public.list_workspace_members(uuid);
drop function if exists public.add_workspace_member(uuid, text, text);
drop function if exists public.set_workspace_member_role(uuid, uuid, text);

alter table public.posts drop column if exists workspace_id;
drop table if exists public.workspace_members;
drop table if exists public.workspaces;

notify pgrst, 'reload schema';
