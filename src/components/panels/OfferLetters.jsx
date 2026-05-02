import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { fetchOffers, createOffer, updateOffer, computeCtcBreakup } from "../../services/offerService.js";
import { updateApplicantStage } from "../../services/applicantService.js";

const OVERLAY = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const MODAL = { background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };

const STATUS_COLORS = { pending: "#f59e0b", accepted: "#22c55e", negotiating: "#0ea5e9", declined: "#ef4444", withdrawn: "#8a7e72" };

function fmt(n) { return n ? `₹${Math.round(n).toLocaleString("en-IN")}` : "—"; }

export default function OfferLetters() {
  const { applicants, refreshApplicants, showToast } = useApp();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ctcInput, setCtcInput] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [probation, setProbation] = useState(6);
  const [preview, setPreview] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setOffers(await fetchOffers());
    setLoading(false);
  }

  const offerApps = applicants.filter((a) => a.stage === "offer");

  function previewBreakup() {
    const gross = parseFloat(ctcInput);
    if (!gross || gross <= 0) return showToast("Enter a valid CTC amount.", false);
    setPreview(computeCtcBreakup(gross));
  }

  async function saveOffer() {
    const gross = parseFloat(ctcInput);
    if (!gross || gross <= 0) return showToast("Enter a valid CTC amount.", false);
    if (!joiningDate) return showToast("Select joining date.", false);
    setSaving(true);
    try {
      await createOffer({ applicant_id: createModal.id, job_id: createModal.jobId, ctc_gross_annual: gross, joining_date: joiningDate, probation_months: probation });
      await updateApplicantStage(createModal.id, "hired");
      await refreshApplicants();
      await load();
      setCreateModal(null);
      setPreview(null);
      showToast("Offer created. Candidate moved to Hired.");
    } catch (e) { showToast(e.message, false); }
    setSaving(false);
  }

  async function updateStatus(offer, status) {
    await updateOffer(offer.id, { offer_status: status });
    if (status === "accepted") {
      await updateApplicantStage(offer.applicant_id, "onboarding");
      await refreshApplicants();
    }
    await load();
    showToast(`Offer marked as ${status}.`);
  }

  return (
    <div className="fade-in">
      <div className="page-title">Offer Letters</div>
      <div className="page-sub">Create and track offer letters. CTC breakup is computed deterministically — never AI-generated.</div>

      {offerApps.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#5a5048", marginBottom: 12 }}>Ready for Offer ({offerApps.length})</div>
          {offerApps.map((app) => (
            <div key={app.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #f0ece5" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{app.name}</div>
                <div style={{ fontSize: 11, color: "#8a7e72" }}>Score: {app.score}</div>
              </div>
              <button className="btn-gold" style={{ fontSize: 12, padding: "5px 14px" }} onClick={() => { setCreateModal(app); setCtcInput(""); setJoiningDate(""); setProbation(6); setPreview(null); }}>
                Create Offer
              </button>
            </div>
          ))}
        </div>
      )}

      {loading ? <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" /></div> : (
        offers.length === 0 ? (
          <div className="card" style={{ textAlign: "center", color: "#8a7e72", padding: 40 }}>No offers created yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {offers.map((o) => (
              <div key={o.id} className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{o.applicants?.full_name}</div>
                  <div style={{ fontSize: 12, color: "#8a7e72" }}>{o.applicants?.jobs?.title}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e", marginTop: 2 }}>{fmt(o.ctc_gross_annual)} / yr</div>
                  {o.joining_date && <div style={{ fontSize: 11, color: "#8a7e72" }}>Joining: {new Date(o.joining_date).toLocaleDateString()}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[o.offer_status], background: `${STATUS_COLORS[o.offer_status]}18`, padding: "2px 8px", borderRadius: 20 }}>
                    {o.offer_status}
                  </span>
                  <button className="btn-outline" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setDetailModal(o)}>View Breakup</button>
                  {o.offer_status === "pending" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn-gold" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => updateStatus(o, "accepted")}>Accepted</button>
                      <button className="btn-ghost" style={{ fontSize: 11, padding: "4px 10px", color: "#ef4444" }} onClick={() => updateStatus(o, "declined")}>Declined</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {createModal && (
        <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && setCreateModal(null)}>
          <div style={MODAL}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, fontFamily: "'Fraunces',serif" }}>Create Offer — {createModal.name}</div>
              <button className="btn-ghost" onClick={() => setCreateModal(null)} style={{ fontSize: 18 }}>✕</button>
            </div>
            <div style={{ background: "#fef3c7", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#92400e" }}>
              CTC is entered by HR only. AI is never used to determine salary.
            </div>
            <div className="form-grid">
              <div className="form-field" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Gross Annual CTC (₹)</label>
                <input className="form-input" type="number" placeholder="e.g. 600000" value={ctcInput} onChange={(e) => { setCtcInput(e.target.value); setPreview(null); }} />
              </div>
              <div className="form-field">
                <label className="form-label">Joining Date</label>
                <input className="form-input" type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="form-label">Probation (months)</label>
                <input className="form-input" type="number" value={probation} onChange={(e) => setProbation(+e.target.value)} />
              </div>
            </div>
            <button className="btn-outline" style={{ marginTop: 8, marginBottom: 16 }} onClick={previewBreakup}>Preview CTC Breakup</button>
            {preview && (
              <div style={{ background: "#faf8f5", borderRadius: 10, padding: "14px", marginBottom: 16, fontSize: 13 }}>
                {[["Basic (40%)", preview.basic], ["HRA (20%)", preview.hra], ["Special Allowance (30%)", preview.special_allowance], ["PF Employee (12% of basic)", preview.pf_employee], ["PF Employer (12% of basic)", preview.pf_employer], ["Gratuity", preview.gratuity], ["Take Home / month", preview.take_home_monthly]].map(([l, v]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #ede6db" }}>
                    <span style={{ color: "#8a7e72" }}>{l}</span>
                    <span style={{ fontWeight: 700 }}>{fmt(v)}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-outline" onClick={() => setCreateModal(null)}>Cancel</button>
              <button className="btn-gold" onClick={saveOffer} disabled={saving}>{saving ? "Saving..." : "Create Offer"}</button>
            </div>
          </div>
        </div>
      )}

      {detailModal && (
        <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && setDetailModal(null)}>
          <div style={MODAL}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, fontFamily: "'Fraunces',serif" }}>CTC Breakup — {detailModal.applicants?.full_name}</div>
              <button className="btn-ghost" onClick={() => setDetailModal(null)} style={{ fontSize: 18 }}>✕</button>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#22c55e", marginBottom: 16 }}>{fmt(detailModal.ctc_gross_annual)} / year gross</div>
            {detailModal.ctc_breakup && Object.entries(detailModal.ctc_breakup).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0ece5", fontSize: 13 }}>
                <span style={{ color: "#5a5048", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                <span style={{ fontWeight: 700 }}>{fmt(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
