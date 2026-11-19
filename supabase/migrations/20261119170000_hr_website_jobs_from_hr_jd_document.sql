-- =====================================================================
-- Website openings rewritten from HR's JD document  ·  19 Nov 2026
-- ---------------------------------------------------------------------
-- Source: "Hagerstone_Job_Descriptions" (HR). The website now advertises
-- Civil Engineer, MEP Engineer (Electrical), Safety Officer, Site Foreman
-- (Civil & Interior), MEP Foreman, Store Keeper, Interior Designer /
-- Architect, plus the existing Site Engineer and Procurement Executive.
--
-- HR's instruction: location is published as "Pan India" (the document's
-- specific sites are not), and salary is NOT stored or published - it is
-- discussed with the candidate. hr.jobs.salary is left empty on purpose.
--
-- The four jobs created today for the website are renamed in place and get
-- the document's JD (Safety Engineer -> Safety Officer, slug
-- safety-engineer -> safety-officer; the website redirects the old URL).
-- Three new jobs are added. HR's own jobs (Site Engineer, Procurement
-- Executive, the original Interior Designer) are not touched.
--
-- GENERATED from the website repo's src/data/careers.ts so the JD HireFlow
-- screens against is word-for-word what the candidate read. Idempotent.
-- Already applied to the hub via MCP.
-- =====================================================================

update hr.jobs set title = 'Civil Engineer', website_slug = 'civil-engineer', location = 'Pan India', exp = 'Experienced candidates from the construction line', jd = 'Civil Engineer - Hagerstone International
Location: Pan India (project sites)
Experience: Experienced candidates from the construction line
Working hours: 12 hours per day
Qualification: Degree or diploma in Civil Engineering

Manage and supervise civil construction at our project sites, so work is built to drawings, specifications, quality standards and schedule.

Responsibilities
- Supervise day-to-day civil construction work at site and ensure it is executed to approved drawings and specifications.
- Read, interpret and prepare drawings and layouts in AutoCAD.
- Coordinate with site foremen, contractors, vendors and the MEP team to keep work on schedule.
- Monitor the quality of materials and workmanship; raise and close site quality issues.
- Prepare measurements and quantity take-offs, and support billing and progress reports.
- Maintain daily progress records and report status to the project management team.
- Make sure the site safety norms set by the safety officer are followed by all workers and contractors.

Requirements
- Degree or diploma in Civil Engineering.
- Proven experience in the construction line.
- Working knowledge of AutoCAD.
- Strong drawing-reading and site-execution skills.
- Willingness to work long hours on site as the project requires.
- Good communication and team-coordination skills.', updated_at = now()
 where website_slug = 'civil-engineer';

update hr.jobs set title = 'MEP Engineer (Electrical)', website_slug = 'mep-engineer', location = 'Pan India', exp = 'Experience in MEP / electrical works', jd = 'MEP Engineer (Electrical) - Hagerstone International
Location: Pan India (project sites)
Experience: Experience in MEP / electrical works
Working hours: 12 hours per day
Qualification: Degree or diploma in Electrical Engineering

Supervise electrical and allied MEP services at our project sites, from installation through testing and commissioning.

Responsibilities
- Supervise electrical installation and related MEP works at site to drawings and specifications.
- Read and interpret electrical and MEP drawings.
- Coordinate with the civil, interior, HVAC and plumbing teams to avoid clashes.
- Check material quality, installation, testing and commissioning of electrical systems.
- Prepare measurements and progress reports, and support billing.
- Coordinate with contractors and vendors for timely execution.
- Make sure electrical safety standards are followed on site.

Requirements
- Degree or diploma in Electrical Engineering.
- Experience in MEP works on construction or fit-out projects.
- Good understanding of electrical drawings, loads and cabling.
- Ability to coordinate with multiple trades.
- Willingness to work long hours on site as the project requires.', updated_at = now()
 where website_slug = 'mep-engineer';

update hr.jobs set title = 'Safety Officer', website_slug = 'safety-officer', location = 'Pan India', exp = 'Experience in site safety', jd = 'Safety Officer - Hagerstone International
Location: Pan India (project sites)
Experience: Experience in site safety
Working hours: 12 hours per day
Qualification: A diploma or certificate in industrial safety is preferred

Implement and monitor health and safety practices at our construction and fit-out sites.

Responsibilities
- Carry out regular site inspections and identify unsafe conditions and practices.
- Make sure workers use PPE and follow safety procedures at all times.
- Hold toolbox talks and basic safety inductions for workers.
- Report and investigate incidents, near misses and accidents, and maintain records.
- Verify safe work practices for work at height, electrical work, lifting and hot work.
- Monitor housekeeping, fire safety and emergency preparedness on site.
- Coordinate with the site engineer and management on safety compliance.

Requirements
- Knowledge of construction site safety practices and PPE norms.
- A safety qualification, such as a diploma or certificate in industrial safety, is preferred.
- Ability to communicate clearly with workers and supervisors.
- Willingness to work long hours on site as the project requires.', updated_at = now()
 where website_slug = 'safety-engineer';

