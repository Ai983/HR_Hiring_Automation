import { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";

export default function Login() {
  const { login } = useApp();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState("");
  const [showPw, setShowPw]     = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setErr("Enter your email and password."); return; }
    setBusy(true); setErr("");
    try {
      await login(email, password);
    } catch (ex) {
      setErr(ex?.message?.includes("Invalid") ? "Invalid email or password." : (ex?.message || "Sign in failed."));
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f4ef", padding: 20 }}>
      <form onSubmit={submit} className="card" style={{ width: "100%", maxWidth: 380, padding: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#e8a24a,#c97a2a)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 20, color: "#1a1612" }}>H</div>
          <div>
            <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 20, color: "#1a1612" }}>HireFlow</div>
            <div style={{ fontSize: 12, color: "#8a7e72" }}>Hagerstone Hub · sign in</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "#8a7e72", margin: "4px 0 20px" }}>Use your Hagerstone Hub email &amp; password.</p>

        <div className="form-field" style={{ marginBottom: 14 }}>
          <label className="form-label">Email</label>
          <input className="form-input" type="email" autoComplete="username" placeholder="you@hagerstone.com"
            value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </div>
        <div className="form-field" style={{ marginBottom: 18 }}>
          <label className="form-label">Password</label>
          {/* Reveal toggle. Sits inside the field rather than beside it so the
              input keeps its full width, and padding-right keeps typed text
              from running under the button. */}
          <div style={{ position: "relative" }}>
            <input className="form-input" type={showPw ? "text" : "password"}
              autoComplete="current-password" placeholder="••••••••"
              style={{ paddingRight: 44, width: "100%" }}
              value={password} onChange={(e) => setPassword(e.target.value)} />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              tabIndex={-1}
              aria-label={showPw ? "Hide password" : "Show password"}
              title={showPw ? "Hide password" : "Show password"}
              style={{
                position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                padding: "6px 8px", fontSize: 16, lineHeight: 1, color: "#8a7e72",
              }}
            >
              {showPw ? "🙈" : "👁"}
            </button>
          </div>
        </div>

        {err && <div style={{ background: "#fff1f0", border: "1px solid #fecaca", borderRadius: 9, padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 14 }}>{err}</div>}

        <button className="btn-gold" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
          {busy ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
