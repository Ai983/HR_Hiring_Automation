// ============================================================
// QuestionBank — HR's read-only view of every assessment paper, with answers.
//
// Built so the 171 answers can actually be signed off (§9.3 of
// HAGERSTONE_DRIVE_AND_ASSESSMENT.md). Until now the only way to read the key
// was to open the TypeScript bank on the server, which is not something HR can
// or should do.
//
// THE ANSWER KEY IS STILL NOT IN THIS BUNDLE. Nothing here imports a question
// bank. The paper is fetched at runtime from the `assessment` edge function,
// which requires a real Hub session AND the hireflow module before it returns
// a single answer. That is the whole reason this is a fetch and not an import:
// an import would put every answer into the JavaScript that /test.html and
// /test2.html serve to candidates' phones.
//
// Read-only on purpose. Papers are versioned, never edited in place once they
// have been sat (§7.4) — so editing here would be actively wrong. Feedback goes
// to whoever maintains the bank, who mints the next version.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchPaper, fetchPaperPositions } from "../../services/assessmentService.js";
import { useApp } from "../../context/AppContext.jsx";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

const BAND_COLOURS = {
  STRONG:    { bg: "rgba(34,197,94,0.12)",  color: "#16a34a" },
  AVERAGE:   { bg: "rgba(14,165,233,0.12)", color: "#0369a1" },
  WEAK:      { bg: "rgba(245,158,11,0.12)", color: "#b45309" },
  BELOW_BAR: { bg: "rgba(239,68,68,0.10)",  color: "#dc2626" },
};

/** "13–15", "9–12", "0–5" — derived from the cuts the server sent. */
function bandRange(bands, i, outOf) {
  const upper = i === 0 ? outOf : bands[i - 1].min - 1;
  return bands[i].min === upper ? `${upper}` : `${bands[i].min}–${upper}`;
}

