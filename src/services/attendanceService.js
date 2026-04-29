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

export async function createEmployee(emp) {
  const { data, error } = await supabase
    .from("employees")
    .insert({
      employee_code: emp.employee_code.toUpperCase().trim(),
      full_name:     emp.full_name.trim(),
      email:         emp.email?.trim() || null,
      phone:         emp.phone?.trim() || null,
      department:    emp.department?.trim() || null,
      designation:   emp.designation?.trim() || null,
      pin:           emp.pin.trim(),
      is_active:     true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEmployee(id, updates) {
  const patch = { updated_at: new Date().toISOString() };
  if (updates.full_name  !== undefined) patch.full_name  = updates.full_name.trim();
  if (updates.email      !== undefined) patch.email      = updates.email?.trim() || null;
  if (updates.phone      !== undefined) patch.phone      = updates.phone?.trim() || null;
  if (updates.department !== undefined) patch.department = updates.department?.trim() || null;
  if (updates.designation!== undefined) patch.designation= updates.designation?.trim() || null;
  if (updates.pin        !== undefined) patch.pin        = updates.pin.trim();
  if (updates.is_active  !== undefined) patch.is_active  = updates.is_active;

  const { data, error } = await supabase
    .from("employees")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function toggleEmployeeActive(id, currentState) {
  return updateEmployee(id, { is_active: !currentState });
}

export async function resetEmployeePin(id, newPin) {
  return updateEmployee(id, { pin: newPin });
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
