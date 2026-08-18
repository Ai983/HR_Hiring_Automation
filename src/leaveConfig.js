// ─────────────────────────────────────────────────────────────────────────────
// LEAVE POLICY — single source of truth shared by the employee portal AND admin.
// Change the numbers here and both sides update automatically.
// ─────────────────────────────────────────────────────────────────────────────

// Paid leave days granted to every employee per CALENDAR MONTH.
// Anything beyond this in the same month is unpaid (salary deducted).
// No carry-forward: unused paid days do NOT roll into the next month.
// Fallback only. The real figure is per-employee in
// hr.employee_profile.allowed_leaves_per_month (the HSIPL sheet used 2.5),
// so always prefer the value passed in from the database.
export const PAID_LEAVE_PER_MONTH = 2.5;

// Leave types — mirrors the existing Google Form ("Type of leave").
// `value` is what we store; `label` is what the employee sees.
// `isHalf` types always count as 0.5 day regardless of the date range.
// `fixedDays` pins a type to a fraction regardless of the date range.
// SHL is 0.25 — inferred from the sheet's 0.75 short-leave totals being 3 x SHL.
export const LEAVE_TYPES = [
  { value: "casual",      label: "Casual Leave",    short: "CL",  hi: "आकस्मिक अवकाश",      fixedDays: null },
  { value: "half_day",    label: "Half Day Leave",  short: "HD",  hi: "आधे दिन की छुट्टी",  fixedDays: 0.5  },
  { value: "short_leave", label: "Short Leave",     short: "SHL", hi: "थोड़े समय की छुट्टी", fixedDays: 0.25 },
  { value: "emergency",   label: "Emergency Leave", short: "EL",  hi: "आपात छुट्टी",        fixedDays: null },
  { value: "sick",        label: "Sick Leave",      short: "SL",  hi: "बीमारी के लिए",      fixedDays: null },
  { value: "uninformed",  label: "Uninformed Leave", short: "UL", hi: "बिना सूचना छुट्टी",   fixedDays: null, adminOnly: true },
];

/** Types an employee may request themselves (UL is marked by HR, not applied for). */
export const REQUESTABLE_LEAVE_TYPES = LEAVE_TYPES.filter((t) => !t.adminOnly);

// Approvers — who the leave request is addressed to. This is a routing LABEL
// stored on the request and shown to the employee; it does not trigger a
// personal notification.
//
// The `phone` numbers that used to sit here were removed deliberately: leave
// requests no longer WhatsApp the approver. Management is notified through the
// email trail instead (notify-leave-email → ea@ + systems@, every request), so
// nobody is pinged personally each time someone applies. Re-adding a number
// here does nothing on its own — see notifyLeaveRequest in whatsappService.js.
export const APPROVERS = [
  { value: "dhruv",   label: "Dhruv Sir"   },
  { value: "bhaskar", label: "Bhaskar Sir" },
];

// Who may actually APPROVE or REJECT a leave request in the admin panel.
//
// Deliberately narrower than hr.is_hr_admin() (admin/hr/founder/management/ai/mis):
// every one of those roles can still open the panel, filter it and export the CSV,
// but only the addresses listed here see the Approve / Reject buttons. EA owns the
// decision. Add a second address here to hand someone a backup — it's the single
// place the rule lives on the client. RLS enforces the same list server-side, so
// changing this alone does not grant anyone the right to write.
export const LEAVE_APPROVER_EMAILS = ["ea@hagerstone.com"];

/** Is this signed-in user allowed to approve/reject leave? Pass ctx.email. */
export function isLeaveApprover(email) {
  if (!email) return false;
  return LEAVE_APPROVER_EMAILS.includes(String(email).trim().toLowerCase());
}

// Request lifecycle.
export const LEAVE_STATUSES = ["pending", "approved", "rejected", "cancelled"];

export const STATUS_META = {
  pending:   { label: "Pending",   bg: "rgba(245,158,11,0.1)", color: "#b45309" },
  approved:  { label: "Approved",  bg: "rgba(34,197,94,0.1)",  color: "#16a34a" },
  rejected:  { label: "Rejected",  bg: "rgba(239,68,68,0.1)",  color: "#dc2626" },
  cancelled: { label: "Cancelled", bg: "rgba(120,113,108,0.12)", color: "#78716c" },
};

// ─── Date / day-count helpers ────────────────────────────────────────────────

// Inclusive whole-day count between two ISO date strings (yyyy-mm-dd).
// Half-day leave types always return 0.5.
export function countLeaveDays(startDate, endDate, leaveType) {
  const meta = LEAVE_TYPES.find((t) => t.value === leaveType);
  if (meta?.fixedDays != null) return meta.fixedDays;
  if (!startDate || !endDate) return 0;
  const s = new Date(startDate + "T00:00:00");
  const e = new Date(endDate + "T00:00:00");
  if (isNaN(s) || isNaN(e) || e < s) return 0;
  const diff = Math.round((e - s) / 86400000);
  return diff + 1;
}

// Is the given ISO date inside the same calendar month as `ref`?
export function isSameMonth(isoDate, ref = new Date()) {
  if (!isoDate) return false;
  const d = new Date(isoDate + "T00:00:00");
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

// ─── Balance math ────────────────────────────────────────────────────────────
// Given how many paid-leave days an employee has ALREADY used this month and the
// number of days they're now requesting, split the new request into paid vs
// unpaid (salary-deducted) days.
//
//   usedThisMonth  – days already consumed against this month's paid allowance
//   requestedDays  – days in the request being previewed
//
// Returns { paidLeft, paidDays, unpaidDays } for the NEW request.
export function splitPaidUnpaid(usedThisMonth, requestedDays, allowance = PAID_LEAVE_PER_MONTH) {
  const paidLeft  = Math.max(0, allowance - usedThisMonth);
  const paidDays  = Math.min(requestedDays, paidLeft);
  const unpaidDays = Math.max(0, requestedDays - paidDays);
  return { paidLeft, paidDays, unpaidDays };
}
