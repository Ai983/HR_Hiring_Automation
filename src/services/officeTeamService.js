import { supabase } from "../supabaseClient.js";

// Data access for the team attendance report.
//
// Membership is DERIVED, per month: everyone who actually recorded attendance
// in the month being viewed, office and site alike. It was a stored flag
// (hr.employee_profile.office_team) curated by the EA until 2026-09-07, which
// silently excluded site staff — two site engineers onboarded that morning
// punched in and never appeared. Requested change: the sheet covers whoever is
// putting attendance into the system.
//
// The known cost of deriving it, which the stored flag existed to avoid:
// someone with NO record at all in a month drops off the sheet entirely rather
// than showing as absent. That is why `office_team` is still written and read
// nowhere else — restoring the curated list is a one-function change.
//
// Panels never touch supabase directly — everything goes through here.

/** Everyone who recorded attendance in `month`, in report order.
 *
 *  Roster people are excluded: they have no login and never punch, and the
 *  ~60 imported sheet names belong to Monthly Report, not this sheet. */
export async function fetchOfficeTeam(month) {
  if (!supabase || !month) return [];
  // One row per person per month, so this is the distinct list already.
  const { data: months, error: monthErr } = await supabase
    .from("attendance_month")
    .select("subject_id")
    .eq("month", month);
  if (monthErr) throw monthErr;

  const ids = [...new Set((months || []).map((m) => m.subject_id))];
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("attendance_subject")
    .select("*")
    .in("subject_id", ids)
    .eq("subject_kind", "employee")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Everyone the EA could add to the team — hub employees only. A roster person
 *  has no login, so they can never punch and can never belong here. */
export async function fetchAssignableSubjects() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("attendance_subject")
    .select("*")
    .eq("subject_kind", "employee")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Add or remove one person. Writes to hr.employee_profile — public.employees
 *  is read-only from this app (CLAUDE.md rule 1). */
export async function setOfficeTeam(employeeId, on) {
  const { data, error } = await supabase
    .from("employee_profile")
    .upsert(
      { employee_id: employeeId, office_team: !!on, updated_at: new Date().toISOString() },
      { onConflict: "employee_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Month summaries for a set of people. One round trip, not one per person. */
export async function fetchOfficeTeamMonth(month, subjectIds) {
  if (!supabase || !subjectIds?.length) return [];
  const { data, error } = await supabase
    .from("attendance_month")
    .select("*")
    .eq("month", month)
    .in("subject_id", subjectIds);
  if (error) throw error;
  return data || [];
}

/** Every day row for a set of people across one month.
 *
 *  Paged deliberately. PostgREST caps a response at max-rows (1000 here), and
 *  the derived team is far larger than the fifteen this was written for — one
 *  month for ~66 people is ~2,000 rows. An unpaged read does not error, it just
 *  stops, and the people sorted last quietly lose their days. Ordering by
 *  subject then date keeps each person's rows contiguous and in date order
 *  across page boundaries. */
export async function fetchOfficeTeamDays({ subjectIds, from, to }) {
  if (!supabase || !subjectIds?.length) return [];
  const PAGE = 1000;
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("attendance_day")
      .select("*")
      .in("subject_id", subjectIds)
      .gte("work_date", from)
      .lte("work_date", to)
      .order("subject_id", { ascending: true })
      .order("work_date", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** Remarks for the month, so the report's Remarks column is not always blank. */
export async function fetchOfficeTeamRemarks({ from, to }) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("attendance_remarks")
    .select("*")
    .gte("remark_date", from)
    .lte("remark_date", to);
  if (error) throw error;
  return data || [];
}

// ─── Month helpers ───────────────────────────────────────────────────────────
// The attendance model is IST-day based throughout (see attendance_day.work_date),
// so month boundaries are built from plain date strings and never from a
// Date object's local getMonth(), which is the browser's timezone, not IST.

export const monthStart = (iso) => `${iso.slice(0, 7)}-01`;

export function monthEnd(iso) {
  const [y, m] = iso.split("-").map(Number);
  return `${iso.slice(0, 7)}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

export function monthOptions(count = 18) {
  const out = [];
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth() + 1;
  for (let i = 0; i < count; i++) {
    out.push(`${y}-${String(m).padStart(2, "0")}-01`);
    if (--m === 0) { m = 12; y--; }
  }
  return out;
}

export const monthLabel = (iso) =>
  new Date(`${iso.slice(0, 7)}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
