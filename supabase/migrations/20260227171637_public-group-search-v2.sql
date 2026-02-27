begin;

-- groups metadata for better discovery
alter table if exists public.groups
  add column if not exists category text;

alter table if exists public.groups
  add column if not exists search_tags text[] not null default '{}';

create index if not exists groups_category_idx on public.groups (category);
create index if not exists groups_search_tags_gin_idx on public.groups using gin (search_tags);

-- Upgrade search RPC: keyword hits group name / food name / category / tags
-- Return columns changed, so drop old signature first.
drop function if exists public.search_public_groups(text, int);
create function public.search_public_groups(p_keyword text default '', p_limit int default 50)
returns table (
  id uuid,
  name text,
  description text,
  owner_id uuid,
  is_public boolean,
  favorite_count int,
  category text,
  search_tags text[],
  matched_food_count int,
  is_favorited boolean
)
language sql
security definer
set search_path = public
set row_security = off
as $$
  with kw as (
    select nullif(trim(coalesce(p_keyword, '')), '') as q
  )
  select
    g.id,
    g.name,
    g.description,
    g.owner_id,
    g.is_public,
    g.favorite_count,
    g.category,
    g.search_tags,
    count(distinct f.id)::int as matched_food_count,
    exists(
      select 1
      from public.group_favorites gf
      where gf.group_id = g.id
        and gf.user_id = auth.uid()
    ) as is_favorited
  from public.groups g
  left join public.foods f
    on f.group_id = g.id
   and (
      (select q from kw) is not null
      and f.name ilike ('%' || (select q from kw) || '%')
   )
  where g.is_public = true
    and (
      (select q from kw) is null
      or g.name ilike ('%' || (select q from kw) || '%')
      or coalesce(g.category, '') ilike ('%' || (select q from kw) || '%')
      or exists (
        select 1
        from unnest(coalesce(g.search_tags, '{}')) t(tag)
        where t.tag ilike ('%' || (select q from kw) || '%')
      )
      or exists (
        select 1
        from public.foods f2
        where f2.group_id = g.id
          and f2.name ilike ('%' || (select q from kw) || '%')
      )
    )
  group by g.id
  order by g.favorite_count desc, g.name asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

-- New RPC: random recommendations before search
create or replace function public.get_public_group_recommendations(p_limit int default 6)
returns table (
  id uuid,
  name text,
  description text,
  owner_id uuid,
  is_public boolean,
  favorite_count int,
  category text,
  search_tags text[],
  sample_food_name text,
  recommendation_reason text,
  is_favorited boolean
)
language sql
security definer
set search_path = public
set row_security = off
as $$
  with base as (
    select
      g.id,
      g.name,
      g.description,
      g.owner_id,
      g.is_public,
      g.favorite_count,
      g.category,
      g.search_tags,
      (
        select f.name
        from public.foods f
        where f.group_id = g.id
        order by random()
        limit 1
      ) as sample_food_name,
      exists(
        select 1
        from public.group_favorites gf
        where gf.group_id = g.id
          and gf.user_id = auth.uid()
      ) as is_favorited,
      random() as rnd
    from public.groups g
    where g.is_public = true
  )
  select
    b.id,
    b.name,
    b.description,
    b.owner_id,
    b.is_public,
    b.favorite_count,
    b.category,
    b.search_tags,
    b.sample_food_name,
    case
      when b.favorite_count >= 10 then '社群熱門'
      when b.sample_food_name is not null then '推薦你試試：' || b.sample_food_name
      else '隨機探索'
    end as recommendation_reason,
    b.is_favorited
  from base b
  order by
    case when b.favorite_count >= 10 then 0 else 1 end,
    b.rnd asc
  limit greatest(1, least(coalesce(p_limit, 6), 24));
$$;

revoke all on function public.search_public_groups(text, int) from public;
grant execute on function public.search_public_groups(text, int) to authenticated;

revoke all on function public.get_public_group_recommendations(int) from public;
grant execute on function public.get_public_group_recommendations(int) to authenticated;

commit;
