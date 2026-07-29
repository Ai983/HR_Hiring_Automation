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
