// ============================================================
// assessmentService — the HR side of the walk-in assessment.
//
// Reads hr.assessment_attempts through the normal authenticated client, so RLS
// (hr.has_hireflow()) applies exactly as it does everywhere else. The candidate
// side never comes through here — see assessmentApi.js.
// ============================================================

import { supabase } from "../supabaseClient.js";

// Kept in step with supabase/functions/_shared/assessment-bank.ts. TOTAL_MARKS
// is only used for the "n / 25" labels; the stored scores are authoritative and
// a v2 attempt (20 marks) still renders correctly from its own `review`.
export const ASSESSMENT_ID = "HAG-WALKIN-L1-v4";
export const TOTAL_MARKS = 20;

// Attempts are never migrated between versions (§7.3), so the panel will show
// v2 and v3 rows side by side for a while. Score out of the paper the candidate
// actually sat, not out of whatever the current paper happens to be.
const PAPER_MARKS = {
  "HAG-WALKIN-L1-v2": 20,
  "HAG-WALKIN-L1-v3": 25,
  "HAG-WALKIN-L1-v4": 20,
};
export const marksFor = (assessmentId) => PAPER_MARKS[assessmentId] ?? TOTAL_MARKS;

export const BANDS = {
  STRONG:    { label: "Strong",    bg: "rgba(34,197,94,0.12)",  color: "#16a34a" },
  AVERAGE:   { label: "Average",   bg: "rgba(14,165,233,0.12)", color: "#0369a1" },
  WEAK:      { label: "Weak",      bg: "rgba(245,158,11,0.12)", color: "#b45309" },
  BELOW_BAR: { label: "Below Bar", bg: "rgba(239,68,68,0.10)",  color: "#dc2626" },
};

/**
 * Attempts for the panel.
 *
 * Sorted by score descending by default — §6.3 of the drive document is
 * explicit that this score is a QUEUE-PRIORITISATION SORT, not a hiring gate.
 * It decides who the panel sees first on a busy day. Do not add a minimum-score
 * filter here: an experienced site supervisor may score 8/20 and still be the
 * right hire.
 */
export async function fetchAttempts({ dateFrom, dateTo, band, search, sort = "score" } = {}) {
  if (!supabase) return [];
  let q = supabase
    .from("assessment_attempts")
    .select("id, assessment_id, email, full_name, attempt_no, applicant_id, started_at, submitted_at, duration_seconds, auto_submitted, score_total, score_section_a, score_section_b, score_section_c, score_section_d, score_section_e, band, status, retake_unlocked, unlocked_by, notes")
    .limit(1000);

  if (dateFrom) q = q.gte("started_at", new Date(dateFrom + "T00:00:00").toISOString());
  if (dateTo)   q = q.lte("started_at", new Date(dateTo   + "T23:59:59").toISOString());
  if (band)     q = q.eq("band", band);
  if (search) {
    const s = search.trim().replace(/[,%]/g, "");
    if (s) q = q.or(`email.ilike.%${s}%,full_name.ilike.%${s}%`);
  }

  q = sort === "recent"
    ? q.order("started_at", { ascending: false })
    : q.order("score_total", { ascending: false, nullsFirst: false }).order("submitted_at", { ascending: true });

  const { data, error } = await q;
  if (error) throw new Error(error.message || "Could not load attempts.");
  return data || [];
}

/** One attempt with its marked paper, for the review modal. */
export async function fetchAttempt(id) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("assessment_attempts")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message || "Could not load the attempt.");
  return data;
}

/**
 * Clear the one-attempt block for a candidate whose sitting genuinely failed —
 * a dead phone, a browser crash. The flag is consumed by the next start, so
 * this grants exactly one re-sit, not unlimited ones.
 */
export async function unlockRetake(id, unlockedBy) {
  if (!supabase) return;
  const { error } = await supabase
    .from("assessment_attempts")
    .update({ retake_unlocked: true, unlocked_by: unlockedBy || null, unlocked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message || "Could not unlock a retake.");
}

/** Attach an attempt to the applicant record once HR has the CV in hand. */
export async function linkToApplicant(id, applicantId) {
  if (!supabase) return;
  const { error } = await supabase
    .from("assessment_attempts")
    .update({ applicant_id: applicantId || null })
    .eq("id", id);
  if (error) throw new Error(error.message || "Could not link the applicant.");
}

export async function saveNotes(id, notes) {
  if (!supabase) return;
  const { error } = await supabase.from("assessment_attempts").update({ notes }).eq("id", id);
  if (error) throw new Error(error.message || "Could not save notes.");
}

/** Badge count for the sidebar: papers submitted today. */
export async function fetchTodaySubmittedCount() {
  if (!supabase) return 0;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("assessment_attempts")
    .select("id", { count: "exact", head: true })
    .eq("status", "submitted")
    .gte("submitted_at", start.toISOString());
  return count || 0;
}
