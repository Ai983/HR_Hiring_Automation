// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP NOTIFICATIONS (MayTAPI)
// Sends automated WhatsApp messages for attendance check-in/out and leave
// requests. Calls the MayTAPI cloud API directly (CORS is enabled on their
// endpoint). Config comes from Vite env with a safe committed fallback so the
// build always works; override via VITE_MAYTAPI_* in .env when needed.
// ─────────────────────────────────────────────────────────────────────────────

import { LEAVE_TYPES, APPROVERS } from "../leaveConfig.js";

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};

const PRODUCT_ID = env.VITE_MAYTAPI_PRODUCT_ID || "b8cce1b9-0f9f-4aef-994c-d232716471f0";
const PHONE_ID   = env.VITE_MAYTAPI_PHONE_ID   || "46821";
const TOKEN      = env.VITE_MAYTAPI_TOKEN      || "ebfd5e67-6403-4921-b300-a54364f2c470";

const API_URL = `https://api.maytapi.com/api/${PRODUCT_ID}/${PHONE_ID}/sendMessage`;

// Normalise an Indian mobile number to MayTAPI's expected "91XXXXXXXXXX" form.
// Accepts "+91 98…", "098…", "98…", "9198…" etc. Returns null when unusable.
function normalizeNumber(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10) d = "91" + d;          // bare 10-digit mobile
  else if (d.length === 11 && d.startsWith("0")) d = "91" + d.slice(1);
  else if (d.length === 12 && d.startsWith("91")) { /* already correct */ }
  else if (d.length === 13 && d.startsWith("91")) d = d.slice(0, 12); // stray digit
  if (d.length !== 12 || !d.startsWith("91")) return null;
  return d;
}

// Low-level send. Never throws — notifications must never break the core flow.
// Returns { success, error?, msgId? }.
export async function sendWhatsApp(number, message) {
  const to = normalizeNumber(number);
  if (!to) return { success: false, error: `invalid number: ${number}` };
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-maytapi-key": TOKEN },
      body: JSON.stringify({ to_number: to, type: "text", message }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.success === false) {
      return { success: false, error: body?.message || `HTTP ${res.status}` };
    }
    return { success: true, msgId: body?.data?.msgId };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

// ─── formatting helpers ──────────────────────────────────────────────────────

function fmtTime(date) {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}
function fmtDateHuman(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function leaveTypeLabel(value) {
  return LEAVE_TYPES.find((t) => t.value === value)?.label || value;
}
function approver(value) {
  return APPROVERS.find((a) => a.value === value) || null;
}
function dayWord(n) {
  return Number(n) === 1 ? "day" : "days";
}

// ─── ATTENDANCE ──────────────────────────────────────────────────────────────

// Fire-and-forget confirmation to the employee after a check-in / check-out.
//   type: "check_in" | "check_out"
export async function notifyAttendance(employee, { type, time, status, address }) {
  if (!employee?.phone) return { success: false, error: "employee has no phone" };
  const isIn = type === "check_in";
  const when = fmtTime(time instanceof Date ? time : new Date(time));
  const statusLine = isIn
    ? `Status: ${status === "late" ? "⚠️ Late" : "✅ Present"}`
    : "Have a great day! 👋";

  const message =
    `${isIn ? "✅ *Attendance — Checked IN*" : "🏁 *Attendance — Checked OUT*"}\n\n` +
    `Hi ${employee.full_name}, your ${isIn ? "check-in" : "check-out"} has been recorded.\n\n` +
    `🕒 Time: ${when}\n` +
    (address ? `📍 Location: ${address}\n` : "") +
    `${statusLine}\n\n` +
    `— Hagerstone HR`;

  return sendWhatsApp(employee.phone, message);
}

// ─── LEAVE ───────────────────────────────────────────────────────────────────

// Notify BOTH the routed approver (Dhruv/Bhaskar) with full details AND the
// employee with a submission confirmation. Runs both sends concurrently and
// returns their results; never throws.
//   req: { request_to, leave_type, reason, start_date, end_date,
//          total_days, paid_days, unpaid_days }
export async function notifyLeaveRequest(employee, req) {
  const appr = approver(req.request_to);
  const typeLabel = leaveTypeLabel(req.leave_type);
  const dateRange =
    req.start_date === req.end_date
      ? fmtDateHuman(req.start_date)
      : `${fmtDateHuman(req.start_date)} → ${fmtDateHuman(req.end_date)}`;
  const total = req.total_days;

  // 1) Full details to the approver.
  const approverMsg =
    `📩 *New Leave Request*\n\n` +
    `👤 Employee: ${employee.full_name} (${employee.employee_code})\n` +
    (employee.department ? `🏢 Department: ${employee.department}\n` : "") +
    (employee.designation ? `💼 Designation: ${employee.designation}\n` : "") +
    (employee.phone ? `📱 Contact: ${employee.phone}\n` : "") +
    `\n📝 Type: ${typeLabel}\n` +
    `📅 Dates: ${dateRange}\n` +
    `⏳ Duration: ${total} ${dayWord(total)} (${req.paid_days} paid` +
    (Number(req.unpaid_days) > 0 ? `, ${req.unpaid_days} unpaid` : "") +
    `)\n` +
    `💬 Reason: ${req.reason || "—"}\n\n` +
    `Requested to: ${appr ? appr.label : req.request_to}\n` +
    `— Hagerstone HR Portal`;

  // 2) Confirmation to the employee.
  const employeeMsg =
    `📨 *Leave Request Submitted*\n\n` +
    `Hi ${employee.full_name}, your leave request has been sent to ` +
    `${appr ? appr.label : "your approver"} for approval.\n\n` +
    `📝 Type: ${typeLabel}\n` +
    `📅 Dates: ${dateRange}\n` +
    `⏳ Duration: ${total} ${dayWord(total)}\n\n` +
    `You'll be informed once it's reviewed.\n` +
    `— Hagerstone HR`;

  const tasks = [];
  if (appr?.phone) tasks.push(sendWhatsApp(appr.phone, approverMsg));
  if (employee?.phone) tasks.push(sendWhatsApp(employee.phone, employeeMsg));

  const results = await Promise.all(tasks);
  return results;
}
