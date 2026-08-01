import { useState, useEffect, useCallback } from "react";
import { fetchLive, fetchLatest, fetchTimeline, fetchTrackedEmployees, fetchSiteRings, fetchSiteDwell } from "../../services/locationService.js";
import { useApp } from "../../context/AppContext.jsx";
import TeamMap from "../location/TeamMap.jsx";
import RouteMap from "../location/RouteMap.jsx";
import { fetchOutOfSite } from "../../services/attendanceService.js";

const TABS = [
  { id: "live",      label: "Live" },
  { id: "map",       label: "Team Map" },
  { id: "sitetime",  label: "Site Time" },
  { id: "outofsite", label: "Out of Site" },
  { id: "timeline",  label: "Timeline" },
];

function fmtAgo(mins) {
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m ago`;
}

// ─── LIVE TAB ────────────────────────────────────────────────────────────────

function LiveTab() {
  const { showToast } = useApp();
  const [rows, setRows]   = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await fetchLive({ staleMinutes: 30 })); }
    catch { showToast("Failed to load live locations."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>Loading…</div>;
  if (!rows.length) return <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>No tracked employees have pinged in the last 30 minutes.</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
      {rows.map((r) => {
        const gpsOff = r.site_name === "GPS_OFF" || r.latitude == null;
        const outside = r.site_name === "Outside";
        const accent = gpsOff ? "#dc2626" : outside ? "#b45309" : "#16a34a";
        return (
          <div key={r.employee_id} className="card" style={{ borderLeft: `4px solid ${accent}`, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1612" }}>{r.employees?.full_name}</div>
                <div style={{ fontSize: 11, color: "#8a7e72" }}>{r.employees?.employee_code}{r.employees?.department ? ` · ${r.employees.department}` : ""}</div>
              </div>
              <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: accent, background: `${accent}1a` }}>
                {gpsOff ? "GPS Off" : r.site_name}
              </span>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#5a5048" }}>
              {fmtAgo(r.minutes_ago)}{r.accuracy != null ? ` · ±${Math.round(r.accuracy)}m` : ""}
            </div>
            {!gpsOff && (
              <a href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`} target="_blank" rel="noreferrer"
                 style={{ fontSize: 12, color: "#0a66c2", textDecoration: "none", marginTop: 4, display: "inline-block" }}>
                📍 Open in Maps
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── TEAM MAP TAB ────────────────────────────────────────────────────────────

function MapTab() {
  const { showToast } = useApp();
  const [people, setPeople] = useState([]);
  const [geos, setGeos]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [p, g] = await Promise.all([fetchLatest({ horizonDays: 7 }), fetchSiteRings()]);
        setPeople(p); setGeos(g);
      } catch { showToast("Failed to load team map."); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>Loading map…</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 12, color: "#5a5048" }}>
        <span>🟢 Live</span><span>⚪ Last seen</span><span>🔴 GPS off</span><span>🔵 Site radius</span>
      </div>
      <TeamMap people={people} geofences={geos} />
      {!people.length && <div style={{ padding: 16, textAlign: "center", color: "#8a7e72" }}>No location data in the last 7 days.</div>}
    </div>
  );
}

// ─── TIMELINE TAB ────────────────────────────────────────────────────────────