export default function QuestionBank() {
  const { showToast } = useApp();

  const [kind, setKind]           = useState("L1");
  const [position, setPosition]   = useState("");
  const [positions, setPositions] = useState([]);
  const [paper, setPaper]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [showAnswers, setShowAnswers] = useState(true);
  const [search, setSearch]       = useState("");

  useEffect(() => {
    fetchPaperPositions()
      .then((list) => {
        setPositions(list);
        setPosition((p) => p || list[0]?.position || "");
      })
      .catch((e) => showToast(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (kind === "ROLE" && !position) return;
    setLoading(true);
    setError("");
    try {
      setPaper(await fetchPaper({ kind, position }));
    } catch (e) {
      setPaper(null);
      setError(e.message || "Could not load the paper.");
    } finally {
      setLoading(false);
    }
  }, [kind, position]);

  useEffect(() => { load(); }, [load]);

  const sections = paper?.sections || [];
  const outOf = paper?.total_questions ?? 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return paper?.questions || [];
    return (paper?.questions || []).filter((x) =>
      [x.q, x.scenario, x.explanation, ...(x.options || [])]
        .filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [paper, search]);

  const bySection = useMemo(() => {
    const map = {};
    for (const q of filtered) (map[q.section] ||= []).push(q);
    return map;
  }, [filtered]);

  return (
    <div className="fade-in">
      <div className="page-title">Question Bank</div>
      <div className="page-sub">
        Every assessment paper with its correct answers and the reasoning behind each one.
        Level 1 is the general paper all 13 positions sit; level 2 is role-specific.
        <b> Read-only</b> — a paper is never edited once candidates have sat it; a change
        mints the next version.
      </div>

      {/* §9.3. This is the whole point of the page, so it is not a footnote. */}
      <div className="card" style={{ marginBottom: 16, background: "#fffaf0", borderLeft: "3px solid #d97706", fontSize: 13, color: "#5a5048", lineHeight: 1.55 }}>
        <b>These answers are engineering judgement, not signed-off Hagerstone policy.</b>{" "}
        They are strongest claims on the level-2 papers, where each one says how a named role
        is expected to work — that a variation is raised before extra work starts, that a pour
        is held for missing sleeves, that a vendor's gift is declined and reported. A candidate
        can defensibly argue any of them at interview. If one does not match how Hagerstone
        actually works, that is a content fix, not a marking bug.
      </div>

      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="form-field">
          <label className="form-label">Test</label>
          <select className="form-input" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="L1">Level 1 — General</option>
            <option value="ROLE">Level 2 — Role</option>
          </select>
        </div>
        {kind === "ROLE" && (
          <div className="form-field" style={{ minWidth: 220 }}>
            <label className="form-label">Position</label>
            <select className="form-input" value={position} onChange={(e) => setPosition(e.target.value)}>
              {positions.map((p) => (
                <option key={p.position} value={p.position}>{p.position}</option>
              ))}
            </select>
          </div>
        )}
        <div className="form-field" style={{ minWidth: 200, flex: 1 }}>
          <label className="form-label">Search this paper</label>
          <input className="form-input" placeholder="Word in a question, option or reason…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn-outline" onClick={() => setShowAnswers((s) => !s)}>
          {showAnswers ? "Hide answers" : "Show answers"}
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>Loading paper…</div>
      ) : error ? (
        <div className="card" style={{ padding: 24, color: "#a3352f", background: "#fdecec", border: "1px solid #f3c9c9" }}>
          {error}
        </div>
      ) : !paper ? null : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 11, color: "#8a7e72", textTransform: "uppercase", letterSpacing: "0.5px" }}>Paper</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {paper.position || "First-Level Assessment"}
                </div>
                <code style={{ fontSize: 11, color: "#8a7e72" }}>{paper.assessment_id}</code>
                {paper.department && (
                  <div style={{ fontSize: 12, color: "#8a7e72", marginTop: 2 }}>{paper.department}</div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#8a7e72", textTransform: "uppercase", letterSpacing: "0.5px" }}>Format</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {paper.total_questions} questions · {paper.total_questions} marks · {paper.duration_minutes} min
                </div>
                <div style={{ fontSize: 12, color: "#8a7e72" }}>1 mark each · no negative marking</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#8a7e72", textTransform: "uppercase", letterSpacing: "0.5px" }}>Sections</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 3 }}>
                  {sections.map((s) => (
                    <span key={s.id} style={{ fontSize: 12 }}>
                      <b>{s.id}</b> {s.name} <span style={{ color: "#8a7e72" }}>({s.count})</span>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#8a7e72", textTransform: "uppercase", letterSpacing: "0.5px" }}>Bands</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 3 }}>
                  {(paper.bands || []).map((b, i) => {
                    const c = BAND_COLOURS[b.band] || {};
                    return (
                      <span key={b.band} style={{ padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color, whiteSpace: "nowrap" }}>
                        {b.label} {bandRange(paper.bands, i, outOf)}
                      </span>
                    );
                  })}
                </div>
                {/* §6.3 — say it right next to the bands, where it gets read. */}
                <div style={{ fontSize: 11, color: "#8a7e72", marginTop: 5, maxWidth: 300, lineHeight: 1.45 }}>
                  A band sets who the panel sees first. It is never a pass mark and must not
                  auto-reject anyone.
                </div>
              </div>
            </div>
          </div>

          {search && (
            <div style={{ fontSize: 12, color: "#8a7e72", marginBottom: 10 }}>
              {filtered.length} of {paper.questions.length} questions match “{search}”.
            </div>
          )}

          {sections.map((s) => {
            const qs = bySection[s.id] || [];
            if (!qs.length) return null;
            return (
              <div key={s.id} style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontFamily: "'Fraunces',serif", fontSize: 17, fontWeight: 700 }}>
                    Section {s.id}
                  </span>
                  <span style={{ fontSize: 14, color: "#5a5048" }}>{s.name}</span>
                  <span style={{ fontSize: 12, color: "#8a7e72" }}>· {s.count} mark{s.count > 1 ? "s" : ""}</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {qs.map((q) => (
                    <div key={q.n} className="card" style={{ padding: "14px 16px" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#8a7e72", marginBottom: 4 }}>
                        Q{q.n}
                      </div>
                      {q.scenario && (
                        <div style={{ fontSize: 13, color: "#5a5048", background: "#faf8f5", borderRadius: 8, padding: "8px 10px", marginBottom: 8, lineHeight: 1.5 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#8a7e72", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 2 }}>
                            Situation
                          </span>
                          {q.scenario}
                        </div>
                      )}
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{q.q}</div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {q.options.map((opt, i) => {
                          const correct = showAnswers && i === q.answer;
                          return (
                            <div key={i} style={{
                              display: "flex", gap: 8, alignItems: "flex-start",
                              fontSize: 13, lineHeight: 1.45, padding: "6px 9px", borderRadius: 8,
                              background: correct ? "rgba(34,197,94,0.10)" : "transparent",
                              border: `1px solid ${correct ? "rgba(34,197,94,0.35)" : "#f0ece5"}`,
                              color: correct ? "#15803d" : "#5a5048",
                              fontWeight: correct ? 700 : 400,
                            }}>
                              <span style={{ fontWeight: 700, color: correct ? "#16a34a" : "#b0a898", minWidth: 14 }}>
                                {LETTERS[i]}
                              </span>
                              <span>{opt}</span>
                              {correct && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>✓ correct</span>}
                            </div>
                          );
                        })}
                      </div>

                      {showAnswers && q.explanation && (
                        <div style={{ fontSize: 12, color: "#5a5048", marginTop: 9, paddingTop: 9, borderTop: "1px dashed #e8e2d9", lineHeight: 1.5 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#8a7e72", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Why
                          </span>
                          <div style={{ marginTop: 2 }}>{q.explanation}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="card" style={{ fontSize: 12, color: "#8a7e72", lineHeight: 1.55 }}>
            <b>Candidates never see this.</b> They are shown their total and their section
            scores — not the band, and not the correct answers. Options are also shuffled per
            candidate, so the letters above are the canonical order, not what anyone sat.
            The paper is not AI-proof and cannot be made so; invigilation is the control.
          </div>
        </>
      )}
    </div>
  );
}
