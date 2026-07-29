import { useEffect, useState } from "react";
import { supabase, supabaseUrl } from "../../supabaseClient.js";

// Extract the Supabase project ref from the URL (https://<ref>.supabase.co).
const projectRef = (() => {
  try { return new URL(supabaseUrl).hostname.split(".")[0]; } catch { return "—"; }
})();

async function countOf(query) {
  const { count, error } = await query.select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export default function SyncStatus() {
  const [state, setState] = useState({ status: "checking", counts: null, error: null });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabase) { setState({ status: "offline", counts: null, error: "No Supabase client" }); return; }
      try {
        const [jobs, applicants, leads] = await Promise.all([
          countOf(supabase.from("jobs")),
          countOf(supabase.from("applicants")),
          countOf(supabase.from("survey_responses")),
        ]);
        if (alive) setState({ status: "synced", counts: { jobs, applicants, leads }, error: null });
      } catch (e) {
        if (alive) setState({ status: "error", counts: null, error: e.message || String(e) });
      }
    })();
    return () => { alive = false; };
  }, []);

  const dot = { checking: "#f59e0b", synced: "#22c55e", error: "#ef4444", offline: "#8a7e72" }[state.status];
  const label = { checking: "Checking…", synced: "Synced to hub", error: "Connection error", offline: "Offline" }[state.status];

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`${supabaseUrl}  ·  schema: hr`}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
          background: "#211c17", border: "1px solid #2e2925", borderRadius: 9,
          padding: "8px 10px", cursor: "pointer", color: "#c8b89a",
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, boxShadow: `0 0 6px ${dot}`, flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#e8ddd0" }}>{label}</div>
          <div style={{ fontSize: 10, color: "#8a7e72", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {projectRef} · schema hr
          </div>
        </div>
        <span style={{ fontSize: 10, color: "#6b5f52" }}>{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div style={{ marginTop: 6, padding: "8px 10px", background: "#1c1813", border: "1px solid #2e2925", borderRadius: 9, fontSize: 11, color: "#a89a88" }}>
          {state.status === "synced" && state.counts && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: 4 }}>
              <span>Jobs</span><b style={{ color: "#e8ddd0" }}>{state.counts.jobs}</b>
              <span>Applicants</span><b style={{ color: "#e8ddd0" }}>{state.counts.applicants}</b>
              <span>Survey leads</span><b style={{ color: "#e8ddd0" }}>{state.counts.leads}</b>
            </div>
          )}
          {state.status === "error" && <div style={{ color: "#ef4444" }}>{state.error}</div>}
          {state.status === "checking" && <div>Probing hub…</div>}
        </div>
      )}
    </div>
  );
}
