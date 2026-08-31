import { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { STAGES, STAGE_META, PORTALS, SOURCE_META } from "../../constants.js";
import { fmtDate } from "../../helpers.js";
import { screenApplicant } from "../../services/applicantService.js";
import { updateApplicantStage } from "../../services/applicantService.js";
import { supabase } from "../../supabaseClient.js";

export default function ApplicantModal({ app, onClose }) {
  const { setApplicants, showToast } = useApp();
  const [screening, setScreening] = useState(false);

  const handleScreen = async () => {
    if (screening) return;
    if (!app.resume_text?.trim()) {
      showToast("No resume text to screen. Re-upload a PDF or DOCX with selectable text.", false);
      return;
    }
    setScreening(true);
    try {
      const data = await screenApplicant(app.id);
      setApplicants((prev) =>
        prev.map((a) =>
          a.id === app.id ? { ...a, score: data.score, shortlisted: data.shortlisted, screening_notes: data.screening_notes } : a
        )
      );
      showToast(`AI Score: ${data.score}/100. ${data.shortlisted ? "Shortlisted – " : ""}${(data.screening_notes || "").slice(0, 60)}`);
      onClose();
    } catch (e) {
      const msg = e?.message || "Screening failed.";
      showToast(msg.includes("Failed to fetch") ? "Network error. Check .env and deploy the screen-resume Edge Function (see EDGE_FUNCTION_DEPLOY.md)." : msg, false);
    } finally {
      setScreening(false);
    }
  };

  const moveStage = async (newStage) => {
    setApplicants((prev) => prev.map((a) => (a.id === app.id ? { ...a, stage: newStage } : a)));
    await updateApplicantStage(app.id, newStage);
    onClose();
    showToast(`Moved to ${STAGE_META[newStage].label}`);
  };

  // PORTALS only lists the six job boards we post to, so sources like
  // "manual", "whatsapp" and "form" fall through to SOURCE_META for a label.
  const portalLabel =
    PORTALS.find((x) => x.id === app.portal)?.label ||
    SOURCE_META[app.portal]?.label ||
    app.portal;

  // Only the public form fills these in. An applicant who arrived from a job
  // board has them all null, and the block is hidden rather than showing a
  // grid of em-dashes.
  const profile = [
    ["Designation", app.designation],
    ["Department", app.department],
    ["Location", app.location],
    ["Industry", app.industry],
    ["Experience", app.experienceYears != null ? `${app.experienceYears} yr` : null],
    ["Notice period", app.noticePeriod],
    ["Current CTC", app.currentCtc != null ? `₹${app.currentCtc} LPA` : null],
    ["Expected CTC", app.expectedCtc != null ? `₹${app.expectedCtc} LPA` : null],
  ].filter(([, v]) => v !== null && v !== undefined && v !== "");

  const hasProfile = profile.length > 0 || (app.skills?.length ?? 0) > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hdr">
          <div>
            <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 18, color: "#1a1612" }}>{app.name}</div>
            <div style={{ fontSize: 12, color: "#8a7e72", marginTop: 2 }}>
              {app.email}{app.phone ? ` · ${app.phone}` : ""}
            </div>
            {app.shortlisted && (
              <span style={{ display: "inline-block", marginTop: 6, padding: "2px 10px", borderRadius: 20, background: "#22c55e", color: "#fff", fontSize: 11, fontWeight: 700 }}>
                Shortlisted
              </span>
            )}
          </div>
          <button className="btn-ghost" onClick={onClose}>
            &#10005;
          </button>
        </div>
        <div className="modal-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
            {[
              ["Applied", fmtDate(app.appliedDate)],
              ["Portal", portalLabel],
              ["AI Score", `${app.score ?? "\u2014"}/100`],
            ].map(([k, v]) => (
              <div key={k} style={{ background: "#faf8f5", borderRadius: 9, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "#8a7e72", fontWeight: 600, textTransform: "uppercase" }}>{k}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1612", marginTop: 4 }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Candidate-supplied profile \u2014 /apply.html submissions only. */}
          {hasProfile && (
            <div style={{ marginBottom: 18, padding: 14, background: "#faf8f5", borderRadius: 10, border: "1px solid #e8e2d9" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#5a5048", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
                Candidate profile
                {app.portal === "form" && (
                  <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#c97a2a", background: "rgba(201,122,42,0.10)", padding: "2px 8px", borderRadius: 20, textTransform: "none", letterSpacing: 0 }}>
                    self-reported
                  </span>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "10px 16px" }}>
                {profile.map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 10.5, color: "#8a7e72", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }}>{k}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1612", marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
              {app.skills?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10.5, color: "#8a7e72", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>Skills</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {app.skills.map((s, i) => (
                      <span key={`${s}-${i}`} style={{ background: "#fdf3e3", border: "1px solid #f0dcb8", color: "#8a6a2a", borderRadius: 20, padding: "3px 11px", fontSize: 12, fontWeight: 600 }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {app.screening_notes && (
            <div style={{ marginBottom: 18, padding: 12, background: "#faf8f5", borderRadius: 10, border: "1px solid #e8e2d9" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#5a5048", marginBottom: 6 }}>AI suggestion</div>
              <div style={{ fontSize: 13, color: "#3a3028", lineHeight: 1.5 }}>{app.screening_notes}</div>
            </div>
          )}

          {supabase && app.id?.length > 20 && (
            <div style={{ marginBottom: 18 }}>
              <button className="btn-gold" onClick={handleScreen} disabled={screening || !app.resume_text?.trim()} title={!app.resume_text?.trim() ? "Re-upload resume with selectable text" : ""}>
                {screening ? <><span className="spinner" /> Screening…</> : "Screen with AI (score & suggest hire)"}
              </button>
              {!app.resume_text?.trim() && <div style={{ fontSize: 11, color: "#8a7e72", marginTop: 6 }}>No text extracted – re-upload PDF/DOCX for AI score</div>}
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#5a5048", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Move Stage (Kanban)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {STAGES.map((s) => (
                <button
                  key={s}
                  onClick={() => moveStage(s)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: `1.5px solid ${app.stage === s ? STAGE_META[s].color : "#e0d9cf"}`,
                    background: app.stage === s ? STAGE_META[s].bg : "#faf8f5",
                    color: app.stage === s ? STAGE_META[s].color : "#8a7e72",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    transition: "all 0.15s",
                  }}
                >
                  {STAGE_META[s].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
