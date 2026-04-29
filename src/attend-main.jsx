import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AttendancePortal from "./components/attendance/AttendancePortal.jsx";

createRoot(document.getElementById("attend-root")).render(
  <StrictMode>
    <AttendancePortal />
  </StrictMode>
);
