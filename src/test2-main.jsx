// Public walk-in assessment, LEVEL 2 — the position-specific paper.
//
// Same component and same rules as test-main.jsx: no auth, because candidates
// have no Hub account and identify themselves by the email they type. The only
// difference is `kind="ROLE"`, which makes the start screen ask for the position
// applied for and makes the server serve that position's questions.
//
// Separate entry point rather than a mode on /test.html so the HR desk hands out
// one link or the other and the candidate never has to choose. Registered in
// vite.config.js — a page not listed there builds locally and 404s in production.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AssessmentPortal from "./components/assessment/AssessmentPortal.jsx";

createRoot(document.getElementById("assessment-root")).render(
  <StrictMode>
    <AssessmentPortal kind="ROLE" />
  </StrictMode>
);
