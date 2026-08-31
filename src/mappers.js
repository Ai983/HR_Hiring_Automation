import { PORTALS } from "./constants.js";

export function dbJobToApp(row) {
  if (!row) return null;
  const ps = row.portal_status || {};
  const job = {
    id: row.id,
    title: row.title,
    dept: row.dept,
    location: row.location,
    type: row.type,
    exp: row.exp,
    salary: row.salary,
    jd: row.jd,
    jd_linkedin: row.jd_linkedin,
    jd_indeed: row.jd_indeed,
    jd_jobhai: row.jd_jobhai,
    jd_apna: row.jd_apna,
    skills: row.skills || [],
    postedDate: row.posted_date,
  };
  PORTALS.forEach((p) => {
    if (ps[p.id] && ps[p.id].status !== "draft") job[p.id] = ps[p.id];
  });
  return job;
}

export function appJobToDb(job, jdResult, selPortals) {
  const portal_status = {};
  PORTALS.forEach((p) => {
    const cur = job?.[p.id];
    portal_status[p.id] =
      cur ||
      (selPortals?.includes(p.id)
        ? { status: "live", applicants: 0, views: 0 }
        : { status: "draft", applicants: 0, views: 0 });
  });
  return {
    title: job.title,
    dept: job.dept || "General",
    location: job.location || "Remote",
    type: job.type || "Full-time",
    exp: job.exp,
    salary: job.salary,
    jd: jdResult?.jd ?? job.jd,
    jd_linkedin: jdResult?.linkedinJD ?? null,
    jd_indeed: jdResult?.indeedJD ?? null,
    jd_jobhai: jdResult?.jobhaiJD ?? null,
    jd_apna: jdResult?.apnaJD ?? null,
    skills: jdResult?.skills ?? job.skills ?? [],
    portal_status,
    posted_date: job.postedDate || new Date().toISOString().split("T")[0],
  };
}

export function dbApplicantToApp(row) {
  if (!row) return null;
  return {
    id: row.id,
    jobId: row.job_id,
    name: row.full_name,
    email: row.email,
    phone: row.phone,
    portal: row.portal,
    resume_path: row.resume_path,
    resume_text: row.resume_text,
    stage: row.stage || "new",
    score: row.ai_score ?? 0,
    shortlisted: row.shortlisted ?? false,
    screening_notes: row.screening_notes,
    appliedDate: row.applied_at,
    // Structured profile — populated by the public /apply.html form, null on
    // applicants that arrived from a portal or were keyed in by hand.
    designation: row.designation,
    department: row.department,
    location: row.location,
    industry: row.industry,
    experienceYears: row.total_experience_years,
    skills: Array.isArray(row.skills) ? row.skills : [],
    currentCtc: row.current_ctc,
    expectedCtc: row.expected_ctc,
    noticePeriod: row.notice_period,
  };
}
