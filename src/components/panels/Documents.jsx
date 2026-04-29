import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { fetchJoinings } from "../../services/joiningService.js";
import { fetchDocuments, updateDocument, DOC_TYPES } from "../../services/documentService.js";

const STATUS_COLOR = { pending: "#f59e0b", submitted: "#0ea5e9", verified: "#22c55e", rejected: "#ef4444", not_applicable: "#8a7e72" };
const STATUS_ICON  = { pending: "○", submitted: "●", verified: "✓", rejected: "✗", not_applicable: "—" };

export default function Documents() {
  const { showToast } = useApp();
  const [joinings, setJoinings] = useState([]);
  const [docs, setDocs] = useState({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [updating, setUpdating] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const jList = await fetchJoinings();
    setJoinings(jList);
    setLoading(false);
  }

  async function loadDocs(joiningId) {
    if (docs[joiningId]) return;
    const d = await fetchDocuments(joiningId);
    setDocs((prev) => ({ ...prev, [joiningId]: d }));
  }

  async function toggleExpand(joiningId) {
    if (expanded === joiningId) { setExpanded(null); return; }
    setExpanded(joiningId);
    await loadDocs(joiningId);
  }

  async function cycleStatus(doc) {
    const cycle = { pending: "not_applicable", submitted: "verified", verified: "pending", rejected: "pending", not_applicable: "pending" };
    const next = cycle[doc.status] || "pending";
    setUpdating(doc.id);
    try {
      const updated = await updateDocument(doc.id, { status: next, verified_by: next === "verified" ? "HR" : null, verified_at: next === "verified" ? new Date().toISOString() : null });
      setDocs((prev) => ({ ...prev, [doc.joining_id]: (prev[doc.joining_id] || []).map((d) => d.id === doc.id ? updated : d) }));
    } catch (e) { showToast(e.message, false); }
    setUpdating(null);
  }

  function pendingCount(joiningId) {
    const d = docs[joiningId] || [];
    return d.filter((x) => x.status === "pending").length;
  }

  function verifiedCount(joiningId) {
    const d = docs[joiningId] || [];
    return d.filter((x) => x.status === "verified").length;
  }

  return (
    <div className="fade-in">
      <div className="page-title">Documents</div>
      <div className="page-sub">Track document submission and verification for each joiner. Click a document status to cycle it.</div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" /></div>
      ) : joinings.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "#8a7e72", padding: 40 }}>No active onboardings. Start onboarding from the Onboarding panel first.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {joinings.map((j) => {
            const isOpen = expanded === j.id;
            const jDocs = docs[j.id] || [];
            return (
              <div key={j.id} className="card">
                <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => toggleExpand(j.id)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{j.applicants?.full_name}</div>
                    <div style={{ fontSize: 12, color: "#8a7e72" }}>{j.applicants?.jobs?.title} · Joining: {j.joining_date}</div>
                  </div>
                  {jDocs.length > 0 && (
                    <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
                      <span style={{ color: "#22c55e", fontWeight: 700 }}>{verifiedCount(j.id)} verified</span>
                      {pendingCount(j.id) > 0 && <span style={{ color: "#f97316", fontWeight: 700 }}>{pendingCount(j.id)} pending</span>}
                    </div>
                  )}
                  <span style={{ fontSize: 18, color: "#8a7e72", transform: isOpen ? "rotate(90deg)" : "none", transition: "0.2s" }}>›</span>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f0ece5" }}>
                    {jDocs.length === 0 ? (
                      <div style={{ textAlign: "center", color: "#8a7e72", padding: 20, fontSize: 13 }}>Loading documents...</div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                        {DOC_TYPES.map((dt) => {
                          const doc = jDocs.find((d) => d.doc_type === dt.id);
                          if (!doc) return null;
                          const busy = updating === doc.id;
                          return (
                            <div key={dt.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: "#faf8f5", border: `1px solid ${STATUS_COLOR[doc.status]}33`, cursor: "pointer", opacity: busy ? 0.5 : 1 }}
                              onClick={() => !busy && cycleStatus(doc)}>
                              <span style={{ fontSize: 14, color: STATUS_COLOR[doc.status], fontWeight: 800, width: 16, textAlign: "center" }}>
                                {busy ? "…" : STATUS_ICON[doc.status]}
                              </span>
                              <span style={{ fontSize: 12, color: "#1a1612", flex: 1 }}>{dt.label}</span>
                              {dt.mandatory && <span style={{ fontSize: 9, color: "#ef4444", fontWeight: 700 }}>REQ</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div style={{ marginTop: 10, fontSize: 11, color: "#8a7e72" }}>
                      Click a document to cycle: pending → not applicable → submitted → verified → pending
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
