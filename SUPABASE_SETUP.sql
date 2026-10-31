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

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint workspaces_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

alter table public.workspaces
  add column if not exists archived_at timestamptz;

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('administrador', 'programador', 'revisor')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

do $$
declare
  role_constraint record;
begin
  for role_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.workspace_members'::regclass
      and contype = 'c'
      and pg_catalog.pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute pg_catalog.format(
      'alter table public.workspace_members drop constraint %I',
      role_constraint.conname
    );
  end loop;

  alter table public.workspace_members
    add constraint workspace_members_role_check
    check (role in ('administrador', 'programador', 'revisor'));
end;
$$;

alter table public.posts
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

create index if not exists posts_workspace_id_idx on public.posts (workspace_id);
create index if not exists workspace_members_user_id_idx on public.workspace_members (user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_avatars_public_read on storage.objects;
create policy profile_avatars_public_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'profile-avatars');

drop policy if exists profile_avatars_owner_insert on storage.objects;
create policy profile_avatars_owner_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists profile_avatars_owner_update on storage.objects;
create policy profile_avatars_owner_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists profile_avatars_owner_delete on storage.objects;
create policy profile_avatars_owner_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create or replace function public.sync_primary_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  primary_workspace_id uuid;
begin
  if lower(coalesce(new.email, '')) = 'gomesheitorvp@gmail.com'
    and new.email_confirmed_at is not null then
    insert into public.panel_admins (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

    insert into public.panel_editors (user_id, role)
    values (new.id, 'programador')
    on conflict (user_id) do update set role = excluded.role;

    insert into public.workspaces (name, slug, owner_id)
    values ('Your Space', 'your-space', new.id)
    on conflict (slug) do nothing;

    select id into primary_workspace_id
    from public.workspaces
    where slug = 'your-space';

    insert into public.workspace_members (workspace_id, user_id, role)
    values (primary_workspace_id, new.id, 'administrador')
    on conflict (workspace_id, user_id) do update set role = excluded.role;

    update public.posts
    set workspace_id = primary_workspace_id
    where workspace_id is null;
  elsif new.email_confirmed_at is not null then
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

insert into public.workspaces (name, slug, owner_id)
select 'Your Space', 'your-space', id
from auth.users
where lower(coalesce(email, '')) = 'gomesheitorvp@gmail.com'
  and email_confirmed_at is not null
on conflict (slug) do nothing;

insert into public.workspace_members (workspace_id, user_id, role)
select workspaces.id, admins.user_id, 'administrador'
from public.workspaces
cross join public.panel_admins as admins
where workspaces.slug = 'your-space'
on conflict (workspace_id, user_id) do update set role = excluded.role;

insert into public.workspace_members (workspace_id, user_id, role)
select workspaces.id, editors.user_id, editors.role
from public.workspaces
cross join public.panel_editors as editors
where workspaces.slug = 'your-space'
  and not exists (
    select 1 from public.panel_admins
    where panel_admins.user_id = editors.user_id
  )
on conflict (workspace_id, user_id) do nothing;

update public.posts
set workspace_id = (
  select id from public.workspaces where slug = 'your-space'
)
where workspace_id is null
  and exists (select 1 from public.workspaces where slug = 'your-space');

alter table public.posts enable row level security;
alter table public.panel_editors enable row level security;
alter table public.panel_admins enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

grant select, insert, update, delete on public.posts to authenticated;
grant select on public.panel_editors to authenticated;
grant select on public.panel_admins to authenticated;
grant select on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;

do $$
declare
  old_policy record;
begin
  for old_policy in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('posts', 'panel_editors', 'panel_admins', 'workspaces', 'workspace_members')
  loop
    execute pg_catalog.format(
      'drop policy if exists %I on public.%I',
      old_policy.policyname,
      old_policy.tablename
    );
  end loop;
end;
$$;

create policy posts_select_workspace_members
  on public.posts
  for select
  to authenticated
  using (
    exists (
      select 1 from public.workspaces
      where workspaces.id = posts.workspace_id
        and workspaces.archived_at is null
    )
    and (exists (
      select 1 from public.workspace_members as member
      where member.workspace_id = posts.workspace_id
        and member.user_id = (select auth.uid())
        and (
          member.role in ('administrador', 'programador')
          or (
            member.role = 'revisor'
            and posts.data ->> 'status' in ('revisao', 'ajustes', 'aprovado')
          )
        )
    )
    or exists (
      select 1 from public.panel_admins
      where panel_admins.user_id = (select auth.uid())
    ))
  );

create policy posts_insert_workspace_programmers
  on public.posts
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.workspaces
      where workspaces.id = posts.workspace_id
        and workspaces.archived_at is null
    )
    and (exists (
      select 1 from public.workspace_members as member
      where member.workspace_id = posts.workspace_id
        and member.user_id = (select auth.uid())
        and member.role in ('administrador', 'programador')
    )
    or exists (
      select 1 from public.panel_admins
      where panel_admins.user_id = (select auth.uid())
    ))
  );

