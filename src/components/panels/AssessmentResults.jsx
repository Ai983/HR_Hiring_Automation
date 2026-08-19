import { useState, useEffect, useCallback } from "react";
import {
  fetchAttempts, fetchAttempt, unlockRetake, saveNotes,
  BANDS, TOTAL_MARKS,
} from "../../services/assessmentService.js";
import { useApp } from "../../context/AppContext.jsx";

const SECTION_META = [
  { key: "score_section_a", id: "A", name: "Numerical Aptitude", count: 5 },
  { key: "score_section_b", id: "B", name: "Logical Reasoning", count: 5 },
  { key: "score_section_c", id: "C", name: "Industry Awareness", count: 6 },
  { key: "score_section_d", id: "D", name: "Situational Judgement", count: 4 },
];

function fmtDT(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
  });
}
function fmtDuration(sec) {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function BandPill({ band }) {
  const b = BANDS[band];
  if (!b) return <span style={{ color: "#b0a898", fontSize: 12 }}>—</span>;
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: b.bg, color: b.color, whiteSpace: "nowrap" }}>
      {b.label}
    </span>
  );
}

// The marked paper, read straight off the attempt row. The answer key is never
// shipped to the browser — the edge function snapshots `review` at submit time.
function ReviewModal({ attemptId, onClose, onChanged }) {
  const { showToast, ctx } = useApp();
  const [row, setRow] = useState(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchAttempt(attemptId)
      .then((r) => { setRow(r); setNotes(r?.notes || ""); })
      .catch((e) => showToast(e.message));
  }, [attemptId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnlock = async () => {
    if (!window.confirm(`Allow ${row.email} to sit the test once more?`)) return;
    setBusy(true);
    try {
      await unlockRetake(row.id, ctx?.email);
      showToast("Retake unlocked — they can start again on the same email.");
      onChanged();
      onClose();
    } catch (e) { showToast(e.message); }
    finally { setBusy(false); }
  };

  const handleNotes = async () => {
    setBusy(true);
    try { await saveNotes(row.id, notes); showToast("Notes saved."); onChanged(); }
    catch (e) { showToast(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 720 }}>
        <div className="modal-hdr">
          <h3 className="modal-title">{row?.full_name || "Attempt"}</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>

        {!row ? (
          <div className="modal-body" style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>Loading…</div>
        ) : (
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 13, color: "#5a5048" }}>
              {row.email} · {row.assessment_id} · attempt {row.attempt_no}
              {row.auto_submitted && <span style={{ marginLeft: 8, color: "#b45309", fontWeight: 700 }}>· auto-submitted on time-up</span>}
            </div>

            <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: 34, fontWeight: 700, lineHeight: 1 }}>
                  {row.score_total ?? "—"}<span style={{ fontSize: 16, color: "#8a7e72" }}> / {TOTAL_MARKS}</span>
                </div>
                <div style={{ marginTop: 6 }}><BandPill band={row.band} /></div>
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {SECTION_META.map((s) => (
                  <div key={s.id}>
                    <div style={{ fontSize: 11, color: "#8a7e72", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.name}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{row[s.key] ?? "—"} / {s.count}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ fontSize: 12, color: "#8a7e72" }}>
              Started {fmtDT(row.started_at)} · Submitted {fmtDT(row.submitted_at)} · Took {fmtDuration(row.duration_seconds)}
            </div>

            {/* §6.2 — read the sections, not just the total. Section A low / C
                high means practical experience with weak arithmetic; fine for a
                Site Supervisor, a concern for Procurement. */}
            <div className="card" style={{ background: "#faf8f5", fontSize: 12, color: "#5a5048", lineHeight: 1.5 }}>
              This score sets <b>queue priority only</b>. It is not a pass/fail and must never
              auto-reject a candidate with strong relevant experience.
            </div>

            {Array.isArray(row.review) && row.review.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {row.review.map((q) => (
                  <div key={q.n} style={{
                    border: "1px solid #e8e2d9", borderRadius: 12, padding: "10px 12px",
                    borderLeft: `3px solid ${q.is_correct ? "#16a34a" : q.chosen ? "#dc2626" : "#d6cec2"}`,
                  }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#8a7e72" }}>Q{q.n} · {q.section}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: q.is_correct ? "#16a34a" : q.chosen ? "#dc2626" : "#b0a898" }}>
                        {q.is_correct ? "Correct" : q.chosen ? "Wrong" : "Not answered"}
                      </span>
                    </div>
                    {q.scenario && <div style={{ fontSize: 12, color: "#8a7e72", marginTop: 4, lineHeight: 1.5 }}>{q.scenario}</div>}
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{q.q}</div>
                    <div style={{ fontSize: 12, marginTop: 5, color: "#5a5048" }}>
                      Chose: {q.chosen ? <b>{q.chosen}</b> : <i style={{ color: "#b0a898" }}>nothing</i>}
                    </div>
                    {!q.is_correct && (
                      <div style={{ fontSize: 12, marginTop: 2, color: "#16a34a" }}>Correct: <b>{q.correct}</b></div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#8a7e72" }}>
                {row.status === "in_progress"
                  ? "Still in progress — the paper is marked when it is submitted."
                  : "No marked paper on this attempt."}
              </div>
            )}

            <div className="form-field">
              <label className="form-label">HR notes</label>
              <textarea className="form-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything the panel should know…" />
            </div>
          </div>
        )}

        <div className="modal-footer">
          {row && !row.retake_unlocked && (
            <button className="btn-outline" onClick={handleUnlock} disabled={busy}>Allow retake</button>
          )}
          {row?.retake_unlocked && (
            <span style={{ fontSize: 12, color: "#b45309", fontWeight: 700, alignSelf: "center", marginRight: "auto" }}>
              Retake already unlocked
            </span>
          )}
          <button className="btn-outline" onClick={onClose}>Close</button>
          <button className="btn-gold" onClick={handleNotes} disabled={busy || !row}>Save notes</button>
        </div>
      </div>
    </div>
  );
}

export default function AssessmentResults() {
  const { showToast } = useApp();
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo]     = useState(() => new Date().toISOString().slice(0, 10));
  const [band, setBand]         = useState("");
  const [search, setSearch]     = useState("");
  const [sort, setSort]         = useState("score");
  const [openId, setOpenId]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchAttempts({ dateFrom, dateTo, band: band || undefined, search, sort }));
    } catch (e) { showToast(e.message || "Failed to load assessment attempts."); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, band, search, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const submitted  = rows.filter((r) => r.status === "submitted");
  const inProgress = rows.filter((r) => r.status === "in_progress").length;
  const avg = submitted.length
    ? (submitted.reduce((s, r) => s + (r.score_total || 0), 0) / submitted.length).toFixed(1)
    : "—";
  const strong = submitted.filter((r) => r.band === "STRONG").length;

  const exportCSV = () => {
    const rowsOut = [[
      "Email", "Name", "Attempt", "Score", "Out Of", "Aptitude/5", "Reasoning/5",
      "Industry/6", "Situational/4", "Band", "Status", "Started", "Submitted",
      "Duration (s)", "Auto Submitted", "Notes",
    ]];
    for (const r of rows) {
      rowsOut.push([
        r.email, (r.full_name || "").replace(/,/g, ";"), r.attempt_no,
        r.score_total ?? "", TOTAL_MARKS,
        r.score_section_a ?? "", r.score_section_b ?? "", r.score_section_c ?? "", r.score_section_d ?? "",
        r.band || "", r.status, r.started_at || "", r.submitted_at || "",
        r.duration_seconds ?? "", r.auto_submitted ? "yes" : "no",
        (r.notes || "").replace(/,/g, ";"),
      ]);
    }
    const csv = rowsOut.map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `assessment_${dateFrom}_${dateTo}.csv`;
    a.click();
  };

  return (
    <div className="fade-in">
      <div className="page-title">Assessment Results</div>
      <div className="page-sub">
        Walk-in first-level assessment · 20 marks · candidates identify themselves by email at{" "}
        <code style={{ fontSize: 12 }}>/test.html</code>. Sorted strongest first so the panel sees
        them first — this is a queue order, never a filter.
      </div>

      <div className="stat-row" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}>
        <div className="stat-card s1"><div className="stat-val">{submitted.length}</div><div className="stat-lbl">Papers Submitted</div></div>
        <div className="stat-card s3"><div className="stat-val">{avg}</div><div className="stat-lbl">Average Score</div></div>
        <div className="stat-card s2"><div className="stat-val">{strong}</div><div className="stat-lbl">Strong (17+)</div></div>
        <div className="stat-card s4"><div className="stat-val">{inProgress}</div><div className="stat-lbl">In Progress</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="form-field" style={{ minWidth: 180, flex: 1 }}>
          <label className="form-label">Search</label>
          <input className="form-input" placeholder="Email or name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-label">From</label>
          <input className="form-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-label">To</label>
          <input className="form-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-label">Band</label>
          <select className="form-input" value={band} onChange={(e) => setBand(e.target.value)}>
            <option value="">All bands</option>
            {Object.entries(BANDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Sort</label>
          <select className="form-input" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="score">Highest score first</option>
            <option value="recent">Most recent first</option>
          </select>
        </div>
        <button className="btn-outline" onClick={exportCSV} title="Export to CSV">⬇ Export CSV</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>Loading attempts…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>No attempts for the selected filters.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e8e2d9", background: "#faf8f5" }}>
                {["Candidate", "Score", "A / 5", "B / 5", "C / 6", "D / 4", "Band", "Submitted", "Took", ""].map((h, i) => (
                  <th key={i} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#8a7e72", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f0ece5", cursor: "pointer" }}
                  onClick={() => setOpenId(r.id)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#faf8f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                  <td style={{ padding: "11px 14px" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1612" }}>{r.full_name}</div>
                    <div style={{ fontSize: 11, color: "#8a7e72" }}>{r.email}</div>
                    {r.attempt_no > 1 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#b45309" }}>attempt {r.attempt_no}</span>
                    )}
                  </td>
                  <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                    {r.status === "submitted" ? (
                      <span style={{ fontFamily: "'Fraunces',serif", fontSize: 17, fontWeight: 700 }}>
                        {r.score_total}<span style={{ fontSize: 12, color: "#8a7e72" }}> / {TOTAL_MARKS}</span>
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: "rgba(245,158,11,0.12)", color: "#b45309" }}>
                        {r.status === "in_progress" ? "Writing…" : "Expired"}
                      </span>
                    )}
                  </td>
                  {SECTION_META.map((s) => (
                    <td key={s.id} style={{ padding: "11px 14px", fontSize: 13, color: "#5a5048" }}>{r[s.key] ?? "—"}</td>
                  ))}
                  <td style={{ padding: "11px 14px" }}><BandPill band={r.band} /></td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: "#5a5048", whiteSpace: "nowrap" }}>
                    {fmtDT(r.submitted_at)}
                    {r.auto_submitted && <div style={{ fontSize: 10, color: "#b45309" }}>time-up</div>}
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: "#8a7e72", whiteSpace: "nowrap" }}>{fmtDuration(r.duration_seconds)}</td>
                  <td style={{ padding: "11px 14px" }}>
                    {r.retake_unlocked && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#b45309" }} title={`Unlocked by ${r.unlocked_by || "HR"}`}>🔓</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {openId && <ReviewModal attemptId={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}
