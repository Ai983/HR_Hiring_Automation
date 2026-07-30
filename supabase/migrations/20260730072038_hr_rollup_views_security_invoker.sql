-- The roll-up views were plain (owner-rights) views, so they bypassed RLS on
-- hr.attendance / hr.leave_requests entirely: anon could read every person's
-- monthly attendance through hr.attendance_month. security_invoker makes the
-- caller's own RLS apply, which also means a normal employee sees only their
-- own days while HR/admin still sees everyone.
alter view hr.attendance_subject set (security_invoker = true);
alter view hr.attendance_day     set (security_invoker = true);
alter view hr.attendance_month   set (security_invoker = true);

select c.relname,
       (select option_value from pg_options_to_table(c.reloptions)
        where option_name = 'security_invoker') as security_invoker
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'hr' and c.relkind = 'v'
order by c.relname;;