create policy posts_update_workspace_programmers
  on public.posts
  for update
  to authenticated
  using (
    exists (
      select 1 from public.workspaces
      where workspaces.id = posts.workspace_id
        and workspaces.archived_at is null
    )
    and (exists (
      select 1 from public.workspace_members as member
      where member.workspace_id = posts.workspace_id
        and member.user_id = (select auth.uid())
        and member.role in ('administrador', 'programador')
    )
    or exists (
      select 1 from public.panel_admins
      where panel_admins.user_id = (select auth.uid())
    ))
  )
  with check (
    exists (
      select 1 from public.workspaces
      where workspaces.id = posts.workspace_id
        and workspaces.archived_at is null
    )
    and (exists (
      select 1 from public.workspace_members as member
      where member.workspace_id = posts.workspace_id
        and member.user_id = (select auth.uid())
        and member.role in ('administrador', 'programador')
    )
    or exists (
      select 1 from public.panel_admins
      where panel_admins.user_id = (select auth.uid())
    ))
  );

create policy posts_delete_workspace_programmers
  on public.posts
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.workspaces
      where workspaces.id = posts.workspace_id
        and workspaces.archived_at is null
    )
    and (exists (
      select 1 from public.workspace_members as member
      where member.workspace_id = posts.workspace_id
        and member.user_id = (select auth.uid())
        and member.role in ('administrador', 'programador')
    )
    or exists (
      select 1 from public.panel_admins
      where panel_admins.user_id = (select auth.uid())
    ))
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

drop policy if exists workspace_members_read_accessible on public.workspace_members;
create policy workspace_members_read_accessible
  on public.workspace_members
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.panel_admins
      where panel_admins.user_id = (select auth.uid())
    )
  );

drop policy if exists workspaces_read_accessible on public.workspaces;
create policy workspaces_read_accessible
  on public.workspaces
  for select
  to authenticated
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = workspaces.id
        and workspace_members.user_id = (select auth.uid())
        and (
          workspaces.archived_at is null
          or workspace_members.role = 'administrador'
          or workspaces.owner_id = (select auth.uid())
        )
    )
    or exists (
      select 1 from public.panel_admins
      where panel_admins.user_id = (select auth.uid())
    )
  );

drop function if exists public.create_workspace(text, text);
drop function if exists public.create_workspace(text);
create or replace function public.create_workspace(p_name text)
returns table (workspace_id uuid, workspace_name text, workspace_slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_id uuid;
  normalized_name text := pg_catalog.btrim(p_name);
  slug_base text;
  generated_slug text;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from auth.users
    where id = (select auth.uid())
      and email_confirmed_at is not null
  ) then
    raise exception 'Confirme seu e-mail antes de criar uma empresa.';
  end if;

  if normalized_name is null
    or pg_catalog.length(normalized_name) < 2
    or pg_catalog.length(normalized_name) > 80 then
    raise exception 'O nome da empresa deve ter entre 2 e 80 caracteres.';
  end if;

  slug_base := pg_catalog.regexp_replace(
    pg_catalog.translate(
      pg_catalog.lower(normalized_name),
      'áàãâäéèêëíìîïóòõôöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'
    ),
    '[^a-z0-9]+',
    '-',
    'g'
  );
  slug_base := pg_catalog.btrim(pg_catalog.substr(slug_base, 1, 36), '-');
  if pg_catalog.length(slug_base) < 2 then
    slug_base := 'empresa';
  end if;
  generated_slug := slug_base || '-' || pg_catalog.substr(
    pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
    1,
    8
  );

  insert into public.workspaces (name, slug, owner_id)
  values (normalized_name, generated_slug, (select auth.uid()))
  returning id into created_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (created_id, (select auth.uid()), 'administrador');

  return query select created_id, normalized_name, generated_slug;
