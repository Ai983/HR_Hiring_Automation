import { useState, useEffect } from "react";
import { POLICY_CATEGORIES, fetchPolicies, signedPolicyUrl } from "../../services/policyService.js";

// ─────────────────────────────────────────────────────────────────────
// The employee-facing view of the policy library, inside /attend.html.
//
// Read-only by construction: there is no upload path here, and RLS on
// hr.policies would refuse one anyway (writes are hr.is_hr_admin()). The
// employee is a real Hub session by the time this renders — the portal
// signs them in before the main screen — so the `policies_read_all` policy
// and the `hr-policies` storage read policy both apply with no special
// casing. Nothing anonymous ever reaches this component.
//
// Same service as the admin panel (services/policyService.js). Do not
// fork a second reader: the two would drift on what "current" means.
// ─────────────────────────────────────────────────────────────────────

const fmtSize = (bytes) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export default function PolicyList() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [opening, setOpening]   = useState(null); // policy id currently being signed

  useEffect(() => {
    let alive = true;
    fetchPolicies()                       // active only — archived stays out of sight
      .then((rows) => { if (alive) setPolicies(rows); })
      .catch((e) => { if (alive) setError(e?.message || "Could not load policies."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // The bucket is private, so opening a document means signing a URL first.
  // The tab is opened SYNCHRONOUSLY and pointed afterwards — a window.open()
  // that happens after an await is swallowed by the popup blocker on mobile
  // Safari and Chrome, which reads to the employee as a dead button.
  const open = async (p) => {
    if (opening) return;
    setOpening(p.id);
    const tab = window.open("", "_blank");
    try {
      const url = await signedPolicyUrl(p.file_path);
      if (tab) tab.location.href = url;
      else window.location.href = url;   // blocker still won: navigate in place
    } catch (e) {
      tab?.close();
      setError(e?.message || "Could not open that document.");
    }
    setOpening(null);
  };

  if (loading) {
    return (
      <div className="ap-policy-state">
        <span className="ap-spinner-sm" /> Loading policies…
      </div>
    );
  }

  if (error && policies.length === 0) {
    return <div className="ap-error" style={{ marginTop: 12 }}>{error}</div>;
  }

  if (policies.length === 0) {
    return (
      <div className="ap-policy-state">
        <div style={{ fontSize: 32, marginBottom: 8 }}>📕</div>
        <div style={{ fontWeight: 700, color: "#1a1612", marginBottom: 4 }}>Nothing published yet</div>
        <div>HR hasn't uploaded any policy documents. Check back later.</div>
      </div>
    );
  }

  // Only render sections that actually have something in them — an employee
  // scrolling four empty headings learns nothing and assumes it is broken.
  const sections = POLICY_CATEGORIES
    .map((c) => ({ ...c, items: policies.filter((p) => p.category === c.id) }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="ap-policy-wrap">
      {error && <div className="ap-error">{error}</div>}

      {sections.map((s) => (
        <div key={s.id} className="ap-policy-group">
          <div className="ap-policy-group-head">
            <span className="ap-policy-group-icon">{s.icon}</span>
            <span className="ap-policy-group-title">{s.label}</span>
            <span className="ap-policy-group-count">{s.items.length}</span>
          </div>

          {s.items.map((p) => (
            <button
              key={p.id}
              className="ap-policy-item"
              onClick={() => open(p)}
              disabled={opening === p.id}
            >
              <span className="ap-policy-item-icon">📄</span>
              <span className="ap-policy-item-body">
                <span className="ap-policy-item-title">{p.title}</span>
                {p.description && <span className="ap-policy-item-desc">{p.description}</span>}
                <span className="ap-policy-item-meta">
                  {[
                    p.file_name,
                    p.file_size ? fmtSize(p.file_size) : null,
                    p.effective_from ? `Effective ${p.effective_from}` : null,
                  ].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="ap-policy-item-arrow">
                {opening === p.id ? <span className="ap-spinner-sm" /> : "↗"}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
