import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../supabaseClient.js";
import { signIn, signOut, getSession, fetchContext, consumeSsoHandoff } from "../../services/authService.js";
import { createLeaveRequest, fetchPaidDaysUsedThisMonth, fetchLeaveAllowance } from "../../services/leaveService.js";
import { insertPing } from "../../services/locationService.js";
import { fetchSites, fetchEmployeeProfile } from "../../services/attendanceService.js";
import { evaluateGeofence, pillState } from "../../lib/geofence.js";
import AttendanceHistory from "./AttendanceHistory.jsx";
import { notifyAttendance, notifyLeaveRequest } from "../../services/whatsappService.js";
import {
  LEAVE_TYPES, REQUESTABLE_LEAVE_TYPES, APPROVERS, PAID_LEAVE_PER_MONTH,
  countLeaveDays, splitPaidUnpaid,
} from "../../leaveConfig.js";
import "./AttendancePortal.css";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtTime(date) {
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}
function fmtDate(date) {
  return date.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function todayRange() {
  const s = new Date(); s.setHours(0, 0, 0, 0);
  const e = new Date(); e.setHours(23, 59, 59, 999);
  return { start: s.toISOString(), end: e.toISOString() };
}

// Acquire the MOST ACCURATE GPS fix within a time window. Phones return a
// coarse network fix first (±500–2000m) then refine to a real lock (±5–20m);
// taking the first fix is why on-site staff saw "outside". So we watch, keep
// the best reading, resolve early at ≤desiredAccuracy, and always clean up.
function getBestPosition({ maxWaitMs = 15000, desiredAccuracy = 40 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("no-geolocation")); return; }
    let best = null;
    let done = false;
    let id = null;
    const finish = (val, err) => {
      if (done) return;
      done = true;
      if (id != null) navigator.geolocation.clearWatch(id);
      clearTimeout(timer);
      if (val) resolve(val); else reject(err || new Error("timeout"));
    };
    id = navigator.geolocation.watchPosition(
      (pos) => {
        const c = pos.coords;
        if (!best || c.accuracy < best.accuracy) best = { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy };
        if (best.accuracy <= desiredAccuracy) finish(best);
      },
      (e) => { if (!best) finish(null, e); },
      { enableHighAccuracy: true, timeout: maxWaitMs, maximumAge: 0 }
    );
    const timer = setTimeout(() => finish(best), maxWaitMs);
  });
}

async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "en" } }
    );
    const d = await r.json();
    return d.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

