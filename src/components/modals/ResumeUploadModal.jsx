import { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { PORTALS, JOB_ROLES } from "../../constants.js";
import { supabase, supabaseUrl, supabaseAnon } from "../../supabaseClient.js";
import { createApplicant, uploadResumeFile, screenApplicant } from "../../services/applicantService.js";
import { resolveJobIdForRole } from "../../services/jobService.js";
import { extractResumeText } from "../../services/resumeParser.js";
import { dbApplicantToApp } from "../../mappers.js";
import { uid } from "../../helpers.js";

export default function ResumeUploadModal({ initialJobId, onClose }) {
  const { jobs, setJobs, setApplicants, showToast } = useApp();

  const [rawJobId, setRawJobId] = useState(initialJobId || "");
  const [jdPaste, setJdPaste] = useState("");
  const [jdFile, setJdFile] = useState(null); // optional JD file (PDF/DOCX)
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", portal: "linkedin" });
  const [resumeFile, setResumeFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState(""); // "upload" | "screen" for button label

  const handleJdFileChange = async (file) => {
    setJdFile(file || null);
    if (!file) return;
    try {
      const text = await extractResumeText(file);
      if (text?.trim()) {
        setJdPaste(text.trim());
        showToast("JD text extracted from file. You can edit it before screening.");
      } else {
        showToast("Could not read text from the JD file. Try a PDF/DOCX with selectable text or paste it manually.", false);
      }
    } catch (_) {
      showToast("Failed to read JD file. Paste the job description instead.", false);
    }
  };

  const handleUpload = async () => {
    if (!rawJobId) return showToast("Select a job/role first.", false);
    if (!form.full_name?.trim() || !form.email?.trim()) return showToast("Name and email required.", false);
    if (!resumeFile) return showToast("Select a resume file (PDF or DOCX).", false);
    setUploading(true);
    setPhase("upload");
    try {
      let jobId = rawJobId;
      if (rawJobId.startsWith("role:")) {
        const title = rawJobId.slice(5);
        jobId = await resolveJobIdForRole(jobs, title, jdPaste, setJobs);
        if (!jobId) {
          showToast("Could not create job. Try again.", false);
          setUploading(false);
          return;
        }
      } else if (supabase && jdPaste?.trim()) {
        await supabase.from("jobs").update({ jd: jdPaste.trim() }).eq("id", rawJobId);
        setJobs((prev) => prev.map((j) => (j.id === rawJobId ? { ...j, jd: jdPaste.trim() } : j)));
      }

      const resumeText = await extractResumeText(resumeFile);
      const ext = resumeFile.name.split(".").pop() || "pdf";
      const path = `${jobId}/${crypto.randomUUID()}.${ext}`;

      if (supabase) {
        await uploadResumeFile(path, resumeFile);
        const newApp = await createApplicant({
          job_id: jobId,
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone?.trim() || null,
          portal: form.portal,
          resume_path: path,
          resume_text: resumeText || null,
          stage: "new",
        });
        setApplicants((prev) => [newApp, ...prev]);

        if (resumeText?.trim() && supabaseUrl && supabaseAnon) {
          setPhase("screen");
          try {
            const data = await screenApplicant(newApp.id);
            setApplicants((prev) =>
              prev.map((a) =>
                a.id === newApp.id
                  ? { ...a, score: data.score, shortlisted: data.shortlisted, screening_notes: data.screening_notes }
                  : a
              )
            );
            onClose();
            showToast(`AI Score: ${data.score}/100. ${data.shortlisted ? "Shortlisted – " : ""}${(data.screening_notes || "").slice(0, 80)}`);
          } catch (screenErr) {
            onClose();
            showToast("Resume uploaded. AI screening failed: " + (screenErr.message || "Unknown error") + ". Open the applicant card and click Screen with AI to retry.", false);
          }
        } else {
          onClose();
          if (!resumeText?.trim()) showToast("Resume uploaded. No text extracted – AI score not available. Use a PDF/DOCX with selectable text for screening.", false);
          else showToast("Resume uploaded. Open the applicant card and click Screen with AI to get a score.");
        }
      } else {
        setApplicants((prev) => [
          {
            id: uid(),
            jobId,
            name: form.full_name,
            email: form.email,
            phone: form.phone,
            portal: form.portal,
            stage: "new",
            score: 0,
            appliedDate: new Date().toISOString().split("T")[0],
          },
          ...prev,
        ]);
        onClose();
        showToast("Resume added (Supabase not connected).");
      }
    } catch (e) {
      const msg = e?.message || "Upload failed.";
      showToast(msg.includes("Failed to fetch") ? "Network error. Check .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY), restart dev server, and that the Supabase project is active." : msg, false);
    }
    setUploading(false);
    setPhase("");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-hdr">
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 18 }}>Upload resume</div>
          <button className="btn-ghost" onClick={onClose}>
            &#10005;
          </button>
        </div>
        <div className="modal-body">
          <div className="form-field" style={{ marginBottom: 14 }}>
            <label className="form-label">Job (role) *</label>
            <select className="form-input" value={rawJobId} onChange={(e) => setRawJobId(e.target.value)}>
              <option value="">Select job...</option>
              {JOB_ROLES.map((role) => (
                <option key={`role:${role}`} value={`role:${role}`}>
                  {role}
                </option>
              ))}
              {jobs.filter((j) => !JOB_ROLES.includes(j.title)).length > 0 && (
                <>
                  <option disabled>——— Posted jobs ———</option>
                  {jobs.filter((j) => !JOB_ROLES.includes(j.title)).map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
          <div className="form-field" style={{ marginBottom: 14 }}>
            <label className="form-label">Job description (optional – for AI screening)</label>
            <textarea
              className="form-input"
              value={jdPaste}
              onChange={(e) => setJdPaste(e.target.value)}
              placeholder="Paste or type the JD here. AI will compare the resume to this to give a score."
              rows={4}
              style={{ minHeight: 80 }}
            />
            <div style={{ fontSize: 11, color: "#8a7e72", marginTop: 6 }}>Or upload the JD as a PDF/DOCX:</div>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => handleJdFileChange(e.target.files?.[0] || null)}
              style={{ fontSize: 13, marginTop: 4 }}
            />
            {jdFile && <span style={{ fontSize: 12, color: "#8a7e72", marginTop: 4, display: "block" }}>{jdFile.name}</span>}
          </div>
          <div className="form-field" style={{ marginBottom: 14 }}>
            <label className="form-label">Full name *</label>
            <input className="form-input" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} placeholder="Applicant name" />
          </div>
          <div className="form-field" style={{ marginBottom: 14 }}>
            <label className="form-label">Email *</label>
            <input className="form-input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
          </div>
          <div className="form-field" style={{ marginBottom: 14 }}>
            <label className="form-label">Phone (optional)</label>
            <input className="form-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91..." />
          </div>
          <div className="form-field" style={{ marginBottom: 14 }}>
            <label className="form-label">Source portal</label>
            <select className="form-input" value={form.portal} onChange={(e) => setForm((f) => ({ ...f, portal: e.target.value }))}>
              {PORTALS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ marginBottom: 18 }}>
            <label className="form-label">Resume file (PDF or DOCX) *</label>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
              style={{ fontSize: 13 }}
            />
            {resumeFile && <span style={{ fontSize: 12, color: "#8a7e72", marginTop: 4, display: "block" }}>{resumeFile.name}</span>}
          </div>
          <button className="btn-gold" style={{ width: "100%", justifyContent: "center" }} onClick={handleUpload} disabled={uploading || !rawJobId}>
            {uploading ? (
              <>
                <span className="spinner" /> {phase === "screen" ? "Screening with AI…" : "Uploading…"}
              </>
            ) : (
              "Upload & screen with AI"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
