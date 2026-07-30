-- total_days/paid_days/unpaid_days were numeric(4,1), so a 0.25-day short leave
-- was silently rounded to 0.3 on write - a 20% over-count on every SHL, and all
-- 126 imported short-leave rows were affected. Widen to two decimals and repair.
alter table hr.leave_requests
  alter column total_days  type numeric(6,2),
  alter column paid_days   type numeric(6,2),
  alter column unpaid_days type numeric(6,2);

-- repair the rounded short-leave rows
update hr.leave_requests
   set total_days = 0.25
 where leave_type = 'short_leave' and total_days = 0.3;

select leave_type, total_days, count(*)
from hr.leave_requests
where leave_type in ('short_leave','half_day')
group by 1,2 order by 1,2;;