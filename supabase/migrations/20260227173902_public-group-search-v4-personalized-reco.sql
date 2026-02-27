begin;

-- V4: Personalized recommendation based on user's favorite group categories/tags.
create or replace function public.get_personalized_public_group_recommendations(p_limit int default 8)
returns table (
  id uuid,
  name text,
  description text,
  owner_id uuid,
  is_public boolean,
  favorite_count int,
  category text,
  search_tags text[],
  score numeric,
  recommendation_reason text,
  is_favorited boolean
)
language sql
security definer
set search_path = public
set row_security = off
as $$
  with my_fav as (
    select g.id, g.category, coalesce(g.search_tags, '{}') as search_tags
    from public.group_favorites gf
    join public.groups g on g.id = gf.group_id
    where gf.user_id = auth.uid()
      and g.is_public = true
  ),
  my_cat as (
    select category, count(*)::numeric as weight
    from my_fav
    where category is not null and category <> ''
    group by category
  ),
  my_tag as (
    select t.tag, count(*)::numeric as weight
    from my_fav f,
         unnest(f.search_tags) as t(tag)
    where t.tag is not null and t.tag <> ''
    group by t.tag
  ),
  cand as (
    select
      g.id,
      g.name,
      g.description,
      g.owner_id,
      g.is_public,
      g.favorite_count,
      g.category,
      g.search_tags,
      coalesce((select mc.weight from my_cat mc where mc.category = g.category), 0) * 2
      + coalesce((
          select sum(mt.weight)
          from unnest(coalesce(g.search_tags, '{}')) t(tag)
          join my_tag mt on mt.tag = t.tag
        ), 0)
      + least(g.favorite_count::numeric / 5, 3) as score,
      exists(
        select 1 from public.group_favorites gf
        where gf.group_id = g.id and gf.user_id = auth.uid()
      ) as is_favorited
    from public.groups g
    where g.is_public = true
      and not exists (
        select 1
        from public.group_favorites gf
        where gf.group_id = g.id and gf.user_id = auth.uid()
      )
  )
  select
    c.id,
    c.name,
    c.description,
    c.owner_id,
    c.is_public,
    c.favorite_count,
    c.category,
    c.search_tags,
    c.score,
    case
      when c.score >= 4 then '符合你常收藏的口味'
      when c.score >= 2 then '與你的偏好有關'
      else '社群也常收藏'
    end as recommendation_reason,
    c.is_favorited
  from cand c
  order by c.score desc, c.favorite_count desc, c.name asc
  limit greatest(1, least(coalesce(p_limit, 8), 30));
$$;

revoke all on function public.get_personalized_public_group_recommendations(int) from public;
grant execute on function public.get_personalized_public_group_recommendations(int) to authenticated;

commit;
