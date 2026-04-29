import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../supabaseClient.js";
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
  const [code, setCode]   = useState("");
  const [pin, setPin]     = useState("");
  const [err, setErr]     = useState("");
  const [busy, setBusy]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim() || !pin.trim()) { setErr("Enter your Employee ID and PIN."); return; }
    setBusy(true); setErr("");
    try {
      if (!supabase) { setErr("Database not connected. Check Supabase config."); setBusy(false); return; }
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("employee_code", code.trim().toUpperCase())
        .eq("pin", pin.trim())
        .eq("is_active", true)
        .single();
      if (error || !data) { setErr("Invalid Employee ID or PIN. Contact HR if you need help."); setBusy(false); return; }
      onLogin(data);
    } catch {
      setErr("Something went wrong. Please try again.");
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
          <label className="ap-label">Employee ID</label>
          <input
            className="ap-input"
            placeholder="e.g. EMP001"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoComplete="username"
            autoFocus
          />
        </div>

        <div className="ap-field">
          <label className="ap-label">PIN</label>
          <input
            className="ap-input"
            type="password"
            placeholder="Enter your PIN"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            autoComplete="current-password"
          />
        </div>

        {err && <div className="ap-error">{err}</div>}

        <button className="ap-btn-primary" type="submit" disabled={busy}>
          {busy ? <span className="ap-spinner" /> : null}
          {busy ? "Verifying…" : "Continue"}
        </button>
      </form>

      <p className="ap-help">Forgot your PIN? Contact HR at <strong>hr@hagerstone.com</strong></p>
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

// ─── MAIN PORTAL ─────────────────────────────────────────────────────────────

export default function AttendancePortal() {
  const [employee, setEmployee]     = useState(null);
  const [now, setNow]               = useState(new Date());
  const [location, setLocation]     = useState(null);   // { lat, lng, address }
  const [locErr, setLocErr]         = useState("");
  const [locLoading, setLocLoading] = useState(false);
  const [todayRec, setTodayRec]     = useState([]);      // today's records for this employee
  const [showCamera, setShowCamera] = useState(false);
  const [selfie, setSelfie]         = useState(null);    // base64 captured image
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(null);    // { type, time }
  const [error, setError]           = useState("");

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Geolocation on login
  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocErr("Geolocation not supported by your browser."); return; }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const address = await reverseGeocode(lat, lng);
        setLocation({ lat, lng, address });
        setLocLoading(false);
      },
      (e) => { setLocErr("Location access denied. Allow location and try again."); setLocLoading(false); },
      { enableHighAccuracy: true, timeout: 12000 }
    );
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
  };

  // Determine next action
  const lastRecord   = todayRec[todayRec.length - 1];
  const nextAction   = !lastRecord || lastRecord.type === "check_out" ? "check_in" : "check_out";
  const checkedInAt  = todayRec.find((r) => r.type === "check_in");
  const checkedOutAt = todayRec.find((r) => r.type === "check_out");

  const handleSelfieCapture = (dataUrl) => {
    setSelfie(dataUrl);
    setShowCamera(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true); setError("");
    try {
      const ts = new Date();
      // Determine status
      let status = "present";
      if (nextAction === "check_in") {
        const cutoff = new Date(ts); cutoff.setHours(9, 30, 0, 0);
        if (ts > cutoff) status = "late";
      }

      // Upload selfie if captured
      let selfieUrl = null;
      if (selfie) selfieUrl = await uploadSelfie(selfie, employee.employee_code);

      const record = {
        employee_id: employee.id,
        type:        nextAction,
        recorded_at: ts.toISOString(),
        latitude:    location?.lat ?? null,
        longitude:   location?.lng ?? null,
        address:     location?.address ?? null,
        selfie_url:  selfieUrl,
        status,
      };

      const { error: dbErr } = await supabase.from("attendance").insert(record);
      if (dbErr) throw dbErr;

      setSubmitted({ type: nextAction, time: ts });
      setSelfie(null);
      await loadTodayRecords(employee);
    } catch (e) {
      setError("Failed to save attendance. Please try again.");
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

  // ── MAIN ATTENDANCE SCREEN ──
  const allDone = checkedInAt && checkedOutAt;

  return (
    <div className="ap-shell">
      {/* Header */}
      <div className="ap-header">
        <div className="ap-avatar">{employee.full_name[0].toUpperCase()}</div>
        <div className="ap-header-info">
          <div className="ap-emp-name">{employee.full_name}</div>
          <div className="ap-emp-meta">{employee.designation || employee.department || "Employee"} · {employee.employee_code}</div>
        </div>
        <button className="ap-logout" onClick={() => { setEmployee(null); setLocation(null); setTodayRec([]); setSelfie(null); }}>
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
          <div className="ap-info-label">Location</div>
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
              📷 Take Selfie <span className="ap-optional">(optional)</span>
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
          disabled={submitting || locLoading}
        >
          {submitting
            ? <><span className="ap-spinner" /> Saving…</>
            : nextAction === "check_in"
              ? "✅ Check In"
              : "🏁 Check Out"}
        </button>
      )}

      <p className="ap-footer-note">
        Your attendance is recorded automatically with timestamp and location.<br />
        Contact HR to request any corrections.
      </p>
    </div>
  );
}
