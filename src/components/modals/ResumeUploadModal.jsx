import { useState, useRef } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { PORTALS, JOB_ROLES } from "../../constants.js";
import { supabase, supabaseUrl, supabaseAnon } from "../../supabaseClient.js";
import { createApplicant, uploadResumeFile, screenApplicant } from "../../services/applicantService.js";
import { resolveJobIdForRole } from "../../services/jobService.js";
import { extractResumeText, parseResumeInfo } from "../../services/resumeParser.js";

const MAX_FILES = 5;
const ALL_PORTALS = [...PORTALS, { id: "manual", label: "Manual" }, { id: "email", label: "Email" }, { id: "whatsapp", label: "WhatsApp" }];

function makeEntry(file) {
  return { id: crypto.randomUUID(), file, name: "", email: "", phone: "", portal: "linkedin", resumeText: "", status: "parsing" };
}

export default function ResumeUploadModal({ initialJobId, onClose }) {
  const { jobs, setJobs, setApplicants, showToast } = useApp();

  const [rawJobId, setRawJobId] = useState(initialJobId || "");
  const [jdPaste, setJdPaste] = useState("");
  const [jdFile, setJdFile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [anyParsing, setAnyParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const fileInputRef = useRef(null);

  const updateEntry = (id, patch) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const handleJdFileChange = async (file) => {
    setJdFile(file || null);
    if (!file) return;
    try {
      const text = await extractResumeText(file);
      if (text?.trim()) {
        setJdPaste(text.trim());
        showToast("JD text extracted. You can edit it before screening.");
      } else {
        showToast("Could not read JD file text. Paste it manually.", false);
      }
    } catch {
      showToast("Failed to read JD file. Paste the job description instead.", false);
    }
  };

  const handleResumeFiles = async (files) => {
    if (!files?.length) return;
    const slots = MAX_FILES - entries.length;
    if (slots <= 0) { showToast(`Maximum ${MAX_FILES} resumes at a time.`, false); return; }
    const incoming = Array.from(files).slice(0, slots);
    const newEntries = incoming.map(makeEntry);
    setEntries((prev) => [...prev, ...newEntries]);
    setAnyParsing(true);
    if (fileInputRef.current) fileInputRef.current.value = "";

    for (const entry of newEntries) {
      try {
        const text = await extractResumeText(entry.file);
        const { name, email, phone } = text ? parseResumeInfo(text) : {};
        updateEntry(entry.id, { resumeText: text || "", name: name || "", email: email || "", phone: phone || "", status: "ready" });
      } catch {
        updateEntry(entry.id, { status: "error", error: "Could not parse file" });
      }
    }
    setAnyParsing(false);
  };

  const removeEntry = (id) => setEntries((prev) => prev.filter((e) => e.id !== id));

  const handleUploadAll = async () => {
    if (!rawJobId) return showToast("Select a job/role first.", false);
    const valid = entries.filter((e) => e.name?.trim() && e.email?.trim());
    if (!valid.length) return showToast("Each resume needs at least a name and email.", false);

    setUploading(true);
    let jobId = rawJobId;

    try {
      if (rawJobId.startsWith("role:")) {
        const title = rawJobId.slice(5);
        jobId = await resolveJobIdForRole(jobs, title, jdPaste, setJobs);
        if (!jobId) { showToast("Could not create job. Try again.", false); setUploading(false); return; }
      } else if (supabase && jdPaste?.trim()) {
        await supabase.from("jobs").update({ jd: jdPaste.trim() }).eq("id", rawJobId);
        setJobs((prev) => prev.map((j) => (j.id === rawJobId ? { ...j, jd: jdPaste.trim() } : j)));
      }

      let done = 0;
      let succeeded = 0;
      for (const entry of valid) {
        done++;
        setProgress(`Processing ${done} / ${valid.length}…`);
        updateEntry(entry.id, { status: "uploading" });

        try {
          const ext = entry.file.name.split(".").pop() || "pdf";
          const path = `${jobId}/${crypto.randomUUID()}.${ext}`;

          if (supabase) {
            await uploadResumeFile(path, entry.file);
            const newApp = await createApplicant({
              job_id: jobId,
              full_name: entry.name.trim(),
              email: entry.email.trim(),
              phone: entry.phone?.trim() || null,
              portal: entry.portal,
              resume_path: path,
              resume_text: entry.resumeText || null,
              stage: "new",
            });
            setApplicants((prev) => [newApp, ...prev]);

            if (entry.resumeText?.trim() && supabaseUrl && supabaseAnon) {
              updateEntry(entry.id, { status: "screening" });
              try {
                const data = await screenApplicant(newApp.id);
                setApplicants((prev) =>
                  prev.map((a) =>
                    a.id === newApp.id
                      ? { ...a, score: data.score, shortlisted: data.shortlisted, screening_notes: data.screening_notes }
                      : a
                  )
                );
                updateEntry(entry.id, { status: "done", score: data.score });
              } catch {
                updateEntry(entry.id, { status: "done" });
              }
            } else {
              updateEntry(entry.id, { status: "done" });
            }
            succeeded++;
          } else {
            setApplicants((prev) => [
              { id: crypto.randomUUID(), jobId, name: entry.name, email: entry.email, phone: entry.phone, portal: entry.portal, stage: "new", score: 0, appliedDate: new Date().toISOString().split("T")[0] },
              ...prev,
            ]);
            updateEntry(entry.id, { status: "done" });
            succeeded++;
          }
        } catch (e) {
          updateEntry(entry.id, { status: "error", error: e.message || "Upload failed" });
        }
      }

      setProgress("");
      const failed = valid.length - succeeded;
      if (failed === 0) {
        showToast(`${succeeded} resume${succeeded > 1 ? "s" : ""} uploaded & screened successfully.`);
        onClose();
      } else {
        showToast(`${succeeded} uploaded, ${failed} failed — check entries above.`, false);
      }
    } catch (e) {
      const msg = e?.message || "Upload failed.";
      showToast(msg.includes("Failed to fetch") ? "Network error. Check .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) and restart the dev server." : msg, false);
    }
    setUploading(false);
    setProgress("");
  };

  const readyCount = entries.filter((e) => e.name?.trim() && e.email?.trim()).length;

  return (
    <div className="modal-overlay" onClick={!uploading ? onClose : undefined}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-hdr">
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 18 }}>Upload resumes</div>
          {!uploading && (
            <button className="btn-ghost" onClick={onClose}>&#10005;</button>
          )}
        </div>
        <div className="modal-body">

          {/* ── Job selection ── */}
          <div className="form-field" style={{ marginBottom: 14 }}>
            <label className="form-label">Job (role) *</label>
            <select className="form-input" value={rawJobId} onChange={(e) => setRawJobId(e.target.value)} disabled={uploading}>
              <option value="">Select job...</option>
              {JOB_ROLES.map((role) => (
                <option key={`role:${role}`} value={`role:${role}`}>{role}</option>
              ))}
              {jobs.filter((j) => !JOB_ROLES.includes(j.title)).length > 0 && (
                <>
                  <option disabled>——— Posted jobs ———</option>
                  {jobs.filter((j) => !JOB_ROLES.includes(j.title)).map((j) => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* ── JD ── */}
          <div className="form-field" style={{ marginBottom: 14 }}>
            <label className="form-label">Job description (optional – used for AI screening of all resumes)</label>
            <textarea
              className="form-input"
              value={jdPaste}
              onChange={(e) => setJdPaste(e.target.value)}
              placeholder="Paste JD here. AI will compare every resume against this to give a score."
              rows={3}
              style={{ minHeight: 70 }}
              disabled={uploading}
            />
            <div style={{ fontSize: 11, color: "#8a7e72", marginTop: 6 }}>Or upload JD as PDF/DOCX:</div>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => handleJdFileChange(e.target.files?.[0] || null)}
              style={{ fontSize: 13, marginTop: 4 }}
              disabled={uploading}
            />
            {jdFile && <span style={{ fontSize: 12, color: "#8a7e72", marginTop: 4, display: "block" }}>{jdFile.name}</span>}
          </div>

          {/* ── Drop zone ── */}
          <div className="form-field" style={{ marginBottom: entries.length ? 10 : 18 }}>
            <label className="form-label">
              Resume files (PDF or DOCX) — up to {MAX_FILES} at once *
              <span style={{ color: "#8a7e72", fontWeight: 400, marginLeft: 6 }}>{entries.length}/{MAX_FILES} added</span>
            </label>
            <div
              style={{
                border: "2px dashed #e8e2d9",
                borderRadius: 10,
                padding: "14px 16px",
                background: "#faf8f5",
                cursor: entries.length < MAX_FILES && !uploading ? "pointer" : "default",
                opacity: entries.length >= MAX_FILES || uploading ? 0.5 : 1,
                transition: "border-color 0.15s",
              }}
              onClick={() => entries.length < MAX_FILES && !uploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                style={{ display: "none" }}
                onChange={(e) => handleResumeFiles(e.target.files)}
              />
              {anyParsing ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#c97a2a" }}>
                  <span className="spinner" /> Parsing resumes…
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#8a7e72" }}>
                  <span style={{ fontSize: 22 }}>📂</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {entries.length === 0 ? "Click to select resumes" : entries.length < MAX_FILES ? "Click to add more resumes" : `Maximum ${MAX_FILES} reached`}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>PDF or DOCX · AI auto-fills name, email & phone from each file</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Entry cards ── */}
          {entries.map((entry, idx) => (
            <div
              key={entry.id}
              style={{
                border: `1.5px solid ${entry.status === "done" ? "#86efac" : entry.status === "error" ? "#fca5a5" : "#e8e2d9"}`,
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 10,
                background: entry.status === "done" ? "rgba(34,197,94,0.04)" : entry.status === "error" ? "rgba(239,68,68,0.04)" : "#fff",
              }}
            >
              {/* File name + status row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#5a5048", minWidth: 0 }}>
                  <span>📄</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{entry.file.name}</span>
                  {entry.status === "parsing" && (
                    <span style={{ color: "#c97a2a", display: "flex", alignItems: "center", gap: 4 }}><span className="spinner" /><span style={{ fontWeight: 400 }}>Parsing…</span></span>
                  )}
                  {entry.status === "uploading" && (
                    <span style={{ color: "#c97a2a", display: "flex", alignItems: "center", gap: 4 }}><span className="spinner" /><span style={{ fontWeight: 400 }}>Uploading…</span></span>
                  )}
                  {entry.status === "screening" && (
                    <span style={{ color: "#8b5cf6", display: "flex", alignItems: "center", gap: 4 }}><span className="spinner" /><span style={{ fontWeight: 400 }}>Screening…</span></span>
                  )}
                  {entry.status === "done" && (
                    <span style={{ color: "#22c55e", fontWeight: 600 }}>
                      Done{entry.score ? ` · ${entry.score}/100` : ""}
                    </span>
                  )}
                  {entry.status === "error" && (
                    <span style={{ color: "#ef4444", fontWeight: 400 }}>{entry.error || "Failed"}</span>
                  )}
                </div>
                {!uploading && (
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 13, padding: "1px 6px", flexShrink: 0 }}
                    onClick={() => removeEntry(entry.id)}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Editable fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#8a7e72", display: "block", marginBottom: 3 }}>Full Name *</label>
                  <input
                    className="form-input"
                    style={{ fontSize: 13, padding: "6px 10px" }}
                    value={entry.name}
                    onChange={(e) => updateEntry(entry.id, { name: e.target.value })}
                    placeholder="Auto-filled from resume"
                    disabled={uploading}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#8a7e72", display: "block", marginBottom: 3 }}>Email *</label>
                  <input
                    className="form-input"
                    style={{ fontSize: 13, padding: "6px 10px" }}
                    type="email"
                    value={entry.email}
                    onChange={(e) => updateEntry(entry.id, { email: e.target.value })}
                    placeholder="auto@filled.com"
                    disabled={uploading}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#8a7e72", display: "block", marginBottom: 3 }}>Phone</label>
                  <input
                    className="form-input"
                    style={{ fontSize: 13, padding: "6px 10px" }}
                    value={entry.phone}
                    onChange={(e) => updateEntry(entry.id, { phone: e.target.value })}
                    placeholder="+91..."
                    disabled={uploading}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#8a7e72", display: "block", marginBottom: 3 }}>Source Portal</label>
                  <select
                    className="form-input"
                    style={{ fontSize: 13, padding: "6px 10px" }}
                    value={entry.portal}
                    onChange={(e) => updateEntry(entry.id, { portal: e.target.value })}
                    disabled={uploading}
                  >
                    {ALL_PORTALS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}

          {/* ── Submit ── */}
          <button
            className="btn-gold"
            style={{ width: "100%", justifyContent: "center", marginTop: entries.length ? 8 : 0 }}
            onClick={handleUploadAll}
            disabled={uploading || !rawJobId || readyCount === 0 || anyParsing}
          >
            {uploading ? (
              <><span className="spinner" /> {progress || "Processing…"}</>
            ) : (
              `Upload & screen ${readyCount > 0 ? readyCount : ""} resume${readyCount !== 1 ? "s" : ""} with AI`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
