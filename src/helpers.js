import { PORTALS } from "./constants.js";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// <input type="datetime-local"> yields "2026-08-01T14:30" with NO timezone.
// Sent raw, Postgres reads it as UTC and the time shifts (+5:30 in IST).
// Parse it as LOCAL time and hand Postgres an unambiguous UTC instant.
export const localInputToISO = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString();
};

// Inverse: a timestamptz -> the "YYYY-MM-DDTHH:mm" a datetime-local input wants.
export const isoToLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const totalApplicants = (job) =>
  PORTALS.reduce((sum, p) => sum + (job[p.id]?.applicants || 0), 0);

export const totalViews = (job) =>
  PORTALS.reduce((sum, p) => sum + (job[p.id]?.views || 0), 0);
