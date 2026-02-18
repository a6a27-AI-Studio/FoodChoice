-- Supabase RLS policies for FoodChoice (fixed recursion)
-- Generated per RLS_PLAN.md

-- Enable RLS
alter table if exists public.users enable row level security;
alter table if exists public.groups enable row level security;
alter table if exists public.group_memberships enable row level security;
alter table if exists public.group_invitations enable row level security;
alter table if exists public.foods enable row level security;
alter table if exists public.ratings enable row level security;

-- Helper functions (security definer to avoid policy recursion)
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.group_memberships gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.group_memberships gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
      and gm.role = 'admin'
  );
$$;

create or replace function public.is_group_editor(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.group_memberships gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
      and gm.role <> 'readonly'
  );
$$;

create or replace function public.is_food_group_member(p_food_id bigint)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.foods f
    join public.group_memberships gm
      on gm.group_id = f.group_id
    where f.id = p_food_id
      and gm.user_id = auth.uid()
  );
$$;

-- users policies
create policy "users_select_own"
  on public.users
  for select
  using (auth.uid() = id);

create policy "users_update_own"
  on public.users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "users_insert_own"
  on public.users
  for insert
  with check (auth.uid() = id);

-- groups policies
drop policy if exists "groups_select_member" on public.groups;
drop policy if exists "groups_update_admin" on public.groups;
drop policy if exists "groups_delete_admin" on public.groups;

create policy "groups_select_member"
  on public.groups
  for select
  using (public.is_group_member(id));

create policy "groups_insert_authenticated"
  on public.groups
  for insert
  with check (auth.uid() is not null);

create policy "groups_update_admin"
  on public.groups
  for update
  using (public.is_group_admin(id))
  with check (public.is_group_admin(id));

create policy "groups_delete_admin"
  on public.groups
  for delete
  using (public.is_group_admin(id));

-- group_memberships policies
drop policy if exists "group_memberships_select_same_group" on public.group_memberships;
drop policy if exists "group_memberships_delete_admin" on public.group_memberships;

create policy "group_memberships_select_same_group"
  on public.group_memberships
  for select
  using (public.is_group_member(group_id));

create policy "group_memberships_insert_self"
  on public.group_memberships
  for insert
  with check (user_id = auth.uid());

create policy "group_memberships_delete_self"
  on public.group_memberships
  for delete
  using (user_id = auth.uid());

create policy "group_memberships_delete_admin"
  on public.group_memberships
  for delete
  using (public.is_group_admin(group_id));

-- group_invitations policies
drop policy if exists "group_invitations_insert_admin" on public.group_invitations;
drop policy if exists "group_invitations_select_admin" on public.group_invitations;

create policy "group_invitations_insert_admin"
  on public.group_invitations
  for insert
  with check (public.is_group_admin(group_id));

create policy "group_invitations_select_admin"
  on public.group_invitations
  for select
  using (public.is_group_admin(group_id));

create policy "group_invitations_select_by_token"
  on public.group_invitations
  for select
  using (
    auth.uid() is not null
    and token = (current_setting('request.headers', true)::json ->> 'x-invite-token')
  );

create policy "group_invitations_update_by_token"
  on public.group_invitations
  for update
  using (
    auth.uid() is not null
    and token = (current_setting('request.headers', true)::json ->> 'x-invite-token')
  )
  with check (
    auth.uid() is not null
    and token = (current_setting('request.headers', true)::json ->> 'x-invite-token')
  );

-- foods policies
drop policy if exists "foods_select_same_group" on public.foods;
drop policy if exists "foods_insert_non_readonly" on public.foods;
drop policy if exists "foods_update_non_readonly" on public.foods;
drop policy if exists "foods_delete_non_readonly" on public.foods;

create policy "foods_select_same_group"
  on public.foods
  for select
  using (public.is_group_member(group_id));

create policy "foods_insert_non_readonly"
  on public.foods
  for insert
  with check (public.is_group_editor(group_id));

create policy "foods_update_non_readonly"
  on public.foods
  for update
  using (public.is_group_editor(group_id))
  with check (public.is_group_editor(group_id));

create policy "foods_delete_non_readonly"
  on public.foods
  for delete
  using (public.is_group_editor(group_id));

-- ratings policies
drop policy if exists "ratings_select_same_group" on public.ratings;
drop policy if exists "ratings_insert_own" on public.ratings;
drop policy if exists "ratings_update_own" on public.ratings;
drop policy if exists "ratings_delete_own" on public.ratings;

create policy "ratings_select_same_group"
  on public.ratings
  for select
  using (public.is_food_group_member(food_id));

create policy "ratings_insert_own"
  on public.ratings
  for insert
  with check (user_id = auth.uid() and public.is_food_group_member(food_id));

create policy "ratings_update_own"
  on public.ratings
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_food_group_member(food_id));

create policy "ratings_delete_own"
  on public.ratings
  for delete
  using (user_id = auth.uid());

-- Schema safeguards
alter table if exists public.ratings
  add column if not exists user_id uuid;

alter table if exists public.foods
  add column if not exists group_id uuid;
