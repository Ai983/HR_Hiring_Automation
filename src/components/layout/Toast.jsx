import { useApp } from "../../context/AppContext.jsx";

export default function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <div className={`toast ${toast.ok ? "ok" : "err"}`}>
      {toast.ok ? "\u2713" : "\u26A0"} {toast.msg}
    </div>
  );
}
