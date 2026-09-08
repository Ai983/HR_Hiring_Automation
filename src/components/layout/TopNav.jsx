import { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { buildNav, visibleGroups } from "../../navigation.js";
import NavMenu from "./NavMenu.jsx";
import SyncStatus from "./SyncStatus.jsx";

// ─────────────────────────────────────────────────────────────────────
// The top bar. Replaces the sidebar, which is gone.
//
// WHY THIS EXISTS AT ALL, given navigation is meant to happen on the
// dashboard: the sidebar was also the only route BACK to the dashboard, the
// only Sign out, and the only place the signed-in identity appeared.
// Deleting it without a replacement would strand anyone who opened a page —
// there would be no way out of "All Jobs" except the browser's back button,
// which this app has no history for (there is no router).
//
// So the bar carries exactly what the sidebar carried and the dashboard
// cannot: the way home, who you are, and the way out. The section menus are
// here too because otherwise every move between two pages costs a detour
// through the dashboard.
// ─────────────────────────────────────────────────────────────────────

export default function TopNav() {
  const { panel, setPanel, setSelectedJob, ctx, hasModule, logout, navBadges } = useApp();
  const [openId, setOpenId] = useState(null); // only one menu open at a time

  const groups = visibleGroups(
    buildNav({ badges: navBadges, canRegularize: !!ctx?.is_super_admin }),
    hasModule
  );

  const goHome = () => {
    setSelectedJob(null);
    setPanel("dashboard");
    setOpenId(null);
  };

  return (
    <header className="topnav">
      <button type="button" className="topnav-brand" onClick={goHome} title="Back to dashboard">
        <span className="topnav-logo">H</span>
        <span className="topnav-brand-text">HireFlow</span>
      </button>

      <nav className="topnav-menus">
        {/* The dashboard itself is a plain link, not a menu — it has no
            children, and burying "Dashboard" inside a dropdown would hide
            the way home. */}
        <button
          type="button"
          className={`navmenu-btn navmenu-plain ${panel === "dashboard" ? "current" : ""}`}
          onClick={goHome}
        >
          <span className="navmenu-icon">⬛</span>
          <span className="navmenu-label">Dashboard</span>
        </button>

        {groups.map((g) => (
          <NavMenu
            key={g.id}
            group={g}
            variant="bar"
            open={openId === g.id}
            onToggle={() => setOpenId((prev) => (prev === g.id ? null : g.id))}
            onClose={() => setOpenId(null)}
          />
        ))}
      </nav>

      <div className="topnav-right">
        <div className="topnav-sync"><SyncStatus /></div>
        <div className="topnav-user" title={ctx?.email || ""}>
          <span className="topnav-avatar">{(ctx?.name || "?").slice(0, 1).toUpperCase()}</span>
          <span className="topnav-user-text">
            <span className="topnav-user-name">{ctx?.name || "—"}</span>
            <span className="topnav-user-mail">{ctx?.email || ""}</span>
          </span>
        </div>
        <button type="button" className="topnav-signout" onClick={logout}>Sign out</button>
      </div>
    </header>
  );
}
