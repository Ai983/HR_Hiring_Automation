import { supabase } from "../supabaseClient.js";

// ─────────────────────────────────────────────────────────────────────
// Performance management (hr.performance_cycles + hr.performance_reviews).
//
// Basic by design — see the migration header for what is deliberately not
// modelled. RLS lets an employee read their OWN review and lets hr_admin
// read and write everything; the role checks in the UI only decide what is
// offered, never what is permitted.
// ─────────────────────────────────────────────────────────────────────

export const CYCLE_STATUSES = [
  { id: "draft",  label: "Draft",  color: "#8a7e72", bg: "rgba(138,126,114,0.10)" },
  { id: "active", label: "Active", color: "#c97a2a", bg: "rgba(201,122,42,0.10)" },
  { id: "closed", label: "Closed", color: "#3f7d4c", bg: "rgba(63,125,76,0.10)" },
];

export const REVIEW_STATUSES = [
  { id: "draft",          label: "Not started",   color: "#8a7e72", bg: "rgba(138,126,114,0.10)" },
  { id: "self_review",    label: "Self review",   color: "#0ea5e9", bg: "rgba(14,165,233,0.10)" },
  { id: "manager_review", label: "Manager review",color: "#c97a2a", bg: "rgba(201,122,42,0.10)" },
  { id: "final",          label: "Final",         color: "#3f7d4c", bg: "rgba(63,125,76,0.10)" },
];

export const cycleStatusMeta  = (id) => CYCLE_STATUSES.find((s) => s.id === id)  || CYCLE_STATUSES[0];
export const reviewStatusMeta = (id) => REVIEW_STATUSES.find((s) => s.id === id) || REVIEW_STATUSES[0];

// ── Cycles ───────────────────────────────────────────────────────────
export async function fetchCycles() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("performance_cycles")
    .select("*")
    .order("period_start", { ascending: false });
  if (error) throw new Error(error.message || "Could not load review cycles.");
  return data || [];
}

export async function createCycle({ name, periodStart, periodEnd, notes, ctx }) {
  if (!supabase) throw new Error("Supabase not configured.");
  const { data, error } = await supabase
    .from("performance_cycles")
    .insert({
      name: name.trim(),
      period_start: periodStart,
      period_end: periodEnd,
      notes: notes?.trim() || null,
      created_by: ctx?.employee_id || null,
    })
    .select("*")
    .single();
  if (error) {
    // The unique constraint on name is the one a user actually trips, and
    // the raw Postgres text ("duplicate key value violates...") means
    // nothing to HR.
    throw new Error(
      /duplicate key|unique/i.test(error.message || "")
        ? `A cycle called "${name.trim()}" already exists.`
        : error.message || "Could not create the cycle."
    );
  }
  return data;
}

export async function updateCycle(id, fields) {
  const { data, error } = await supabase
    .from("performance_cycles").update(fields).eq("id", id).select("*").single();
  if (error) throw new Error(error.message || "Could not update the cycle.");
  return data;
}

export async function deleteCycle(id) {
  // Reviews cascade with the cycle — that is the FK's ON DELETE CASCADE,
  // and it is why the panel confirms with the review count first.
  const { error } = await supabase.from("performance_cycles").delete().eq("id", id);
  if (error) throw new Error(error.message || "Could not delete the cycle.");
}

// ── Reviews ──────────────────────────────────────────────────────────
/** Reviews for one cycle, joined to the employee they belong to. */
export async function fetchReviews(cycleId) {
  if (!supabase || !cycleId) return [];
  const { data, error } = await supabase
    .from("performance_reviews")
    .select("*")
    .eq("cycle_id", cycleId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message || "Could not load reviews.");
  return data || [];
}

/**
 * Add reviews for a set of employees in one go.
 *
 * Uses upsert with ignoreDuplicates so re-running "add everyone" after three
 * people joined adds only those three, instead of failing the whole batch on
 * the (cycle_id, employee_id) unique constraint.
 */
export async function addReviews(cycleId, employeeIds) {
  if (!supabase || !employeeIds?.length) return [];
  const rows = employeeIds.map((employee_id) => ({ cycle_id: cycleId, employee_id }));
  const { data, error } = await supabase
    .from("performance_reviews")
    .upsert(rows, { onConflict: "cycle_id,employee_id", ignoreDuplicates: true })
    .select("*");
  if (error) throw new Error(error.message || "Could not add reviews.");
  return data || [];
}

export async function updateReview(id, fields) {
  const { data, error } = await supabase
    .from("performance_reviews").update(fields).eq("id", id).select("*").single();
  if (error) throw new Error(error.message || "Could not save the review.");
  return data;
}

export async function deleteReview(id) {
  const { error } = await supabase.from("performance_reviews").delete().eq("id", id);
  if (error) throw new Error(error.message || "Could not remove that review.");
}

/** The signed-in user's own reviews, newest cycle first. */
export async function fetchMyReviews(employeeId) {
  if (!supabase || !employeeId) return [];
  const { data, error } = await supabase
    .from("performance_reviews")
    .select("*, performance_cycles(name, period_start, period_end, status)")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message || "Could not load your reviews.");
  return data || [];
}

/**
 * Average of the ratings that exist, ignoring the ones that don't.
 * Returns null rather than 0 for "nothing rated yet" — 0 would render as the
 * worst possible score, which is the opposite of "no data".
 */
export function averageRating(reviews, field = "final_rating") {
  const vals = (reviews || []).map((r) => r[field]).filter((v) => v !== null && v !== undefined).map(Number);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}
