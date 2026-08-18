import { supabase } from "../supabaseClient.js";

// ─── LEAVE REQUESTS ──────────────────────────────────────────────────────────

// Create a new leave request. `req` already carries the computed day split
// (total_days / paid_days / unpaid_days) from leaveConfig helpers.
export async function createLeaveRequest(req) {
  const { data, error } = await supabase
    .from("leave_requests")
    .insert({
      employee_id: req.employee_id,
      request_to:  req.request_to,
      leave_type:  req.leave_type,
      reason:      req.reason?.trim() || null,
      start_date:  req.start_date,
      end_date:    req.end_date,
      total_days:  req.total_days,
      paid_days:   req.paid_days,
      unpaid_days: req.unpaid_days,
      status:      "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Admin list with employee join + optional filters.
// `phone` is joined so the approve/reject WhatsApp can be sent straight from the
// admin panel without a second round-trip — and so the number comes from the DB
// rather than client auth state, which doesn't carry it.
export async function fetchLeaveRequests({ employeeId, status, dateFrom, dateTo, limit = 500 } = {}) {
  let q = supabase
    .from("leave_requests")
    .select(`
      *,
      employees ( employee_code, full_name, department, designation, phone )
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (employeeId) q = q.eq("employee_id", employeeId);
  if (status)     q = q.eq("status", status);
  if (dateFrom)   q = q.gte("start_date", dateFrom);
  if (dateTo)     q = q.lte("start_date", dateTo);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// Count of pending requests — used for the sidebar badge.
export async function fetchPendingLeaveCount() {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) return 0;
  return count || 0;
}

// Approve / reject / cancel.
export async function updateLeaveStatus(id, { status, admin_notes, reviewed_by }) {
  const { data, error } = await supabase
    .from("leave_requests")
    .update({
      status,
      admin_notes: admin_notes ?? null,
      reviewed_by: reviewed_by ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLeaveRequest(id) {
  const { error } = await supabase.from("leave_requests").delete().eq("id", id);
  if (error) throw error;
}

// ─── BALANCE ─────────────────────────────────────────────────────────────────
// Sum of paid_days an employee has already consumed for leave that STARTS in the
// current calendar month. Rejected/cancelled requests don't count against the
// allowance; pending + approved do (so the preview is conservative — an employee
// can't double-book paid days while a request awaits approval).
export async function fetchPaidDaysUsedThisMonth(employeeId, ref = new Date()) {
  if (!supabase || !employeeId) return 0;
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end   = new Date(ref.getFullYear(), ref.getMonth() + 1, 0); // last day of month
  const toISO = (d) => d.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("leave_requests")
    .select("paid_days")
    .eq("employee_id", employeeId)
    .in("status", ["pending", "approved"])
    .gte("start_date", toISO(start))
    .lte("start_date", toISO(end));

  if (error) return 0;
  return (data || []).reduce((sum, r) => sum + Number(r.paid_days || 0), 0);
}

// Per-employee paid-leave allowance (the HSIPL sheet's "Allowed Leaves", 2.5).
// Falls back to the config default when no profile row exists yet.
export async function fetchLeaveAllowance(employeeId, fallback = 2.5) {
  if (!supabase || !employeeId) return fallback;
  const { data, error } = await supabase
    .from("employee_profile").select("allowed_leaves_per_month")
    .eq("employee_id", employeeId).maybeSingle();
  if (error || !data) return fallback;
  return Number(data.allowed_leaves_per_month ?? fallback);
}
