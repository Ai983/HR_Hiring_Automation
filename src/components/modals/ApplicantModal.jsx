import { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { STAGES, STAGE_META, PORTALS } from "../../constants.js";
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

  const portal = PORTALS.find((x) => x.id === app.portal) || {};

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hdr">
          <div>
            <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 18, color: "#1a1612" }}>{app.name}</div>
            <div style={{ fontSize: 12, color: "#8a7e72", marginTop: 2 }}>{app.email}</div>
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
              ["Portal", portal.label || app.portal],
              ["AI Score", `${app.score ?? "\u2014"}/100`],
            ].map(([k, v]) => (
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
