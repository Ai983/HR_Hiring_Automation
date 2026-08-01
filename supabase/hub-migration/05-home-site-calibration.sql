-- ============================================================
-- 05-home-site-calibration.sql
-- Applied to the hub project (tpfvnerrjhqwipyonngf).
-- Phased geofence rollout:
--   (1) assign each employee a home site,
--   (2) collect their real punch coordinates,
--   (3) an admin reviews the cluster and promotes a site to 'verified' — which
--       is what switches ON blocking for that site.
-- Idempotent: safe to re-run.
-- ============================================================

-- Home site each employee normally reports to (defaults their punch site, and
-- powers the "punched away from their site" admin view).
alter table hr.employee_profile
  add column if not exists home_site_id uuid references hr.sites(id) on delete set null;

-- SQL haversine (metres) — mirrors the TS/JS geofence math, for calibration stats.
create or replace function hr._haversine(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
) returns double precision
language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
  ));
$$;

-- Per-site calibration stats from real punches: how many good-accuracy points we
-- have, their median centre, and how tightly they cluster (p90 distance). The
-- admin uses this to set a trustworthy pin + radius and mark the site verified.
create or replace function hr.site_calibration(p_days int default 120, p_max_accuracy numeric default 120)
returns table (
  site_id uuid, name text, code text,
  latitude double precision, longitude double precision,
  geocode_confidence text, radius_meters int,
  n_points int, median_lat double precision, median_lng double precision,
  spread_m numeric, suggested_radius int, current_dist_m numeric
)
language sql
stable
security definer
set search_path = hr, public
as $$
  with pts as (
    select a.site_ref, a.latitude as lat, a.longitude as lng
    from hr.attendance a
    where a.site_ref is not null
      and a.latitude is not null and a.longitude is not null
      and (a.accuracy is null or a.accuracy <= p_max_accuracy)
      and a.recorded_at >= now() - make_interval(days => p_days)
  ),
  med as (
    select site_ref,
           percentile_cont(0.5) within group (order by lat) as mlat,
           percentile_cont(0.5) within group (order by lng) as mlng,
           count(*) as n
    from pts group by site_ref
  ),
  spread as (
    select p.site_ref,
           percentile_cont(0.9) within group (order by hr._haversine(p.lat, p.lng, m.mlat, m.mlng)) as p90
    from pts p join med m on m.site_ref = p.site_ref
    group by p.site_ref
  )
  select s.id, s.name, s.code, s.latitude, s.longitude, s.geocode_confidence, s.radius_meters,
         m.n::int, m.mlat, m.mlng,
         round(sp.p90::numeric, 0) as spread_m,
         greatest(80, least(500, ceil(coalesce(sp.p90, 0) + 40)))::int as suggested_radius,
         case when s.latitude is null then null
              else round(hr._haversine(s.latitude, s.longitude, m.mlat, m.mlng)::numeric, 0) end as current_dist_m
  from med m
  join hr.sites s on s.id = m.site_ref
  join spread sp on sp.site_ref = m.site_ref
  where hr.is_hr_admin()
  order by m.n desc;
$$;

grant execute on function hr.site_calibration(int, numeric) to authenticated, service_role;
