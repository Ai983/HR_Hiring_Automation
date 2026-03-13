import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
// Prefer generated file (written by vite.config from .env); fallback to define-injected env.js
import { VITE_SUPABASE_URL as supabaseUrl, VITE_SUPABASE_ANON_KEY as supabaseAnon } from "./src/env.generated.js";

const supabase = supabaseUrl && supabaseAnon ? createClient(supabaseUrl, supabaseAnon) : null;

// ─── Seed Data (used when Supabase not configured) ─────────────────────────────
const SEED_JOBS = [
  {
    id: "j1", title: "Senior Frontend Engineer", dept: "Engineering", location: "Remote",
    type: "Full-time", exp: "3–5 years", salary: "$90k–$120k",
    jd: "We are looking for a Senior Frontend Engineer to join our growing product team. You will own the UI architecture, collaborate with designers and backend engineers, and deliver exceptional user experiences at scale.",
    skills: ["React", "TypeScript", "GraphQL", "CSS-in-JS", "Testing"],
    postedDate: "2026-03-01",
    linkedin: { status: "live", applicants: 18, views: 310 },
    indeed:   { status: "live", applicants: 11, views: 204 },
  },
  {
    id: "j2", title: "Product Manager", dept: "Product", location: "New York, NY",
    type: "Full-time", exp: "5–8 years", salary: "$110k–$140k",
    jd: "Own the product roadmap for our core platform. Work cross-functionally with engineering, design, data, and go-to-market teams to define, ship, and iterate on high-impact features.",
    skills: ["Roadmapping", "Stakeholder Mgmt", "SQL", "Figma", "Agile"],
    postedDate: "2026-03-06",
    linkedin: { status: "live", applicants: 9,  views: 175 },
    indeed:   { status: "paused", applicants: 3, views: 62 },
  },
  {
    id: "j3", title: "Data Analyst", dept: "Analytics", location: "Austin, TX",
    type: "Full-time", exp: "1–3 years", salary: "$70k–$90k",
    jd: "Analyse large datasets to surface actionable insights for leadership. Build dashboards, run ad-hoc queries, and partner with product teams to drive data-informed decisions.",
    skills: ["SQL", "Python", "Tableau", "dbt", "A/B Testing"],
    postedDate: "2026-02-22",
    linkedin: { status: "closed", applicants: 34, views: 520 },
    indeed:   { status: "closed", applicants: 29, views: 488 },
  },
];

const SEED_APPLICANTS = [
  { id: "a1", jobId: "j1", name: "Aisha Nwosu",    portal: "linkedin", stage: "screening",  appliedDate: "2026-03-03", email: "aisha@email.com",   score: 92 },
  { id: "a2", jobId: "j1", name: "Carlos Reyes",   portal: "indeed",   stage: "interview",  appliedDate: "2026-03-04", email: "carlos@email.com",  score: 87 },
  { id: "a3", jobId: "j1", name: "Mei Zhang",      portal: "linkedin", stage: "new",        appliedDate: "2026-03-08", email: "mei@email.com",     score: 78 },
  { id: "a4", jobId: "j1", name: "Ravi Patel",     portal: "linkedin", stage: "offer",      appliedDate: "2026-03-02", email: "ravi@email.com",    score: 95 },
  { id: "a5", jobId: "j2", name: "Sofia Berger",   portal: "linkedin", stage: "screening",  appliedDate: "2026-03-07", email: "sofia@email.com",   score: 83 },
  { id: "a6", jobId: "j2", name: "James Okafor",   portal: "indeed",   stage: "new",        appliedDate: "2026-03-09", email: "james@email.com",   score: 71 },
  { id: "a7", jobId: "j3", name: "Priya Sharma",   portal: "indeed",   stage: "hired",      appliedDate: "2026-02-25", email: "priya@email.com",   score: 96 },
  { id: "a8", jobId: "j3", name: "Tom Whitfield",  portal: "linkedin", stage: "rejected",   appliedDate: "2026-02-24", email: "tom@email.com",     score: 55 },
];

