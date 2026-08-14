import { supabase } from "../supabaseClient.js";

// ─── EMPLOYEES ──────────────────────────────────────────────────────────────

export async function fetchEmployees() {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data || [];
}

// ── HR-specific fields live in hr.employee_profile (1:1 with the shared
//    public.employees master). The `employees` relation is a READ-ONLY view,
//    so every employee write goes to employee_profile instead. ──
async function upsertEmployeeProfile(employeeId, fields) {
  const { data, error } = await supabase
    .from("employee_profile")
    .upsert(
      { employee_id: employeeId, ...fields, updated_at: new Date().toISOString() },
      { onConflict: "employee_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setEmployeePin(employeeId, pin) {
  return upsertEmployeeProfile(employeeId, { pin: String(pin).trim() });
}

export async function setTrackLocation(employeeId, track_location) {
  return upsertEmployeeProfile(employeeId, { track_location });
}

export async function setEmployeeRoster(employeeId, roster) {
  return upsertEmployeeProfile(employeeId, { roster });
}

export async function setEmployeeHomeSite(employeeId, home_site_id) {
  return upsertEmployeeProfile(employeeId, { home_site_id: home_site_id || null });
}

// Per-site calibration stats (median centre + cluster spread) from real punches.
export async function fetchSiteCalibration({ days = 120, maxAccuracy = 120 } = {}) {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("site_calibration", { p_days: days, p_max_accuracy: maxAccuracy });
  if (error) throw error;
  return data || [];
}

// ─── ATTENDANCE ──────────────────────────────────────────────────────────────

export async function fetchAttendance({ employeeId, dateFrom, dateTo, limit = 200 } = {}) {
  let q = supabase
    .from("attendance")
    .select(`
      *,
      employees ( employee_code, full_name, department, designation )
    `)
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (employeeId) q = q.eq("employee_id", employeeId);
  if (dateFrom)   q = q.gte("recorded_at", dateFrom);
  if (dateTo)     q = q.lte("recorded_at", dateTo);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// Punches flagged as off-site (GPS clearly away from the chosen, verified site).
// Admin-facing (RLS: HR/admin see all, others only their own rows).
export async function fetchOutOfSite({ dateFrom, dateTo, limit = 300 } = {}) {
  if (!supabase) return [];
  let q = supabase
    .from("attendance")
    .select(`
      id, recorded_at, type, site_name, site_distance_m, site_match, latitude, longitude, accuracy, address,
      employees ( employee_code, full_name, department )
    `)
    .eq("site_match", "mismatch")
    .order("recorded_at", { ascending: false })
    .limit(limit);
  if (dateFrom) q = q.gte("recorded_at", dateFrom);
  if (dateTo)   q = q.lte("recorded_at", dateTo);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function updateAttendanceRecord(id, { status, admin_notes }) {
  const { data, error } = await supabase
    .from("attendance")
    .update({ status, admin_notes })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAttendanceRecord(id) {
  const { error } = await supabase.from("attendance").delete().eq("id", id);
  if (error) throw error;
}

// ─── SUMMARY HELPERS ─────────────────────────────────────────────────────────

export async function fetchDailySummary(date) {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end   = new Date(date); end.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from("attendance")
    .select(`
      employee_id, type, recorded_at, status,
      employees ( employee_code, full_name, department )
    `)
    .gte("recorded_at", start.toISOString())
    .lte("recorded_at", end.toISOString())
    .order("recorded_at", { ascending: true });

  if (error) throw error;

  // Group by employee
  const map = {};
  for (const r of data || []) {
    const eid = r.employee_id;
    if (!map[eid]) map[eid] = { employee: r.employees, check_in: null, check_out: null, status: r.status };
    if (r.type === "check_in"  && !map[eid].check_in)  map[eid].check_in  = r.recorded_at;
    if (r.type === "check_out" && !map[eid].check_out) map[eid].check_out = r.recorded_at;
  }
  return Object.values(map);
}

// ─── SITES (the 47-entry pick-list the old Google Form had) ──────────────────

export async function fetchSites({ activeOnly = true } = {}) {
  if (!supabase) return [];
  let q = supabase.from("sites").select("*").order("name", { ascending: true });
  if (activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createSite(site) {
  const lat = site.latitude  === "" || site.latitude  == null ? null : Number(site.latitude);
  const lng = site.longitude === "" || site.longitude == null ? null : Number(site.longitude);
  const geo = lat != null && lng != null
    ? { geocode_confidence: "verified", geocode_provider: "manual", geocoded_at: new Date().toISOString() }
    : {};
  const { data, error } = await supabase.from("sites").insert({
    name: site.name.trim(),
    code: site.code?.trim() || null,
    latitude: lat,
    longitude: lng,
    radius_meters: Number(site.radius_meters) || 200,
    active: site.active ?? true,
    ...geo,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateSite(id, patch) {
  const body = {};
  for (const k of ["name", "code", "active"]) if (patch[k] !== undefined) body[k] = patch[k];
  for (const k of ["latitude", "longitude"])
    if (patch[k] !== undefined) body[k] = patch[k] === "" || patch[k] == null ? null : Number(patch[k]);
  if (patch.radius_meters !== undefined) body.radius_meters = Number(patch.radius_meters) || 200;
  // An admin who sets/edits coordinates is declaring ground truth: mark them
  // 'verified' so the punch geofence will actually enforce (block) against them.
  // Clearing coordinates clears the confidence so the site reverts to flag-only.
  if (body.latitude !== undefined || body.longitude !== undefined) {
    if (body.latitude != null && body.longitude != null) {
      body.geocode_confidence = "verified";
      body.geocode_provider = "manual";
      body.geocoded_at = new Date().toISOString();
    } else {
      body.geocode_confidence = null;
      body.geocoded_at = null;
    }
  }
  const { data, error } = await supabase.from("sites").update(body).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

// ─── HOLIDAYS ───────────────────────────────────────────────────────────────

export async function fetchHolidays(year) {
  if (!supabase) return [];
  let q = supabase.from("holidays").select("*").order("holiday_date", { ascending: true });
  if (year) q = q.gte("holiday_date", `${year}-01-01`).lte("holiday_date", `${year}-12-31`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function addHoliday(holiday_date, name) {
  const { data, error } = await supabase.from("holidays")
    .upsert({ holiday_date, name: name.trim() }, { onConflict: "holiday_date" }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteHoliday(holiday_date) {
  const { error } = await supabase.from("holidays").delete().eq("holiday_date", holiday_date);
  if (error) throw error;
}

// ─── SHIFT / OT SETTINGS ────────────────────────────────────────────────────

export async function fetchAttendanceSettings() {
  if (!supabase) return null;
  const { data, error } = await supabase.from("attendance_settings").select("*").eq("id", true).single();
  if (error) throw error;
  return data;
}

export async function saveAttendanceSettings(patch) {
  const { data, error } = await supabase.from("attendance_settings")
    .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", true).select().single();
  if (error) throw error;
  return data;
}

// ─── DAILY + MONTHLY ROLL-UPS (replaces the sheet's Monthly / Overtime tabs) ─

export async function fetchAttendanceDays({ subjectId, from, to, limit = 2000 } = {}) {
  if (!supabase) return [];
  let q = supabase.from("attendance_day").select("*")
    .order("work_date", { ascending: false }).limit(limit);
  if (subjectId) q = q.eq("subject_id", subjectId);
  if (from) q = q.gte("work_date", from);
  if (to)   q = q.lte("work_date", to);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchAttendanceMonth(month, { subjectId } = {}) {
  if (!supabase) return [];
  let q = supabase.from("attendance_month").select("*")
    .eq("month", month).order("full_name", { ascending: true });
  if (subjectId) q = q.eq("subject_id", subjectId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ─── TODAY BOARD (live daily view for HR) ────────────────────────────────────

/** Calendar date in IST as "YYYY-MM-DD". The whole attendance model is IST-day
 *  based (see attendance_day.work_date), so never use the browser's local date. */
export function istDate(d = new Date()) {
  return new Date(d.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// attendance_day.day_status values that mean "approved away", vs "not a working
// day at all". Both must be kept out of the not-punched list — chasing someone
// for missing a punch on a Sunday is exactly the noise that kills a daily board.
const LEAVE_DAY_STATUS = new Set(["sick", "casual", "emergency", "short_leave", "earned", "unpaid", "on_leave"]);
const OFF_DAY_STATUS   = new Set(["week_off", "holiday"]);

/**
 * Who is in, late, still out, and — the one the punch log can't answer —
 * who has not punched at all today.
 *
 * "Expected today" deliberately means *people already using the portal*
 * (anyone who punched in the last `windowDays`), NOT all 74 active employees.
 * The roster has no "enrolled in attendance" flag yet, so counting everyone
 * would bury the 12 real users under 60 colleagues who were never onboarded.
 * Callers get `enrolled` vs `rosterActive` so the UI can say which it means.
 */
export async function fetchTodayBoard(date = istDate(), { windowDays = 14 } = {}) {
  if (!supabase) return null;

  const since = istDate(new Date(Date.now() - windowDays * 86400000));
  const [{ data: recent, error: rErr }, allDays, subjects] = await Promise.all([
    supabase.from("attendance_day").select("subject_id, subject_kind, full_name, employee_code, department")
      .eq("subject_kind", "employee")
      .gte("work_date", since).lte("work_date", date),
    fetchAttendanceDays({ from: date, to: date }),
    fetchAttendanceSubjects(),
  ]);
  if (rErr) throw rErr;

  // Only hub employees belong on this board. hr.attendance_person entries
  // (subject_kind 'roster') are the imported HSIPL names with no hub login —
  // they cannot punch, so listing them would park them in "not punched"
  // permanently and make the one actionable list useless.
  const days = (allDays || []).filter((d) => d.subject_kind === "employee");

  // Distinct people seen in the window — the set we expect a punch from.
  const expected = new Map();
  for (const r of recent || []) {
    if (!expected.has(r.subject_id)) expected.set(r.subject_id, r);
  }
  const todayBy = new Map(days.map((d) => [d.subject_id, d]));
  // Anyone punching for the first time today still belongs on the board.
  for (const d of days) if (!expected.has(d.subject_id)) expected.set(d.subject_id, d);

  const rows = [...expected.values()].map((p) => {
    const d = todayBy.get(p.subject_id) || null;
    // day_status carries the leave type directly (sick/casual/emergency/…), so
    // don't rely on leave_type alone — it is null on some leave rows and those
    // people would be reported as "not punched" on a day they were approved off.
    let state;
    if (d?.in_at) state = d.out_at ? "done" : "in";
    else if (d?.leave_type || LEAVE_DAY_STATUS.has(d?.day_status)) state = "on_leave";
    else if (OFF_DAY_STATUS.has(d?.day_status)) state = "off";   // Sunday / holiday
    else state = "not_in";
    return {
      subject_id: p.subject_id,
      full_name: p.full_name,
      employee_code: p.employee_code,
      department: p.department,
      state,                                   // not_in | in | done | on_leave
      late: d?.day_status === "late",
      in_at: d?.in_at ?? null,
      out_at: d?.out_at ?? null,
      worked_minutes: d?.worked_minutes ?? null,
      ot_minutes: d?.ot_minutes ?? null,
      site_name: d?.site_name ?? null,
      flagged: d?.any_unverified === true,
      leave_type: d?.leave_type ?? null,
      day_status: d?.day_status ?? null,
    };
  })
    .filter((r) => r.state !== "off")   // week-offs/holidays are not a to-do list
    .sort((a, b) => (a.in_at || "9").localeCompare(b.in_at || "9") || String(a.full_name).localeCompare(String(b.full_name)));

  return {
    date,
    rows,
    enrolled: rows.length,
    rosterActive: (subjects || []).filter((s) => s.subject_kind === "employee").length,
    counts: {
      in:       rows.filter((r) => r.state === "in").length,
      done:     rows.filter((r) => r.state === "done").length,
      not_in:   rows.filter((r) => r.state === "not_in").length,
      on_leave: rows.filter((r) => r.state === "on_leave").length,
      late:     rows.filter((r) => r.late).length,
      flagged:  rows.filter((r) => r.flagged).length,
    },
  };
}

/** Everyone attendance can be recorded for: hub employees + HR-roster people. */
export async function fetchAttendanceSubjects() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("attendance_subject")
    .select("*").eq("is_active", true).order("full_name", { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Per-person work rules from the HSIPL sheet: planned days, Sunday working,
 *  and the paid-leave allowance ("Allowed Leaves", 2.5 in the sheet). */
export async function setEmployeeWorkRules(employeeId, { planned_days_per_week, works_sunday, allowed_leaves_per_month }) {
  const fields = {};
  if (planned_days_per_week    !== undefined) fields.planned_days_per_week    = Number(planned_days_per_week);
  if (works_sunday             !== undefined) fields.works_sunday             = !!works_sunday;
  if (allowed_leaves_per_month !== undefined) fields.allowed_leaves_per_month = Number(allowed_leaves_per_month);
  return upsertEmployeeProfile(employeeId, fields);
}

/** The profile row backing those rules (null when none exists yet). */
export async function fetchEmployeeProfile(employeeId) {
  if (!supabase || !employeeId) return null;
  const { data } = await supabase.from("employee_profile").select("*").eq("employee_id", employeeId).maybeSingle();
  return data || null;
}

// ─── REMARKS (the sheet's "Remarks" tab) ────────────────────────────────────
// A remark hangs off either a hub employee or an HR-roster person, matching the
// XOR constraint on the table. Callers pass the subject straight from
// attendance_month / attendance_day, so this maps kind -> the right column.

const subjectCols = (subjectId, subjectKind) =>
  subjectKind === "roster" ? { person_ref: subjectId } : { employee_id: subjectId };

export async function fetchRemarks({ from, to, subjectId, subjectKind } = {}) {
  if (!supabase) return [];
  let q = supabase.from("attendance_remarks").select("*").order("remark_date", { ascending: false });
  if (from) q = q.gte("remark_date", from);
  if (to)   q = q.lte("remark_date", to);
  if (subjectId) {
    const c = subjectCols(subjectId, subjectKind);
    q = c.person_ref ? q.eq("person_ref", c.person_ref) : q.eq("employee_id", c.employee_id);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function addRemark({ subjectId, subjectKind, remark_date, remark, created_by }) {
  const { data, error } = await supabase.from("attendance_remarks").insert({
    ...subjectCols(subjectId, subjectKind),
    remark_date, remark: remark.trim(), created_by: created_by || null,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRemark(id) {
  const { error } = await supabase.from("attendance_remarks").delete().eq("id", id);
  if (error) throw error;
}
