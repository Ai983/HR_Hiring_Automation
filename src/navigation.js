// ─────────────────────────────────────────────────────────────────────
// ONE definition of the app's navigation, consumed by both the sidebar and
// the dashboard.
//
// It is a single source on purpose. The dashboard exists to put every page
// one click away, which means the two lists have to agree — and two lists
// that "look the same" drift the moment somebody adds a panel to one of
// them. That is precisely the failure the officeTeamReport note in
// CLAUDE.md describes: the panel and the Excel writer looked identical when
// they were written separately too, right up until one changed.
//
// SHAPE
//   group.module  — the module a user must hold to see the group at all.
//                   null means "everyone signed in" (policies, performance).
//   item.panel    — the value written to `panel`. NOT the same as item.id:
//                   the four HR Policy entries all open the `policies` panel
//                   and differ only by which section they land on.
//   item.category — for policy entries, the section to open.
//   item.badge    — a count, resolved by the caller from live data.
// ─────────────────────────────────────────────────────────────────────

/**
 * @param {object}  opts
 * @param {object}  opts.badges         counts keyed by item id
 * @param {boolean} opts.canRegularize  super_admin — Attendance Fix is hidden otherwise
 */
export function buildNav({ badges = {}, canRegularize = false } = {}) {
  const b = (id) => badges[id] ?? 0;

  return [
    {
      id: "grp-hire",
      module: "hireflow",
      icon: "\u{1F9ED}",
      label: "Hire",
      blurb: "Post roles, screen applicants, interview, offer and onboard.",
      items: [
        { id: "jobs",          panel: "jobs",          icon: "≡",        label: "All Jobs",        badge: b("jobs") },
        { id: "applicants",    panel: "applicants",    icon: "◎",        label: "Applicants",      badge: b("applicants") },
        { id: "survey",        panel: "survey",        icon: "📋",       label: "Survey Leads",    badge: b("survey") },
        { id: "assessment",    panel: "assessment",    icon: "\u{1F9EE}", label: "Assessment",      badge: b("assessment") },
        { id: "questionbank",  panel: "questionbank",  icon: "\u{1F4DA}", label: "Question Bank" },
        { id: "calling",       panel: "calling",       icon: "☎",        label: "Calling Queue",   badge: b("calling") },
        { id: "interviews",    panel: "interviews",    icon: "\u{1F4C5}", label: "Interviews",      badge: b("interviews") },
        { id: "reference",     panel: "reference",     icon: "✅",       label: "Reference Check", badge: b("reference") },
        { id: "offers",        panel: "offers",        icon: "\u{1F4DD}", label: "Offer Letters",   badge: b("offers") },
        { id: "onboarding",    panel: "onboarding",    icon: "\u{1F3E0}", label: "Onboarding",      badge: b("onboarding") },
        { id: "documents",     panel: "documents",     icon: "\u{1F4C4}", label: "Documents" },
        { id: "questionnaire", panel: "questionnaire", icon: "❓",       label: "Questionnaire" },
        { id: "report",        panel: "report",        icon: "☰",        label: "Resume Report" },
      ],
    },
    {
      id: "grp-employees",
      module: "attendance",
      icon: "\u{1F465}",
      label: "Employee Management",
      blurb: "Attendance, leave, location and the employee master.",
      items: [
        { id: "today",      panel: "today",      icon: "\u{1F4C6}", label: "Today" },
        { id: "attendance", panel: "attendance", icon: "⏰",        label: "Attendance" },
        { id: "weekly",     panel: "weekly",     icon: "\u{1F5D3}", label: "Weekly Report" },
        { id: "monthly",    panel: "monthly",    icon: "\u{1F4CA}", label: "Monthly Report" },
        { id: "officeteam", panel: "officeteam", icon: "\u{1F3E2}", label: "Office Team" },
        { id: "attsetup",   panel: "attsetup",   icon: "⚙",        label: "Attendance Setup" },
        { id: "location",   panel: "location",   icon: "\u{1F4CD}", label: "Location Tracking" },
        { id: "geofence",   panel: "geofence",   icon: "\u{1F5FA}", label: "Geofence Sites" },
        { id: "leave",      panel: "leave",      icon: "\u{1F334}", label: "Leave Requests", badge: b("leave") },
        // Hiding a nav item is not access control — App.jsx SUPER_ONLY is.
        // This only keeps a dead end off the screen for everyone else.
        ...(canRegularize ? [{ id: "regularize", panel: "regularize", icon: "✎", label: "Attendance Fix" }] : []),
        { id: "employees",  panel: "employees",  icon: "▦",        label: "Employees" },
      ],
    },
    {
      id: "grp-performance",
      module: null, // everyone: HR runs cycles, an employee reads their own review
      icon: "\u{1F4C8}",
      label: "Performance Management",
      blurb: "Review cycles, self and manager assessments, final ratings.",
      items: [
        { id: "performance", panel: "performance", icon: "\u{1F4C8}", label: "Reviews & Cycles" },
      ],
    },
    {
      id: "grp-policy",
      module: null, // every signed-in employee can read policies
      icon: "\u{1F4D5}",
      label: "HR Policy",
      blurb: "The documents everyone is expected to have read.",
      items: [
        { id: "policy-company",  panel: "policies", category: "company",            icon: "🏛", label: "Company Policy" },
        { id: "policy-timings",  panel: "policies", category: "timings_attendance", icon: "⏰", label: "Timings, Attendance" },
        { id: "policy-leave",    panel: "policies", category: "leave",              icon: "🌴", label: "Leave Policy" },
        { id: "policy-ztp",      panel: "policies", category: "ztp",                icon: "🚫", label: "ZTP Policy" },
      ],
    },
  ];
}

/** Groups this user may see. `null` module = no gate. */
export function visibleGroups(nav, hasModule) {
  return nav.filter((g) => g.module === null || hasModule(g.module));
}