update hr.jobs set title = 'Interior Designer / Architect', website_slug = 'interior-designer', location = 'Noida', exp = 'Minimum 3 years', jd = 'Interior Designer / Architect - Hagerstone International
Location: Noida (office-based)
Experience: Minimum 3 years
Working hours: Office hours
Qualification: Degree or diploma in Interior Design or Architecture

Join our office design team and develop design concepts and drawings for interior and fit-out projects.

Responsibilities
- Develop interior design concepts, layouts and space plans for client projects.
- Prepare working drawings, detailed drawings and 3D visuals.
- Select materials, finishes and furniture in line with the design intent and budget.
- Coordinate with site teams and vendors to resolve design and drawing queries.
- Present designs to clients and incorporate their feedback.
- Support BOQ preparation and design documentation.
- Make sure drawings are accurate and delivered on schedule.

Requirements
- Degree or diploma in Interior Design or Architecture.
- Minimum 3 years of relevant experience.
- Proficiency in AutoCAD and 3D / visualisation software.
- Good understanding of materials, finishes and site execution.
- Strong communication, presentation and time-management skills.', updated_at = now()
 where website_slug = 'interior-designer';

insert into hr.jobs (title, dept, location, type, exp, jd, skills, website_slug, posted_date)
select 'Site Foreman (Civil & Interior)', 'General', 'Pan India', 'Full-time', 'Experience in civil and interior / office fit-out works', 'Site Foreman (Civil & Interior) - Hagerstone International
Location: Pan India (project sites)
Experience: Experience in civil and interior / office fit-out works
Working hours: 12 hours per day

Lead on-site labour and trades for civil and interior office fit-out works, so the work is carried out accurately to drawings.

Responsibilities
- Lead and supervise site labour, carpenters, masons, painters and other trades for civil and interior fit-out works.
- Read and understand architectural and working drawings, and execute work accordingly.
- Plan daily work allocation and make sure targets are met on time.
- Check workmanship, finishes, levels and dimensions against drawings.
- Coordinate with engineers, designers and vendors on material and drawing clarifications.
- Track material use at site and report requirements in advance.
- Enforce safety practices and site discipline.

Requirements
- Experience as a foreman or supervisor in civil and interior / office fit-out works.
- Must be able to read and understand drawings (mandatory).
- Hands-on knowledge of civil, false ceiling, partition, flooring, carpentry and finishing works.
- Ability to manage labour and contractors effectively.
- Willingness to work long hours on site as the project requires.', '[]'::jsonb, 'site-foreman', current_date
where not exists (select 1 from hr.jobs where website_slug = 'site-foreman');

insert into hr.jobs (title, dept, location, type, exp, jd, skills, website_slug, posted_date)
select 'MEP Foreman', 'General', 'Pan India', 'Full-time', 'Experience supervising MEP works at site', 'MEP Foreman - Hagerstone International
Location: Pan India (project sites)
Experience: Experience supervising MEP works at site
Working hours: 12 hours per day

Supervise mechanical, electrical and plumbing installation crews at our project sites, so work is installed accurately to drawings and on schedule.

Responsibilities
- Lead and supervise site technicians and helpers for electrical, plumbing, HVAC and fire-fighting installation works.
- Read and understand MEP drawings and carry out installation accordingly.
- Plan daily work allocation and make sure targets are met on time.
- Check conduiting, cabling, piping, ducting and equipment installation for quality and alignment with drawings.
- Coordinate with the MEP engineer and the civil and interior teams to avoid clashes and resolve drawing queries.
- Track MEP material use at site and report requirements in advance.
- Assist in testing and commissioning, and make sure work on site is done safely.

Requirements
- Experience as a foreman or supervisor in MEP works on construction or fit-out projects.
- Must be able to read and understand MEP drawings.
- Hands-on knowledge of electrical wiring, plumbing and HVAC installation.
- Ability to manage technicians and contractors effectively.
- Willingness to work long hours on site as the project requires.', '[]'::jsonb, 'mep-foreman', current_date
where not exists (select 1 from hr.jobs where website_slug = 'mep-foreman');

insert into hr.jobs (title, dept, location, type, exp, jd, skills, website_slug, posted_date)
select 'Store Keeper', 'General', 'Pan India', 'Full-time', 'Prior store or site inventory experience preferred', 'Store Keeper - Hagerstone International
Location: Pan India (project sites)
Experience: Prior store or site inventory experience preferred
Working hours: 12 hours per day

Manage materials, tools and consumables at our project sites, and keep stock records accurate.

Responsibilities
- Receive, inspect, record and store materials delivered to site.
- Issue materials and tools against approved requisitions and keep issue records.
- Maintain daily stock registers with inward, outward and balance quantities.
- Carry out periodic stock checks and report shortages, damage or wastage.
- Coordinate with the site engineer and procurement team on material requirements.
- Keep the store organised, secure and safe.
- Maintain challans, delivery receipts and other supporting documents.

Requirements
- Experience in store or inventory handling, preferably at a construction or fit-out site.
- Basic computer skills (Excel or similar) for stock records.
- Knowledge of construction and interior materials is an advantage.
- Honesty, accuracy and good record-keeping habits.
- Willingness to work long hours on site as the project requires.', '[]'::jsonb, 'store-keeper', current_date
where not exists (select 1 from hr.jobs where website_slug = 'store-keeper');
