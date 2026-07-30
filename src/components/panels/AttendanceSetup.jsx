import { useState, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext.jsx";
import {
  fetchSites, createSite, updateSite,
  fetchHolidays, addHoliday, deleteHoliday,
  fetchAttendanceSettings, saveAttendanceSettings,
} from "../../services/attendanceService.js";

// Replaces the HSIPL sheet's "Setting" tab: the site list employees pick from,
// the holiday calendar, and the shift/overtime rules that used to be buried in
// spreadsheet formulas.

const TABS = [
  { id: "sites",    label: "Sites & Offices" },
  { id: "holidays", label: "Holidays" },
  { id: "shift",    label: "Shift & Overtime" },
];

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ─── SITES ───────────────────────────────────────────────────────────────────

function SiteModal({ site, onSaved, onClose }) {
  const [f, setF] = useState(site ?? { name: "", code: "", latitude: "", longitude: "", radius_meters: 500, active: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [locBusy, setLocBusy] = useState(false);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const useMyLocation = () => {
    if (!navigator.geolocation) { setErr("This browser can't read a location."); return; }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setF((x) => ({ ...x, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) })); setLocBusy(false); },
      () => { setErr("Could not read your location."); setLocBusy(false); },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const save = async () => {
    if (!f.name.trim()) { setErr("A site name is required."); return; }
    const hasLat = f.latitude !== "" && f.latitude != null;
    const hasLng = f.longitude !== "" && f.longitude != null;
    if (hasLat !== hasLng) { setErr("Give both latitude and longitude, or neither."); return; }
    setBusy(true); setErr("");
    try {
      site?.id ? await updateSite(site.id, f) : await createSite(f);
      onSaved();
    } catch (e) { setErr(e.message || "Could not save the site."); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="modal-hdr">
          <h3 className="modal-title">{site?.id ? "Edit site" : "Add site"}</h3>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-grid">
            <div className="form-field" style={{ gridColumn: "span 2" }}>
              <label className="form-label">Site / office name *</label>
              <input className="form-input" value={f.name} onChange={set("name")} placeholder="Hero Homes Ludhiana" />
            </div>
            <div className="form-field">
              <label className="form-label">Code</label>
              <input className="form-input" value={f.code || ""} onChange={set("code")} placeholder="optional" />
            </div>
            <div className="form-field">
              <label className="form-label">Active</label>
              <select className="form-input" value={f.active ? "1" : "0"}
                onChange={(e) => setF((p) => ({ ...p, active: e.target.value === "1" }))}>
                <option value="1">Yes — employees can pick it</option>
                <option value="0">No — hidden from the list</option>
              </select>
            </div>
          </div>

          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 9, padding: "10px 13px", fontSize: 12, color: "#92400e" }}>
            Coordinates are <strong>optional</strong>. With them, a punch here is cross-checked against GPS and a
            mismatch is flagged for review — it is never blocked. Leave them blank rather than guessing:
            a wrong coordinate would flag every genuine punch at this site.
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">Latitude</label>
              <input className="form-input" value={f.latitude ?? ""} onChange={set("latitude")} placeholder="blank if unknown" />
            </div>
            <div className="form-field">
              <label className="form-label">Longitude</label>
              <input className="form-input" value={f.longitude ?? ""} onChange={set("longitude")} placeholder="blank if unknown" />
            </div>
            <div className="form-field">
              <label className="form-label">Allowed radius (m)</label>
              <input className="form-input" type="number" min={50} max={5000}
                value={f.radius_meters ?? 500} onChange={set("radius_meters")} />
            </div>
          </div>
          <button className="btn-outline" style={{ alignSelf: "flex-start" }} onClick={useMyLocation} disabled={locBusy}>
            {locBusy ? "Reading…" : "📍 Use my current location"}
          </button>
          {err && <div style={{ background: "#fff1f0", border: "1px solid #fecaca", borderRadius: 9, padding: "10px 13px", fontSize: 13, color: "#dc2626" }}>{err}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-gold" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

function SitesTab() {
  const { showToast } = useApp();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setSites(await fetchSites({ activeOnly: false })); }
    catch { showToast("Could not load sites."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = sites.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()));
  const withCoords = sites.filter((s) => s.latitude != null).length;

  return (
    <>
      <div className="stat-row" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 16, maxWidth: 560 }}>
        <div className="stat-card s1"><div className="stat-val">{sites.length}</div><div className="stat-lbl">Sites</div></div>
        <div className="stat-card s3"><div className="stat-val">{sites.filter((s) => s.active).length}</div><div className="stat-lbl">Active</div></div>
        <div className="stat-card s2"><div className="stat-val">{withCoords}</div><div className="stat-lbl">With GPS coords</div></div>
      </div>

      {withCoords === 0 && !loading && (
        <div className="card" style={{ marginBottom: 14, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 13 }}>
          No site has coordinates yet, so punches record the site the employee picked without a GPS cross-check —
          exactly like the old Google Form. Add coordinates site by site to switch verification on.
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "center" }}>
        <input className="form-input" style={{ maxWidth: 300 }} placeholder="Search sites…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-gold" onClick={() => setModal({})}>+ Add site</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        {loading ? <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>Loading…</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead><tr style={{ background: "#faf8f5" }}>
              {["Site", "Code", "GPS verification", "Radius", "Status", ""].map((h) => (
                <th key={h} style={{ padding: "10px 13px", textAlign: "left", fontSize: 10, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: ".4px", color: "#8a7e72", borderBottom: "1px solid #e8e2d9" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid #f0ece5" }}>
                  <td style={{ padding: "9px 13px", fontWeight: 600, fontSize: 13 }}>{s.name}</td>
                  <td style={{ padding: "9px 13px", fontSize: 12, color: "#8a7e72", fontFamily: "monospace" }}>{s.code || "—"}</td>
                  <td style={{ padding: "9px 13px", fontSize: 12 }}>
                    {s.latitude != null
                      ? <a href={`https://maps.google.com/?q=${s.latitude},${s.longitude}`} target="_blank" rel="noreferrer" style={{ color: "#0a66c2", textDecoration: "none" }}>
                          📍 {Number(s.latitude).toFixed(4)}, {Number(s.longitude).toFixed(4)}
                        </a>
                      : <span style={{ color: "#b0a898" }}>not set — no cross-check</span>}
                  </td>
                  <td style={{ padding: "9px 13px", fontSize: 12, color: "#5a5048" }}>{s.latitude != null ? `${s.radius_meters} m` : "—"}</td>
                  <td style={{ padding: "9px 13px" }}>
                    <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                      background: s.active ? "rgba(34,197,94,.12)" : "rgba(120,113,108,.12)", color: s.active ? "#16a34a" : "#78716c" }}>
                      {s.active ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td style={{ padding: "9px 13px", textAlign: "right" }}>
                    <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setModal(s)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modal && <SiteModal site={modal.id ? modal : null}
        onSaved={() => { setModal(null); load(); showToast("Site saved."); }}
        onClose={() => setModal(null)} />}
    </>
  );
}

// ─── HOLIDAYS ────────────────────────────────────────────────────────────────

function HolidaysTab() {
  const { showToast } = useApp();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await fetchHolidays(year)); }
    catch { showToast("Could not load holidays."); }
    finally { setLoading(false); }
  }, [year]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!date || !name.trim()) return showToast("Pick a date and give the holiday a name.", false);
    try { await addHoliday(date, name); setDate(""); setName(""); load(); showToast("Holiday added."); }
    catch (e) { showToast(e.message || "Could not add the holiday.", false); }
  };

  const remove = async (d, n) => {
    if (!window.confirm(`Remove ${n} (${d})? Days marked as holiday will become normal working days.`)) return;
    try { await deleteHoliday(d); load(); showToast("Holiday removed."); }
    catch { showToast("Could not remove the holiday.", false); }
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="form-field" style={{ maxWidth: 120 }}>
          <label className="form-label">Year</label>
          <select className="form-input" value={year} onChange={(e) => setYear(+e.target.value)}>
            {[thisYear + 1, thisYear, thisYear - 1, thisYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="form-field" style={{ maxWidth: 170 }}>
          <label className="form-label">Date</label>
          <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="form-field" style={{ minWidth: 200, flex: 1 }}>
          <label className="form-label">Holiday name</label>
          <input className="form-input" placeholder="Diwali" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="btn-gold" onClick={add}>+ Add holiday</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>Loading…</div>
          : rows.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>No holidays recorded for {year}.</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#faf8f5" }}>
              {["Date", "Day", "Holiday", ""].map((h) => (
                <th key={h} style={{ padding: "10px 13px", textAlign: "left", fontSize: 10, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: ".4px", color: "#8a7e72", borderBottom: "1px solid #e8e2d9" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.holiday_date} style={{ borderBottom: "1px solid #f0ece5" }}>
                  <td style={{ padding: "9px 13px", fontSize: 13 }}>
                    {new Date(h.holiday_date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td style={{ padding: "9px 13px", fontSize: 12, color: "#8a7e72" }}>
                    {DOW[new Date(h.holiday_date + "T00:00:00").getDay()]}
                  </td>
                  <td style={{ padding: "9px 13px", fontWeight: 600, fontSize: 13 }}>{h.name}</td>
                  <td style={{ padding: "9px 13px", textAlign: "right" }}>
                    <button className="btn-ghost" style={{ fontSize: 12, color: "#dc2626" }}
                      onClick={() => remove(h.holiday_date, h.name)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ─── SHIFT & OVERTIME ────────────────────────────────────────────────────────

function ShiftTab() {
  const { showToast } = useApp();
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetchAttendanceSettings().then(setS).catch(() => showToast("Could not load settings.")); }, []);

  const set = (k) => (e) => setS((p) => ({ ...p, [k]: e.target.value }));
  const setMin = (k) => (e) => setS((p) => ({ ...p, [k]: Math.max(0, Math.round(Number(e.target.value) * 60)) }));
  const toggleDow = (d) => setS((p) => ({
    ...p,
    weekend_dows: p.weekend_dows.includes(d) ? p.weekend_dows.filter((x) => x !== d) : [...p.weekend_dows, d].sort(),
  }));

  const save = async () => {
    setBusy(true);
    try {
      await saveAttendanceSettings({
        shift_start: s.shift_start, shift_end: s.shift_end, late_after: s.late_after,
        full_day_minutes: s.full_day_minutes, half_day_minutes: s.half_day_minutes,
        ot_after_minutes: s.ot_after_minutes, weekend_dows: s.weekend_dows,
      });
      showToast("Shift rules saved. Reports recalculate immediately.");
    } catch (e) { showToast(e.message || "Could not save.", false); }
    finally { setBusy(false); }
  };

  if (!s) return <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>Loading…</div>;

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <div style={{ fontSize: 12, color: "#8a7e72", marginBottom: 16 }}>
        These were hardcoded in the old spreadsheet's formulas. Every report — daily, monthly and overtime —
        recalculates from these values the moment you save, including historic months.
      </div>

      <div className="form-grid">
        <div className="form-field">
          <label className="form-label">Shift starts</label>
          <input className="form-input" type="time" value={s.shift_start?.slice(0, 5) || ""} onChange={set("shift_start")} />
        </div>
        <div className="form-field">
          <label className="form-label">Shift ends</label>
          <input className="form-input" type="time" value={s.shift_end?.slice(0, 5) || ""} onChange={set("shift_end")} />
        </div>
        <div className="form-field" style={{ gridColumn: "span 2" }}>
          <label className="form-label">Marked late after</label>
          <input className="form-input" type="time" value={s.late_after?.slice(0, 5) || ""} onChange={set("late_after")} />
          <div style={{ fontSize: 11, color: "#8a7e72", marginTop: 4 }}>A check-in later than this counts as Late.</div>
        </div>
        <div className="form-field">
          <label className="form-label">Full day after (hours)</label>
          <input className="form-input" type="number" step="0.25" min="1" max="16"
            value={(s.full_day_minutes / 60).toFixed(2)} onChange={setMin("full_day_minutes")} />
        </div>
        <div className="form-field">
          <label className="form-label">Half day after (hours)</label>
          <input className="form-input" type="number" step="0.25" min="0.5" max="12"
            value={(s.half_day_minutes / 60).toFixed(2)} onChange={setMin("half_day_minutes")} />
        </div>
        <div className="form-field" style={{ gridColumn: "span 2" }}>
          <label className="form-label">Overtime starts after (hours)</label>
          <input className="form-input" type="number" step="0.25" min="1" max="20"
            value={(s.ot_after_minutes / 60).toFixed(2)} onChange={setMin("ot_after_minutes")} />
          <div style={{ fontSize: 11, color: "#8a7e72", marginTop: 4 }}>
            Anything worked beyond this counts as OT. Your old sheet flagged a 9h07m day as OT, which is why this is 9.
          </div>
        </div>
      </div>

      <div className="form-field" style={{ marginTop: 8 }}>
        <label className="form-label">Weekly day off</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DOW.map((d, i) => (
            <button key={d} type="button" onClick={() => toggleDow(i)}
              style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                border: `1.5px solid ${s.weekend_dows.includes(i) ? "#e8a24a" : "#e8e2d9"}`,
                background: s.weekend_dows.includes(i) ? "rgba(232,162,74,.12)" : "#fff",
                fontWeight: s.weekend_dows.includes(i) ? 700 : 400, color: "#1a1612" }}>
              {d.slice(0, 3)}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "#8a7e72", marginTop: 6 }}>
          Staff flagged as Sunday workers are exempt — set that per person under Employees.
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <button className="btn-gold" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save rules"}</button>
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

export default function AttendanceSetup() {
  const [tab, setTab] = useState("sites");
  return (
    <div className="fade-in">
      <div className="page-title">Attendance Setup</div>
      <div className="page-sub">Sites employees can punch from, the holiday calendar, and the shift &amp; overtime rules.</div>

      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid #e8e2d9" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className="btn-ghost"
            style={{ padding: "10px 18px", fontSize: 13, fontWeight: 700, borderRadius: 0,
              borderBottom: tab === t.id ? "2px solid #e8a24a" : "2px solid transparent",
              color: tab === t.id ? "#1a1612" : "#8a7e72" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "sites" && <SitesTab />}
      {tab === "holidays" && <HolidaysTab />}
      {tab === "shift" && <ShiftTab />}
    </div>
  );
}
