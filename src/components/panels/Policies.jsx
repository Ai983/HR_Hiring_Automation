import { useState, useEffect, useCallback, useRef } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { fmtDate } from "../../helpers.js";
import {
  POLICY_CATEGORIES, ACCEPTED_POLICY_TYPES, MAX_POLICY_BYTES,
  fetchPolicies, uploadPolicy, signedPolicyUrl, archivePolicy, restorePolicy, deletePolicy,
} from "../../services/policyService.js";

// ─────────────────────────────────────────────────────────────────────
// The policy library. Every signed-in employee can read; only hr_admin /
// super_admin sees the upload and archive controls.
//
// The role check below decides what the UI OFFERS. It is not the control —
// RLS on hr.policies and on the `hr-policies` bucket is. An employee who
// forces this panel open sees the documents (which they are allowed to) and
// nothing else.
// ─────────────────────────────────────────────────────────────────────

const OVERLAY = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const MODAL = { background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };

const fmtSize = (bytes) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const EMPTY_FORM = { category: "company", title: "", description: "", effectiveFrom: "" };

export default function Policies() {
  const { ctx, showToast, policyCategory, setPolicyCategory } = useApp();
  const canManage = !!ctx?.is_hr_admin;

  const [policies, setPolicies] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  // The dashboard's HR Policy cards deep-link into one section. Consume that
  // choice once, then clear it — otherwise coming back to this panel later
  // silently yanks the user back to the section they clicked days ago.
  const [category, setCategory] = useState(policyCategory || "company");
  useEffect(() => {
    if (policyCategory) {
      setCategory(policyCategory);
      setPolicyCategory(null);
    }
  }, [policyCategory, setPolicyCategory]);
  const [showArchived, setShowArchived] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm]     = useState(EMPTY_FORM);
  const [file, setFile]     = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPolicies(await fetchPolicies({ includeInactive: canManage }));
    } catch (e) {
      setError(e?.message || "Could not load policies.");
    }
    setLoading(false);
  }, [canManage]);

  useEffect(() => { load(); }, [load]);

  const visible = policies.filter(
    (p) => p.category === category && (showArchived ? true : p.is_active)
  );
  const countFor = (catId) => policies.filter((p) => p.category === catId && p.is_active).length;

  // A private bucket means every open is a fresh signed URL. Open the tab
  // synchronously and point it afterwards — a popup blocker kills a
  // window.open() that happens after an await, which reads to the user as
  // "the download button is broken".
  const openDoc = async (p) => {
    const tab = window.open("", "_blank");
    try {
      const url = await signedPolicyUrl(p.file_path);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (e) {
      tab?.close();
      showToast(e?.message || "Could not open that document.", false);
    }
  };

  const openUpload = () => {
    setForm({ ...EMPTY_FORM, category });
    setFile(null);
    setUploadOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) return showToast("Give the policy a title.", false);
    if (!file) return showToast("Choose a file to upload.", false);
    setSaving(true);
    try {
      await uploadPolicy({
        category: form.category,
        title: form.title,
        description: form.description,
        effectiveFrom: form.effectiveFrom || null,
        file,
        ctx,
      });
      setUploadOpen(false);
      setCategory(form.category);
      showToast("Policy published — every employee can now read it.");
      await load();
    } catch (e) {
      showToast(e?.message || "Upload failed.", false);
    }
    setSaving(false);
  };

  const doArchive = async (p) => {
    try {
      await archivePolicy(p.id);
      showToast(`"${p.title}" archived. It stays on record but is no longer listed as current.`);
      await load();
    } catch (e) { showToast(e.message, false); }
  };

  const doRestore = async (p) => {
    try {
      await restorePolicy(p.id);
      showToast(`"${p.title}" restored.`);
      await load();
    } catch (e) { showToast(e.message, false); }
  };

  const doDelete = async (p) => {
    if (!window.confirm(
      `Permanently delete "${p.title}" and its file?\n\n` +
      `This cannot be undone. If the policy is simply out of date, Archive it instead — ` +
      `that keeps the record of what was in force and when.`
    )) return;
    try {
      await deletePolicy(p);
      showToast("Policy deleted.");
      await load();
    } catch (e) { showToast(e.message, false); }
  };

  const meta = POLICY_CATEGORIES.find((c) => c.id === category);

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="page-title">HR Policy</div>
          <div className="page-sub">
            {canManage
              ? "Upload the company's policy documents. Every signed-in employee can read what you publish here."
              : "Hagerstone's policy documents. Open one to read or download it."}
          </div>
        </div>
        {canManage && (
          <button className="btn-gold" onClick={openUpload}>+ Upload policy</button>
        )}
      </div>

      {/* Category tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {POLICY_CATEGORIES.map((c) => {
          const on = c.id === category;
          const n = countFor(c.id);
          return (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "9px 14px", borderRadius: 10, cursor: "pointer",
                border: `1.5px solid ${on ? "#c97a2a" : "#e8e2d9"}`,
                background: on ? "rgba(201,122,42,0.08)" : "#fff",
                color: on ? "#c97a2a" : "#5a5048",
                fontWeight: 700, fontSize: 13, fontFamily: "'Nunito',sans-serif",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 15 }}>{c.icon}</span>
              {c.label}
              <span style={{
                background: on ? "#c97a2a" : "#f0ece5",
                color: on ? "#fff" : "#8a7e72",
                borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 800,
              }}>{n}</span>
            </button>
          );
        })}
      </div>

      {meta && (
        <div style={{ fontSize: 13, color: "#8a7e72", marginBottom: 14 }}>{meta.blurb}</div>
      )}

      {canManage && policies.some((p) => !p.is_active) && (
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#8a7e72", marginBottom: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived (superseded) policies
        </label>
      )}

      {error && (
        <div className="card" style={{ padding: 16, marginBottom: 14, borderColor: "#f3c9c9", background: "#fdecec", color: "#a3352f", fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#8a7e72", fontSize: 13 }}>
          <span className="spinner" /> Loading policies…
        </div>
      ) : visible.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>{meta?.icon || "📄"}</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 16, color: "#1a1612", marginBottom: 6 }}>
            No {meta?.label || "policy"} uploaded yet
          </div>
          <div style={{ fontSize: 13, color: "#8a7e72" }}>
            {canManage
              ? "Upload the document and it appears here for everyone."
              : "Nothing has been published in this section yet. Check with HR."}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {visible.map((p) => (
            <div
              key={p.id}
              className="card"
              style={{
                padding: 18, display: "flex", gap: 16, alignItems: "flex-start",
                opacity: p.is_active ? 1 : 0.6,
                borderStyle: p.is_active ? "solid" : "dashed",
              }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                background: "rgba(201,122,42,0.10)", color: "#c97a2a",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              }}>
                📄
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "#1a1612" }}>{p.title}</span>
                  {!p.is_active && (
                    <span style={{ background: "#f0ece5", color: "#8a7e72", borderRadius: 20, padding: "2px 9px", fontSize: 10, fontWeight: 800 }}>
                      ARCHIVED
                    </span>
                  )}
                </div>
                {p.description && (
                  <div style={{ fontSize: 13, color: "#5a5048", marginTop: 5, lineHeight: 1.5 }}>{p.description}</div>
                )}
                <div style={{ fontSize: 11.5, color: "#8a7e72", marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span>{p.file_name}</span>
                  {p.file_size ? <span>{fmtSize(p.file_size)}</span> : null}
                  {p.effective_from && <span>Effective {fmtDate(p.effective_from)}</span>}
                  <span>Added {fmtDate(p.created_at)}{p.uploaded_by_name ? ` by ${p.uploaded_by_name}` : ""}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button className="btn-outline" style={{ fontSize: 12 }} onClick={() => openDoc(p)}>Open</button>
                {canManage && (p.is_active
                  ? <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => doArchive(p)}>Archive</button>
                  : <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => doRestore(p)}>Restore</button>
                )}
                {canManage && (
                  <button className="btn-ghost" style={{ fontSize: 12, color: "#a3352f" }} onClick={() => doDelete(p)}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload modal */}
      {uploadOpen && (
        <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && !saving && setUploadOpen(false)}>
          <div style={MODAL}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, fontFamily: "'Fraunces',serif" }}>Upload policy</div>
                <div style={{ fontSize: 11, color: "#8a7e72", marginTop: 3 }}>
                  Visible to every signed-in employee as soon as you save.
                </div>
              </div>
              <button className="btn-ghost" onClick={() => !saving && setUploadOpen(false)} style={{ fontSize: 18 }}>✕</button>
            </div>

            <div
              style={{
                border: `2px dashed ${file ? "#22c55e" : "#e8e2d9"}`, borderRadius: 12,
                padding: "16px", marginBottom: 18, cursor: "pointer",
                background: file ? "rgba(34,197,94,0.04)" : "#faf8f5",
              }}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_POLICY_TYPES}
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  if (f && f.size > MAX_POLICY_BYTES) {
                    showToast(`That file is ${(f.size / 1024 / 1024).toFixed(1)} MB. The limit is 25 MB.`, false);
                    return;
                  }
                  setFile(f);
                }}
              />
              {file ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>📄</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1612", overflowWrap: "anywhere" }}>{file.name}</div>
                    <div style={{ fontSize: 11, color: "#22c55e", marginTop: 2 }}>{fmtSize(file.size)} · Click to change</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#8a7e72" }}>
                  <span style={{ fontSize: 24 }}>⬆</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Choose the document</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>PDF, DOC or DOCX · up to 25 MB</div>
                  </div>
                </div>
              )}
            </div>

            <div className="form-grid">
              <div className="form-field" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Title *</label>
                <input
                  className="form-input"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Leave Policy 2026"
                  autoFocus
                />
              </div>
              <div className="form-field">
                <label className="form-label">Section *</label>
                <select
                  className="form-input"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {POLICY_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Effective from</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.effectiveFrom}
                  onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
                />
              </div>
              <div className="form-field" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Short description</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="One or two lines so people know what's inside before opening it."
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn-outline" onClick={() => setUploadOpen(false)} disabled={saving}>Cancel</button>
              <button className="btn-gold" onClick={save} disabled={saving}>
                {saving ? <><span className="spinner" /> Publishing…</> : "Publish policy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
