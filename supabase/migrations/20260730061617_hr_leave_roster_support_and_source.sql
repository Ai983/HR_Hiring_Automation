-- Leave for HR-roster people too, plus provenance. hr schema only.
alter table hr.leave_requests
  add column if not exists person_ref uuid references hr.attendance_person(id) on delete cascade,
  add column if not exists source     text not null default 'portal';

alter table hr.leave_requests alter column employee_id drop not null;
alter table hr.leave_requests alter column request_to  drop not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='leave_subject_chk') then
    alter table hr.leave_requests add constraint leave_subject_chk
      check ((employee_id is not null) <> (person_ref is not null));
  end if;
  if not exists (select 1 from pg_constraint where conname='leave_source_chk') then
    alter table hr.leave_requests add constraint leave_source_chk
      check (source in ('portal','import','admin'));
  end if;
end $$;

create index if not exists leave_person_ref_idx on hr.leave_requests (person_ref, start_date);
create index if not exists leave_dates_idx on hr.leave_requests (start_date, end_date);;