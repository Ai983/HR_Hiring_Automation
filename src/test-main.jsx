// Public walk-in assessment entry point.
// Deliberately imports no auth: candidates have no Hub account and identify
// themselves by the email they type on the start screen.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AssessmentPortal from "./components/assessment/AssessmentPortal.jsx";

createRoot(document.getElementById("assessment-root")).render(
  <StrictMode>
    <AssessmentPortal />
  </StrictMode>
);
