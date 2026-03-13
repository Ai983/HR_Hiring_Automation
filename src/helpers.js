import { PORTALS } from "./constants.js";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const totalApplicants = (job) =>
  PORTALS.reduce((sum, p) => sum + (job[p.id]?.applicants || 0), 0);

export const totalViews = (job) =>
  PORTALS.reduce((sum, p) => sum + (job[p.id]?.views || 0), 0);
