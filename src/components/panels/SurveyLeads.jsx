import { useState, useEffect } from "react";
import { fetchSurveyResponses, convertToApplicant, rejectSurveyLead } from "../../services/surveyService.js";
import { useApp } from "../../context/AppContext.jsx";
import { AI_RECOMMENDATIONS, SURVEY_SOURCES } from "../../constants.js";

export default function SurveyLeads() {
  const { jobs, showToast } = useApp();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ source: "", recommendation: "", status: "new" });
  const [expanded, setExpanded] = useState(null);
  const [converting, setConverting] = useState(null);
  const [pendingConvert, setPendingConvert] = useState(null);
  const [pendingJobId, setPendingJobId] = useState("");

  useEffect(() => { loadLeads(); }, [filters]);

  const loadLeads = async () => {
    setLoading(true);
    setLeads(await fetchSurveyResponses(filters));
    setLoading(false);
  };

  const initConvert = (lead) => {
    const englishPart = (lead.form_name || "").split("/")[0].trim().toLowerCase();
    const words = englishPart.split(/\s+/).filter(Boolean);
    const match = jobs.find((j) => words.some((w) => w.length > 3 && j.title.toLowerCase().includes(w)));
    setPendingConvert(lead);
    setPendingJobId(match?.id || (jobs.length === 1 ? jobs[0].id : ""));
  };

  const handleConvert = async () => {
    if (!pendingConvert) return;
    if (!pendingJobId) { showToast("Please select a job first.", false); return; }
    const lead = pendingConvert;
    const jobId = pendingJobId;
    setConverting(lead.id);
    setPendingConvert(null);
    try {
      await convertToApplicant(lead.id, jobId);
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      showToast(`${lead.full_name} moved to Calling Queue`);
    } catch (e) {
      showToast(e.message || "Conversion failed", false);
    }
    setConverting(null);
  };

  const handleReject = async (leadId) => {
    await rejectSurveyLead(leadId);
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    showToast("Lead rejected.");
  };

  const strong = leads.filter((l) => l.ai_recommendation === "strong_recommend").length;
  const avgScore = leads.length
    ? Math.round(leads.reduce((s, l) => s + (l.ai_score || 0), 0) / leads.length)
    : 0;

  return (
    <div className="fade-in">
      <div className="page-title">Survey Leads</div>
      <div className="page-sub">Meta ads + Apna form submissions — AI analyzed and ranked</div>

      {/* Stats */}
      <div className="stat-row" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}>
        {[
          { val: leads.length,                                         lbl: "Total Leads",       color: "#5a5048" },
          { val: strong,                                               lbl: "Strong Recommend",  color: "#10b981" },
          { val: `${avgScore}/100`,                                    lbl: "Avg AI Score",      color: "#f59e0b" },
          { val: leads.filter((l) => l.source === "facebook").length,  lbl: "From Facebook",     color: "#1877f2" },
        ].map((s) => (
          <div key={s.lbl} className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
            <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 800, fontSize: 28, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: "#8a7e72", marginTop: 4 }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <select className="form-input" style={{ width: 160 }}
          value={filters.source} onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}>
          <option value="">All Sources</option>
          {SURVEY_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select className="form-input" style={{ width: 190 }}
          value={filters.recommendation} onChange={(e) => setFilters((f) => ({ ...f, recommendation: e.target.value }))}>
          <option value="">All Recommendations</option>
          {Object.entries(AI_RECOMMENDATIONS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select className="form-input" style={{ width: 170 }}
          value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="new">New (unreviewed)</option>
          <option value="">All Status</option>
          <option value="reviewed">Reviewed</option>
          <option value="converted">Converted</option>
          <option value="rejected">Rejected</option>
        </select>
        <button className="btn-outline" style={{ fontSize: 12 }} onClick={loadLeads}>Refresh</button>
      </div>

      {/* Lead Cards */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" /></div>
      ) : leads.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px", color: "#8a7e72" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>No survey leads yet</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>
            Leads appear here once Meta form submissions flow through Google Sheets → n8n
          </div>
        </div>
      ) : (
        leads.map((lead) => {
          const rec = AI_RECOMMENDATIONS[lead.ai_recommendation] || AI_RECOMMENDATIONS.borderline;
          const src = SURVEY_SOURCES.find((s) => s.id === lead.source) || {};
          const isExp = expanded === lead.id;
          const answers = (() => { try { return typeof lead.answers === "string" ? JSON.parse(lead.answers) : (lead.answers || {}); } catch { return {}; } })();

          return (
            <div key={lead.id} className="card" style={{ marginBottom: 12, padding: "18px 22px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 16, color: "#1a1612" }}>
                      {lead.full_name || "Unknown"}
                    </span>
                    <span style={{ padding: "2px 8px", borderRadius: 20, background: rec.bg, color: rec.color, fontSize: 11, fontWeight: 700 }}>
                      {rec.label}
                    </span>
                    <span style={{ padding: "2px 8px", borderRadius: 20, background: src.bg || "#f0ece5", color: src.color || "#5a5048", fontSize: 11, fontWeight: 700 }}>
                      {src.label || lead.source}
                    </span>
                    <span style={{ fontSize: 11, color: "#8a7e72" }}>{lead.form_name}</span>
                    {lead.phone && <span style={{ fontSize: 11, color: "#8a7e72" }}>📞 {lead.phone}</span>}
                  </div>

                  {/* AI one-liner */}
                  {lead.ai_one_line && (
                    <div style={{ fontSize: 13, color: "#3a3028", marginBottom: 8, lineHeight: 1.5 }}>
                      <span style={{ color: "#c97a2a", fontWeight: 700 }}>✦ AI: </span>
                      {lead.ai_one_line}
                    </div>
                  )}

                  {/* Strengths */}
                  {lead.ai_strengths?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                      {lead.ai_strengths.map((s, i) => (
                        <span key={i} style={{ padding: "2px 8px", borderRadius: 20, background: "rgba(34,197,94,0.08)", color: "#15803d", fontSize: 11, fontWeight: 600 }}>
                          ✓ {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Concerns */}
                  {lead.ai_concerns?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                      {lead.ai_concerns.map((c, i) => (
                        <span key={i} style={{ padding: "2px 8px", borderRadius: 20, background: "rgba(245,158,11,0.08)", color: "#92400e", fontSize: 11, fontWeight: 600 }}>
                          ⚠ {c}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Suggested call question */}
                  {lead.ai_suggested_question && (
                    <div style={{ padding: "8px 12px", background: "#faf8f5", borderRadius: 8, border: "1px solid #ede6db", fontSize: 12, color: "#5a5048", marginBottom: 8 }}>
                      <span style={{ fontWeight: 700 }}>📞 Ask on call: </span>
                      {lead.ai_suggested_question}
                    </div>
                  )}

                  {/* Expanded answers */}
                  {isExp && (
                    <div style={{ marginTop: 12, padding: 12, background: "#faf8f5", borderRadius: 8, border: "1px solid #ede6db", fontSize: 12 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8, color: "#1a1612" }}>Full Survey Answers</div>
                      {Object.entries(answers).map(([k, v]) =>
                        v ? (
                          <div key={k} style={{ display: "flex", gap: 8, padding: "4px 0", borderBottom: "1px solid #f0ece5" }}>
                            <span style={{ color: "#8a7e72", minWidth: 180, textTransform: "capitalize" }}>
                              {k.replace(/_/g, " ")}
                            </span>
                            <span style={{ color: "#1a1612", fontWeight: 600 }}>{String(v)}</span>
                          </div>
                        ) : null
                      )}
                    </div>
                  )}
                </div>

                {/* Right: score + actions */}
                <div style={{ textAlign: "right", flexShrink: 0, minWidth: 130 }}>
                  <div style={{
                    fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 32,
                    color: lead.ai_score >= 80 ? "#22c55e" : lead.ai_score >= 60 ? "#f59e0b" : lead.ai_score ? "#ef4444" : "#c4bdb2"
                  }}>
                    {lead.ai_score ?? "—"}
                  </div>
                  <div style={{ fontSize: 11, color: "#8a7e72", marginBottom: 14 }}>/ 100</div>

                  <button className="btn-gold" style={{ width: "100%", justifyContent: "center", marginBottom: 6, padding: "8px 12px", fontSize: 12 }}
                    onClick={() => initConvert(lead)} disabled={converting === lead.id}>
                    {converting === lead.id ? <><span className="spinner" /> Moving...</> : "→ Calling Queue"}
                  </button>
                  <button className="btn-outline" style={{ width: "100%", justifyContent: "center", padding: "7px 12px", fontSize: 12, marginBottom: 6 }}
                    onClick={() => setExpanded(isExp ? null : lead.id)}>
                    {isExp ? "Hide Answers" : "View Answers"}
                  </button>
                  <button className="btn-ghost" style={{ width: "100%", fontSize: 11, color: "#ef4444" }}
                    onClick={() => handleReject(lead.id)}>
                    Reject
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      {pendingConvert && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setPendingConvert(null)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Move to Calling Queue</div>
            <div style={{ fontSize: 13, color: "#8a7e72", marginBottom: 18 }}>
              Select the job to assign <strong>{pendingConvert.full_name}</strong> to:
            </div>
            <select className="form-input" value={pendingJobId} onChange={(e) => setPendingJobId(e.target.value)} style={{ marginBottom: 20 }}>
              <option value="">Select a job…</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-outline" onClick={() => setPendingConvert(null)}>Cancel</button>
              <button className="btn-gold" onClick={handleConvert} disabled={!pendingJobId}>Confirm → Queue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
