-- ============================================================================
-- Reference data for the attendance module: the site pick-list and the holiday
-- calendar carried over from the retired HSIPL sheet.
--
-- Applied to production on 2026-07-30 as plain SQL rather than a migration, so
-- it is captured here to make a rebuild from this repo reproducible.
--
-- Idempotent. Safe to re-run.
--
-- NOTE ON COORDINATES: every site is deliberately created WITHOUT lat/long. A
-- guessed coordinate would make the GPS cross-check flag every genuine punch at
-- that site as a mismatch. Add real coordinates per site in Attendance Setup;
-- until a site has them, site_match records 'no_coords' and nothing is blocked.
--
-- Two values from the sheet's site column were data-entry errors and are
-- excluded on purpose: 'B' (a spilled column header) and 'Priyanka' (a person's
-- name typed into the site field).
-- ============================================================================

insert into hr.sites (name) values
  ('Head Office'),('Delhi NCR'),('Bhuj'),('Hero Homes Ludhiana'),('Minebea Mitsumi'),
  ('ULTRATECH - RAJPURA'),('Hero Homes Greater Noida'),('PARAS - GAWAL PHADI  GURUGRAM'),
  ('MAX Hospital, Saket Delhi'),('Vaneet Infra'),('Auma India Bengaluru'),('Bangalore Branch Office'),
  ('bansal tower gurugram'),('Dehradun'),('MT & T - CHENNAI'),('Microsave'),('PRATIBHA PRESS - LUCKNOW'),
  ('Dee Foundation Omaxe, Faridabad'),('Jasarar'),('hanumangarh'),('Chattargarh'),('Andritz'),
  ('Vinfast - Jaipur'),('CIPL - NOIDA'),('Himalaya'),('KOKO Town, Chandigarh'),
  ('TAJ GYM PROJECT - VARANAS'),('Statkraft- Saket'),('Consern Pharma'),('Concord'),('VinFast'),
  ('kotputli Project'),('SAMSUNG [ SERVE & CARE ] - KANPUR'),('Jasrasar'),('Ferozepur Punjab'),
  ('Vinfast - Patparganj'),('RSP SEC- 18 - GURUGRAM'),('Theon Lifescience'),('Bangalore'),
  ('Vinfast-Ghaziabad'),('VATSALYA PEETH - CHATTARPUR'),('Valorium'),('AU Space Office Ludhiana'),
  ('Ludhiana'),('churu')
on conflict (name) do nothing;

-- Holiday names/dates as listed on the sheet's Setting tab, rolled to 2026.
-- Verify these against the official 2026 holiday list before the year is relied on.
insert into hr.holidays (holiday_date, name) values
  ('2026-01-01','New Year'),
  ('2026-03-25','Holi'),
  ('2026-04-11','Ashtami'),
  ('2026-04-17','Ramnavmi'),
  ('2026-08-15','Independence Day'),
  ('2026-08-19','Raksha Bandhan'),
  ('2026-10-02','Gandhi Jayanti'),
  ('2026-10-12','Dusshara'),
  ('2026-11-01','Diwali'),
  ('2026-11-02','Bhaidooj')
on conflict (holiday_date) do nothing;

-- The singleton shift/OT row is created by the parity migration with the values
-- read off the sheet (08:00-19:00, late after 09:30, full day 9h, OT past 9h,
-- Sunday as the weekly day off). Nothing to seed here.

select (select count(*) from hr.sites)    as sites,
       (select count(*) from hr.holidays) as holidays;