function TimelineTab() {
  const { showToast } = useApp();
  const [emps, setEmps]   = useState([]);
  const [empId, setEmpId] = useState("");
  const [date, setDate]   = useState(() => new Date().toISOString().slice(0, 10));
  const [geos, setGeos]   = useState([]);
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTrackedEmployees().then((e) => { setEmps(e); if (e[0]) setEmpId(e[0].id); }).catch(() => {});
    fetchSiteRings().then(setGeos).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!empId || !date) return;
    setLoading(true);
    try { setData(await fetchTimeline({ employeeId: empId, date })); }
    catch { showToast("Failed to load timeline."); }
    finally { setLoading(false); }
  }, [empId, date]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="form-field" style={{ minWidth: 220, flex: 1 }}>
          <label className="form-label">Employee</label>
          <select className="form-input" value={empId} onChange={(e) => setEmpId(e.target.value)}>
            {emps.length === 0 && <option value="">No tracked employees</option>}
            {emps.map((e) => <option key={e.id} value={e.id}>{e.employee_code} — {e.full_name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Date</label>
          <input className="form-input" type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>Loading…</div>
      ) : !data ? null : (
        <>
          <div className="stat-row" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
            <div className="stat-card s1"><div className="stat-val">{data.pings.length}</div><div className="stat-lbl">Pings</div></div>
            <div className="stat-card s3"><div className="stat-val">{(data.total_distance_m / 1000).toFixed(2)}</div><div className="stat-lbl">KM Travelled</div></div>
            <div className="stat-card s2"><div className="stat-val">{data.attendance.check_in ? new Date(data.attendance.check_in).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</div><div className="stat-lbl">Check In</div></div>
            <div className="stat-card s4"><div className="stat-val">{data.suspicious_count}</div><div className="stat-lbl">Suspicious</div></div>
          </div>

          <RouteMap pings={data.pings} geofences={geos} />

          {data.suspicious_count > 0 && (
            <div className="card" style={{ marginTop: 12, background: "#fff1f0", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 13 }}>
              ⚠️ {data.suspicious_count} ping(s) exceeded 120 km/h and were excluded from the distance total (likely GPS spoofing or cell-tower glitch). The selfie remains the real proof of presence.
            </div>
          )}

          {/* Movement table */}
          <div className="card" style={{ padding: 0, overflow: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e8e2d9", background: "#faf8f5" }}>
                  {["Time", "Site", "Distance", "Speed", "Phase", "Flag"].map((h) => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#8a7e72" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.pings.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f0ece5", background: p.suspicious ? "#fff5f5" : "" }}>
                    <td style={{ padding: "9px 12px", fontSize: 12 }}>{new Date(p.captured_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                    <td style={{ padding: "9px 12px", fontSize: 12, color: p.site_name === "Outside" ? "#dc2626" : p.site_name === "GPS_OFF" ? "#b45309" : "#1a1612" }}>{p.site_name || "—"}</td>
                    <td style={{ padding: "9px 12px", fontSize: 12 }}>{p.distance_from_prev_m} m</td>
                    <td style={{ padding: "9px 12px", fontSize: 12 }}>{p.speed_kmh} km/h</td>
                    <td style={{ padding: "9px 12px", fontSize: 12, color: "#8a7e72" }}>{p.phase}</td>
                    <td style={{ padding: "9px 12px", fontSize: 12 }}>{p.suspicious ? <span style={{ color: "#dc2626", fontWeight: 700 }}>⚠ teleport</span> : "—"}</td>
                  </tr>
                ))}
                {data.pings.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 30, textAlign: "center", color: "#8a7e72" }}>No pings for this day.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── OUT OF SITE TAB (punches whose GPS was clearly away from the chosen site) ─
function OutOfSiteTab() {
  const { showToast } = useApp();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo]     = useState(today);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await fetchOutOfSite({ dateFrom: from, dateTo: to + "T23:59:59" })); }
    catch { showToast("Failed to load off-site punches."); }
    finally { setLoading(false); }
  }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="form-field"><label className="form-label">From</label>
          <input className="form-input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="form-field"><label className="form-label">To</label>
          <input className="form-input" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>Loading…</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead><tr style={{ background: "#faf8f5" }}>
              {["When", "Employee", "Punch", "Chosen site", "Distance off", "Map"].map((h) => (
                <th key={h} style={{ padding: "10px 13px", textAlign: "left", fontSize: 10, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: ".4px", color: "#8a7e72", borderBottom: "1px solid #e8e2d9" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f0ece5" }}>
                  <td style={{ padding: "9px 13px", fontSize: 12 }}>{new Date(r.recorded_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  <td style={{ padding: "9px 13px", fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{r.employees?.full_name || "—"}</span>
                    <span style={{ color: "#8a7e72", fontFamily: "monospace", marginLeft: 6, fontSize: 11 }}>{r.employees?.employee_code}</span>
                  </td>
                  <td style={{ padding: "9px 13px", fontSize: 12, color: "#5a5048" }}>{r.type === "check_in" ? "Check in" : "Check out"}</td>
                  <td style={{ padding: "9px 13px", fontSize: 13 }}>{r.site_name || "—"}</td>
                  <td style={{ padding: "9px 13px", fontSize: 13, color: "#dc2626", fontWeight: 700 }}>{r.site_distance_m != null ? `${r.site_distance_m} m` : "—"}</td>
                  <td style={{ padding: "9px 13px", fontSize: 12 }}>
                    {r.latitude != null
                      ? <a href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`} target="_blank" rel="noreferrer" style={{ color: "#0a66c2", textDecoration: "none" }}>📍 open</a>
                      : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 30, textAlign: "center", color: "#8a7e72" }}>
                  No off-site punches in this range. (Only punches at a verified site can be flagged off-site.)</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── SITE TIME TAB (dwell: how long each person stayed at each site) ──────────

function fmtMins(m) {
  const t = Math.round(Number(m) || 0);
  const h = Math.floor(t / 60);
  return h > 0 ? `${h}h ${t % 60}m` : `${t}m`;
}

function SiteTimeTab() {
  const { showToast } = useApp();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo]     = useState(today);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await fetchSiteDwell({ from, to })); }
    catch { showToast("Failed to load site time."); }
    finally { setLoading(false); }
  }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  // Aggregate the per-day rows into per employee + site totals.
  const map = new Map();
  for (const r of rows) {
    const key = r.employee_id + "|" + (r.site_ref || r.site_name || "?");
    const cur = map.get(key) || { code: r.employee_code, name: r.full_name, site: r.site_name || "—", minutes: 0, sessions: 0, days: new Set() };
    cur.minutes += Number(r.minutes) || 0;
    cur.sessions += Number(r.sessions) || 0;
    cur.days.add(r.day);
    map.set(key, cur);
  }
  const grouped = [...map.values()].map((g) => ({ ...g, days: g.days.size })).sort((a, b) => b.minutes - a.minutes);
  const totalMins = grouped.reduce((s, g) => s + g.minutes, 0);

  return (
    <div>
      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="form-field"><label className="form-label">From</label>
          <input className="form-input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="form-field"><label className="form-label">To</label>
          <input className="form-input" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#8a7e72" }}>Loading…</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
            <thead><tr style={{ background: "#faf8f5" }}>
              {["Employee", "Site", "Days", "Sessions", "Time on site"].map((h) => (
                <th key={h} style={{ padding: "10px 13px", textAlign: "left", fontSize: 10, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: ".4px", color: "#8a7e72", borderBottom: "1px solid #e8e2d9" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {grouped.map((g, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f0ece5" }}>
                  <td style={{ padding: "9px 13px", fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{g.name}</span>
                    <span style={{ color: "#8a7e72", fontFamily: "monospace", marginLeft: 6, fontSize: 11 }}>{g.code}</span>
                  </td>
                  <td style={{ padding: "9px 13px", fontSize: 13 }}>{g.site}</td>
                  <td style={{ padding: "9px 13px", fontSize: 13, color: "#5a5048" }}>{g.days}</td>
                  <td style={{ padding: "9px 13px", fontSize: 13, color: "#5a5048" }}>{g.sessions}</td>
                  <td style={{ padding: "9px 13px", fontSize: 13, fontWeight: 700 }}>{fmtMins(g.minutes)}</td>
                </tr>
              ))}
              {grouped.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 30, textAlign: "center", color: "#8a7e72" }}>
                  No completed check-in→check-out sessions in this range.</td></tr>
              )}
            </tbody>
            {grouped.length > 0 && (
              <tfoot><tr style={{ background: "#faf8f5", borderTop: "2px solid #e8e2d9" }}>
                <td colSpan={4} style={{ padding: "10px 13px", fontSize: 12, fontWeight: 700, color: "#5a5048" }}>Total across all staff</td>
                <td style={{ padding: "10px 13px", fontSize: 13, fontWeight: 800 }}>{fmtMins(totalMins)}</td>
              </tr></tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

export default function LocationTracking() {
  const [tab, setTab] = useState("live");

  return (
    <div className="fade-in">
      <div className="page-title">Location Tracking</div>
      <div className="page-sub">Live positions, team map, and per-employee daily route for tracked (field) staff.</div>

      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid #e8e2d9" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="btn-ghost"
            style={{
              padding: "10px 18px", fontSize: 13, fontWeight: 700,
              borderBottom: tab === t.id ? "2px solid #e8a24a" : "2px solid transparent",
              color: tab === t.id ? "#1a1612" : "#8a7e72", borderRadius: 0,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "live"     && <LiveTab />}
      {tab === "map"      && <MapTab />}
      {tab === "sitetime"  && <SiteTimeTab />}
      {tab === "outofsite" && <OutOfSiteTab />}
      {tab === "timeline" && <TimelineTab />}
    </div>
  );
}
