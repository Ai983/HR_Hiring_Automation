// ─────────────────────────────────────────────────────────────────────────────
// EMAIL NOTIFICATIONS
// Mail can't be sent from the browser — it needs SMTP credentials — so this is
// a thin client over the `notify-leave-email` edge function, which holds the
// systems@hagerstone.com app password and does the actual send.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "../supabaseClient.js";

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};

// Where the "Click Here" link in the mail should point. Set VITE_HUB_URL when
// the portal and the admin Hub live on different hosts; otherwise the current
// origin is right. The edge function's HUB_URL secret overrides this anyway,
// so a request raised on localhost still mails a link approvers can open.
const HUB_URL = env.VITE_HUB_URL || (typeof window !== "undefined" ? window.location.origin : "");

// Notify HR (ea@ + systems@) that an employee has applied for leave.
// Never throws — a mail failure must not cost the employee their request.
// Returns { success, error?, sent_to? }.
export async function notifyLeaveEmail(employee, leave) {
  if (!supabase) return { success: false, error: "supabase not configured" };
  try {
    const { data, error } = await supabase.functions.invoke("notify-leave-email", {
      body: {
        employee: {
          full_name:     employee?.full_name,
          employee_code: employee?.employee_code,
          department:    employee?.department,
          designation:   employee?.designation,
        },
        leave,
        hub_url: HUB_URL,
      },
    });
    if (error) return { success: false, error: error.message || String(error) };
    if (data?.error) return { success: false, error: data.error };
    return { success: true, sent_to: data?.sent_to };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}
