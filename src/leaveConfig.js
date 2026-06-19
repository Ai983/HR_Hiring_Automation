// ─────────────────────────────────────────────────────────────────────────────
// LEAVE POLICY — single source of truth shared by the employee portal AND admin.
// Change the numbers here and both sides update automatically.
// ─────────────────────────────────────────────────────────────────────────────

// Paid leave days granted to every employee per CALENDAR MONTH.
// Anything beyond this in the same month is unpaid (salary deducted).
// No carry-forward: unused paid days do NOT roll into the next month.
export const PAID_LEAVE_PER_MONTH = 2;

// Leave types — mirrors the existing Google Form ("Type of leave").
// `value` is what we store; `label` is what the employee sees.
// `isHalf` types always count as 0.5 day regardless of the date range.
export const LEAVE_TYPES = [
  { value: "casual",    label: "Casual Leave",    hi: "आकस्मिक अवकाश",      isHalf: false },
  { value: "half_day",  label: "Half Day Leave",  hi: "आधे दिन की छुट्टी",  isHalf: true  },
  { value: "emergency", label: "Emergency Leave", hi: "आपात छुट्टी",        isHalf: false },
  { value: "sick",      label: "Sick Leave",      hi: "बीमारी के लिए",      isHalf: false },
];

// Approvers — for now this is just who the request is addressed to.
// Routing/notifications to these people get wired up later.
export const APPROVERS = [
  { value: "dhruv",   label: "Dhruv Sir"   },
  { value: "bhaskar", label: "Bhaskar Sir" },
];

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
  if (meta?.isHalf) return 0.5;
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
export function splitPaidUnpaid(usedThisMonth, requestedDays) {
  const paidLeft  = Math.max(0, PAID_LEAVE_PER_MONTH - usedThisMonth);
  const paidDays  = Math.min(requestedDays, paidLeft);
  const unpaidDays = Math.max(0, requestedDays - paidDays);
  return { paidLeft, paidDays, unpaidDays };
}
