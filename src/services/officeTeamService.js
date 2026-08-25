import { supabase } from "../supabaseClient.js";

// Data access for the EA's Office Team attendance report.
//
// "Office team" is hr.employee_profile.office_team, a stored flag, NOT a query
// over who punched recently. Derived membership drops anyone away for a
// fortnight, and two of the fifteen (Yash Kumar Sharma, Bipin Jha) had not
// punched on the portal at all when the report was built. The EA maintains the
// list from the panel.
//
// Panels never touch supabase directly — everything goes through here.

/** The office team, in report order. */
export async function fetchOfficeTeam() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("attendance_subject")
    .select("*")
    .eq("office_team", true)
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

/** Every day row for a set of people across one month. */
export async function fetchOfficeTeamDays({ subjectIds, from, to }) {
  if (!supabase || !subjectIds?.length) return [];
  const { data, error } = await supabase
    .from("attendance_day")
    .select("*")
    .in("subject_id", subjectIds)
    .gte("work_date", from)
    .lte("work_date", to)
    .order("work_date", { ascending: true });
  if (error) throw error;
  return data || [];
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
