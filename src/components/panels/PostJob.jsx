import { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { PORTALS, DEPTS, TYPES, EXPS } from "../../constants.js";
import { uid } from "../../helpers.js";
import { enhanceJD } from "../../services/aiService.js";
import { createJob } from "../../services/jobService.js";
import { supabase } from "../../supabaseClient.js";
import CopyButton from "../shared/CopyButton.jsx";

// Extract text from PDF or DOCX in the browser
async function extractFileText(file) {
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
      text += content.items.map((it) => it.str).join(" ") + "\n";
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
}

export default function PostJob() {
  const { jobs, setJobs, setPanel, showToast } = useApp();

  const [form, setForm] = useState({ title: "", dept: "", location: "", type: "Full-time", exp: "1-3 years", salary: "", extraNotes: "" });
  const [jdPaste, setJdPaste] = useState("");
  const [jdFile, setJdFile] = useState(null);
  const [jdResult, setJdResult] = useState(null);
  const [selPortals, setSelPortals] = useState(["linkedin", "indeed"]);
  const [genLoading, setGenLoading] = useState(false);
  const [postLoading, setPostLoading] = useState(false);
  const [postStatus, setPostStatus] = useState({});
  const [postDone, setPostDone] = useState(false);
  const [jdTab, setJdTab] = useState("base");

  const generateJD = async () => {
    if (!form.title.trim()) return showToast("Enter a job title first.", false);

    let jdInput = (jdPaste || form.extraNotes || "").trim();
    if (!jdInput && jdFile) {
      setGenLoading(true);
      try {
        jdInput = (await extractFileText(jdFile)).trim();
        if (jdInput) setJdPaste(jdInput);
      } catch {
        setGenLoading(false);
        return showToast("Could not read text from the uploaded file. Try pasting the JD instead.", false);
      }
      if (!jdInput) {
        setGenLoading(false);
        return showToast("No text found in the file. Try pasting the JD or use a different file.", false);
      }
    }
    if (!jdInput) return showToast("Paste your JD above or upload a PDF/DOCX file.", false);

    setGenLoading(true);
    setJdResult(null);
    try {
      const result = await enhanceJD({
        title: form.title,
        dept: form.dept || "Not specified",
        location: form.location || "Not specified",
        type: form.type,
        exp: form.exp,
        salary: form.salary || "Competitive",
        extraNotes: form.extraNotes || "none",
        jdInput: jdInput.slice(0, 4000),
      });
      setJdResult(result);
      showToast("JD enhanced for all 4 portals");
    } catch {
      showToast("Generation failed - please try again.", false);
    }
    setGenLoading(false);
  };

  const postJob = async () => {
    if (!jdResult) return showToast("Enhance JD with AI first.", false);
    if (!selPortals.length) return showToast("Select at least one portal.", false);
    setPostLoading(true);
    setPostDone(false);

    const newAppJob = {
      title: form.title,
      dept: form.dept || "General",
      location: form.location || "Remote",
      type: form.type,
      exp: form.exp,
      salary: form.salary,
      postedDate: new Date().toISOString().split("T")[0],
      ...Object.fromEntries(PORTALS.map((p) => [p.id, selPortals.includes(p.id) ? { status: "live", applicants: 0, views: 0 } : null])),
      jd: jdResult.jd,
      skills: jdResult.skills,
    };

    try {
      const saved = await createJob(newAppJob, jdResult, selPortals);
      setJobs((prev) => [saved, ...prev]);
      setPostDone(true);
      showToast(`"${form.title}" saved — copy each portal's JD and open to post manually.`);
    } catch (e) {
      showToast("Failed to save job: " + e.message, false);
    }
    setPostLoading(false);
  };

  const resetPostForm = () => {
    setForm({ title: "", dept: "", location: "", type: "Full-time", exp: "1-3 years", salary: "", extraNotes: "" });
    setJdPaste("");
    setJdFile(null);
    setJdResult(null);
    setSelPortals(["linkedin", "indeed"]);
    setPostStatus({});
    setPostDone(false);
  };

  const getJdTextForTab = (tab) => {
    if (!jdResult) return "";
    if (tab === "base") return jdResult.jd || "";
    if (tab === "linkedin") return jdResult.linkedinJD || "";
    if (tab === "indeed") return jdResult.indeedJD || "";
    if (tab === "jobhai") return jdResult.jobhaiJD || jdResult.jd || "";
    if (tab === "apna") return jdResult.apnaJD || jdResult.jd || "";
    return "";
  };

  return (
    <div className="fade-in">
      <div className="page-title">Post a Job</div>
      <div className="page-sub">AI enhances your JD for each portal. One click copies the portal-optimised JD; next click opens the portal so you can paste and publish.</div>

      <div className="two-col">
        {/* Left: Form + JD result */}
        <div>
          {/* Step 1 - details */}
          {!postDone && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1612", marginBottom: 16, fontFamily: "'Fraunces',serif" }}>
                1 &middot; JD input (paste or upload) + Job details
              </div>
              <div className="form-field" style={{ marginBottom: 14 }}>
                <label className="form-label">Paste JD here or upload PDF/DOCX</label>
                <textarea className="form-input" placeholder="Paste your job description here..." value={jdPaste} onChange={(e) => setJdPaste(e.target.value)} style={{ minHeight: 120 }} />
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      setJdFile(f || null);
                      if (f) showToast("File selected.");
                    }}
                    style={{ fontSize: 12 }}
                  />
                  {jdFile && <span style={{ fontSize: 12, color: "#8a7e72" }}>{jdFile.name}</span>}
                </div>
              </div>
              <div className="form-grid">
                <div className="form-field" style={{ gridColumn: "span 2" }}>
                  <label className="form-label">Job Title *</label>
                  <input className="form-input" placeholder="e.g. Senior React Developer" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-label">Department</label>
                  <select className="form-input" value={form.dept} onChange={(e) => setForm((f) => ({ ...f, dept: e.target.value }))}>
                    <option value="">Select...</option>
                    {DEPTS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Location</label>
                  <input className="form-input" placeholder="e.g. Remote / New York, NY" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-label">Job Type</label>
                  <select className="form-input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                    {TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Experience</label>
                  <select className="form-input" value={form.exp} onChange={(e) => setForm((f) => ({ ...f, exp: e.target.value }))}>
                    {EXPS.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field" style={{ gridColumn: "span 2" }}>
                  <label className="form-label">Salary / Compensation</label>
                  <input className="form-input" placeholder="e.g. $80k-$110k or Competitive" value={form.salary} onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))} />
                </div>
                <div className="form-field" style={{ gridColumn: "span 2" }}>
                  <label className="form-label">Extra Notes for AI (optional)</label>
                  <textarea className="form-input" placeholder="Must-have skills, team culture, tech stack..." value={form.extraNotes} onChange={(e) => setForm((f) => ({ ...f, extraNotes: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18, gap: 10 }}>
                {jdResult && (
                  <button className="btn-outline" onClick={() => setJdResult(null)}>
                    Clear enhanced JD
                  </button>
                )}
                <button className="btn-gold" onClick={generateJD} disabled={genLoading}>
                  {genLoading ? (
                    <>
                      <span className="spinner" /> Enhancing...
                    </>
                  ) : (
                    "Enhance JD with AI (all 4 portals)"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* JD result */}
          {jdResult && !postDone && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1612", marginBottom: 14, fontFamily: "'Fraunces',serif" }}>
                2 &middot; Generated Job Description
              </div>
              <div className="jd-tabs">
                {[
                  ["base", "Base JD"],
                  ["linkedin", "LinkedIn"],
                  ["indeed", "Indeed"],
                  ["jobhai", "JobHai"],
                  ["apna", "Apna"],
                ].map(([t, l]) => (
                  <button key={t} className={`jd-tab ${jdTab === t ? "active" : ""}`} onClick={() => setJdTab(t)}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="jd-box">{getJdTextForTab(jdTab)}</div>
              <CopyButton text={getJdTextForTab(jdTab)} label={`Copy ${jdTab === "base" ? "Base" : PORTALS.find((p) => p.id === jdTab)?.label || jdTab} JD`} />
              {jdTab === "base" && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#5a5048", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 8 }}>Key Skills</div>
                  <div>
                    {(jdResult.skills || []).map((s) => (
                      <span key={s} className="skill-pill">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Post-save: per-portal copy+open action panel */}
          {postDone && (
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#22c55e", fontWeight: 800, fontSize: 14 }}>&#10003;</span>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1612", fontFamily: "'Fraunces',serif" }}>Job saved to HireFlow</div>
                  <div style={{ fontSize: 12, color: "#8a7e72" }}>Copy each portal's enhanced JD, then open to paste and post</div>
                </div>
              </div>

              {PORTALS.filter((p) => selPortals.includes(p.id)).map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #f0ece5" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: p.bg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, color: p.color, flexShrink: 0 }}>
                    {p.label.slice(0, 2)}
                  </div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#1a1612" }}>{p.label}</span>
                  {p.autoPost ? (
                    <span style={{ fontSize: 11, background: `${p.color}18`, color: p.color, padding: "3px 9px", borderRadius: 20, fontWeight: 700 }}>⚡ n8n auto-post</span>
                  ) : (
                    <>
                      <CopyButton text={getJdTextForTab(p.id)} label="Copy JD" />
                      {p.postUrl && (
                        <a href={p.postUrl} target="_blank" rel="noopener noreferrer"
                          style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, border: `1.5px solid ${p.color}`, color: p.color, fontSize: 12, fontWeight: 700, background: p.bg, whiteSpace: "nowrap" }}>
                          Open &rarr;
                        </a>
                      )}
                    </>
                  )}
                </div>
              ))}

              <button
                className="btn-gold"
                style={{ marginTop: 14, width: "100%", justifyContent: "center" }}
                onClick={() => { resetPostForm(); setPanel("jobs"); }}
              >
                View All Jobs &rarr;
              </button>
            </div>
          )}
        </div>

        {/* Right: portal selection + post */}
        <div style={{ position: "sticky", top: 24 }}>
          <div className="card">
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1612", marginBottom: 14, fontFamily: "'Fraunces',serif" }}>Select Portals</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              {PORTALS.map((p) => {
                const sel = selPortals.includes(p.id);
                return (
                  <div key={p.id} className={`portal-chip ${sel ? p.chipCls : ""}`} onClick={() => setSelPortals((prev) => (sel ? prev.filter((x) => x !== p.id) : [...prev, p.id]))}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: p.bg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: p.color }}>
                      {p.label[0]}
                    </div>
                    <span style={{ flex: 1 }}>{p.label}</span>
                    <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${sel ? p.color : "#d0c8be"}`, background: sel ? p.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", transition: "all 0.15s" }}>
                      {sel && "\u2713"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            {jdResult && (
              <div style={{ background: "#faf8f5", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13 }}>
                {[
                  ["Title", form.title || "\u2014"],
                  ["Type", form.type],
                  ["Location", form.location || "Remote"],
                  ["Experience", form.exp],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #ede6db" }}>
                    <span style={{ color: "#8a7e72" }}>{k}</span>
                    <span style={{ fontWeight: 600, color: "#1a1612" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            <button className="btn-gold" style={{ width: "100%", justifyContent: "center" }} onClick={postJob} disabled={postLoading || !jdResult || postDone}>
              {postLoading ? (
                <>
                  <span className="spinner" /> Posting...
                </>
              ) : postDone ? (
                "Saved!"
              ) : (
                `Save & Get Posting Links (${selPortals.length || 0} portal${selPortals.length !== 1 ? "s" : ""})`
              )}
            </button>

            {!jdResult && <div style={{ textAlign: "center", fontSize: 12, color: "#b0a898", marginTop: 10 }}>Generate JD first to enable posting</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
