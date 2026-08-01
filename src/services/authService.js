import { supabase } from "../supabaseClient.js";

// ── Universal Hagerstone Hub login (Supabase Auth) ──────────────────────────
// Same email + password as every other hub module. Access to HireFlow areas is
// governed by the person's assigned modules (hr.my_context → employee_module_access).

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email).trim(),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ── Cross-app single-login hand-off ─────────────────────────────────────────
// The Hagerstone Hub and this app share one Supabase project. When a user opens
// this app from a Hub tile, the Hub appends its live session to the URL fragment
// (#sso=<access>|<refresh>). We adopt it here so there is no second login, then
// strip it from the URL immediately. The fragment never reaches a server.
let ssoPromise = null;
export function consumeSsoHandoff() {
  // Memoised: React StrictMode double-invokes effects, and two concurrent
  // setSession calls contend on Supabase's auth lock (a known deadlock). One
  // shared promise means a single setSession that both callers await.
  if (ssoPromise) return ssoPromise;
  ssoPromise = (async () => {
    if (!supabase || typeof window === "undefined") return false;
    const m = (window.location.hash || "").match(/[#&]sso=([^&]+)/);
    if (!m) return false;
    let access_token, refresh_token;
    try { [access_token, refresh_token] = decodeURIComponent(m[1]).split("|"); } catch { /* malformed */ }
    // Strip the token fragment immediately — never leave it in the URL/history.
    history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!access_token || !refresh_token) return false;
    try {
      const timeout = new Promise((res) => setTimeout(() => res({ error: true }), 6000));
      const { error } = await Promise.race([supabase.auth.setSession({ access_token, refresh_token }), timeout]);
      return !error;
    } catch { return false; }
  })();
  return ssoPromise;
}

export function onAuthChange(cb) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_evt, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

// Resolve the logged-in person → their employee identity + assigned modules.
// Returns { employee_id, employee_code, name, email, role, track_location, modules[] } or null.
export async function fetchContext() {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("my_context");
  if (error) throw error;
  return data || null;
}
