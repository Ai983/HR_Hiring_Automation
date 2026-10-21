-- ============================================================================
-- Add Vinfast Jhotwara to the attendance site pick-list.
--
-- Coordinates are intentionally left blank. Until HR pins/verifies the site in
-- Attendance Setup, punches can use the site but the geofence remains flag-only.
-- ============================================================================

insert into hr.sites (name, radius_meters, active, source)
values ('Vinfast - Jhotwara', 200, true, 'manual')
on conflict (name) do update
set active = true,
    radius_meters = coalesce(hr.sites.radius_meters, excluded.radius_meters),
    source = coalesce(hr.sites.source, excluded.source);

select id, name, active, radius_meters, latitude, longitude, geocode_confidence
from hr.sites
where name = 'Vinfast - Jhotwara';