async function uploadSelfie(base64, employeeCode) {
  if (!supabase) return null;
  try {
    const blob = await fetch(base64).then((r) => r.blob());
    const path = `${employeeCode}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("selfies").upload(path, blob, { contentType: "image/jpeg" });
    if (error) return null;
    const { data } = supabase.storage.from("selfies").getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

// ─── LOGIN SCREEN ────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr]           = useState("");
  const [busy, setBusy]         = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setErr("Enter your email and password."); return; }
    setBusy(true); setErr("");
    try {
      if (!supabase) { setErr("Not connected. Check configuration."); setBusy(false); return; }
      await signIn(email, password);
      const ctx = await fetchContext();
      if (!ctx) { setErr("Your login isn't linked to an employee record. Contact HR."); await signOut(); setBusy(false); return; }
      if (!ctx.modules?.includes("attendance")) { setErr("You don't have attendance access. Contact HR."); await signOut(); setBusy(false); return; }
      onLogin({ id: ctx.employee_id, employee_code: ctx.employee_code, full_name: ctx.name, role: ctx.role, track_location: ctx.track_location });
    } catch (ex) {
      setErr(ex?.message?.includes("Invalid") ? "Invalid email or password." : (ex?.message || "Sign in failed."));
      setBusy(false);
    }
  };

  return (
    <div className="ap-login">
      <div className="ap-brand">
        <div className="ap-logo">H</div>
        <div>
          <div className="ap-company">Hagerstone</div>
          <div className="ap-tagline">Employee Attendance Portal</div>
        </div>
      </div>

      <form className="ap-form" onSubmit={handleSubmit}>
        <h2 className="ap-form-title">Sign In</h2>

        <div className="ap-field">
          <label className="ap-label">Email</label>
          <input className="ap-input" type="email" placeholder="you@hagerstone.com" value={email}
            onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus />
        </div>

        <div className="ap-field">
          <label className="ap-label">Password</label>
          <input className="ap-input" type="password" placeholder="Your Hagerstone Hub password" value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>

        {err && <div className="ap-error">{err}</div>}

        <button className="ap-btn-primary" type="submit" disabled={busy}>
          {busy ? <span className="ap-spinner" /> : null}
          {busy ? "Signing in…" : "Continue"}
        </button>
      </form>

      <p className="ap-help">Use your Hagerstone Hub login. Trouble? Contact <strong>hr@hagerstone.com</strong></p>
    </div>
  );
}

// ─── CAMERA ──────────────────────────────────────────────────────────────────

function Camera({ onCapture, onCancel }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [err, setErr]     = useState("");

  useEffect(() => {
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
        streamRef.current = s;
        videoRef.current.srcObject = s;
        videoRef.current.onloadedmetadata = () => setReady(true);
      } catch (e) {
        setErr("Camera access denied. Please allow camera permission and retry.");
      }
    })();
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const capture = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width  = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.85);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCapture(dataUrl);
  };

  return (
    <div className="ap-camera-wrap">
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {err ? (
        <div className="ap-camera-err">
          <span style={{ fontSize: 32 }}>📷</span>
          <p>{err}</p>
          <button className="ap-btn-outline" onClick={onCancel}>Skip Camera</button>
        </div>
      ) : (
        <>
          <video ref={videoRef} className="ap-video" autoPlay playsInline muted />
          {ready && (
            <div className="ap-camera-actions">
              <button className="ap-btn-outline" onClick={onCancel}>Skip</button>
              <button className="ap-btn-capture" onClick={capture}>📸 Take Photo</button>
            </div>
          )}
          {!ready && <div className="ap-camera-loading"><span className="ap-spinner" /> Starting camera…</div>}
        </>
      )}
    </div>
  );
}

// ─── LEAVE REQUEST FORM ──────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function LeaveForm({ employee, onCancel, onSubmitted }) {
  const [requestTo, setRequestTo] = useState("");
  const [leaveType, setLeaveType] = useState("");
  const [reason, setReason]       = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");
  const [usedThisMonth, setUsed]  = useState(0);
  const [allowance, setAllowance] = useState(PAID_LEAVE_PER_MONTH);
  const [loadingBal, setLoadingBal] = useState(true);
  const [busy, setBusy]           = useState(false);
  const [err, setErr]             = useState("");

  const typeMeta = LEAVE_TYPES.find((t) => t.value === leaveType);
  const isFixed  = typeMeta?.fixedDays != null;   // half-day / short-leave: one date only

  // Load how many paid days the employee has already used this month.
  useEffect(() => {
    let alive = true;
    Promise.all([
      fetchPaidDaysUsedThisMonth(employee.id),
      fetchLeaveAllowance(employee.id, PAID_LEAVE_PER_MONTH),
    ])
      .then(([used, allow]) => { if (alive) { setUsed(used); setAllowance(allow); setLoadingBal(false); } })
      .catch(() => { if (alive) setLoadingBal(false); });
    return () => { alive = false; };
  }, [employee.id]);

  // Half-day leave only spans a single date.
  useEffect(() => {
    if (isFixed && startDate) setEndDate(startDate);
  }, [isFixed, startDate]);

  // Live day split for the preview banner.
  const requestedDays = countLeaveDays(startDate, isFixed ? startDate : endDate, leaveType);
  const { paidLeft, paidDays, unpaidDays } = splitPaidUnpaid(usedThisMonth, requestedDays, allowance);

  const handleSubmit = async () => {
    setErr("");
    if (!requestTo)              { setErr("Please choose who you're requesting leave from."); return; }
    if (!leaveType)             { setErr("Please select a type of leave."); return; }
    if (!startDate)             { setErr("Please pick a start date."); return; }
    if (!isFixed && !endDate)   { setErr("Please pick an end date."); return; }
    if (requestedDays <= 0)     { setErr("End date can't be before the start date."); return; }
    if (!reason.trim())         { setErr("Please add a short reason for the leave."); return; }

    setBusy(true);
    try {
      const leavePayload = {
        employee_id: employee.id,
        request_to:  requestTo,
        leave_type:  leaveType,
        reason,
        start_date:  startDate,
        end_date:    isFixed ? startDate : endDate,
        total_days:  requestedDays,
        paid_days:   paidDays,
        unpaid_days: unpaidDays,
      };
      await createLeaveRequest(leavePayload);
      // Fire WhatsApp notifications (approver + employee); never block the flow.
      notifyLeaveRequest(employee, leavePayload).catch(() => {});
      onSubmitted({ days: requestedDays, paidDays, unpaidDays });
    } catch (e) {
      setErr("Couldn't submit your request. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="ap-shell">
      <div className="ap-leave-head">
        <button className="ap-logout" onClick={onCancel}>← Back</button>
        <div className="ap-section-title">Apply for Leave</div>
      </div>

      {/* Balance banner */}
      <div className={`ap-balance ${paidLeft > 0 ? "ok" : "none"}`}>
        {loadingBal ? (
          <><span className="ap-spinner-sm" /> Checking your leave balance…</>
        ) : (
          <>
            <div className="ap-balance-top">
              <span className="ap-balance-big">{paidLeft}</span>
              <span className="ap-balance-of">of {allowance} paid leave days left this month</span>
            </div>
            <div className="ap-balance-sub">
              {paidLeft > 0
                ? "Paid leaves reset on the 1st of every month. Extra days are unpaid."
                : "You've used your paid leave for this month. Further leave is unpaid (salary deducted)."}
            </div>
          </>
        )}
      </div>

      {/* Leave Request To */}
      <div className="ap-form-card">
        <label className="ap-label req">Leave Request To</label>
        <div className="ap-radio-row">
          {APPROVERS.map((a) => (
            <button
              key={a.value}
              type="button"
              className={`ap-radio ${requestTo === a.value ? "sel" : ""}`}
              onClick={() => setRequestTo(a.value)}
            >
              <span className="ap-radio-dot" />{a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Type of leave */}
      <div className="ap-form-card">
        <label className="ap-label req">Type of Leave <span className="ap-hi">(छुट्टी का प्रकार)</span></label>
        <select className="ap-input" value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
          <option value="">Choose…</option>
          {REQUESTABLE_LEAVE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.short} — {t.label} ({t.hi})</option>
          ))}
        </select>
      </div>

      {/* Reason */}
      <div className="ap-form-card">
        <label className="ap-label req">Reason of Leave <span className="ap-hi">(छुट्टी का कारण)</span></label>
        <textarea
          className="ap-input"
          rows={3}
          placeholder="Why do you need this leave?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      {/* Dates */}
      <div className="ap-form-card">
        <label className="ap-label req">{isFixed ? "Date" : "Start Date"}</label>
        <input className="ap-input" type="date" min={todayISO()} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        {!isFixed && (
          <>
            <label className="ap-label req" style={{ marginTop: 12 }}>End Date</label>
            <input className="ap-input" type="date" min={startDate || todayISO()} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </>
        )}
      </div>

      {/* Deduction preview */}
      {requestedDays > 0 && (
        <div className="ap-preview">
          <div className="ap-preview-row">
            <span>This request</span>
            <strong>{requestedDays} {requestedDays === 1 ? "day" : "days"}</strong>
          </div>
          <div className="ap-preview-row paid">
            <span>✅ Paid</span>
            <strong>{paidDays} {paidDays === 1 ? "day" : "days"}</strong>
          </div>
          {unpaidDays > 0 && (
            <div className="ap-preview-row unpaid">
              <span>⚠️ Salary deducted</span>
              <strong>{unpaidDays} {unpaidDays === 1 ? "day" : "days"}</strong>
            </div>
          )}
        </div>
      )}

      {err && <div className="ap-error">{err}</div>}

      <button className="ap-btn-action checkin" onClick={handleSubmit} disabled={busy || loadingBal}>
        {busy ? <><span className="ap-spinner" /> Submitting…</> : "Submit Leave Request"}
      </button>

      <p className="ap-footer-note">
        Your request goes to HR for approval. You'll be informed once it's reviewed.
      </p>
    </div>
  );
}

// ─── MAIN PORTAL ─────────────────────────────────────────────────────────────

export default function AttendancePortal() {
  const [employee, setEmployee]     = useState(null);
  const [now, setNow]               = useState(new Date());
  const [location, setLocation]     = useState(null);   // { lat, lng, accuracy, address }
  const [locErr, setLocErr]         = useState("");
  const [locLoading, setLocLoading] = useState(false);
  const [geofences, setGeofences]   = useState([]);      // active sites for the status pill / pings
  const [todayRec, setTodayRec]     = useState([]);      // today's records for this employee
  const [showCamera, setShowCamera] = useState(false);
  const [selfie, setSelfie]         = useState(null);    // base64 captured image
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(null);    // { type, time }
  const [error, setError]           = useState("");
  const [showLeave, setShowLeave]   = useState(false);   // leave form open?
  const [showHistory, setShowHistory] = useState(false); // "My Attendance" open?
  const [leaveDone, setLeaveDone]   = useState(null);    // { days, paidDays, unpaidDays }
  const [sites, setSites]           = useState([]);      // the 47-site pick-list
  const [siteId, setSiteId]         = useState("");      // which site I'm at

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Geolocation on login — best-fix (watches briefly, keeps most accurate).
  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocErr("Geolocation not supported by your browser."); return; }
    setLocLoading(true); setLocErr("");
    getBestPosition()
      .then(async (fix) => {
        const address = await reverseGeocode(fix.lat, fix.lng);
        setLocation({ lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, address });
        setLocLoading(false);
      })
      .catch(() => { setLocErr("Location access denied. Allow location and try again."); setLocLoading(false); });
  }, []);

  // Load today's records
  const loadTodayRecords = useCallback(async (emp) => {
    if (!supabase || !emp) return;
    const { start, end } = todayRange();
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", emp.id)
      .gte("recorded_at", start)
      .lte("recorded_at", end)
      .order("recorded_at", { ascending: true });
    setTodayRec(data || []);
  }, []);

  const handleLogin = (emp) => {
    setEmployee(emp);
    fetchLocation();
    loadTodayRecords(emp);
    // The auth context only carries id/name/code — pull phone/department from the
    // employees table so attendance & leave WhatsApp notifications can reach them.
    supabase
      .from("employees")
      .select("phone, department, designation")
      .eq("id", emp.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setEmployee((prev) => (prev ? { ...prev, ...data } : prev)); })
      .catch(() => {});
    // The old Google Form made the employee choose their site — keep that, and
    // remember the last one so a site team isn't re-picking it every morning.
    // The same CPS-sourced sites also drive the geofence pill + tracking pings
    // (only rows that have coordinates count as geofences).
    fetchSites().then((s) => {
      setSites(s);
      setGeofences(
        s.filter((x) => x.latitude != null && x.longitude != null)
         .map((x) => ({ site_id: x.id, site_name: x.name, latitude: x.latitude, longitude: x.longitude, radius_meters: x.radius_meters ?? 200 })),
      );
      // Prefer the employee's assigned home site; fall back to their last pick.
      fetchEmployeeProfile(emp.id).then((prof) => {
        const home = prof?.home_site_id;
        const saved = localStorage.getItem("hf_last_site");
        const def = (home && s.some((x) => x.id === home)) ? home
                  : (saved && s.some((x) => x.id === saved)) ? saved : "";
        if (def) setSiteId(def);
      }).catch(() => {
        const saved = localStorage.getItem("hf_last_site");
        if (saved && s.some((x) => x.id === saved)) setSiteId(saved);
      });
    }).catch(() => {});
  };

  // Auto-resume an existing Hagerstone Hub session (no re-login each visit).
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabase) return;
      await consumeSsoHandoff();        // adopt a Hub tile hand-off, if present
      if (window.location.hash.includes("sso=")) history.replaceState(null, "", window.location.pathname + window.location.search);
      const sess = await getSession();
      if (!sess || !alive) return;
      const c = await fetchContext();
      if (!c || !alive || !c.modules?.includes("attendance")) return;
      handleLogin({ id: c.employee_id, employee_code: c.employee_code, full_name: c.name, role: c.role, track_location: c.track_location });
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine next action
  const lastRecord   = todayRec[todayRec.length - 1];
  const nextAction   = !lastRecord || lastRecord.type === "check_out" ? "check_in" : "check_out";
  const checkedInAt  = todayRec.find((r) => r.type === "check_in");
  const checkedOutAt = todayRec.find((r) => r.type === "check_out");
  const dayClosed    = !!checkedInAt && !!checkedOutAt;

  // ── Continuous 30s ping loop (tracked employees only, until day closes) ──
  useEffect(() => {
    if (!employee || !employee.track_location || dayClosed) return;
    let alive = true;

    const ping = async () => {
      try {
        const fix = await getBestPosition({ maxWaitMs: 12000, desiredAccuracy: 50 });
        const geo = evaluateGeofence(fix.lat, fix.lng, fix.accuracy, geofences);
        const site_name = geo.decision === "inside" ? geo.matchedSite : "Outside";
        if (alive) await insertPing({ employee_id: employee.id, latitude: fix.lat, longitude: fix.lng, accuracy: fix.accuracy, site_name });
      } catch {
        // "online but GPS off" heartbeat so admin sees red, not absent.
        if (alive) await insertPing({ employee_id: employee.id, latitude: null, longitude: null, accuracy: null, site_name: "GPS_OFF" }).catch(() => {});
      }
    };

    ping();
    const iv = setInterval(ping, 30000);
    return () => { alive = false; clearInterval(iv); };
  }, [employee, geofences, dayClosed]);

  // Live status pill mirrors the server rule (display only).
  const geoNow = employee?.track_location && location
    ? evaluateGeofence(location.lat, location.lng, location.accuracy, geofences)
    : null;
  const pill = employee?.track_location
    ? pillState(location ? (geoNow ? geoNow.decision : "locating") : "locating")
    : null;

  const handleSelfieCapture = (dataUrl) => {
    setSelfie(dataUrl);
    setShowCamera(false);
  };

  // Fallback used only when the attendance-punch Edge Function isn't deployed.
  // Writes directly to the table; the geofence check is client-side, so the row
  // is always flagged location_verified=false for admin review.
  const directInsertFallback = async (ts, selfieUrl) => {
    const geo = employee.track_location && location
      ? evaluateGeofence(location.lat, location.lng, location.accuracy, geofences)
      : null;

    let status = "present";
    if (nextAction === "check_in") {
      const cutoff = new Date(ts); cutoff.setHours(9, 30, 0, 0);
      if (ts > cutoff) status = "late";
    }

    const record = {
      employee_id: employee.id,
      type:        nextAction,
      site_ref:    siteId || null,
      site_name:   sites.find((s) => s.id === siteId)?.name ?? null,
      recorded_at: ts.toISOString(),
      latitude:    location?.lat ?? null,
      longitude:   location?.lng ?? null,
      accuracy:    location?.accuracy ?? null,
      address:     location?.address ?? null,
      selfie_url:  selfieUrl,
      status,
      // site comes from what the employee picked (above); the geofence result is
      // only ever advisory here because this path evaluates it client-side.
      site_match: geo ? (geo.decision === "inside" ? "ok" : "mismatch") : "no_gps",
      location_verified: false,   // a client-side check is never "verified"
      source: "portal",
    };

    const { error: dbErr } = await supabase.from("attendance").insert(record);
    if (dbErr) throw new Error("Failed to save attendance. Please try again.");
    return { location_verified: record.location_verified };
  };

  const handleSubmit = async () => {
    if (!siteId) { setError("Please choose the site or office you're at."); return; }
    if (!selfie) { setError("A photo is required — tap “Take Photo” before submitting."); return; }
    setSubmitting(true); setError("");
    try {
      const ts = new Date();
      localStorage.setItem("hf_last_site", siteId);

      // Upload selfie if captured (still client-side to the public bucket).
      let selfieUrl = null;
      if (selfie) selfieUrl = await uploadSelfie(selfie, employee.employee_code);

      // Punch goes through the Edge Function — it re-verifies the PIN and runs
      // the server-authoritative geofence decision (client can't forge "inside").
      const { data, error: fnErr } = await supabase.functions.invoke("attendance-punch", {
        body: {
          type:       nextAction,
          site_id:    siteId,
          latitude:   location?.lat ?? null,
          longitude:  location?.lng ?? null,
          accuracy:   location?.accuracy ?? null,
          address:    location?.address ?? null,
          selfie_url: selfieUrl,
        },
      });

      let result = data;

      if (fnErr) {
        // Did the function actually run and reject us (e.g. "you are 800m from
        // site")? Then it's a real business rejection — surface it and stop.
        let businessError = null;
        try { const ctx = await fnErr.context?.json?.(); if (ctx?.error) businessError = ctx.error; } catch { /* not a JSON response */ }
        if (businessError) throw new Error(businessError);

        // Otherwise the function is unreachable (not deployed yet / network).
        // Fall back to a direct insert so attendance never breaks. Geofence is
        // evaluated client-side here, so the row is recorded UNVERIFIED.
        result = await directInsertFallback(ts, selfieUrl);
      } else if (data?.error) {
        throw new Error(data.error);
      }

      // Fire WhatsApp check-in/out confirmation to the employee; never block the flow.
      notifyAttendance(employee, {
        type:    nextAction,
        time:    ts,
        status:  result?.status,
        address: location?.address ?? null,
      }).catch(() => {});

      setSubmitted({
        type: nextAction,
        time: ts,
        note: result?.location_verified === false ? "Location unconfirmed — recorded and flagged for review." : null,
      });
      setSelfie(null);
      await loadTodayRecords(employee);
    } catch (e) {
      setError(e.message || "Failed to save attendance. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── NOT LOGGED IN ──
  if (!employee) return <LoginScreen onLogin={handleLogin} />;

  // ── SUCCESS FLASH ──
  if (submitted) {
    return (
      <div className="ap-shell">
        <div className="ap-success fade-in">
          <div className="ap-success-icon">{submitted.type === "check_in" ? "✅" : "👋"}</div>
          <h2>{submitted.type === "check_in" ? "Checked In!" : "Checked Out!"}</h2>
          <p className="ap-success-time">{fmtTime(submitted.time)}</p>
          {location && <p className="ap-success-addr">{location.address}</p>}
          {submitted.note && <p className="ap-success-addr" style={{ color: "#b45309" }}>⚠️ {submitted.note}</p>}
          <button className="ap-btn-primary" style={{ marginTop: 24 }} onClick={() => setSubmitted(null)}>
            Done
          </button>
        </div>
      </div>
    );
  }

  // ── CAMERA ──
  if (showCamera) {
    return (
      <div className="ap-shell">
        <div className="ap-section-title">Take a Selfie</div>
        <Camera onCapture={handleSelfieCapture} onCancel={() => setShowCamera(false)} />
      </div>
    );
  }

  // ── LEAVE SUCCESS FLASH ──
  if (leaveDone) {
    return (
      <div className="ap-shell">
        <div className="ap-success fade-in">
          <div className="ap-success-icon">📨</div>
          <h2>Leave Requested!</h2>
          <p className="ap-success-time">
            {leaveDone.days} {leaveDone.days === 1 ? "day" : "days"}
          </p>
          <p className="ap-success-addr">
            {leaveDone.paidDays} paid
            {leaveDone.unpaidDays > 0 ? ` · ${leaveDone.unpaidDays} unpaid (salary deducted)` : ""}.
            <br />Sent to HR for approval.
          </p>
          <button className="ap-btn-primary" style={{ marginTop: 24 }} onClick={() => setLeaveDone(null)}>
            Done
          </button>
        </div>
      </div>
    );
  }

  // ── LEAVE FORM ──
  if (showLeave) {
    return (
      <LeaveForm
        employee={employee}
        onCancel={() => setShowLeave(false)}
        onSubmitted={(info) => { setShowLeave(false); setLeaveDone(info); }}
      />
    );
  }

  // ── MY ATTENDANCE (read-only) ──
  // A separate screen, not a change to the punch flow: the portal still opens
  // straight onto the punch card, exactly as before.
  if (showHistory) {
    return (
      <div className="ap-shell">
        <div className="ap-header">
          <button className="ap-logout" onClick={() => setShowHistory(false)}>← Back</button>
          <div className="ap-header-info" style={{ textAlign: "center" }}>
            <div className="ap-emp-name">My Attendance</div>
            <div className="ap-emp-meta">{employee.full_name}</div>
          </div>
          <span style={{ width: 68 }} />
        </div>
        <AttendanceHistory subjectId={employee.id} />
        <p className="ap-footer-note" style={{ marginTop: 18 }}>
          This is your own record, shown for reference only.<br />
          Contact HR to request any corrections.
        </p>
      </div>
    );
  }

  // ── MAIN ATTENDANCE SCREEN ──
  const allDone = checkedInAt && checkedOutAt;

  return (
    <div className="ap-shell">
      {/* Header */}
      <div className="ap-header">
        <div className="ap-avatar">{(employee.full_name || "?").charAt(0).toUpperCase()}</div>
        <div className="ap-header-info">
          <div className="ap-emp-name">{employee.full_name || "Employee"}</div>
          <div className="ap-emp-meta">{employee.role || "Employee"} · {employee.employee_code}</div>
        </div>
        <button className="ap-logout" onClick={async () => { await signOut(); setEmployee(null); setLocation(null); setGeofences([]); setTodayRec([]); setSelfie(null); setShowLeave(false); setLeaveDone(null); }}>
          Sign out
        </button>
      </div>

      {/* Clock */}
      <div className="ap-clock-card">
        <div className="ap-time">{fmtTime(now)}</div>
        <div className="ap-date">{fmtDate(now)}</div>
      </div>

      {/* Location */}
      <div className="ap-info-card">
        <div className="ap-info-icon">📍</div>
        <div className="ap-info-body">
          <div className="ap-info-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Location
            {pill && (
              <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: pill.color, background: pill.bg }}>
                {pill.label}{location?.accuracy ? ` · ±${Math.round(location.accuracy)}m` : ""}
              </span>
            )}
          </div>
          {locLoading && <div className="ap-info-val muted"><span className="ap-spinner-sm" /> Detecting…</div>}
          {!locLoading && locErr && (
            <div className="ap-info-val warn">
              {locErr} <button className="ap-link" onClick={fetchLocation}>Retry</button>
            </div>
          )}
          {!locLoading && !locErr && location && (
            <div className="ap-info-val">{location.address}</div>
          )}
        </div>
      </div>

      {/* Site / office — required, mirrors the old Google Form's dropdown */}
      {!allDone && (
        <div className="ap-form-card" style={{ marginBottom: 12 }}>
          <label className="ap-label req">
            Site / Office <span className="ap-hi">(साइट कार्यालय का नाम)</span>
          </label>
          <select className="ap-input" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">Choose where you are…</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {/* Today's summary */}
      {(checkedInAt || checkedOutAt) && (
        <div className="ap-today-summary">
          {checkedInAt && (
            <div className="ap-rec-chip green">
              ✅ In: {fmtTime(new Date(checkedInAt.recorded_at))}
            </div>
          )}
          {checkedOutAt && (
            <div className="ap-rec-chip amber">
              🏁 Out: {fmtTime(new Date(checkedOutAt.recorded_at))}
            </div>
          )}
        </div>
      )}

      {/* Selfie section */}
      {!allDone && (
        <div className="ap-selfie-section">
          {selfie ? (
            <div className="ap-selfie-preview">
              <img src={selfie} alt="selfie" className="ap-selfie-img" />
              <button className="ap-link" onClick={() => setSelfie(null)}>Retake</button>
            </div>
          ) : (
            <button className="ap-btn-camera" onClick={() => setShowCamera(true)}>
              📷 Take Photo <span className="ap-optional">(required)</span>
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && <div className="ap-error">{error}</div>}

      {/* Action button */}
      {allDone ? (
        <div className="ap-all-done">
          <span>🎉</span> Attendance complete for today!
        </div>
      ) : (
        <button
          className={`ap-btn-action ${nextAction === "check_in" ? "checkin" : "checkout"}`}
          onClick={handleSubmit}
          disabled={submitting || locLoading || !siteId || !selfie}
          title={!siteId ? "Choose your site first" : !selfie ? "Take a photo first" : ""}
        >
          {submitting
            ? <><span className="ap-spinner" /> Saving…</>
            : nextAction === "check_in"
              ? "✅ Check In"
              : "🏁 Check Out"}
        </button>
      )}

      {/* My Attendance — read-only view of the employee's own record */}
      <div className="ap-leave-box" onClick={() => setShowHistory(true)}>
        <div className="ap-leave-box-icon">📊</div>
        <div className="ap-leave-box-body">
          <div className="ap-leave-box-title">My Attendance</div>
          <div className="ap-leave-box-sub">This month · Days · Late · Overtime · Leaves</div>
        </div>
        <div className="ap-leave-box-arrow">→</div>
      </div>

      {/* Leave request box — second action in the portal */}
      <div className="ap-leave-box" onClick={() => setShowLeave(true)}>
        <div className="ap-leave-box-icon">🌴</div>
        <div className="ap-leave-box-body">
          <div className="ap-leave-box-title">Apply for Leave</div>
          <div className="ap-leave-box-sub">Casual · Half Day · Emergency · Sick</div>
        </div>
        <div className="ap-leave-box-arrow">→</div>
      </div>

      <p className="ap-footer-note">
        Your attendance is recorded automatically with timestamp and location.<br />
        Contact HR to request any corrections.
      </p>
    </div>
  );
}
