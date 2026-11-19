import { useMemo, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { STAGES, STAGE_META, CAREERS_URL } from "../../constants.js";
import { fmtDate } from "../../helpers.js";
import { getResumeUrl, updateApplicantStage } from "../../services/applicantService.js";

// ─────────────────────────────────────────────────────────────────────
// Website Applications — everyone who applied on hagerstone.com/careers.
//
// Not a second inbox. These rows are ordinary hr.applicants (portal =
// 'website') and also sit in the Applicants Kanban; this panel is a filtered
// table of them with the fields the careers form collects (qualification,
// experience, notice, expected CTC) laid out so HR can triage a batch without
// opening every card. Moving a stage here moves it on the Kanban too.
//
// Reads from AppContext like the Kanban does. The CV opens through a 5-minute
// signed URL: website CVs are in the PRIVATE `candidate-resumes` bucket.
// ─────────────────────────────────────────────────────────────────────

const TH = { textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#8a7e72", textTransform: "uppercase", letterSpacing: "0.4px", whiteSpace: "nowrap" };
const TD = { padding: "10px 12px", fontSize: 13, color: "#1a1612", verticalAlign: "top" };

const scoreColor = (s) => (!s ? "#8a7e72" : s >= 80 ? "#22c55e" : s >= 60 ? "#f59e0b" : "#ef4444");

function csvCell(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function WebsiteApplications() {
  const { applicants, setApplicants, jobs, refreshApplicants, setModal, showToast } = useApp();
  const [role, setRole] = useState("");
  const [stage, setStage] = useState("");
  const [q, setQ] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const website = useMemo(() => applicants.filter((a) => a.portal === "website"), [applicants]);
  const roleOf = (a) => jobs.find((j) => j.id === a.jobId)?.title || a.designation || "—";
  const roles = useMemo(() => [...new Set(website.map(roleOf))].sort(), [website, jobs]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return website.filter((a) =>
      (!role || roleOf(a) === role) &&
      (!stage || a.stage === stage) &&
      (!needle || [a.name, a.email, a.phone, a.location, a.qualification].some((v) => v?.toLowerCase().includes(needle))));
  }, [website, role, stage, q, jobs]); // eslint-disable-line react-hooks/exhaustive-deps

  const weekAgo = Date.now() - 7 * 86400000;
  const stats = [
    { cls: "s1", val: website.length, lbl: "Total website applications" },
    { cls: "s2", val: website.filter((a) => new Date(a.appliedDate).getTime() >= weekAgo).length, lbl: "In the last 7 days" },
    { cls: "s4", val: website.filter((a) => a.stage === "new").length, lbl: "Awaiting review (New)" },
    { cls: "s3", val: website.filter((a) => a.score > 0).length, lbl: "AI screened" },
  ];

  const refresh = async () => {
    setRefreshing(true);
    try { await refreshApplicants(); } finally { setRefreshing(false); }
  };

  // Tab opened before the await so the popup blocker lets it through.
  const openResume = async (app) => {
    const tab = window.open("about:blank", "_blank");
    try {
      const url = await getResumeUrl(app);
      if (tab) tab.location.href = url; else window.location.href = url;
    } catch (e) {
      if (tab) tab.close();
      showToast(e?.message || "Could not open the CV.", false);
    }
  };

  const moveStage = async (app, next) => {
    setApplicants((prev) => prev.map((a) => (a.id === app.id ? { ...a, stage: next } : a)));
    await updateApplicantStage(app.id, next);
    showToast(`${app.name} → ${STAGE_META[next].label}`);
  };

  const exportCsv = () => {
    const head = ["Applied", "Name", "Email", "Phone", "Role", "City", "Qualification", "Current employer", "Experience (yr)", "Current CTC (LPA)", "Expected CTC (LPA)", "Notice period", "AI score", "Stage", "Note"];
    const body = rows.map((a) => [
      a.appliedDate?.slice(0, 10), a.name, a.email, a.phone, roleOf(a), a.location, a.qualification, a.currentEmployer,
      a.experienceYears, a.currentCtc, a.expectedCtc, a.noticePeriod, a.score || "", STAGE_META[a.stage]?.label, a.coverNote,
    ]);
    const csv = [head, ...body].map((r) => r.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `website-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="page-title">Website Applications</div>
          <div className="page-sub">
            Candidates who applied on{" "}
            <a href={CAREERS_URL} target="_blank" rel="noreferrer" style={{ color: "#c97a2a" }}>hagerstone.com/careers</a>.
            {" "}They also appear in the Applicants Kanban, tagged <b>Website</b>.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-outline" style={{ fontSize: 12 }} onClick={refresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
          <button className="btn-outline" style={{ fontSize: 12 }} onClick={exportCsv} disabled={rows.length === 0}>⬇ Export CSV</button>
        </div>
      </div>

      <div className="stat-row">
        {stats.map((s) => (
          <div key={s.lbl} className={`stat-card ${s.cls}`}>
            <div className="stat-val">{s.val}</div>
            <div className="stat-lbl">{s.lbl}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select className="form-input" style={{ width: 220 }} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="form-input" style={{ width: 180 }} value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">All stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
        </select>
        <input className="form-input" style={{ width: 260 }} placeholder="Search name, email, phone, city…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e8e2d9", background: "#faf8f5" }}>
              {["Applied", "Candidate", "Role", "City", "Qualification", "Exp.", "Notice", "Expected CTC", "AI score", "Stage", ""].map((h) => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} style={{ borderBottom: "1px solid #f0ebe3" }}>
                <td style={{ ...TD, whiteSpace: "nowrap", color: "#8a7e72" }}>{fmtDate(a.appliedDate)}</td>
                <td style={TD}>
                  <button
                    onClick={() => setModal({ type: "applicant", data: a })}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 700, color: "#1a1612", fontSize: 13, textAlign: "left" }}
                    title="Open the applicant card"
                  >
                    {a.name}
                  </button>
                  <div style={{ fontSize: 11, color: "#8a7e72", marginTop: 2 }}>{a.email}</div>
                  {a.phone && <div style={{ fontSize: 11, color: "#8a7e72" }}>{a.phone}</div>}
                </td>
                <td style={TD}>{roleOf(a)}</td>
                <td style={TD}>{a.location || "—"}</td>
                <td style={TD}>{a.qualification || "—"}</td>
                <td style={{ ...TD, whiteSpace: "nowrap" }}>{a.experienceYears != null ? `${a.experienceYears} yr` : "—"}</td>
                <td style={TD}>{a.noticePeriod || "—"}</td>
                <td style={{ ...TD, whiteSpace: "nowrap" }}>{a.expectedCtc != null ? `₹${a.expectedCtc} LPA` : "—"}</td>
                <td style={{ ...TD, fontWeight: 700, color: scoreColor(a.score), whiteSpace: "nowrap" }}>
                  {a.score ? `${a.score}/100` : "Not screened"}
                </td>
                <td style={TD}>
                  <select
                    className="form-input"
                    style={{ width: 130, padding: "4px 8px", fontSize: 12, color: STAGE_META[a.stage]?.color, fontWeight: 700 }}
                    value={a.stage}
                    onChange={(e) => moveStage(a, e.target.value)}
                  >
                    {STAGES.map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
                  </select>
                </td>
                <td style={{ ...TD, whiteSpace: "nowrap" }}>
                  {a.resume_path && (
                    <button className="btn-outline" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => openResume(a)}>📄 CV</button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} style={{ padding: 36, textAlign: "center", color: "#8a7e72", fontSize: 13 }}>
                  {website.length === 0 ? "No applications from the website yet." : "No applications match these filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
