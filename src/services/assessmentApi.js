// ============================================================
// assessmentApi — the candidate side of the walk-in test.
//
// Deliberately talks ONLY to the `assessment` edge function. It never queries a
// table, because the candidate's browser is anonymous and anon has no policy on
// hr.assessment_attempts. Do not add a supabase.from() call to this file.
//
// The admin side lives in assessmentService.js and goes through RLS as normal.
// ============================================================

import { supabaseUrl, supabaseAnon } from "../supabaseClient.js";

const FN_URL = `${(supabaseUrl || "").replace(/\/$/, "")}/functions/v1/assessment`;

async function call(payload, { retries = 0 } = {}) {
  if (!supabaseUrl || !supabaseAnon) {
    throw new Error("Test system is not configured. Please tell the HR desk.");
  }

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnon}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`);
      return data;
    } catch (e) {
      lastErr = e;
      // Venue Wi-Fi. Back off and try again before telling the candidate their
      // paper is lost — their answers are still in localStorage either way.
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  throw new Error(
    lastErr?.message === "Failed to fetch"
      ? "No internet connection. Please tell the HR desk."
      : lastErr?.message || "Something went wrong. Please tell the HR desk."
  );
}

/** Start a new attempt, or resume the one already in progress for this email. */
export function startAttempt({ email, fullName }) {
  return call(
    {
      action: "start",
      email,
      full_name: fullName,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    },
    { retries: 2 }
  );
}

/** Submit for marking. `answers` is { questionNumber: displayedOptionIndex }. */
export function submitAttempt({ attemptToken, answers }) {
  return call(
    { action: "submit", attempt_token: attemptToken, answers },
    { retries: 3 } // a lost submit is a lost candidate — try harder than on start
  );
}
