-- Supabase RLS policies for FoodChoice
-- Generated per RLS_PLAN.md

-- 1) users
alter table if exists public.users enable row level security;

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

-- 2) groups
alter table if exists public.groups enable row level security;

create policy "groups_select_member"
  on public.groups
  for select
  using (
    id in (
      select gm.group_id
      from public.group_memberships gm
      where gm.user_id = auth.uid()
    )
  );

create policy "groups_insert_authenticated"
  on public.groups
  for insert
  with check (auth.uid() is not null);

create policy "groups_update_admin"
  on public.groups
  for update
  using (
    exists (
      select 1
      from public.group_memberships gm
      where gm.group_id = groups.id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.group_memberships gm
      where gm.group_id = groups.id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
  );

create policy "groups_delete_admin"
  on public.groups
  for delete
  using (
    exists (
      select 1
      from public.group_memberships gm
      where gm.group_id = groups.id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
  );

-- 3) group_memberships
alter table if exists public.group_memberships enable row level security;

create policy "group_memberships_select_same_group"
  on public.group_memberships
  for select
  using (
    group_id in (
      select gm.group_id
      from public.group_memberships gm
      where gm.user_id = auth.uid()
    )
  );

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
  using (
    exists (
      select 1
      from public.group_memberships gm
      where gm.group_id = group_memberships.group_id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
  );

-- 4) group_invitations
alter table if exists public.group_invitations enable row level security;

create policy "group_invitations_insert_admin"
  on public.group_invitations
  for insert
  with check (
    exists (
      select 1
      from public.group_memberships gm
      where gm.group_id = group_invitations.group_id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
  );

create policy "group_invitations_select_admin"
  on public.group_invitations
  for select
  using (
    exists (
      select 1
      from public.group_memberships gm
      where gm.group_id = group_invitations.group_id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
  );

-- Allow authenticated user with invite token header to read invitation
-- Client must send: x-invite-token: <token>
create policy "group_invitations_select_by_token"
  on public.group_invitations
  for select
  using (
    auth.uid() is not null
    and token = (current_setting('request.headers', true)::json ->> 'x-invite-token')
  );

-- Allow accepting invite when token matches
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

-- 5) foods
alter table if exists public.foods enable row level security;

create policy "foods_select_same_group"
  on public.foods
  for select
  using (
    exists (
      select 1
      from public.group_memberships gm
      where gm.group_id = foods.group_id
        and gm.user_id = auth.uid()
    )
  );

create policy "foods_insert_non_readonly"
  on public.foods
  for insert
  with check (
    exists (
      select 1
      from public.group_memberships gm
      where gm.group_id = foods.group_id
        and gm.user_id = auth.uid()
        and gm.role <> 'readonly'
    )
  );

create policy "foods_update_non_readonly"
  on public.foods
  for update
  using (
    exists (
      select 1
      from public.group_memberships gm
      where gm.group_id = foods.group_id
        and gm.user_id = auth.uid()
        and gm.role <> 'readonly'
    )
  )
  with check (
    exists (
      select 1
      from public.group_memberships gm
      where gm.group_id = foods.group_id
        and gm.user_id = auth.uid()
        and gm.role <> 'readonly'
    )
  );

create policy "foods_delete_non_readonly"
  on public.foods
  for delete
  using (
    exists (
      select 1
      from public.group_memberships gm
      where gm.group_id = foods.group_id
        and gm.user_id = auth.uid()
        and gm.role <> 'readonly'
    )
  );

-- 6) ratings
alter table if exists public.ratings enable row level security;

alter table if exists public.ratings
  add column if not exists user_id uuid;

create policy "ratings_select_same_group"
  on public.ratings
  for select
  using (
    exists (
      select 1
      from public.foods f
      join public.group_memberships gm
        on gm.group_id = f.group_id
      where f.id = ratings.food_id
        and gm.user_id = auth.uid()
    )
  );

create policy "ratings_insert_own"
  on public.ratings
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.foods f
      join public.group_memberships gm
        on gm.group_id = f.group_id
      where f.id = ratings.food_id
        and gm.user_id = auth.uid()
    )
  );

create policy "ratings_update_own"
  on public.ratings
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.foods f
      join public.group_memberships gm
        on gm.group_id = f.group_id
      where f.id = ratings.food_id
        and gm.user_id = auth.uid()
    )
  );

create policy "ratings_delete_own"
  on public.ratings
  for delete
  using (user_id = auth.uid());

-- 7) foods group_id safeguard
alter table if exists public.foods
  add column if not exists group_id uuid;
