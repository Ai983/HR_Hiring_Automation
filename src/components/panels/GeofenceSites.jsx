import { useState, useEffect, useCallback } from "react";
import { fetchGeofences, createGeofence, updateGeofence, deleteGeofence } from "../../services/locationService.js";
import { useApp } from "../../context/AppContext.jsx";

const EMPTY = { site_id: "", site_name: "", latitude: "", longitude: "", radius_meters: 200, active: true };

function SiteModal({ site, onSave, onClose }) {
  const { showToast } = useApp();
  const [form, setForm] = useState(site ? { ...site } : EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");
  const [locBusy, setLocBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const useMyLocation = () => {
    if (!navigator.geolocation) { setErr("Geolocation not supported."); return; }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
        setLocBusy(false);
      },
      () => { setErr("Could not read your location."); setLocBusy(false); },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const handleSave = async () => {
    if (!form.site_name.trim())            { setErr("Site name is required."); return; }
    if (form.latitude === "" || isNaN(Number(form.latitude)))   { setErr("Valid latitude is required."); return; }
    if (form.longitude === "" || isNaN(Number(form.longitude))) { setErr("Valid longitude is required."); return; }
    setBusy(true); setErr("");
    try {
      if (site) await updateGeofence(site.id, form);
      else      await createGeofence(form);
      onSave();
    } catch (e) {
      setErr("Failed to save site. Try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="modal-hdr">
          <h3 className="modal-title">{site ? "Edit Site" : "Add Site"}</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">Site Name *</label>
              <input className="form-input" placeholder="Head Office" value={form.site_name} onChange={set("site_name")} />
            </div>
            <div className="form-field">
              <label className="form-label">Site Code</label>
              <input className="form-input" placeholder="HO-01 (optional)" value={form.site_id || ""} onChange={set("site_id")} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">Latitude *</label>
              <input className="form-input" placeholder="28.6139" value={form.latitude} onChange={set("latitude")} />
            </div>
            <div className="form-field">
              <label className="form-label">Longitude *</label>
              <input className="form-input" placeholder="77.2090" value={form.longitude} onChange={set("longitude")} />
            </div>
          </div>
          <button className="btn-outline" onClick={useMyLocation} disabled={locBusy} style={{ alignSelf: "flex-start" }}>
            {locBusy ? "Reading…" : "📍 Use my current location"}
          </button>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">Radius (metres)</label>
              <input className="form-input" type="number" min={20} max={5000} value={form.radius_meters} onChange={set("radius_meters")} />
            </div>
            <div className="form-field">
              <label className="form-label">Active</label>
              <select className="form-input" value={form.active ? "1" : "0"} onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === "1" }))}>
                <option value="1">Yes — enforced</option>
                <option value="0">No — disabled</option>
              </select>
            </div>
          </div>
          {err && <div style={{ background: "#fff1f0", border: "1px solid #fecaca", borderRadius: 9, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>{err}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-gold" onClick={handleSave} disabled={busy}>{busy ? "Saving…" : site ? "Save Changes" : "Add Site"}</button>
        </div>
      </div>
    </div>
  );
}

export default function GeofenceSites() {
  const { showToast } = useApp();
  const [sites, setSites]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState(null); // null | { site }

  const load = useCallback(async () => {
    setLoading(true);
    try { setSites(await fetchGeofences()); }
    catch { showToast("Failed to load sites."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (site) => {
    if (!window.confirm(`Delete site "${site.site_name}"? Punches will no longer match it.`)) return;
    try { await deleteGeofence(site.id); showToast("Site deleted."); load(); }
    catch { showToast("Failed to delete site."); }
  };

  const activeCount = sites.filter((s) => s.active).length;

  return (
    <div className="fade-in">
      <div className="page-title">Geofence Sites</div>
      <div className="page-sub">Define authorised office/site locations. Tracked employees are geofence-checked against active sites on punch in/out.</div>

      <div className="stat-row" style={{ gridTemplateColumns: "repeat(2,1fr)", marginBottom: 20, maxWidth: 420 }}>
        <div className="stat-card s1"><div className="stat-val">{sites.length}</div><div className="stat-lbl">Total Sites</div></div>
        <div className="stat-card s3"><div className="stat-val">{activeCount}</div><div className="stat-lbl">Active</div></div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button className="btn-gold" onClick={() => setModal({ site: null })}>+ Add Site</button>
      </div>

      {activeCount === 0 && !loading && (
        <div className="card" style={{ marginBottom: 16, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 13 }}>
          ⚠️ No active sites. Until you add one, punches from tracked employees are allowed but recorded as <strong>unconfirmed</strong> (flagged for review).
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>Loading sites…</div>
        ) : sites.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>No sites yet. Add your first authorised location.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e8e2d9", background: "#faf8f5" }}>
                {["Site", "Coordinates", "Radius", "Status", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#8a7e72", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid #f0ece5" }}>
                  <td style={{ padding: "11px 14px" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1612" }}>{s.site_name}</div>
                    {s.site_id && <div style={{ fontSize: 11, color: "#8a7e72", fontFamily: "monospace" }}>{s.site_id}</div>}
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 12 }}>
                    <a href={`https://maps.google.com/?q=${s.latitude},${s.longitude}`} target="_blank" rel="noreferrer" style={{ color: "#0a66c2", textDecoration: "none" }}>
                      📍 {Number(s.latitude).toFixed(5)}, {Number(s.longitude).toFixed(5)}
                    </a>
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 13, color: "#5a5048" }}>{s.radius_meters} m</td>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.active ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: s.active ? "#16a34a" : "#dc2626" }}>
                      {s.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setModal({ site: s })}>Edit</button>
                      <button className="btn-ghost" style={{ fontSize: 12, color: "#dc2626" }} onClick={() => handleDelete(s)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <SiteModal
          site={modal.site}
          onSave={() => { setModal(null); load(); showToast(modal.site ? "Site updated." : "Site added."); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
