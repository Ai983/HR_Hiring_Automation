-- ============================================================
-- 03-site-geocode.sql
-- Applied to the hub project (tpfvnerrjhqwipyonngf).
-- Geofenced attendance: site coordinates sourced from CPS (Central Procurement
-- System). CPS stores only site_address text, so coordinates are geocoded
-- (Nominatim/OSM — the project's free maps stack) into hr.sites.
--
-- hr.sites is the canonical attendance site pick-list + geofence source used by
-- the attendance-punch Edge Function. This migration adds CPS linkage + geocode
-- provenance so we only ever BLOCK a punch against a coordinate we trust.
-- Idempotent: safe to re-run.
-- ============================================================

alter table hr.sites add column if not exists address            text;
alter table hr.sites add column if not exists project_code       text;   -- links public.projects.code / cps.cps_projects.code
alter table hr.sites add column if not exists source             text;   -- 'cps' | 'office' | 'manual'
alter table hr.sites add column if not exists geocoded_at        timestamptz;
alter table hr.sites add column if not exists geocode_confidence text;   -- 'verified' (block-safe) | 'approx' (flag-only) | 'failed'
alter table hr.sites add column if not exists geocode_provider   text;   -- 'nominatim' | 'manual'

-- Only a 'verified' coordinate is precise enough to reject a punch on. Everything
-- else (approx / failed / null) is cross-checked and flagged, never blocked.
create index if not exists idx_hr_sites_active on hr.sites(active) where active;

-- Widen the attendance.site_match check for the new picked-site outcomes:
--   'calibrated' — the punch seeded a previously-uncoordinated site
--   'weak'       — GPS too coarse to judge the picked site (flagged, not blocked)
alter table hr.attendance drop constraint if exists attendance_site_match_chk;
alter table hr.attendance add constraint attendance_site_match_chk
  check (site_match is null or site_match = any (array[
    'ok','mismatch','no_coords','no_gps','calibrated','weak'
  ]));
