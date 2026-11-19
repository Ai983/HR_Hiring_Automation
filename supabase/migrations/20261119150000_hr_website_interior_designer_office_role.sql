-- =====================================================================
-- Website Interior Designer opening becomes an office role  ·  19 Nov 2026
-- ---------------------------------------------------------------------
-- hagerstone.com/careers/interior-designer now advertises office-based
-- design work in Noida (space planning, concepts, 3D, working drawings),
-- not site execution.
--
-- HR's existing "Interior Designer" job keeps its site-execution JD and its
-- applicants; only its website_slug is cleared. The slug moves to a new
-- "Interior Designer (Office)" job whose JD matches what website candidates
-- apply for, so screen-resume scores them against the right description.
--
-- Already applied to the hub via MCP. Idempotent.
-- =====================================================================

update hr.jobs set website_slug = null
 where website_slug = 'interior-designer' and title = 'Interior Designer';

insert into hr.jobs (title, dept, location, type, exp, jd, skills, website_slug, posted_date)
select 'Interior Designer (Office)', 'General', 'Noida', 'Full-time', '1–3 years',
'Interior Designer - Office-based, Noida
Location: Noida (office-based)
Experience: 1–3 years in interior design (commercial or office projects preferred)

Responsibilities
- Prepare space plans and furniture layouts for offices from the client''s brief and headcount.
- Develop design concepts, mood boards and 3D views for client presentations.
- Select materials, finishes and furniture, and prepare finish schedules.
- Prepare working drawings: layouts, reflected ceiling plans, elevations and joinery details.
- Support the estimation team with quantities for the BOQ.
- Coordinate the design with the MEP, procurement and project teams, and revise drawings from client feedback.
- Answer design queries from the site team during execution.

Requirements
- Bachelor''s degree or Diploma in Interior Design or a related field.
- 1–3 years of interior design experience; commercial office projects preferred.
- AutoCAD (mandatory) and SketchUp; 3ds Max, V-Ray or a similar rendering tool is a plus.
- Good knowledge of interior materials, finishes and furniture systems.
- A portfolio of work.
- Clear communication with clients and project teams.',
  '["Space planning","Office interiors","AutoCAD","SketchUp","3D visualisation","Working drawings","Material selection"]'::jsonb,
  'interior-designer', current_date
where not exists (select 1 from hr.jobs where website_slug = 'interior-designer');
