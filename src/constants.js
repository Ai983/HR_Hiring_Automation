// ── Constants ─────────────────────────────────────────────────────────────────

export const STAGES = [
  "new", "screening", "calling", "interview", "reference", "offer", "hired", "onboarding", "rejected",
];

export const STAGE_META = {
  new:        { label: "New",        color: "#6366f1", bg: "rgba(99,102,241,0.08)" },
  screening:  { label: "Screening",  color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
  calling:    { label: "Calling",    color: "#0ea5e9", bg: "rgba(14,165,233,0.08)" },
  interview:  { label: "Interview",  color: "#8b5cf6", bg: "rgba(139,92,246,0.08)" },
  reference:  { label: "Reference",  color: "#f97316", bg: "rgba(249,115,22,0.08)" },
  offer:      { label: "Offer",      color: "#22c55e", bg: "rgba(34,197,94,0.08)" },
  hired:      { label: "Hired",      color: "#10b981", bg: "rgba(16,185,129,0.08)" },
  onboarding: { label: "Onboarding", color: "#14b8a6", bg: "rgba(20,184,166,0.08)" },
  rejected:   { label: "Rejected",   color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
};

export const STATUS_META = {
  draft:  { label: "Draft",  color: "#8a7e72", bg: "#f0ece5" },
  live:   { label: "Live",   color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  paused: { label: "Paused", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  closed: { label: "Closed", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};

export const DEPTS = ["Engineering", "Product", "Design", "Marketing", "Sales", "Analytics", "Operations", "HR", "Finance", "Legal"];
export const TYPES = ["Full-time", "Part-time", "Contract", "Internship"];
export const EXPS = ["0–1 years", "1–3 years", "3–5 years", "5–8 years", "8+ years"];

// Job roles shown in dropdowns (Upload resume, Questionnaire)
export const JOB_ROLES = [
  "Interior Designer",
  "Senior Interior Designer",
  "Civil Engineer",
  "Site Engineer",
  "Site Manager",
  "Tender Executive",
  "Project Manager",
  "Procurement Executive",
  "Site Engineer [Facade]",
  "Designer [Facade]",
  "Operation Manager [Facade]",
  "AI Specialist",
  "HR Recruiter",
  "Sales Manager",
];

export const PORTALS = [
  { id: "linkedin",  label: "LinkedIn",  color: "#0a66c2", bg: "rgba(10,102,194,0.08)", chipCls: "sel-li", postUrl: "https://www.linkedin.com/jobs/post/" },
  { id: "indeed",    label: "Indeed",    color: "#2b64e1", bg: "rgba(43,100,225,0.08)", chipCls: "sel-in", postUrl: "https://employers.indeed.com/jobposting" },
  { id: "jobhai",    label: "JobHai",    color: "#059669", bg: "rgba(5,150,105,0.08)",  chipCls: "sel-jh", postUrl: "https://jobhai.com/post-a-job" },
  { id: "apna",      label: "Apna",      color: "#7c3aed", bg: "rgba(124,58,237,0.08)", chipCls: "sel-ap", postUrl: "https://apna.co/business/postjob" },
  { id: "facebook",  label: "Facebook",  color: "#1877f2", bg: "rgba(24,119,242,0.08)", chipCls: "sel-fb", autoPost: true },
  { id: "instagram", label: "Instagram", color: "#e1306c", bg: "rgba(225,48,108,0.08)", chipCls: "sel-ig", autoPost: true },
];

// Source metadata used for applicant source badges (all channels)
export const SOURCE_META = {
  linkedin:  { label: "LinkedIn",  color: "#0a66c2", bg: "rgba(10,102,194,0.10)" },
  indeed:    { label: "Indeed",    color: "#2b64e1", bg: "rgba(43,100,225,0.10)" },
  jobhai:    { label: "JobHai",    color: "#059669", bg: "rgba(5,150,105,0.10)"  },
  apna:      { label: "Apna",      color: "#7c3aed", bg: "rgba(124,58,237,0.10)" },
  email:     { label: "Email",     color: "#ea4335", bg: "rgba(234,67,53,0.10)"  },
  whatsapp:  { label: "WhatsApp",  color: "#128c7e", bg: "rgba(18,140,126,0.10)" },
  facebook:  { label: "Facebook",  color: "#1877f2", bg: "rgba(24,119,242,0.10)" },
  instagram: { label: "Instagram", color: "#e1306c", bg: "rgba(225,48,108,0.10)" },
  manual:    { label: "Manual",    color: "#8a7e72", bg: "rgba(138,126,114,0.10)"},
};

export const SURVEY_SOURCES = [
  { id: "facebook",  label: "Facebook",  color: "#1877f2", bg: "rgba(24,119,242,0.08)" },
  { id: "instagram", label: "Instagram", color: "#e1306c", bg: "rgba(225,48,108,0.08)" },
  { id: "apna",      label: "Apna",      color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
  { id: "linkedin",  label: "LinkedIn",  color: "#0a66c2", bg: "rgba(10,102,194,0.08)" },
  { id: "direct",    label: "Walk-in",   color: "#0f766e", bg: "rgba(15,118,110,0.08)" },
];

export const AI_RECOMMENDATIONS = {
  strong_recommend: { label: "Strong ★",  color: "#10b981", bg: "rgba(16,185,129,0.1)"  },
  recommend:        { label: "Recommend", color: "#22c55e", bg: "rgba(34,197,94,0.1)"   },
  borderline:       { label: "Borderline",color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  reject:           { label: "Reject",    color: "#ef4444", bg: "rgba(239,68,68,0.1)"   },
};

// ── Seed Data (used when Supabase not configured) ────────────────────────────
export const SEED_JOBS = [
  {
    id: "j1", title: "Senior Frontend Engineer", dept: "Engineering", location: "Remote",
    type: "Full-time", exp: "3-5 years", salary: "$90k-$120k",
    jd: "We are looking for a Senior Frontend Engineer to join our growing product team. You will own the UI architecture, collaborate with designers and backend engineers, and deliver exceptional user experiences at scale.",
    skills: ["React", "TypeScript", "GraphQL", "CSS-in-JS", "Testing"],
    postedDate: "2026-03-01",
    linkedin: { status: "live", applicants: 18, views: 310 },
    indeed:   { status: "live", applicants: 11, views: 204 },
  },
  {
    id: "j2", title: "Product Manager", dept: "Product", location: "New York, NY",
    type: "Full-time", exp: "5-8 years", salary: "$110k-$140k",
    jd: "Own the product roadmap for our core platform. Work cross-functionally with engineering, design, data, and go-to-market teams to define, ship, and iterate on high-impact features.",
    skills: ["Roadmapping", "Stakeholder Mgmt", "SQL", "Figma", "Agile"],
    postedDate: "2026-03-06",
    linkedin: { status: "live", applicants: 9,  views: 175 },
    indeed:   { status: "paused", applicants: 3, views: 62 },
  },
  {
    id: "j3", title: "Data Analyst", dept: "Analytics", location: "Austin, TX",
    type: "Full-time", exp: "1-3 years", salary: "$70k-$90k",
    jd: "Translate complex datasets into clear insights that drive business decisions. Partner with product and engineering teams to define KPIs and build dashboards.",
    skills: ["SQL", "Python", "Tableau", "Excel", "Statistics"],
    postedDate: "2026-03-10",
    linkedin: { status: "live", applicants: 5,  views: 98 },
    jobhai:   { status: "live", applicants: 3,  views: 45 },
    apna:     { status: "live", applicants: 2,  views: 30 },
  },
];

export const SEED_APPLICANTS = [
  { id: "a1", jobId: "j1", name: "Ravi Patel",      email: "ravi@email.com",     portal: "linkedin", stage: "interview", score: 92, appliedDate: "2026-03-03", shortlisted: true, screening_notes: "Strong React & TS. 6 yrs experience. Great culture fit." },
  { id: "a2", jobId: "j1", name: "Aisha Nwosu",     email: "aisha@email.com",    portal: "linkedin", stage: "screening", score: 85, appliedDate: "2026-03-05", shortlisted: true, screening_notes: "Solid frontend skills. Needs more GraphQL depth." },
  { id: "a3", jobId: "j1", name: "Tom Chen",         email: "tom@email.com",      portal: "indeed",   stage: "new",       score: 60, appliedDate: "2026-03-07", shortlisted: false, screening_notes: "Junior-level. Consider for a different role." },
  { id: "a4", jobId: "j2", name: "Priya Sharma",     email: "priya@email.com",    portal: "linkedin", stage: "offer",     score: 95, appliedDate: "2026-03-07", shortlisted: true, screening_notes: "Exceptional PM. Led 3 product launches. Highly recommend." },
  { id: "a5", jobId: "j2", name: "Marcus Johnson",   email: "marcus@email.com",   portal: "indeed",   stage: "screening", score: 72, appliedDate: "2026-03-08", shortlisted: false, screening_notes: "Good communication but limited product experience." },
  { id: "a6", jobId: "j3", name: "Sara Ahmed",       email: "sara@email.com",     portal: "jobhai",   stage: "new",       score: 0,  appliedDate: "2026-03-11" },
  { id: "a7", jobId: "j3", name: "Amit Desai",       email: "amit@email.com",     portal: "apna",     stage: "new",       score: 0,  appliedDate: "2026-03-12" },
  { id: "a8", jobId: "j1", name: "Elena Rodriguez",  email: "elena@email.com",    portal: "linkedin", stage: "hired",     score: 88, appliedDate: "2026-03-02", shortlisted: true, screening_notes: "Excellent all-round frontend engineer. Strong testing culture." },
];