end;
$$;

drop function if exists public.list_user_workspaces();
create or replace function public.list_user_workspaces()
returns table (
  workspace_id uuid,
  workspace_name text,
  workspace_slug text,
  role text,
  is_owner boolean,
  archived_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    workspaces.id,
    workspaces.name,
    workspaces.slug,
    coalesce(members.role, 'administrador')::text,
    (workspaces.owner_id = (select auth.uid())),
    workspaces.archived_at
  from public.workspaces
  left join public.workspace_members as members
    on members.workspace_id = workspaces.id
    and members.user_id = (select auth.uid())
  where (
      (workspaces.archived_at is null and members.user_id is not null)
      or (
        workspaces.archived_at is not null
        and (
          workspaces.owner_id = (select auth.uid())
          or members.role = 'administrador'
        )
      )
    )
    or exists (
      select 1 from public.panel_admins
      where panel_admins.user_id = (select auth.uid())
    )
  order by lower(workspaces.name);
$$;

create or replace function public.rename_workspace(p_workspace_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text := pg_catalog.btrim(p_name);
begin
  if normalized_name is null
    or pg_catalog.length(normalized_name) < 2
    or pg_catalog.length(normalized_name) > 80 then
    raise exception 'O nome da empresa deve ter entre 2 e 80 caracteres.';
  end if;

  if not exists (
    select 1 from public.workspace_members as members
    where members.workspace_id = p_workspace_id
      and members.user_id = (select auth.uid())
      and members.role = 'administrador'
  ) and not exists (
    select 1 from public.panel_admins as admins
    where admins.user_id = (select auth.uid())
  ) then
    raise exception 'Somente administradores podem renomear esta empresa.';
  end if;

  update public.workspaces
  set name = normalized_name
  where id = p_workspace_id
    and archived_at is null;
  if not found then
    raise exception 'Empresa não encontrada ou arquivada.';
  end if;
end;
$$;

create or replace function public.archive_workspace(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.workspace_members as members
    where members.workspace_id = p_workspace_id
      and members.user_id = (select auth.uid())
      and members.role = 'administrador'
  ) and not exists (
    select 1 from public.panel_admins as admins
    where admins.user_id = (select auth.uid())
  ) then
    raise exception 'Somente administradores podem arquivar esta empresa.';
  end if;

  update public.workspaces
  set archived_at = pg_catalog.clock_timestamp()
  where id = p_workspace_id
    and slug <> 'your-space'
    and archived_at is null;
  if not found then
    raise exception 'Esta empresa não pode ser arquivada.';
  end if;
end;
$$;

create or replace function public.restore_workspace(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.workspace_members as members
    where members.workspace_id = p_workspace_id
      and members.user_id = (select auth.uid())
      and members.role = 'administrador'
  ) and not exists (
    select 1 from public.panel_admins as admins
    where admins.user_id = (select auth.uid())
  ) then
    raise exception 'Somente administradores podem restaurar esta empresa.';
  end if;

  update public.workspaces
  set archived_at = null
  where id = p_workspace_id
    and archived_at is not null;
  if not found then
    raise exception 'Empresa arquivada não encontrada.';
  end if;
end;
$$;

create or replace function public.delete_archived_workspace(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_slug text;
  workspace_archived_at timestamptz;
begin
  select workspaces.slug, workspaces.archived_at
  into workspace_slug, workspace_archived_at
  from public.workspaces
  where workspaces.id = p_workspace_id
  for update;

  if not found
    or workspace_slug = 'your-space'
    or workspace_archived_at is null then
    raise exception 'Somente empresas arquivadas podem ser excluídas permanentemente.';
  end if;

  if not exists (
    select 1 from public.workspace_members as members
    where members.workspace_id = p_workspace_id
      and members.user_id = (select auth.uid())
      and members.role = 'administrador'
  ) and not exists (
    select 1 from public.panel_admins as admins
    where admins.user_id = (select auth.uid())
  ) then
    raise exception 'Somente administradores podem excluir esta empresa.';
  end if;

  delete from public.workspaces
  where id = p_workspace_id;
end;
$$;

drop function if exists public.verify_workspace_access(text);
create or replace function public.verify_workspace_access(p_workspace_slug text)
returns table (
  workspace_id uuid,
  workspace_name text,
  role text,
  is_admin boolean,
  is_owner boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Entre na sua conta para acessar esta empresa.';
  end if;

  return query
  select
    workspaces.id,
    workspaces.name,
    coalesce(members.role, case when admins.user_id is not null then 'administrador' end)::text,
    (coalesce(members.role = 'administrador', false) or admins.user_id is not null),
    (workspaces.owner_id = (select auth.uid()))
  from public.workspaces
  left join public.workspace_members as members
    on members.workspace_id = workspaces.id
    and members.user_id = (select auth.uid())
  left join public.panel_admins as admins
    on admins.user_id = (select auth.uid())
  where workspaces.slug = p_workspace_slug
    and workspaces.archived_at is null
    and (members.user_id is not null or admins.user_id is not null);

  if not found then
    raise exception 'Empresa não encontrada ou sua conta não tem acesso.';
  end if;
end;
$$;

drop function if exists public.list_workspace_members(uuid);
create or replace function public.list_workspace_members(p_workspace_id uuid)
returns table (user_id uuid, email text, role text, is_owner boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.workspace_members as caller_members
    where caller_members.workspace_id = p_workspace_id
      and caller_members.user_id = (select auth.uid())
      and caller_members.role = 'administrador'
  ) and not exists (
    select 1 from public.panel_admins as admins
    where admins.user_id = (select auth.uid())
  ) then
    raise exception 'Somente administradores desta empresa podem listar a equipe.';
  end if;

  return query
  select
    members.user_id,
    coalesce(users.email, '')::text,
    members.role::text,
    (workspaces.owner_id = members.user_id)
  from public.workspace_members as members
  join auth.users as users on users.id = members.user_id
  join public.workspaces on workspaces.id = members.workspace_id
  where members.workspace_id = p_workspace_id
  order by lower(coalesce(users.email, ''));
end;
$$;

create or replace function public.add_workspace_member(
  p_workspace_id uuid,
  p_email text,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  if not exists (
    select 1 from public.workspace_members as caller_members
    where caller_members.workspace_id = p_workspace_id
      and caller_members.user_id = (select auth.uid())
      and caller_members.role = 'administrador'
  ) and not exists (
    select 1 from public.panel_admins as admins
    where admins.user_id = (select auth.uid())
  ) then
    raise exception 'Somente administradores desta empresa podem adicionar pessoas.';
  end if;

  if not exists (
    select 1 from public.workspaces as target_workspace
    where target_workspace.id = p_workspace_id
      and target_workspace.archived_at is null
  ) then
    raise exception 'Empresa não encontrada ou arquivada.';
  end if;
  if p_role is null or p_role not in ('administrador', 'programador', 'revisor') then
    raise exception 'Perfil inválido.';
  end if;

  select id into target_user_id
  from auth.users
  where lower(email) = lower(pg_catalog.btrim(p_email))
    and email_confirmed_at is not null
  limit 1;
  if target_user_id is null then
    raise exception 'Não encontramos uma conta confirmada com esse e-mail. A pessoa precisa criar a conta e confirmar o e-mail primeiro.';
  end if;

  if exists (
    select 1 from public.workspaces
    where id = p_workspace_id and owner_id = target_user_id
  ) then
    p_role := 'administrador';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (p_workspace_id, target_user_id, p_role)
  on conflict (workspace_id, user_id) do update set role = excluded.role;
end;
$$;

create or replace function public.set_workspace_member_role(
  p_workspace_id uuid,
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
    select 1 from public.workspaces as target_workspace
    where target_workspace.id = p_workspace_id
      and target_workspace.archived_at is null
  ) then
    raise exception 'Empresa não encontrada ou arquivada.';
  end if;

  if not exists (
    select 1 from public.workspace_members as caller_members
    where caller_members.workspace_id = p_workspace_id
      and caller_members.user_id = (select auth.uid())
      and caller_members.role = 'administrador'
  ) and not exists (
    select 1 from public.panel_admins as admins
    where admins.user_id = (select auth.uid())
  ) then
    raise exception 'Somente administradores desta empresa podem alterar os perfis.';
  end if;
  if p_role is null or p_role not in ('administrador', 'programador', 'revisor', 'sem_acesso') then
    raise exception 'Perfil inválido.';
  end if;
  if exists (
    select 1 from public.workspaces
    where id = p_workspace_id and owner_id = p_user_id
  ) then
    raise exception 'O proprietário da empresa não pode perder o acesso de administrador.';
  end if;

  if p_role = 'sem_acesso' then
    delete from public.workspace_members
    where workspace_id = p_workspace_id and user_id = p_user_id;
  else
    update public.workspace_members
    set role = p_role
    where workspace_id = p_workspace_id and user_id = p_user_id;
    if not found then
      raise exception 'Esta pessoa não pertence a esta empresa.';
    end if;
  end if;
end;
$$;

drop function if exists public.list_panel_accounts();
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
    raise exception 'Somente administradores gerais podem listar as contas.';
  end if;

  return query
  select
    users.id::uuid,
    coalesce(users.email, '')::text,
    (case
      when admins.user_id is not null or legacy_members.role = 'administrador' then 'administrador'
      else coalesce(legacy_members.role, 'sem_acesso')
    end)::text,
    (admins.user_id is not null or legacy_members.role = 'administrador')::boolean
  from auth.users as users
  left join public.panel_admins as admins on admins.user_id = users.id
  left join public.workspaces as legacy_workspace on legacy_workspace.slug = 'your-space'
  left join public.workspace_members as legacy_members
    on legacy_members.workspace_id = legacy_workspace.id
    and legacy_members.user_id = users.id
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
declare
  primary_workspace_id uuid;
begin
  if not exists (
    select 1 from public.panel_admins
    where panel_admins.user_id = (select auth.uid())
  ) then
    raise exception 'Somente administradores gerais podem alterar os perfis globais.';
  end if;

  if p_user_id is null or p_role is null
    or p_role not in ('programador', 'revisor', 'sem_acesso') then
    raise exception 'Conta ou perfil inválido.';
  end if;
  if exists (
    select 1 from public.panel_admins
    where panel_admins.user_id = p_user_id
  ) then
    raise exception 'O perfil de administrador geral não pode ser alterado por esta tela.';
  end if;

  select id into primary_workspace_id
  from public.workspaces
  where slug = 'your-space';
  if primary_workspace_id is null then
    raise exception 'A empresa Your Space ainda não foi criada. Execute a migração de empresas primeiro.';
  end if;
  if exists (
    select 1 from public.workspaces
    where id = primary_workspace_id and owner_id = p_user_id
  ) then
    raise exception 'O proprietário do Your Space não pode perder o acesso de administrador.';
  end if;

  if p_role = 'sem_acesso' then
    delete from public.workspace_members
    where workspace_id = primary_workspace_id and user_id = p_user_id;
    delete from public.panel_editors where panel_editors.user_id = p_user_id;
  else
    insert into public.workspace_members (workspace_id, user_id, role)
    values (primary_workspace_id, p_user_id, p_role)
    on conflict (workspace_id, user_id) do update set role = excluded.role;
    insert into public.panel_editors (user_id, role)
    values (p_user_id, p_role)
    on conflict (user_id) do update set role = excluded.role;
  end if;
end;
$$;

drop function if exists public.submit_review_decision(text, text, text);
drop function if exists public.submit_review_decision(uuid, text, text, text);
create or replace function public.submit_review_decision(
  p_workspace_id uuid,
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
  post_data jsonb;
  decision_at text := pg_catalog.to_char(
    pg_catalog.clock_timestamp() at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
begin
  if not exists (
    select 1 from public.workspaces as target_workspace
    where target_workspace.id = p_workspace_id
      and target_workspace.archived_at is null
  ) then
    raise exception 'Empresa não encontrada ou arquivada.';
  end if;

  if (select auth.uid()) is null or (
    not exists (
      select 1 from public.workspace_members
      where workspace_id = p_workspace_id
        and user_id = (select auth.uid())
        and role in ('administrador', 'revisor')
    )
    and not exists (
      select 1 from public.panel_admins
      where user_id = (select auth.uid())
    )
  ) then
    raise exception 'Somente revisores e administradores desta empresa podem enviar pareceres.';
  end if;

  if p_status is null or p_status not in ('aprovado', 'ajustes') then
    raise exception 'Decisão de revisão inválida.';
  end if;
  if p_status = 'ajustes' and pg_catalog.length(pg_catalog.btrim(coalesce(p_comment, ''))) = 0 then
    raise exception 'Escreva um comentário para registrar os ajustes necessários.';
  end if;

  select data into post_data
  from public.posts
  where id = p_post_id and workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception 'A publicação não existe nesta empresa.';
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
        when pg_catalog.length(pg_catalog.btrim(coalesce(p_comment, ''))) = 0 then
          coalesce(post_data -> 'reviewComments', '[]'::jsonb)
        else
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
      end)
  ),
  updated_at = pg_catalog.clock_timestamp()
  where id = p_post_id and workspace_id = p_workspace_id;
end;
$$;

drop function if exists public.reset_review_comments(text);
create or replace function public.reset_review_comments(p_workspace_id uuid, p_post_id text)
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
  if not exists (
    select 1 from public.workspaces as target_workspace
    where target_workspace.id = p_workspace_id
      and target_workspace.archived_at is null
  ) then
    raise exception 'Empresa não encontrada ou arquivada.';
  end if;

  if (select auth.uid()) is null or (
    not exists (
      select 1 from public.workspace_members
      where workspace_id = p_workspace_id
        and user_id = (select auth.uid())
        and role = 'administrador'
    )
    and not exists (
      select 1 from public.panel_admins
      where user_id = (select auth.uid())
    )
  ) then
    raise exception 'Somente administradores desta empresa podem resetar os pareceres.';
  end if;

  select data into post_data
  from public.posts
  where id = p_post_id and workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception 'A publicação não existe nesta empresa.';
  end if;

  update public.posts
  set data = (post_data - 'reviewComments') || pg_catalog.jsonb_build_object('updatedAt', reset_at),
      updated_at = pg_catalog.clock_timestamp()
  where id = p_post_id and workspace_id = p_workspace_id;
end;
$$;

revoke all on function public.create_workspace(text) from public;
revoke all on function public.list_user_workspaces() from public;
revoke all on function public.rename_workspace(uuid, text) from public;
revoke all on function public.archive_workspace(uuid) from public;
revoke all on function public.restore_workspace(uuid) from public;
revoke all on function public.delete_archived_workspace(uuid) from public;
revoke all on function public.verify_workspace_access(text) from public;
revoke all on function public.list_workspace_members(uuid) from public;
revoke all on function public.add_workspace_member(uuid, text, text) from public;
revoke all on function public.set_workspace_member_role(uuid, uuid, text) from public;
revoke all on function public.list_panel_accounts() from public;
revoke all on function public.set_panel_account_role(uuid, text) from public;
revoke all on function public.submit_review_decision(uuid, text, text, text) from public;
revoke all on function public.reset_review_comments(uuid, text) from public;

grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.list_user_workspaces() to authenticated;
grant execute on function public.rename_workspace(uuid, text) to authenticated;
grant execute on function public.archive_workspace(uuid) to authenticated;
grant execute on function public.restore_workspace(uuid) to authenticated;
grant execute on function public.delete_archived_workspace(uuid) to authenticated;
grant execute on function public.verify_workspace_access(text) to authenticated;
grant execute on function public.list_workspace_members(uuid) to authenticated;
grant execute on function public.add_workspace_member(uuid, text, text) to authenticated;
grant execute on function public.set_workspace_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.list_panel_accounts() to authenticated;
grant execute on function public.set_panel_account_role(uuid, text) to authenticated;
grant execute on function public.submit_review_decision(uuid, text, text, text) to authenticated;
grant execute on function public.reset_review_comments(uuid, text) to authenticated;

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

notify pgrst, 'reload schema';
