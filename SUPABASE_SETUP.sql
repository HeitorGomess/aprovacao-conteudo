create table if not exists public.posts (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.panel_editors (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.posts enable row level security;
alter table public.panel_editors enable row level security;

grant select, insert, update, delete on public.posts to authenticated;
grant select on public.panel_editors to authenticated;

drop policy if exists posts_authenticated_all on public.posts;
create policy posts_authenticated_all
  on public.posts
  for all
  to authenticated
  using (exists (select 1 from public.panel_editors where user_id = (select auth.uid())))
  with check (exists (select 1 from public.panel_editors where user_id = (select auth.uid())));

drop policy if exists panel_editors_read_self on public.panel_editors;
create policy panel_editors_read_self
  on public.panel_editors
  for select
  to authenticated
  using (user_id = (select auth.uid()));

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
