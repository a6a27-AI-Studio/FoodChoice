begin;

-- group settings can be updated by admin; keep updated_at useful for sorting/audit
alter table if exists public.groups
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_group_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_groups_updated_at on public.groups;
create trigger trg_groups_updated_at
before update on public.groups
for each row execute function public.touch_group_updated_at();

-- Trending Top N public groups
create or replace function public.get_public_group_trending(p_limit int default 10)
returns table (
  id uuid,
  name text,
  description text,
  owner_id uuid,
  is_public boolean,
  favorite_count int,
  category text,
  search_tags text[],
  food_count int,
  is_favorited boolean
)
language sql
security definer
set search_path = public
set row_security = off
as $$
  select
    g.id,
    g.name,
    g.description,
    g.owner_id,
    g.is_public,
    g.favorite_count,
    g.category,
    g.search_tags,
    count(f.id)::int as food_count,
    exists(
      select 1
      from public.group_favorites gf
      where gf.group_id = g.id
        and gf.user_id = auth.uid()
    ) as is_favorited
  from public.groups g
  left join public.foods f on f.group_id = g.id
  where g.is_public = true
  group by g.id
  order by g.favorite_count desc, count(f.id) desc, g.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

revoke all on function public.get_public_group_trending(int) from public;
grant execute on function public.get_public_group_trending(int) to authenticated;

commit;
