import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ApplyForm from "./components/apply/ApplyForm.jsx";

// Standalone anonymous entry point — no auth, no AppContext, no App.jsx.
// Anything imported here ships to every candidate's phone.
createRoot(document.getElementById("apply-root")).render(
  <StrictMode>
    <ApplyForm />
  </StrictMode>
);
