begin;

-- Hotfix: allow creating both public/private groups for authenticated owner
-- Some environments may contain older insert policy variants (e.g. public-only).

drop policy if exists "groups_insert_authenticated" on public.groups;
drop policy if exists "groups_insert_owner_only" on public.groups;
drop policy if exists "groups_insert_public_only" on public.groups;

create policy "groups_insert_owner_only"
  on public.groups
  for insert
  with check (
    auth.uid() is not null
    and owner_id = auth.uid()
  );

commit;
