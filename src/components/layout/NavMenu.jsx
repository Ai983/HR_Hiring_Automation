import { useEffect, useRef } from "react";
import { useApp } from "../../context/AppContext.jsx";

// ─────────────────────────────────────────────────────────────────────
// One section button + its dropdown of pages.
//
// Used in two places with different skins:
//   variant="hero" — the big buttons on the dashboard
//   variant="bar"  — the compact buttons in the top bar
// Same component either way, because the menu contents, the navigation and
// the open/close behaviour must not differ between them. The items come
// from navigation.js, which is already the single definition of the nav.
//
// `open` is owned by the PARENT, not by this component: only one menu may
// be open at a time, and two sibling components cannot enforce that between
// themselves without lifting the state.
// ─────────────────────────────────────────────────────────────────────

export default function NavMenu({ group, variant = "bar", open, onToggle, onClose }) {
  const { panel, setPanel, setSelectedJob, setPolicyCategory } = useApp();
  const wrapRef = useRef(null);

  // Close on an outside click or Escape. Both matter: a dropdown you can
  // only dismiss by picking something from it is a trap, and on a laptop
  // Escape is the reflex.
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e) => { if (!wrapRef.current?.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const go = (item) => {
    // Policy entries all open the same panel and differ only by section.
    if (item.category) setPolicyCategory(item.category);
    if (item.panel !== "applicants") setSelectedJob(null);
    setPanel(item.panel);
    onClose();
  };

  // A section counts as current if any of its pages is the open panel — so
  // the top bar still shows you where you are without a sidebar to do it.
  const isCurrent = group.items.some((it) => it.panel === panel);
  const total = group.items.reduce((n, it) => n + (it.badge > 0 ? it.badge : 0), 0);

  return (
    <div className={`navmenu navmenu-${variant}`} ref={wrapRef}>
      <button
        type="button"
        className={`navmenu-btn ${open ? "open" : ""} ${isCurrent ? "current" : ""}`}
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="navmenu-icon">{group.icon}</span>
        <span className="navmenu-label">
          {group.label}
          {variant === "hero" && group.blurb && (
            <span className="navmenu-blurb">{group.blurb}</span>
          )}
        </span>
        {total > 0 && <span className="navmenu-total">{total}</span>}
        <span className="navmenu-chev">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="navmenu-pop" role="menu">
          {group.items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={`navmenu-item ${panel === item.panel ? "active" : ""}`}
              onClick={() => go(item)}
            >
              <span className="navmenu-item-icon">{item.icon}</span>
              <span className="navmenu-item-label">{item.label}</span>
              {item.badge > 0 && <span className="navmenu-item-badge">{item.badge}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
