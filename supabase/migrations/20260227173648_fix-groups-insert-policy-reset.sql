begin;

-- Hard reset groups INSERT policies to avoid legacy restrictive/public-only rules.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'groups'
      and cmd = 'INSERT'
  loop
    execute format('drop policy if exists %I on public.groups', p.policyname);
  end loop;
end $$;

-- Ensure required groups policies exist with clear semantics.
drop policy if exists "groups_select_public_or_member" on public.groups;
drop policy if exists "groups_update_admin" on public.groups;
drop policy if exists "groups_delete_admin" on public.groups;

create policy "groups_select_public_or_member"
  on public.groups
  for select
  using (public.is_group_member(id) or is_public = true);

create policy "groups_insert_owner_only"
  on public.groups
  for insert
  with check (
    auth.uid() is not null
    and owner_id = auth.uid()
  );

create policy "groups_update_admin"
  on public.groups
  for update
  using (public.is_group_admin(id))
  with check (public.is_group_admin(id));

create policy "groups_delete_admin"
  on public.groups
  for delete
  using (public.is_group_admin(id));

commit;
