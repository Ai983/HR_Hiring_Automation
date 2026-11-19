-- Interior Designer / Architect (website): experience is 1–3 years, not
-- "minimum 3 years" (HR, 19 Nov 2026). Already applied to the hub. Idempotent.
update hr.jobs
   set exp = '1–3 years',
       jd = replace(replace(jd, 'Experience: Minimum 3 years', 'Experience: 1–3 years'),
                    '- Minimum 3 years of relevant experience.', '- 1–3 years of relevant experience.'),
       updated_at = now()
 where website_slug = 'interior-designer';
