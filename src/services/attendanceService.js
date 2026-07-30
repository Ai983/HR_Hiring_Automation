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
  const { data, error } = await supabase.from("sites").insert({
    name: site.name.trim(),
    code: site.code?.trim() || null,
    latitude:  site.latitude  === "" || site.latitude  == null ? null : Number(site.latitude),
    longitude: site.longitude === "" || site.longitude == null ? null : Number(site.longitude),
    radius_meters: Number(site.radius_meters) || 500,
    active: site.active ?? true,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateSite(id, patch) {
  const body = {};
  for (const k of ["name", "code", "active"]) if (patch[k] !== undefined) body[k] = patch[k];
  for (const k of ["latitude", "longitude"])
    if (patch[k] !== undefined) body[k] = patch[k] === "" || patch[k] == null ? null : Number(patch[k]);
  if (patch.radius_meters !== undefined) body.radius_meters = Number(patch.radius_meters) || 500;
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

export async function fetchAttendanceMonth(month) {
  if (!supabase) return [];
  const { data, error } = await supabase.from("attendance_month").select("*")
    .eq("month", month).order("full_name", { ascending: true });
  if (error) throw error;
  return data || [];
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
