import { useState, useEffect, useCallback, useMemo } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { fmtDate } from "../../helpers.js";
import { fetchEmployees } from "../../services/attendanceService.js";
import {
  CYCLE_STATUSES, cycleStatusMeta, REVIEW_STATUSES, reviewStatusMeta,
  fetchCycles, createCycle, updateCycle, deleteCycle,
  fetchReviews, addReviews, updateReview, deleteReview, fetchMyReviews, averageRating,
} from "../../services/performanceService.js";

// ─────────────────────────────────────────────────────────────────────
// Performance management — basic version.
//
// hr_admin runs review cycles here. Everyone else sees only their own
// reviews, which is also all RLS will return them. Deliberately small: see
// the migration header for what is NOT modelled and why inventing it would
// be worse than leaving it out.
// ─────────────────────────────────────────────────────────────────────

const OVERLAY = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const MODAL = { background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };

const RATINGS = ["", "1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5"];

function Pill({ meta }) {
  return (
    <span style={{ background: meta.bg, color: meta.color, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>
      {meta.label}
    </span>
  );
}

function Rating({ value }) {
  if (value === null || value === undefined) return <span style={{ color: "#c4bdb2" }}>—</span>;
  const n = Number(value);
  const color = n >= 4 ? "#3f7d4c" : n >= 3 ? "#c97a2a" : "#a3352f";
  return <span style={{ color, fontWeight: 800 }}>{n.toFixed(1)}</span>;
}

export default function Performance() {
  const { ctx, showToast } = useApp();
  const canManage = !!ctx?.is_hr_admin;

  const [cycles, setCycles]       = useState([]);
  const [cycleId, setCycleId]     = useState("");
  const [reviews, setReviews]     = useState([]);
  const [employees, setEmployees] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  const [newCycle, setNewCycle]   = useState(null); // null | form object
  const [addOpen, setAddOpen]     = useState(false);
  const [picked, setPicked]       = useState(new Set());
  const [editing, setEditing]     = useState(null); // null | review row
  const [saving, setSaving]       = useState(false);

  const empById = useMemo(() => {
    const m = {};
    employees.forEach((e) => { m[e.id] = e; });
    return m;
  }, [employees]);

  // ── Load ───────────────────────────────────────────────────────────
  const loadBase = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cs, mine] = await Promise.all([
        fetchCycles(),
        ctx?.employee_id ? fetchMyReviews(ctx.employee_id) : Promise.resolve([]),
      ]);
      setCycles(cs);
      setMyReviews(mine);
      // Land on the active cycle if there is one — that is the one being run.
      if (cs.length && !cycleId) {
        setCycleId((cs.find((c) => c.status === "active") || cs[0]).id);
      }
      if (canManage) setEmployees(await fetchEmployees());
    } catch (e) {
      setError(e?.message || "Could not load performance data.");
    }
    setLoading(false);
  }, [ctx?.employee_id, canManage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadBase(); }, [loadBase]);

  const loadReviews = useCallback(async () => {
    if (!cycleId) { setReviews([]); return; }
    try {
      setReviews(await fetchReviews(cycleId));
    } catch (e) {
      showToast(e.message, false);
    }
  }, [cycleId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadReviews(); }, [loadReviews]);

  const cycle = cycles.find((c) => c.id === cycleId) || null;

  // ── Cycle actions ──────────────────────────────────────────────────
  const saveCycle = async () => {
    const f = newCycle;
    if (!f.name.trim()) return showToast("Give the cycle a name, e.g. “H1 2026”.", false);
    if (!f.periodStart || !f.periodEnd) return showToast("Set the period start and end.", false);
    if (f.periodEnd < f.periodStart) return showToast("The period ends before it starts.", false);
    setSaving(true);
    try {
      const c = await createCycle({ ...f, ctx });
      setCycles((prev) => [c, ...prev]);
      setCycleId(c.id);
      setNewCycle(null);
      showToast(`Cycle "${c.name}" created. Add the people it covers.`);
    } catch (e) { showToast(e.message, false); }
    setSaving(false);
  };

  const setCycleStatus = async (status) => {
    try {
      const c = await updateCycle(cycle.id, { status });
      setCycles((prev) => prev.map((x) => (x.id === c.id ? c : x)));
      showToast(`Cycle marked ${cycleStatusMeta(status).label.toLowerCase()}.`);
    } catch (e) { showToast(e.message, false); }
  };

  const removeCycle = async () => {
    if (!window.confirm(
      `Delete the cycle "${cycle.name}"?\n\n` +
      `This also deletes its ${reviews.length} review${reviews.length === 1 ? "" : "s"}, ` +
      `including any ratings and comments already recorded. This cannot be undone.`
    )) return;
    try {
      await deleteCycle(cycle.id);
      const rest = cycles.filter((c) => c.id !== cycle.id);
      setCycles(rest);
      setCycleId(rest[0]?.id || "");
      showToast("Cycle deleted.");
    } catch (e) { showToast(e.message, false); }
  };

  // ── Review actions ─────────────────────────────────────────────────
  const openAdd = () => {
    setPicked(new Set());
    setAddOpen(true);
  };

  const confirmAdd = async () => {
    if (!picked.size) return showToast("Pick at least one person.", false);
    setSaving(true);
    try {
      await addReviews(cycleId, [...picked]);
      setAddOpen(false);
      showToast(`Added ${picked.size} ${picked.size === 1 ? "person" : "people"} to ${cycle.name}.`);
      await loadReviews();
    } catch (e) { showToast(e.message, false); }
    setSaving(false);
  };

  const saveReview = async () => {
    const r = editing;
    setSaving(true);
    try {
      const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
      const saved = await updateReview(r.id, {
        goals: r.goals?.trim() || null,
        self_rating: num(r.self_rating),
        self_comments: r.self_comments?.trim() || null,
        manager_rating: num(r.manager_rating),
        manager_comments: r.manager_comments?.trim() || null,
        final_rating: num(r.final_rating),
        status: r.status,
        // Stamp who did the manager assessment when one is recorded, rather
        // than assuming whoever is logged in did it.
        manager_id: num(r.manager_rating) !== null ? (r.manager_id || ctx?.employee_id || null) : r.manager_id,
        manager_submitted_at: num(r.manager_rating) !== null ? (r.manager_submitted_at || new Date().toISOString()) : r.manager_submitted_at,
        self_submitted_at: num(r.self_rating) !== null ? (r.self_submitted_at || new Date().toISOString()) : r.self_submitted_at,
      });
      setReviews((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
      setEditing(null);
      showToast("Review saved.");
    } catch (e) { showToast(e.message, false); }
    setSaving(false);
  };

  const removeReview = async (r) => {
    const who = empById[r.employee_id]?.full_name || "this person";
    if (!window.confirm(`Remove ${who} from ${cycle.name}? Any ratings and comments on this review are deleted.`)) return;
    try {
      await deleteReview(r.id);
      setReviews((prev) => prev.filter((x) => x.id !== r.id));
      showToast("Removed from the cycle.");
    } catch (e) { showToast(e.message, false); }
  };

  // ── Derived ────────────────────────────────────────────────────────
  const inCycle   = new Set(reviews.map((r) => r.employee_id));
  const available = employees.filter((e) => e.is_active !== false && !inCycle.has(e.id));
  const stats = {
    people:  reviews.length,
    self:    reviews.filter((r) => r.self_rating !== null).length,
    manager: reviews.filter((r) => r.manager_rating !== null).length,
    final:   reviews.filter((r) => r.final_rating !== null).length,
    avg:     averageRating(reviews, "final_rating"),
  };

  // ── Employee-only view ─────────────────────────────────────────────
  if (!canManage) {
    return (
      <div className="fade-in">
        <div className="page-title">Performance</div>
        <div className="page-sub">Your appraisal history. Only you and HR can see this.</div>
        <div style={{ marginTop: 20 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#8a7e72", fontSize: 13 }}>
              <span className="spinner" /> Loading…
            </div>
          ) : myReviews.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>📈</div>
              <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No reviews yet</div>
              <div style={{ fontSize: 13, color: "#8a7e72" }}>
                When HR opens a review cycle that includes you, it will appear here.
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {myReviews.map((r) => (
                <MyReviewCard key={r.id} r={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── HR view ────────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="page-title">Performance Management</div>
          <div className="page-sub">
            Run a review cycle, record self and manager assessments, agree a final rating.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {cycles.length > 0 && (
            <select className="form-input" style={{ width: 240 }} value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>{c.name} · {cycleStatusMeta(c.status).label}</option>
              ))}
            </select>
          )}
          <button
            className="btn-gold"
            onClick={() => setNewCycle({ name: "", periodStart: "", periodEnd: "", notes: "" })}
          >
            + New cycle
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ padding: 16, marginBottom: 14, borderColor: "#f3c9c9", background: "#fdecec", color: "#a3352f", fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#8a7e72", fontSize: 13 }}>
          <span className="spinner" /> Loading…
        </div>
      ) : !cycle ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>📈</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 17, marginBottom: 6 }}>No review cycles yet</div>
          <div style={{ fontSize: 13, color: "#8a7e72", maxWidth: 460, margin: "0 auto 16px" }}>
            A cycle is one appraisal period — "H1 2026", say. Create one, add the people
            it covers, then record their self and manager assessments.
          </div>
          <button className="btn-gold" onClick={() => setNewCycle({ name: "", periodStart: "", periodEnd: "", notes: "" })}>
            Create the first cycle
          </button>
        </div>
      ) : (
        <>
          {/* Cycle header */}
          <div className="card" style={{ padding: 18, marginBottom: 16, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 17 }}>{cycle.name}</span>
                <Pill meta={cycleStatusMeta(cycle.status)} />
              </div>
              <div style={{ fontSize: 12, color: "#8a7e72", marginTop: 4 }}>
                {fmtDate(cycle.period_start)} — {fmtDate(cycle.period_end)}
                {cycle.notes ? ` · ${cycle.notes}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {CYCLE_STATUSES.filter((s) => s.id !== cycle.status).map((s) => (
                <button key={s.id} className="btn-outline" style={{ fontSize: 12 }} onClick={() => setCycleStatus(s.id)}>
                  Mark {s.label}
                </button>
              ))}
              <button className="btn-ghost" style={{ fontSize: 12, color: "#a3352f" }} onClick={removeCycle}>Delete cycle</button>
            </div>
          </div>

          {/* Stats */}
          <div className="stat-row" style={{ marginBottom: 18 }}>
            {[
              { cls: "s1", val: stats.people,  lbl: "In this cycle" },
              { cls: "s2", val: stats.self,    lbl: "Self assessed" },
              { cls: "s3", val: stats.manager, lbl: "Manager assessed" },
              { cls: "s4", val: stats.avg === null ? "—" : stats.avg.toFixed(1), lbl: "Average final rating" },
            ].map((s) => (
              <div key={s.lbl} className={`stat-card ${s.cls}`}>
                <div className="stat-val">{s.val}</div>
                <div className="stat-lbl">{s.lbl}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
            <div className="section-title" style={{ margin: 0 }}>Reviews</div>
            <button className="btn-outline" style={{ fontSize: 12 }} onClick={openAdd}>+ Add people</button>
          </div>

          {reviews.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: "center", fontSize: 13, color: "#8a7e72" }}>
              Nobody is in this cycle yet. Use <b>+ Add people</b> to include the employees it covers.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                <thead>
                  <tr style={{ background: "#faf8f5" }}>
                    {["Employee", "Status", "Self", "Manager", "Final", ""].map((h, i) => (
                      <th key={h + i} style={{ textAlign: i > 1 && i < 5 ? "center" : "left", padding: "11px 14px", fontSize: 11, fontWeight: 800, color: "#8a7e72", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => {
                    const e = empById[r.employee_id];
                    return (
                      <tr key={r.id} style={{ borderTop: "1px solid #f0ece5" }}>
                        <td style={{ padding: "11px 14px" }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1a1612" }}>{e?.full_name || "Unknown employee"}</div>
                          <div style={{ fontSize: 11, color: "#8a7e72" }}>
                            {[e?.employee_code, e?.designation, e?.department].filter(Boolean).join(" · ")}
                          </div>
                        </td>
                        <td style={{ padding: "11px 14px" }}><Pill meta={reviewStatusMeta(r.status)} /></td>
                        <td style={{ padding: "11px 14px", textAlign: "center" }}><Rating value={r.self_rating} /></td>
                        <td style={{ padding: "11px 14px", textAlign: "center" }}><Rating value={r.manager_rating} /></td>
                        <td style={{ padding: "11px 14px", textAlign: "center" }}><Rating value={r.final_rating} /></td>
                        <td style={{ padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <button className="btn-outline" style={{ fontSize: 11 }} onClick={() => setEditing({ ...r })}>Open</button>
                          <button className="btn-ghost" style={{ fontSize: 11, color: "#a3352f", marginLeft: 6 }} onClick={() => removeReview(r)}>Remove</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* New cycle modal */}
      {newCycle && (
        <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && !saving && setNewCycle(null)}>
          <div style={MODAL}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 16, fontFamily: "'Fraunces',serif" }}>New review cycle</div>
              <button className="btn-ghost" onClick={() => setNewCycle(null)} style={{ fontSize: 18 }}>✕</button>
            </div>
            <div className="form-grid">
              <div className="form-field" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Name *</label>
                <input className="form-input" autoFocus value={newCycle.name}
                  onChange={(e) => setNewCycle((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. H1 2026" />
              </div>
              <div className="form-field">
                <label className="form-label">Period start *</label>
                <input className="form-input" type="date" value={newCycle.periodStart}
                  onChange={(e) => setNewCycle((f) => ({ ...f, periodStart: e.target.value }))} />
              </div>
              <div className="form-field">
                <label className="form-label">Period end *</label>
                <input className="form-input" type="date" value={newCycle.periodEnd}
                  onChange={(e) => setNewCycle((f) => ({ ...f, periodEnd: e.target.value }))} />
              </div>
              <div className="form-field" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} value={newCycle.notes}
                  onChange={(e) => setNewCycle((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional — what this cycle covers." />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn-outline" onClick={() => setNewCycle(null)} disabled={saving}>Cancel</button>
              <button className="btn-gold" onClick={saveCycle} disabled={saving}>
                {saving ? <><span className="spinner" /> Creating…</> : "Create cycle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add people modal */}
      {addOpen && (
        <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && !saving && setAddOpen(false)}>
          <div style={MODAL}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontWeight: 800, fontSize: 16, fontFamily: "'Fraunces',serif" }}>Add people to {cycle?.name}</div>
              <button className="btn-ghost" onClick={() => setAddOpen(false)} style={{ fontSize: 18 }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: "#8a7e72", marginBottom: 14 }}>
              {available.length} employee{available.length === 1 ? "" : "s"} not yet in this cycle.
            </div>

            {available.length > 0 && (
              <button
                className="btn-ghost"
                style={{ fontSize: 12, marginBottom: 8 }}
                onClick={() => setPicked(picked.size === available.length ? new Set() : new Set(available.map((e) => e.id)))}
              >
                {picked.size === available.length ? "Clear all" : `Select all ${available.length}`}
              </button>
            )}

            <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid #e8e2d9", borderRadius: 10 }}>
              {available.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "#8a7e72" }}>
                  Everyone is already in this cycle.
                </div>
              ) : available.map((e) => (
                <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid #f0ece5", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={picked.has(e.id)}
                    onChange={() => setPicked((prev) => {
                      const n = new Set(prev);
                      n.has(e.id) ? n.delete(e.id) : n.add(e.id);
                      return n;
                    })}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1612" }}>{e.full_name}</div>
                    <div style={{ fontSize: 11, color: "#8a7e72" }}>
                      {[e.employee_code, e.designation, e.department].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn-outline" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</button>
              <button className="btn-gold" onClick={confirmAdd} disabled={saving || !picked.size}>
                {saving ? <><span className="spinner" /> Adding…</> : `Add ${picked.size || ""}`.trim()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review editor */}
      {editing && (
        <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && !saving && setEditing(null)}>
          <div style={MODAL}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, fontFamily: "'Fraunces',serif" }}>
                  {empById[editing.employee_id]?.full_name || "Review"}
                </div>
                <div style={{ fontSize: 11, color: "#8a7e72", marginTop: 3 }}>{cycle?.name}</div>
              </div>
              <button className="btn-ghost" onClick={() => setEditing(null)} style={{ fontSize: 18 }}>✕</button>
            </div>

            <div className="form-grid">
              <div className="form-field" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Goals / KRAs for the period</label>
                <textarea className="form-input" rows={3} value={editing.goals || ""}
                  onChange={(e) => setEditing((r) => ({ ...r, goals: e.target.value }))}
                  placeholder="What was agreed at the start of the cycle." />
              </div>

              <div className="form-field">
                <label className="form-label">Self rating (1–5)</label>
                <select className="form-input" value={editing.self_rating ?? ""}
                  onChange={(e) => setEditing((r) => ({ ...r, self_rating: e.target.value }))}>
                  {RATINGS.map((v) => <option key={v} value={v}>{v || "Not rated"}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Manager rating (1–5)</label>
                <select className="form-input" value={editing.manager_rating ?? ""}
                  onChange={(e) => setEditing((r) => ({ ...r, manager_rating: e.target.value }))}>
                  {RATINGS.map((v) => <option key={v} value={v}>{v || "Not rated"}</option>)}
                </select>
              </div>

              <div className="form-field" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Self comments</label>
                <textarea className="form-input" rows={2} value={editing.self_comments || ""}
                  onChange={(e) => setEditing((r) => ({ ...r, self_comments: e.target.value }))} />
              </div>
              <div className="form-field" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Manager comments</label>
                <textarea className="form-input" rows={3} value={editing.manager_comments || ""}
                  onChange={(e) => setEditing((r) => ({ ...r, manager_comments: e.target.value }))} />
              </div>

              <div className="form-field">
                <label className="form-label">Final rating (1–5)</label>
                <select className="form-input" value={editing.final_rating ?? ""}
                  onChange={(e) => setEditing((r) => ({ ...r, final_rating: e.target.value }))}>
                  {RATINGS.map((v) => <option key={v} value={v}>{v || "Not concluded"}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Stage</label>
                <select className="form-input" value={editing.status}
                  onChange={(e) => setEditing((r) => ({ ...r, status: e.target.value }))}>
                  {REVIEW_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ fontSize: 11, color: "#8a7e72", marginTop: 12, lineHeight: 1.5 }}>
              The employee can read this review. Nobody else outside HR can.
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              <button className="btn-outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
              <button className="btn-gold" onClick={saveReview} disabled={saving}>
                {saving ? <><span className="spinner" /> Saving…</> : "Save review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MyReviewCard({ r }) {
  const c = r.performance_cycles || {};
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 16 }}>{c.name || "Review"}</div>
          <div style={{ fontSize: 12, color: "#8a7e72", marginTop: 2 }}>
            {c.period_start ? `${fmtDate(c.period_start)} — ${fmtDate(c.period_end)}` : ""}
          </div>
        </div>
        <Pill meta={reviewStatusMeta(r.status)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, marginTop: 14 }}>
        {[["Self", r.self_rating], ["Manager", r.manager_rating], ["Final", r.final_rating]].map(([k, v]) => (
          <div key={k} style={{ background: "#faf8f5", borderRadius: 9, padding: "10px 14px" }}>
            <div style={{ fontSize: 11, color: "#8a7e72", fontWeight: 700, textTransform: "uppercase" }}>{k}</div>
            <div style={{ fontSize: 18, marginTop: 3 }}><Rating value={v} /></div>
          </div>
        ))}
      </div>

      {r.goals && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8a7e72", textTransform: "uppercase", marginBottom: 4 }}>Goals</div>
          <div style={{ fontSize: 13, color: "#3a3028", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{r.goals}</div>
        </div>
      )}
      {r.manager_comments && (
        <div style={{ marginTop: 14, padding: 12, background: "#faf8f5", borderRadius: 10, border: "1px solid #e8e2d9" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8a7e72", textTransform: "uppercase", marginBottom: 4 }}>Manager comments</div>
          <div style={{ fontSize: 13, color: "#3a3028", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{r.manager_comments}</div>
        </div>
      )}
    </div>
  );
}