const STAGES = ["new", "screening", "interview", "offer", "hired", "rejected"];
const STAGE_META = {
  new:       { label: "New",       color: "#64748b", bg: "rgba(100,116,139,0.12)" },
  screening: { label: "Screening", color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  interview: { label: "Interview", color: "#3b82f6", bg: "rgba(59,130,246,0.12)"  },
  offer:     { label: "Offer",     color: "#a855f7", bg: "rgba(168,85,247,0.12)"  },
  hired:     { label: "Hired",     color: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
  rejected:  { label: "Rejected",  color: "#ef4444", bg: "rgba(239,68,68,0.12)"   },
};
const STATUS_META = {
  live:   { label: "Live",   color: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
  paused: { label: "Paused", color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  closed: { label: "Closed", color: "#64748b", bg: "rgba(100,116,139,0.12)" },
  draft:  { label: "Draft",  color: "#94a3b8", bg: "rgba(148,163,184,0.1)"  },
};

const DEPTS = ["Design","Procurement","Finance","Sales","Site Team","Execution Team","AI Team"];
const TYPES = ["Full-time","Part-time","Contract","Internship","Freelance"];
const EXPS  = ["0–1 years","1–3 years","3–5 years","5–8 years","8+ years","Any"];
// Job roles shown in Upload resume dropdown (always available; job is found or created)
const JOB_ROLES = ["Interior Designer", "Site Engineer", "Tender Estimation", "Project Manager"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid  = () => Math.random().toString(36).slice(2, 9);
const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const PORTALS = [
  { id: "linkedin", label: "LinkedIn",  color: "#0a66c2", bg: "rgba(10,102,194,0.1)",  chipCls: "sel-li" },
  { id: "indeed",   label: "Indeed",    color: "#2b64e1", bg: "rgba(43,100,225,0.1)",  chipCls: "sel-in" },
  { id: "jobhai",   label: "JobHai",   color: "#059669", bg: "rgba(5,150,105,0.1)",   chipCls: "sel-jh" },
  { id: "apna",     label: "Apna",     color: "#7c3aed", bg: "rgba(124,58,237,0.1)",   chipCls: "sel-ap" },
];
const totalApplicants = (job) => PORTALS.reduce((n, p) => n + (job[p.id]?.applicants || 0), 0);
const totalViews      = (job) => PORTALS.reduce((n, p) => n + (job[p.id]?.views || 0), 0);

function dbJobToApp(row) {
  if (!row) return null;
  const ps = row.portal_status || {};
  return {
    id: row.id,
    title: row.title,
    dept: row.dept,
    location: row.location,
    type: row.type || "Full-time",
    exp: row.exp,
    salary: row.salary,
    jd: row.jd,
    skills: row.skills || [],
    postedDate: row.posted_date,
    linkedin: ps.linkedin ? { status: ps.linkedin.status || "draft", applicants: ps.linkedin.applicants ?? 0, views: ps.linkedin.views ?? 0 } : null,
    indeed:   ps.indeed   ? { status: ps.indeed.status || "draft",   applicants: ps.indeed.applicants ?? 0,   views: ps.indeed.views ?? 0 } : null,
    jobhai:   ps.jobhai   ? { status: ps.jobhai.status || "draft",   applicants: ps.jobhai.applicants ?? 0,   views: ps.jobhai.views ?? 0 } : null,
    apna:     ps.apna     ? { status: ps.apna.status || "draft",     applicants: ps.apna.applicants ?? 0,     views: ps.apna.views ?? 0 } : null,
  };
}

function appJobToDb(job, jdResult, selPortals) {
  const portal_status = {};
  PORTALS.forEach(p => {
    const cur = job?.[p.id];
    portal_status[p.id] = cur || (selPortals?.includes(p.id) ? { status: "live", applicants: 0, views: 0 } : { status: "draft", applicants: 0, views: 0 });
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

function dbApplicantToApp(row) {
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
  };
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function HireFlow() {
  const [jobs, setJobs]             = useState([]);   // Start empty for testing; load from Supabase if configured
  const [applicants, setApplicants] = useState([]);
  const [panel, setPanel]           = useState("dashboard"); // dashboard | post | jobs | applicants
  const [selectedJob, setSelectedJob] = useState(null);      // job id for applicants panel
  const [toast, setToast]           = useState(null);
  const [modal, setModal]           = useState(null);        // { type: 'jobDetail' | 'applicant', data }
  const [loading, setLoading]       = useState(!!supabase);

  // post-job form
  const [form, setForm]   = useState({ title:"", dept:"", location:"", type:"Full-time", exp:"1–3 years", salary:"", extraNotes:"" });
  const [jdPaste, setJdPaste]       = useState("");         // pasted or extracted JD text
  const [jdFile, setJdFile]         = useState(null);        // uploaded JD file (PDF/DOCX)
  const [jdResult, setJdResult] = useState(null);            // { jd, skills, linkedinJD, indeedJD, jobhaiJD, apnaJD }
  const [selPortals, setSelPortals] = useState(["linkedin","indeed"]);
  const [genLoading, setGenLoading] = useState(false);
  const [postLoading, setPostLoading] = useState(false);
  const [postStatus, setPostStatus]   = useState({});        // { linkedin: 'pending'|'done', ... }
  const [postDone, setPostDone]       = useState(false);

  // resume upload
  const [resumeModal, setResumeModal] = useState(false);      // { jobId } or false
  const [resumeForm, setResumeForm] = useState({ full_name: "", email: "", phone: "", portal: "linkedin" });
  const [resumeUploadJd, setResumeUploadJd] = useState("");    // optional JD for AI screening (paste in upload modal)
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeExtracting, setResumeExtracting] = useState(false);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [screeningAppId, setScreeningAppId] = useState(null);
  const [screeningInProgress, setScreeningInProgress] = useState(null);

  // Load from Supabase
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data: jobsRows } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
      const { data: appRows } = await supabase.from("applicants").select("*").order("applied_at", { ascending: false });
      if (jobsRows) setJobs(jobsRows.map(dbJobToApp));
      if (appRows) setApplicants(appRows.map(dbApplicantToApp));
      setLoading(false);
    })();
  }, []);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  };

  // Clear all jobs and applicants (for testing)
  const clearAllData = async () => {
    if (!window.confirm("Clear all jobs and applicants? This cannot be undone.")) return;
    if (supabase) {
      const zero = "00000000-0000-0000-0000-000000000000";
      await supabase.from("applicants").delete().or(`id.eq.${zero},id.neq.${zero}`);
      await supabase.from("jobs").delete().or(`id.eq.${zero},id.neq.${zero}`);
    }
    setJobs([]);
    setApplicants([]);
    setSelectedJob(null);
    setModal(null);
    setResumeModal(false);
    showToast("All data cleared. You can test from scratch.");
  };

  // ── Generate JD (enhance with AI using uploaded/pasted JD + form) ─────────────
  const generateJD = async () => {
    if (!form.title.trim()) return showToast("Enter a job title first.", false);

    let jdInput = (jdPaste || form.extraNotes || "").trim();
    if (!jdInput && jdFile) {
      setGenLoading(true);
      try {
        jdInput = (await extractResumeText(jdFile)).trim();
        if (jdInput) setJdPaste(jdInput);
      } catch (e) {
        setGenLoading(false);
        return showToast("Could not read text from the uploaded file. Try pasting the JD instead.", false);
      }
      if (!jdInput) {
        setGenLoading(false);
        return showToast("No text found in the file. Try pasting the JD or use a different file.", false);
      }
    }
    if (!jdInput) return showToast("Paste your JD above or upload a PDF/DOCX file (we'll extract the text).", false);

    setGenLoading(true);
    setJdResult(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are a world-class HR copywriter. Reply ONLY with a single valid JSON object — no markdown fences, no preamble. Shape:
{"jd":"<base JD, 120-150 words, professional>","skills":["skill1","skill2","skill3","skill4","skill5","skill6"],"linkedinJD":"<LinkedIn version: professional, story-driven, 100 words>","indeedJD":"<Indeed version: direct, keyword-dense, 100 words>","jobhaiJD":"<JobHai version: clear, role-focused, 100 words>","apnaJD":"<Apna version: concise, opportunity-focused, 100 words>"}`,
          messages: [{
            role: "user",
            content: `Job Title: ${form.title}
Department: ${form.dept || "Not specified"}
Location: ${form.location || "Not specified"}
Type: ${form.type}
Experience: ${form.exp}
Salary: ${form.salary || "Competitive"}
Extra context: ${form.extraNotes || "none"}

HR's JD (use this as the main content to refine and enhance):
---
${jdInput.slice(0, 4000)}
---

Generate the enhanced JD and portal-specific versions (LinkedIn, Indeed, JobHai, Apna) now.`
          }]
        })
      });
      const data = await res.json();
      const raw = data.content?.find(b => b.type === "text")?.text || "";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setJdResult(parsed);
      showToast("JD enhanced for all 4 portals ✓");
    } catch {
      showToast("Generation failed — please try again.", false);
    }
    setGenLoading(false);
  };

  // ── Post to portals (save job; AI-enhanced JDs ready to copy to each portal) ─
  const postJob = async () => {
    if (!jdResult) return showToast("Enhance JD with AI first.", false);
    if (!selPortals.length) return showToast("Select at least one portal.", false);
    setPostLoading(true);
    setPostDone(false);
    const prog = {};
    selPortals.forEach(p => prog[p] = "pending");
    setPostStatus({ ...prog });

    for (const p of selPortals) {
      await new Promise(r => setTimeout(r, 400 + Math.random() * 400));
      setPostStatus(prev => ({ ...prev, [p]: "done" }));
    }

    const newAppJob = {
      title: form.title, dept: form.dept || "General",
      location: form.location || "Remote", type: form.type,
      exp: form.exp, salary: form.salary,
      postedDate: new Date().toISOString().split("T")[0],
      linkedin: selPortals.includes("linkedin") ? { status: "live", applicants: 0, views: 0 } : null,
      indeed:   selPortals.includes("indeed")   ? { status: "live", applicants: 0, views: 0 } : null,
      jobhai:   selPortals.includes("jobhai")   ? { status: "live", applicants: 0, views: 0 } : null,
      apna:     selPortals.includes("apna")     ? { status: "live", applicants: 0, views: 0 } : null,
      jd: jdResult.jd, skills: jdResult.skills,
    };

    if (supabase) {
      const dbRow = appJobToDb(newAppJob, jdResult, selPortals);
      const { data: inserted, error } = await supabase.from("jobs").insert(dbRow).select("id, title, dept, location, type, exp, salary, jd, skills, portal_status, posted_date").single();
      if (error) { setPostLoading(false); return showToast("Failed to save job: " + error.message, false); }
      setJobs(prev => [dbJobToApp(inserted), ...prev]);
    } else {
      setJobs(prev => [{ ...newAppJob, id: uid() }, ...prev]);
    }
    setPostDone(true);
    setPostLoading(false);
    showToast(`"${form.title}" saved. Copy enhanced JDs to LinkedIn, Indeed, JobHai, Apna from the tabs.`);
  };

  const resetPostForm = () => {
    setForm({ title:"", dept:"", location:"", type:"Full-time", exp:"1–3 years", salary:"", extraNotes:"" });
    setJdPaste(""); setJdFile(null); setJdResult(null); setSelPortals(["linkedin","indeed"]);
    setPostStatus({}); setPostDone(false);
  };

  // ── Derived stats ───────────────────────────────────────────────────────────
  const totalJobs     = jobs.length;
  const liveJobs      = jobs.filter(j => PORTALS.some(p => j[p.id]?.status === "live")).length;
  const totalApps     = applicants.length;
  const hiredCount    = applicants.filter(a => a.stage === "hired").length;
  const openRoles     = jobs.filter(j => PORTALS.some(p => j[p.id]?.status === "live"));
  const jobApplicants = (id) => applicants.filter(a => a.jobId === id);

  // ── Move applicant stage (Kanban – persist to Supabase) ───────────────────────
  const moveStage = async (appId, newStage) => {
    setApplicants(prev => prev.map(a => a.id === appId ? { ...a, stage: newStage } : a));
    if (supabase) {
      await supabase.from("applicants").update({ stage: newStage }).eq("id", appId);
    }
  };

  // ── Toggle portal status (persist to Supabase) ───────────────────────────────
  const togglePortalStatus = async (jobId, portal) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const cur = job[portal]?.status;
    const next = cur === "live" ? "paused" : cur === "paused" ? "live" : cur;
    setJobs(prev => prev.map(j => {
      if (j.id !== jobId) return j;
      return { ...j, [portal]: { ...j[portal], status: next } };
    }));
    if (supabase) {
      const ps = {
        linkedin: job.linkedin || { status: "draft", applicants: 0, views: 0 },
        indeed: job.indeed || { status: "draft", applicants: 0, views: 0 },
        jobhai: job.jobhai || { status: "draft", applicants: 0, views: 0 },
        apna: job.apna || { status: "draft", applicants: 0, views: 0 },
      };
      ps[portal] = { ...ps[portal], ...job[portal], status: next };
      await supabase.from("jobs").update({ portal_status: ps }).eq("id", jobId);
    }
  };

  // ── Extract text from resume file (PDF/DOCX) in browser ─────────────────────
  const extractResumeText = async (file) => {
    const type = file.type || "";
    if (type.includes("pdf")) {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.mjs`;
      const arr = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument(arr).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(it => it.str).join(" ") + "\n";
      }
      return text.trim();
    }
    if (type.includes("wordprocessingml") || type.includes("msword") || file.name?.toLowerCase().endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const arr = await file.arrayBuffer();
      const { value } = await mammoth.extractRawText({ arrayBuffer: arr });
      return (value || "").trim();
    }
    return "";
  };

  // ── Resolve job id for upload: if "role:Title" then find or create job ─────────
  const resolveJobIdForUpload = async (rawJobId) => {
    if (!rawJobId) return null;
    if (rawJobId.startsWith("role:")) {
      const title = rawJobId.slice(5);
      const existing = jobs.find(j => j.title === title);
      if (existing) return existing.id;
      if (!supabase) return null;
      const portal_status = {};
      PORTALS.forEach(p => { portal_status[p.id] = { status: "draft", applicants: 0, views: 0 }; });
      const dbRow = {
        title,
        dept: "General",
        location: "",
        type: "Full-time",
        exp: "",
        salary: "",
        jd: resumeUploadJd?.trim() || null,
        skills: [],
        portal_status,
        posted_date: new Date().toISOString().split("T")[0],
      };
      const { data: inserted, error } = await supabase.from("jobs").insert(dbRow).select("id").single();
      if (error) throw new Error(error.message);
      setJobs(prev => [dbJobToApp({ ...inserted, ...dbRow, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }), ...prev]);
      return inserted.id;
    }
    return rawJobId;
  };

  // ── Upload resume (HR): store file in bucket, create applicant, then screen ───
  const uploadResume = async () => {
    const rawJobId = resumeModal?.jobId || selectedJob;
    if (!rawJobId) return showToast("Select a job/role first.", false);
    if (!resumeForm.full_name?.trim() || !resumeForm.email?.trim()) return showToast("Name and email required.", false);
    if (!resumeFile) return showToast("Select a resume file (PDF or DOCX).", false);
    setResumeUploading(true);
    setResumeExtracting(true);
    try {
      const jobId = await resolveJobIdForUpload(rawJobId);
      if (!jobId) return showToast("Could not resolve job. Select a role or post a job first.", false);
      // If they pasted JD and selected an existing job, update that job's JD for screening
      if (supabase && resumeUploadJd?.trim() && rawJobId === jobId && !rawJobId.startsWith("role:")) {
        await supabase.from("jobs").update({ jd: resumeUploadJd.trim() }).eq("id", jobId);
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, jd: resumeUploadJd.trim() } : j));
      }
      let resumeText = await extractResumeText(resumeFile);
      setResumeExtracting(false);
      const ext = resumeFile.name.split(".").pop() || "pdf";
      const path = `${jobId}/${crypto.randomUUID()}.${ext}`;
      if (supabase) {
        const { error: upErr } = await supabase.storage.from("resumes").upload(path, resumeFile, { upsert: false });
        if (upErr) throw new Error(upErr.message);
        const { data: appRow, error: insErr } = await supabase.from("applicants").insert({
          job_id: jobId,
          full_name: resumeForm.full_name.trim(),
          email: resumeForm.email.trim(),
          phone: resumeForm.phone?.trim() || null,
          portal: resumeForm.portal,
          resume_path: path,
          resume_text: resumeText || null,
          stage: "new",
        }).select("id").single();
        if (insErr) throw new Error(insErr.message);
        const newApp = await supabase.from("applicants").select("*").eq("id", appRow.id).single();
        setApplicants(prev => [dbApplicantToApp(newApp.data), ...prev]);
        setResumeModal(false);
        setResumeForm({ full_name: "", email: "", phone: "", portal: "linkedin" });
        setResumeUploadJd("");
        setResumeFile(null);
        if (!resumeText?.trim()) showToast("Resume saved. No text extracted – AI screening may not work; use a PDF/DOCX with selectable text.", false);
        else showToast("Resume uploaded. Open the applicant card and click Screen with AI to get a score.");
        setScreeningAppId(appRow.id);
      } else {
        setApplicants(prev => [{ id: uid(), jobId, name: resumeForm.full_name, email: resumeForm.email, phone: resumeForm.phone, portal: resumeForm.portal, stage: "new", score: 0, appliedDate: new Date().toISOString().split("T")[0] }, ...prev]);
        setResumeModal(false);
        showToast("Resume added (Supabase not connected).");
      }
    } catch (e) {
      showToast(e.message || "Upload failed.", false);
    }
    setResumeUploading(false);
    setResumeExtracting(false);
  };

  // ── Screen applicant with OpenAI (Edge Function) ───────────────────────────
  const screenApplicant = async (appId) => {
    if (!supabaseUrl || !supabaseAnon) return showToast("Supabase not configured.", false);
    const app = applicants.find(a => a.id === appId);
    if (app && !app.resume_text?.trim()) return showToast("No resume text to screen. Re-upload a PDF or DOCX with selectable text.", false);
    setScreeningInProgress(appId);
    const url = `${supabaseUrl}/functions/v1/screen-resume`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseAnon}` },
        body: JSON.stringify({ applicant_id: appId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Screening failed");
      if (app) setApplicants(prev => prev.map(a => a.id === appId ? { ...a, score: data.score, shortlisted: data.shortlisted, screening_notes: data.screening_notes } : a));
      showToast(data.shortlisted ? "Shortlisted – " + (data.screening_notes || "").slice(0, 60) : "Scored " + data.score + " – " + (data.screening_notes || "").slice(0, 60));
      setModal(null);
      setScreeningAppId(null);
    } catch (e) {
      showToast(e.message || "Screening failed.", false);
    } finally {
      setScreeningInProgress(null);
    }
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&family=Nunito:wght@300;400;500;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#f7f4ef;}
    ::-webkit-scrollbar{width:5px;height:5px;}
    ::-webkit-scrollbar-track{background:#ede8e0;}
    ::-webkit-scrollbar-thumb{background:#c4bdb2;border-radius:4px;}
    .app{display:flex;min-height:100vh;background:#f7f4ef;font-family:'Nunito',sans-serif;}
    /* Sidebar */
    .sidebar{width:220px;min-width:220px;background:#1a1612;display:flex;flex-direction:column;padding:28px 0;position:sticky;top:0;height:100vh;}
    .sidebar-logo{padding:0 22px 28px;border-bottom:1px solid #2e2925;}
    .logo-mark{display:flex;align-items:center;gap:10px;}
    .logo-icon{width:34px;height:34px;background:linear-gradient(135deg,#e8a24a,#c97a2a);border-radius:9px;display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-weight:700;font-size:16px;color:#1a1612;}
    .logo-text{font-family:'Fraunces',serif;font-weight:700;font-size:18px;color:#f5f0e8;letter-spacing:-0.3px;}
    .sidebar-nav{padding:18px 12px;flex:1;display:flex;flex-direction:column;gap:4px;}
    .nav-item{display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:9px;cursor:pointer;font-size:13.5px;font-weight:500;color:#8a7e72;transition:all 0.18s;border:none;background:none;width:100%;text-align:left;}
    .nav-item:hover{background:#2a241e;color:#e8ddd0;}
    .nav-item.active{background:#2e2720;color:#e8a24a;font-weight:600;}
    .nav-item .nav-icon{font-size:16px;width:20px;text-align:center;}
    .nav-badge{margin-left:auto;background:#e8a24a;color:#1a1612;border-radius:20px;padding:1px 8px;font-size:11px;font-weight:700;}
    .sidebar-footer{padding:18px 22px 0;border-top:1px solid #2e2925;}
    .user-pill{display:flex;align-items:center;gap:10px;}
    .user-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#e8a24a,#d4845a);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#1a1612;}
    .user-name{font-size:13px;font-weight:600;color:#c8b89a;}
    .user-role{font-size:11px;color:#5a5048;}
    /* Main area */
    .main{flex:1;overflow-y:auto;padding:32px 36px;}
    .page-title{font-family:'Fraunces',serif;font-weight:700;font-size:26px;color:#1a1612;letter-spacing:-0.5px;margin-bottom:4px;}
    .page-sub{font-size:13px;color:#8a7e72;margin-bottom:28px;}
    /* Cards */
    .card{background:#fff;border-radius:14px;border:1px solid #e8e2d9;padding:22px;}
    .card-sm{background:#fff;border-radius:12px;border:1px solid #e8e2d9;padding:16px 18px;}
    /* Stat row */
    .stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;}
    .stat-card{background:#fff;border:1px solid #e8e2d9;border-radius:14px;padding:20px;position:relative;overflow:hidden;}
    .stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;}
    .stat-card.s1::before{background:linear-gradient(90deg,#e8a24a,#f0c070);}
    .stat-card.s2::before{background:linear-gradient(90deg,#0a66c2,#5ba4f5);}
    .stat-card.s3::before{background:linear-gradient(90deg,#22c55e,#4ade80);}
    .stat-card.s4::before{background:linear-gradient(90deg,#a855f7,#c084fc);}
    .stat-val{font-family:'Fraunces',serif;font-size:32px;font-weight:700;color:#1a1612;line-height:1;}
    .stat-lbl{font-size:12px;color:#8a7e72;margin-top:6px;font-weight:500;}
    /* Job list */
    .job-row{background:#fff;border:1px solid #e8e2d9;border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:16px;margin-bottom:10px;transition:box-shadow 0.18s;cursor:pointer;}
    .job-row:hover{box-shadow:0 4px 16px rgba(26,22,18,0.07);}
    .job-title{font-weight:700;font-size:15px;color:#1a1612;font-family:'Fraunces',serif;}
    .job-meta{font-size:12px;color:#8a7e72;margin-top:2px;}
    /* Portal badge */
    .portal-li{display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:20px;font-size:12px;font-weight:600;}
    .portal-li.linkedin{background:rgba(10,102,194,0.1);color:#0a66c2;}
    .portal-li.indeed{background:rgba(43,100,225,0.1);color:#2b64e1;}
    /* Tags */
    .tag{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;}
    /* Form */
    .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
    .form-field{display:flex;flex-direction:column;gap:6px;}
    .form-label{font-size:12px;font-weight:600;color:#5a5048;text-transform:uppercase;letter-spacing:0.5px;}
    .form-input{background:#faf8f5;border:1.5px solid #e0d9cf;border-radius:9px;padding:10px 14px;font-family:'Nunito',sans-serif;font-size:14px;color:#1a1612;outline:none;transition:border 0.18s;}
    .form-input:focus{border-color:#c97a2a;background:#fff;}
    .form-input::placeholder{color:#b0a898;}
    textarea.form-input{resize:vertical;min-height:90px;line-height:1.6;}
    select.form-input option{background:#fff;}
    /* Buttons */
    .btn-gold{background:linear-gradient(135deg,#e8a24a,#c97a2a);border:none;border-radius:10px;color:#1a1612;padding:11px 22px;font-family:'Nunito',sans-serif;font-weight:700;font-size:14px;cursor:pointer;transition:all 0.2s;display:inline-flex;align-items:center;gap:8px;}
    .btn-gold:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(201,122,42,0.3);}
    .btn-gold:disabled{opacity:0.6;cursor:not-allowed;transform:none;}
    .btn-outline{background:#fff;border:1.5px solid #ddd6ca;border-radius:10px;color:#5a5048;padding:10px 18px;font-family:'Nunito',sans-serif;font-weight:600;font-size:13px;cursor:pointer;transition:all 0.18s;}
    .btn-outline:hover{border-color:#c97a2a;color:#c97a2a;}
    .btn-ghost{background:none;border:none;cursor:pointer;font-family:'Nunito',sans-serif;font-size:13px;color:#8a7e72;padding:6px 10px;border-radius:7px;transition:all 0.15s;}
    .btn-ghost:hover{background:#f0ece5;color:#1a1612;}
    /* Portal select */
    .portal-select{display:flex;gap:12px;margin-top:6px;}
    .portal-chip{display:flex;align-items:center;gap:9px;padding:10px 16px;border-radius:10px;border:2px solid #e0d9cf;background:#faf8f5;cursor:pointer;transition:all 0.18s;font-size:13px;font-weight:600;color:#5a5048;}
    .portal-chip:hover{border-color:#c97a2a;}
    .portal-chip.sel-li{border-color:#0a66c2;background:rgba(10,102,194,0.06);color:#0a66c2;}
    .portal-chip.sel-in{border-color:#2b64e1;background:rgba(43,100,225,0.06);color:#2b64e1;}
    .portal-chip.sel-jh{border-color:#059669;background:rgba(5,150,105,0.06);color:#059669;}
    .portal-chip.sel-ap{border-color:#7c3aed;background:rgba(124,58,237,0.06);color:#7c3aed;}
    .portal-dot{width:10px;height:10px;border-radius:50%;}
    /* JD result */
    .jd-box{background:#faf8f5;border:1.5px solid #e0d9cf;border-radius:10px;padding:16px;font-size:13.5px;color:#3a3028;line-height:1.75;position:relative;}
    .jd-tabs{display:flex;gap:6px;margin-bottom:12px;}
    .jd-tab{padding:6px 14px;border-radius:7px;border:1.5px solid #e0d9cf;background:#fff;font-size:12px;font-weight:600;cursor:pointer;color:#8a7e72;transition:all 0.15s;}
    .jd-tab.active{border-color:#c97a2a;color:#c97a2a;background:rgba(201,122,42,0.05);}
    .skill-pill{display:inline-block;padding:4px 12px;border-radius:20px;background:#f0ece5;border:1px solid #ddd5c5;font-size:12px;font-weight:600;color:#5a5048;margin:3px;}
    /* Progress */
    .progress-item{display:flex;align-items:center;gap:12px;padding:12px 16px;background:#faf8f5;border-radius:10px;margin-bottom:8px;border:1px solid #ede6db;}
    .prog-icon{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;}
    /* Kanban */
    .kanban{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;}
    .kanban-col{min-width:180px;max-width:200px;flex-shrink:0;}
    .kanban-hdr{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#8a7e72;margin-bottom:10px;display:flex;align-items:center;gap:6px;}
    .kanban-card{background:#fff;border:1px solid #e8e2d9;border-radius:10px;padding:12px;margin-bottom:8px;cursor:pointer;transition:box-shadow 0.15s;}
    .kanban-card:hover{box-shadow:0 3px 12px rgba(26,22,18,0.08);}
    .k-name{font-weight:700;font-size:13px;color:#1a1612;}
    .k-meta{font-size:11px;color:#8a7e72;margin-top:3px;}
    .k-score{font-size:11px;font-weight:700;margin-top:6px;}
    .spinner{width:16px;height:16px;border:2px solid rgba(26,22,18,0.15);border-top-color:#1a1612;border-radius:50%;animation:spin 0.6s linear infinite;display:inline-block;}
    @keyframes spin{to{transform:rotate(360deg);}}
    .fade-in{animation:fadeIn 0.3s ease;}
    @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    /* Toast */
    .toast{position:fixed;bottom:28px;right:28px;z-index:9999;padding:13px 20px;border-radius:11px;font-size:13.5px;font-weight:600;display:flex;align-items:center;gap:10px;box-shadow:0 8px 30px rgba(0,0,0,0.15);animation:slideUp 0.3s ease;}
    .toast.ok{background:#1a1612;color:#f5f0e8;}
    .toast.err{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;}
    @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    /* Modal overlay */
    .modal-overlay{position:fixed;inset:0;background:rgba(26,22,18,0.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;}
    .modal-box{background:#fff;border-radius:16px;width:100%;max-width:560px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.25);}
    .modal-hdr{padding:22px 24px 16px;border-bottom:1px solid #ede6db;display:flex;align-items:center;justify-content:space-between;}
    .modal-body{padding:22px 24px;}
    .section-title{font-family:'Fraunces',serif;font-size:17px;font-weight:700;color:#1a1612;margin-bottom:14px;}
    /* Divider */
    .divider{height:1px;background:#ede6db;margin:20px 0;}
    /* Two col layout for main content */
    .two-col{display:grid;grid-template-columns:1fr 340px;gap:20px;align-items:start;}
    @media(max-width:900px){.two-col{grid-template-columns:1fr;}.stat-row{grid-template-columns:1fr 1fr;}}
    /* Auth page */
    .auth-page{min-height:100vh;background:#f7f4ef;display:flex;align-items:center;justify-content:center;padding:24px;font-family:'Nunito',sans-serif;}
    .auth-card{background:#fff;border-radius:16px;border:1px solid #e8e2d9;padding:32px;width:100%;max-width:400px;box-shadow:0 8px 30px rgba(26,22,18,0.08);}
    .auth-title{font-family:'Fraunces',serif;font-weight:700;font-size:24px;color:#1a1612;margin-bottom:8px;text-align:center;}
    .auth-sub{font-size:13px;color:#8a7e72;text-align:center;margin-bottom:24px;}
    .auth-tabs{display:flex;gap:8px;margin-bottom:20px;}
    .auth-tab{padding:10px 18px;border-radius:10px;border:1.5px solid #e0d9cf;background:#faf8f5;font-size:13px;font-weight:600;color:#8a7e72;cursor:pointer;transition:all 0.15s;flex:1;}
    .auth-tab:hover{border-color:#c97a2a;color:#5a5048;}
    .auth-tab.active{border-color:#c97a2a;background:rgba(201,122,42,0.08);color:#c97a2a;}
    .auth-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:13px;padding:10px 14px;border-radius:10px;margin-bottom:16px;}
  `;

  // ── Applicant modal ────────────────────────────────────────────────────────
  const ApplicantModal = ({ app, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div>
            <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 18, color: "#1a1612" }}>{app.name}</div>
            <div style={{ fontSize: 12, color: "#8a7e72", marginTop: 2 }}>{app.email}</div>
            {app.shortlisted && <span style={{ display: "inline-block", marginTop: 6, padding: "2px 10px", borderRadius: 20, background: "#22c55e", color: "#fff", fontSize: 11, fontWeight: 700 }}>Shortlisted</span>}
          </div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
            {[["Applied", fmtDate(app.appliedDate)], ["Portal", (PORTALS.find(x=>x.id===app.portal)||{}).label || app.portal], ["AI Score", `${app.score ?? "—"}/100`]].map(([k,v]) => (
              <div key={k} style={{ background: "#faf8f5", borderRadius: 9, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "#8a7e72", fontWeight: 600, textTransform: "uppercase" }}>{k}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1612", marginTop: 4 }}>{v}</div>
              </div>
            ))}
          </div>
          {app.screening_notes && (
            <div style={{ marginBottom: 18, padding: 12, background: "#faf8f5", borderRadius: 10, border: "1px solid #e8e2d9" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#5a5048", marginBottom: 6 }}>AI suggestion</div>
              <div style={{ fontSize: 13, color: "#3a3028", lineHeight: 1.5 }}>{app.screening_notes}</div>
            </div>
          )}
          {supabase && (app.id?.length > 20) && (
            <div style={{ marginBottom: 18 }}>
              <button
                className="btn-gold"
                onClick={() => screenApplicant(app.id)}
                disabled={screeningInProgress === app.id || !app.resume_text?.trim()}
                title={!app.resume_text?.trim() ? "Re-upload resume with selectable text to enable AI screening" : ""}
              >
                {screeningInProgress === app.id ? <><span className="spinner" /> Screening…</> : "Screen with AI (score & suggest hire)"}
              </button>
              {!app.resume_text?.trim() && <div style={{ fontSize: 11, color: "#8a7e72", marginTop: 6 }}>No text extracted – re-upload PDF/DOCX for AI screening</div>}
            </div>
          )}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#5a5048", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Move Stage (Kanban)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {STAGES.map(s => (
                <button key={s} onClick={() => { moveStage(app.id, s); onClose(); showToast(`Moved to ${STAGE_META[s].label}`); }}
                  style={{ padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${app.stage === s ? STAGE_META[s].color : "#e0d9cf"}`,
                    background: app.stage === s ? STAGE_META[s].bg : "#faf8f5", color: app.stage === s ? STAGE_META[s].color : "#8a7e72",
                    cursor: "pointer", fontSize: 12, fontWeight: 700, transition: "all 0.15s" }}>
                  {STAGE_META[s].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const [jdTab, setJdTab] = useState("base");

  return (
    <>
      <style>{css}</style>
      {toast && <div className={`toast ${toast.ok ? "ok" : "err"}`}>{toast.ok ? "✓" : "⚠"} {toast.msg}</div>}
      {modal?.type === "applicant" && <ApplicantModal app={modal.data} onClose={() => setModal(null)} />}

      {resumeModal && (
        <div className="modal-overlay" onClick={() => { setResumeModal(false); setResumeUploadJd(""); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-hdr">
              <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 18 }}>Upload resume</div>
              <button className="btn-ghost" onClick={() => { setResumeModal(false); setResumeUploadJd(""); }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-field" style={{ marginBottom: 14 }}>
                <label className="form-label">Job (role) *</label>
                <select className="form-input" value={resumeModal.jobId || ""} onChange={e => setResumeModal(prev => ({ ...prev, jobId: e.target.value }))}>
                  <option value="">Select job…</option>
                  {JOB_ROLES.map(role => (
                    <option key={`role:${role}`} value={`role:${role}`}>{role}</option>
                  ))}
                  {jobs.filter(j => !JOB_ROLES.includes(j.title)).length > 0 && (
                    <>
                      <option disabled>——— Posted jobs ———</option>
                      {jobs.filter(j => !JOB_ROLES.includes(j.title)).map(j => (
                        <option key={j.id} value={j.id}>{j.title}</option>
                      ))}
                    </>
                  )}
                </select>
              </div>
              <div className="form-field" style={{ marginBottom: 14 }}>
                <label className="form-label">Job description (optional – for AI screening)</label>
                <textarea className="form-input" value={resumeUploadJd} onChange={e => setResumeUploadJd(e.target.value)} placeholder="Paste or type the JD here. AI will compare the resume to this to give a score." rows={4} style={{ minHeight: 80 }} />
              </div>
              <div className="form-field" style={{ marginBottom: 14 }}>
                <label className="form-label">Full name *</label>
                <input className="form-input" value={resumeForm.full_name} onChange={e => setResumeForm(f=>({...f, full_name: e.target.value}))} placeholder="Applicant name" />
              </div>
              <div className="form-field" style={{ marginBottom: 14 }}>
                <label className="form-label">Email *</label>
                <input className="form-input" type="email" value={resumeForm.email} onChange={e => setResumeForm(f=>({...f, email: e.target.value}))} placeholder="email@example.com" />
              </div>
              <div className="form-field" style={{ marginBottom: 14 }}>
                <label className="form-label">Phone (optional)</label>
                <input className="form-input" value={resumeForm.phone} onChange={e => setResumeForm(f=>({...f, phone: e.target.value}))} placeholder="+91..." />
              </div>
              <div className="form-field" style={{ marginBottom: 14 }}>
                <label className="form-label">Source portal</label>
                <select className="form-input" value={resumeForm.portal} onChange={e => setResumeForm(f=>({...f, portal: e.target.value}))}>
                  {PORTALS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div className="form-field" style={{ marginBottom: 18 }}>
                <label className="form-label">Resume file (PDF or DOCX) *</label>
                <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => setResumeFile(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
                {resumeFile && <span style={{ fontSize: 12, color: "#8a7e72", marginTop: 4, display: "block" }}>{resumeFile.name}</span>}
              </div>
              <button className="btn-gold" style={{ width: "100%", justifyContent: "center" }} onClick={uploadResume} disabled={resumeUploading || !resumeModal.jobId}>
                {resumeUploading ? <><span className="spinner" /> {resumeExtracting ? "Extracting text…" : "Uploading…"}</> : "Upload & save (then Screen with AI for score)"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="app">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-mark">
              <div className="logo-icon">H</div>
              <span className="logo-text">HireFlow</span>
            </div>
          </div>
          <nav className="sidebar-nav">
            {[
              { id: "dashboard",   icon: "⬛", label: "Dashboard" },
              { id: "post",        icon: "✦",  label: "Post a Job" },
              { id: "jobs",        icon: "≡",  label: "All Jobs",       badge: liveJobs },
              { id: "applicants",  icon: "◎",  label: "Applicants",     badge: applicants.filter(a => a.stage === "new").length },
            ].map(item => (
              <button key={item.id} className={`nav-item ${panel === item.id ? "active" : ""}`}
                onClick={() => { setPanel(item.id); if (item.id !== "applicants") setSelectedJob(null); }}>
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="user-pill">
              <div className="user-avatar">H</div>
              <div style={{ minWidth: 0 }}>
                <div className="user-name">HR</div>
                <div className="user-role">HireFlow</div>
              </div>
            </div>
            <button type="button" className="btn-ghost" onClick={clearAllData} style={{ marginTop: 8, width: "100%", justifyContent: "center", fontSize: 11, color: "#8a7e72" }} title="Remove all jobs and applicants for testing">
              Clear all data (testing)
            </button>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="main">

          {/* ═══ DASHBOARD ═══ */}
          {panel === "dashboard" && (
            <div className="fade-in">
              <div className="page-title">Good morning, HR 👋</div>
              <div className="page-sub">Here's a live snapshot of your hiring pipeline.</div>

              <div className="stat-row">
                {[
                  { cls: "s1", val: liveJobs,   lbl: "Active Postings"  },
                  { cls: "s2", val: totalApps,  lbl: "Total Applicants" },
                  { cls: "s3", val: hiredCount, lbl: "Hired This Month"  },
                  { cls: "s4", val: jobs.reduce((a,j)=>a+totalViews(j),0), lbl: "Total Job Views" },
                ].map(s => (
                  <div key={s.lbl} className={`stat-card ${s.cls}`}>
                    <div className="stat-val">{s.val}</div>
                    <div className="stat-lbl">{s.lbl}</div>
                  </div>
                ))}
              </div>

              <div className="two-col">
                {/* Recent postings */}
                <div>
                  <div className="section-title">Recent Postings</div>
                  {jobs.slice(0,4).map(job => (
                    <div key={job.id} className="job-row" onClick={() => { setSelectedJob(job.id); setPanel("applicants"); }}>
                      <div style={{ flex: 1 }}>
                        <div className="job-title">{job.title}</div>
                        <div className="job-meta">{job.dept} · {job.location} · {job.type}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {PORTALS.map(p => job[p.id] && (
                          <span key={p.id} className="tag" style={{ background: STATUS_META[job[p.id].status].bg, color: STATUS_META[job[p.id].status].color }}>
                            {p.label.slice(0,2)} {job[p.id].status}
                          </span>
                        ))}
                      </div>
                      <div style={{ fontSize: 13, color: "#8a7e72", minWidth: 80, textAlign: "right" }}>
                        {totalApplicants(job)} applicants
                      </div>
                    </div>
                  ))}
                  <button className="btn-ghost" style={{ marginTop: 6 }} onClick={() => setPanel("jobs")}>View all jobs →</button>
                </div>

                {/* Pipeline summary */}
                <div>
                  <div className="section-title">Applicant Pipeline</div>
                  <div className="card" style={{ padding: 18 }}>
                    {STAGES.filter(s => s !== "rejected").map(s => {
                      const count = applicants.filter(a => a.stage === s).length;
                      const pct = Math.round((count / Math.max(totalApps, 1)) * 100);
                      return (
                        <div key={s} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                            <span style={{ color: STAGE_META[s].color }}>{STAGE_META[s].label}</span>
                            <span style={{ color: "#8a7e72" }}>{count}</span>
                          </div>
                          <div style={{ height: 6, background: "#f0ece5", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: STAGE_META[s].color, borderRadius: 4, transition: "width 0.5s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                    <div className="divider" style={{ margin: "14px 0" }} />
                    <button className="btn-gold" style={{ width: "100%", justifyContent: "center" }} onClick={() => setPanel("post")}>
                      + Post a New Job
                    </button>
                  </div>

                  {/* Portal summary */}
                  <div className="card" style={{ padding: 18, marginTop: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1612", marginBottom: 14 }}>Portal Performance</div>
                    {PORTALS.map(p => {
                      const liveCount = jobs.filter(j => j[p.id]?.status === "live").length;
                      const appCount  = applicants.filter(a => a.portal === p.id).length;
                      return (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f0ece5" }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: p.bg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: p.color }}>
                            {p.label[0]}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1612" }}>{p.label}</div>
                            <div style={{ fontSize: 11, color: "#8a7e72" }}>{liveCount} live · {appCount} applicants</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ POST A JOB ═══ */}
          {panel === "post" && (
            <div className="fade-in">
              <div className="page-title">Post a Job</div>
              <div className="page-sub">Paste or upload your JD; AI enhances it for LinkedIn, Indeed, JobHai & Apna. Copy from tabs to post on each portal.</div>

              <div className="two-col">
                {/* Left: Form + JD result */}
                <div>
                  {/* Step 1 — details */}
                  {!postDone && (
                    <div className="card" style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1612", marginBottom: 16, fontFamily: "'Fraunces',serif" }}>
                        1 · JD input (paste or upload) + Job details
                      </div>
                      <div className="form-field" style={{ marginBottom: 14 }}>
                        <label className="form-label">Paste JD here or upload PDF/DOCX (optional fields below)</label>
                        <textarea className="form-input" placeholder="Paste your job description here. You can also upload a file below." value={jdPaste} onChange={e => setJdPaste(e.target.value)} style={{ minHeight: 120 }} />
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                          <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => { const f = e.target.files?.[0]; setJdFile(f || null); if (f) showToast("File selected. Paste the JD text above if needed, or use optional fields below."); }} style={{ fontSize: 12 }} />
                          {jdFile && <span style={{ fontSize: 12, color: "#8a7e72" }}>{jdFile.name}</span>}
                        </div>
                      </div>
                      <div className="form-grid">
                        <div className="form-field" style={{ gridColumn: "span 2" }}>
                          <label className="form-label">Job Title *</label>
                          <input className="form-input" placeholder="e.g. Senior React Developer" value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} />
                        </div>
                        <div className="form-field">
                          <label className="form-label">Department</label>
                          <select className="form-input" value={form.dept} onChange={e => setForm(f=>({...f,dept:e.target.value}))}>
                            <option value="">Select…</option>
                            {DEPTS.map(d=><option key={d}>{d}</option>)}
                          </select>
                        </div>
                        <div className="form-field">
                          <label className="form-label">Location</label>
                          <input className="form-input" placeholder="e.g. Remote / New York, NY" value={form.location} onChange={e => setForm(f=>({...f,location:e.target.value}))} />
                        </div>
                        <div className="form-field">
                          <label className="form-label">Job Type</label>
                          <select className="form-input" value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))}>
                            {TYPES.map(t=><option key={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="form-field">
                          <label className="form-label">Experience</label>
                          <select className="form-input" value={form.exp} onChange={e => setForm(f=>({...f,exp:e.target.value}))}>
                            {EXPS.map(x=><option key={x}>{x}</option>)}
                          </select>
                        </div>
                        <div className="form-field" style={{ gridColumn: "span 2" }}>
                          <label className="form-label">Salary / Compensation</label>
                          <input className="form-input" placeholder="e.g. $80k–$110k or Competitive" value={form.salary} onChange={e => setForm(f=>({...f,salary:e.target.value}))} />
                        </div>
                        <div className="form-field" style={{ gridColumn: "span 2" }}>
                          <label className="form-label">Extra Notes for AI (optional)</label>
                          <textarea className="form-input" placeholder="Must-have skills, team culture, tech stack…" value={form.extraNotes} onChange={e => setForm(f=>({...f,extraNotes:e.target.value}))} />
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18, gap: 10 }}>
                        {jdResult && <button className="btn-outline" onClick={() => setJdResult(null)}>Clear enhanced JD</button>}
                        <button className="btn-gold" onClick={generateJD} disabled={genLoading}>
                          {genLoading ? <><span className="spinner" /> Enhancing…</> : "✦ Enhance JD with AI (all 4 portals)"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* JD result */}
                  {jdResult && !postDone && (
                    <div className="card" style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1612", marginBottom: 14, fontFamily: "'Fraunces',serif" }}>
                        2 · Generated Job Description
                      </div>
                      <div className="jd-tabs">
                        {[["base","Base JD"],["linkedin","LinkedIn"],["indeed","Indeed"],["jobhai","JobHai"],["apna","Apna"]].map(([t,l])=>(
                          <button key={t} className={`jd-tab ${jdTab===t?"active":""}`} onClick={()=>setJdTab(t)}>{l}</button>
                        ))}
                      </div>
                      <div className="jd-box">
                        {jdTab === "base"     && jdResult.jd}
                        {jdTab === "linkedin" && jdResult.linkedinJD}
                        {jdTab === "indeed"   && jdResult.indeedJD}
                        {jdTab === "jobhai"   && (jdResult.jobhaiJD || jdResult.jd)}
                        {jdTab === "apna"     && (jdResult.apnaJD || jdResult.jd)}
                      </div>
                      {jdTab === "base" && (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#5a5048", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 8 }}>Key Skills</div>
                          <div>{(jdResult.skills || []).map(s=><span key={s} className="skill-pill">{s}</span>)}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Post progress */}
                  {Object.keys(postStatus).length > 0 && (
                    <div className="card">
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1612", marginBottom: 14, fontFamily: "'Fraunces',serif" }}>
                        {postDone ? "✓ Posted Successfully" : "Posting in progress…"}
                      </div>
                      {PORTALS.filter(p=>postStatus[p.id]).map(p => (
                        <div key={p.id} className="progress-item">
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: p.bg, display:"flex",alignItems:"center",justifyContent:"center", fontWeight:800, fontSize:13, color: p.color }}>
                            {p.label.slice(0,2)}
                          </div>
                          <span style={{ flex:1, fontSize:14, fontWeight:600 }}>{p.label}</span>
                          <div className="prog-icon" style={{ background: postStatus[p.id]==="done" ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)" }}>
                            {postStatus[p.id]==="done" ? <span style={{color:"#22c55e",fontWeight:700}}>✓</span> : <span className="spinner" style={{width:14,height:14}} />}
                          </div>
                        </div>
                      ))}
                      {postDone && (
                        <button className="btn-gold" style={{ marginTop: 14, width: "100%", justifyContent: "center" }} onClick={() => { resetPostForm(); setPanel("jobs"); }}>
                          View All Jobs →
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: portal selection + post */}
                <div style={{ position: "sticky", top: 24 }}>
                  <div className="card">
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1612", marginBottom: 14, fontFamily: "'Fraunces',serif" }}>
                      Select Portals
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
                      {PORTALS.map(p => {
                        const sel = selPortals.includes(p.id);
                        return (
                          <div key={p.id}
                            className={`portal-chip ${sel ? p.chipCls : ""}`}
                            onClick={() => setSelPortals(prev => sel ? prev.filter(x=>x!==p.id) : [...prev,p.id])}>
                            <div style={{ width: 28, height: 28, borderRadius: 7, background: p.bg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: p.color }}>
                              {p.label[0]}
                            </div>
                            <span style={{ flex: 1 }}>{p.label}</span>
                            <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${sel ? p.color : "#d0c8be"}`, background: sel ? p.color : "transparent", display:"flex",alignItems:"center",justifyContent:"center", fontSize:11, color:"#fff", transition:"all 0.15s" }}>
                              {sel && "✓"}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Summary */}
                    {jdResult && (
                      <div style={{ background: "#faf8f5", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13 }}>
                        {[["Title", form.title || "—"],["Type", form.type],["Location", form.location || "Remote"],["Experience", form.exp]].map(([k,v])=>(
                          <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #ede6db" }}>
                            <span style={{color:"#8a7e72"}}>{k}</span>
                            <span style={{fontWeight:600,color:"#1a1612"}}>{v}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <button className="btn-gold" style={{ width: "100%", justifyContent: "center" }} onClick={postJob} disabled={postLoading || !jdResult || postDone}>
                      {postLoading ? <><span className="spinner" /> Posting…</> : postDone ? "✓ Posted!" : `🚀 Post to ${selPortals.length || 0} Portal${selPortals.length !== 1 ? "s" : ""}`}
                    </button>

                    {!jdResult && (
                      <div style={{ textAlign: "center", fontSize: 12, color: "#b0a898", marginTop: 10 }}>Generate JD first to enable posting</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ ALL JOBS ═══ */}
          {panel === "jobs" && (
            <div className="fade-in">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                <div>
                  <div className="page-title">All Jobs</div>
                  <div className="page-sub">{jobs.length} total · {liveJobs} live</div>
                </div>
                <button className="btn-gold" onClick={() => setPanel("post")}>+ Post a Job</button>
              </div>

              {jobs.map(job => (
                <div key={job.id} className="card" style={{ marginBottom: 12, padding: "18px 22px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span className="job-title">{job.title}</span>
                        <span className="tag" style={{ background: "#f0ece5", color: "#5a5048", fontSize: 11 }}>{job.type}</span>
                      </div>
                      <div className="job-meta">{job.dept} · {job.location} · Posted {fmtDate(job.postedDate)}</div>
                      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {(job.skills || []).slice(0,4).map(s=><span key={s} className="skill-pill" style={{fontSize:11,padding:"2px 10px"}}>{s}</span>)}
                      </div>
                    </div>

                    {/* Portal status columns */}
                    <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                      {PORTALS.map(p => {
                        const data = job[p.id];
                        if (!data) return (
                          <div key={p.id} style={{ width: 130, padding: "12px 14px", background: "#faf8f5", borderRadius: 10, border: "1px solid #ede6db", opacity: 0.5, textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: "#b0a898" }}>{p.label}</div>
                            <div style={{ fontSize: 11, color: "#c4bdb2", marginTop: 4 }}>Not posted</div>
                          </div>
                        );
                        return (
                          <div key={p.id} style={{ width: 130, padding: "12px 14px", background: p.bg, borderRadius: 10, border: `1px solid ${p.color}22` }}>
                            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: p.color }}>{p.label}</span>
                              <span className="tag" style={{ background: STATUS_META[data.status].bg, color: STATUS_META[data.status].color, fontSize: 10 }}>
                                {STATUS_META[data.status].label}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: "#5a5048" }}>{data.applicants} applicants</div>
                            <div style={{ fontSize: 11, color: "#8a7e72" }}>{data.views} views</div>
                            {data.status !== "closed" && (
                              <button onClick={() => { togglePortalStatus(job.id, p.id); showToast(`${p.label} posting ${data.status==="live"?"paused":"resumed"}.`); }}
                                style={{ marginTop: 8, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, border: `1px solid ${p.color}44`, background: "transparent", color: p.color, cursor: "pointer" }}>
                                {data.status === "live" ? "Pause" : "Resume"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 20, fontFamily: "'Fraunces',serif", fontWeight: 700, color: "#1a1612" }}>{totalApplicants(job)}</div>
                      <div style={{ fontSize: 11, color: "#8a7e72" }}>applicants</div>
                      <button className="btn-ghost" style={{ marginTop: 8, fontSize: 12 }} onClick={() => { setSelectedJob(job.id); setPanel("applicants"); }}>
                        View →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ APPLICANTS ═══ */}
          {panel === "applicants" && (
            <div className="fade-in">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div className="page-title">Applicants</div>
                  <div className="page-sub">Kanban — move stages manually; upload resumes and run AI screening</div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <select className="form-input" style={{ width: 220 }} value={selectedJob || ""} onChange={e => setSelectedJob(e.target.value || null)}>
                    <option value="">All Jobs</option>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                  </select>
                  <button className="btn-gold" onClick={() => setResumeModal(selectedJob ? { jobId: selectedJob } : {})}>
                    + Upload resume
                  </button>
                </div>
              </div>

              {/* Summary row */}
              <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                {STAGES.map(s => {
                  const count = applicants.filter(a => a.stage === s && (!selectedJob || a.jobId === selectedJob)).length;
                  return (
                    <div key={s} style={{ background: "#fff", border: `1.5px solid ${STAGE_META[s].color}33`, borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: STAGE_META[s].color }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: STAGE_META[s].color }}>{STAGE_META[s].label}</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "#1a1612", fontFamily: "'Fraunces',serif" }}>{count}</span>
                    </div>
                  );
                })}
              </div>

              {/* Kanban */}
              <div className="kanban">
                {STAGES.map(s => {
                  const colApps = applicants.filter(a => a.stage === s && (!selectedJob || a.jobId === selectedJob));
                  return (
                    <div key={s} className="kanban-col">
                      <div className="kanban-hdr">
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: STAGE_META[s].color }} />
                        {STAGE_META[s].label}
                        <span style={{ marginLeft: "auto", background: STAGE_META[s].bg, color: STAGE_META[s].color, borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 800 }}>{colApps.length}</span>
                      </div>
                      {colApps.map(app => {
                        const job = jobs.find(j => j.id === app.jobId);
                        return (
                          <div key={app.id} className="kanban-card" onClick={() => setModal({ type: "applicant", data: app })}>
                            <div className="k-name">{app.name}</div>
                            <div className="k-meta">{job?.title || "Unknown role"}</div>
                            <div className="k-meta" style={{ marginTop: 4 }}>
                              <span style={{ background: (PORTALS.find(x=>x.id===app.portal)||{}).bg || "#f0ece5", color: (PORTALS.find(x=>x.id===app.portal)||{}).color || "#5a5048", padding:"2px 7px", borderRadius:20, fontSize:10, fontWeight:700 }}>
                                {(PORTALS.find(x=>x.id===app.portal)||{}).label || app.portal}
                              </span>
                            </div>
                            <div className="k-score" style={{ color: app.score != null ? (app.score >= 85 ? "#22c55e" : app.score >= 70 ? "#f59e0b" : "#ef4444") : "#8a7e72" }}>
                              ◉ {app.score != null ? `${app.score}/100` : "Not screened"}
                            </div>
                            <div style={{ fontSize: 10, color: "#b0a898", marginTop: 4 }}>{fmtDate(app.appliedDate)}</div>
                          </div>
                        );
                      })}
                      {colApps.length === 0 && (
                        <div style={{ padding: "14px 0", textAlign: "center", fontSize: 12, color: "#c4bdb2", borderRadius: 10, border: "1.5px dashed #e8e2d9" }}>Empty</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </main>
      </div>
    </>
  );
}