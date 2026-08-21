// ============================================================
// assessmentService — the HR side of the walk-in assessment.
//
// Reads hr.assessment_attempts through the normal authenticated client, so RLS
// (hr.has_hireflow()) applies exactly as it does everywhere else. The candidate
// side never comes through here — see assessmentApi.js.
// ============================================================

import { supabase, supabaseUrl, supabaseAnon } from "../supabaseClient.js";

// Kept in step with supabase/functions/_shared/assessment-bank.ts. TOTAL_MARKS
// is only used for the "n / 15" labels; the stored scores are authoritative and
// a v2 attempt (20 marks) still renders correctly from its own `review`.
export const ASSESSMENT_ID = "HAG-WALKIN-L1-v5";
export const TOTAL_MARKS = 15;

// Attempts are never migrated between versions (§7.3), so the panel will show
// v2 and v3 rows side by side for a while. Score out of the paper the candidate
// actually sat, not out of whatever the current paper happens to be.
//
// The level-2 role papers are all 12 marks and are not listed individually —
// there are thirteen of them, each independently versionable, and listing them
// here would be one more place to forget to update. `review.length` on the row
// is the authoritative count and is what the panel prefers; ROLE_MARKS is only
// the fallback for a row with no marked paper yet.
const PAPER_MARKS = {
  "HAG-WALKIN-L1-v2": 20,
  "HAG-WALKIN-L1-v3": 25,
  "HAG-WALKIN-L1-v4": 20,
  "HAG-WALKIN-L1-v5": 15,
};
export const ROLE_MARKS = 12;

/**
 * Marks the given attempt was out of.
 *
 * Prefers the row's own stored paper — `review.length` for a submitted attempt,
 * then the section counts in `section_meta` — and only falls back to the table
 * above. That order is what keeps an old attempt readable after its paper has
 * been bumped, without the panel having to know anything about the bank.
 */
export function marksFor(assessmentIdOrRow, maybeRow) {
  const row = typeof assessmentIdOrRow === "object" ? assessmentIdOrRow : maybeRow;
  const assessmentId = typeof assessmentIdOrRow === "object"
    ? assessmentIdOrRow?.assessment_id
    : assessmentIdOrRow;

  if (Array.isArray(row?.review) && row.review.length) return row.review.length;
  if (Array.isArray(row?.section_meta) && row.section_meta.length) {
    return row.section_meta.reduce((n, s) => n + (s.count || 0), 0);
  }
  if (PAPER_MARKS[assessmentId]) return PAPER_MARKS[assessmentId];
  if (row?.paper_kind === "ROLE" || String(assessmentId || "").startsWith("HAG-ROLE-")) {
    return ROLE_MARKS;
  }
  return TOTAL_MARKS;
}

// The section columns the panel renders. Level 1 has a fixed set; every role
// paper has its own, so a row's `section_meta` wins where it exists.
export const L1_SECTIONS = [
  { id: "A", name: "Attitude & Ownership", count: 4 },
  { id: "B", name: "Communication & Teamwork", count: 4 },
  { id: "C", name: "Reliability & Time", count: 4 },
  { id: "D", name: "Problem Solving", count: 3 },
];

export const SECTION_COLUMNS = ["A", "B", "C", "D", "E"];
export const sectionKey = (id) => `score_section_${id.toLowerCase()}`;

/** The sections of the paper this row actually sat. */
export function sectionsFor(row) {
  if (Array.isArray(row?.section_meta) && row.section_meta.length) return row.section_meta;
  return L1_SECTIONS;
}

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
export async function fetchAttempts({
  dateFrom, dateTo, band, search, sort = "score", paperKind, position,
} = {}) {
  if (!supabase) return [];
  let q = supabase
    .from("assessment_attempts")
    .select("id, assessment_id, paper_kind, position_applied, section_meta, email, full_name, attempt_no, applicant_id, started_at, submitted_at, duration_seconds, auto_submitted, score_total, score_section_a, score_section_b, score_section_c, score_section_d, score_section_e, band, status, retake_unlocked, unlocked_by, notes")
    .limit(1000);

  if (dateFrom) q = q.gte("started_at", new Date(dateFrom + "T00:00:00").toISOString());
  if (dateTo)   q = q.lte("started_at", new Date(dateTo   + "T23:59:59").toISOString());
  if (band)     q = q.eq("band", band);
  // Level 1 and level 2 are different papers with different marks and different
  // sections, so mixing them in one table is only ever confusing. The panel
  // always has one or the other selected.
  if (paperKind) q = q.eq("paper_kind", paperKind);
  // A position filter is a way of comparing the candidates for ONE role against
  // each other. It is still a sort within that group, never a gate (§6.3).
  if (position)  q = q.eq("position_applied", position);
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

/**
 * The positions that actually have level-2 attempts, for the filter dropdown.
 *
 * Derived from the rows rather than from a hardcoded copy of §2.2, so the filter
 * only ever offers positions somebody has actually sat — an empty dropdown entry
 * that returns nothing reads as a bug to whoever is running the desk.
 */
export async function fetchAttemptedPositions() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("assessment_attempts")
    .select("position_applied")
    .eq("paper_kind", "ROLE")
    .not("position_applied", "is", null)
    .limit(2000);
  if (error) return [];
  return [...new Set((data || []).map((r) => r.position_applied))].sort();
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

/**
 * The full paper INCLUDING the answer key and explanations, for HR review.
 *
 * This deliberately does NOT read a local question bank — importing either bank
 * into anything under src/ would ship 171 answer keys to every candidate's
 * phone, which is the single invariant this whole design protects. Instead the
 * `assessment` edge function serves it at runtime to a caller who is signed in
 * AND has the hireflow module; anon gets 401 and attendance-only gets 403.
 *
 * Sends the user's access token rather than the anon key, because the anon key
 * is a valid project JWT with no user behind it and would fail the check.
 */
export async function fetchPaper({ kind = "L1", position } = {}) {
  if (!supabase) throw new Error("Not configured.");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please sign in again.");

  const url = `${(supabaseUrl || "").replace(/\/$/, "")}/functions/v1/assessment`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action: "paper", kind, position: position || undefined }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Could not load the paper (${res.status}).`);
  return data;
}

/** The 13 level-2 positions, for the review page's picker. Carries no answers. */
export async function fetchPaperPositions() {
  if (!supabase) return [];
  const url = `${(supabaseUrl || "").replace(/\/$/, "")}/functions/v1/assessment`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseAnon}` },
    body: JSON.stringify({ action: "positions" }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Could not load the positions.");
  return data?.positions || [];
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
