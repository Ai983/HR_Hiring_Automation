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
