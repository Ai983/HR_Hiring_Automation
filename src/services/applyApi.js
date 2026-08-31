// ─────────────────────────────────────────────────────────────────────
// Candidate self-application form → `apply` edge function.
//
// This module is imported by /apply.html, which is an ANONYMOUS page. It
// must never call `supabase.from(...)`: hr.applicants has RLS on with no
// anon policy and no anon grant, so a direct call returns "permission
// denied" and the candidate sees a meaningless error. Only supabaseUrl and
// supabaseAnon are taken from the client. Same rule as assessmentApi.js.
// ─────────────────────────────────────────────────────────────────────
import { supabaseUrl, supabaseAnon } from "../supabaseClient.js";

const FN_URL = `${(supabaseUrl || "").replace(/\/$/, "")}/functions/v1/apply`;

/** Marks an error the server raised about the input itself — never retried. */
class InputError extends Error {}

/**
 * POST the form. Transient failures are retried, because candidates fill
 * this in on phone data and losing a completed form to one dropped packet
 * is the worst outcome this page has. A 4xx is not transient: the same
 * input would fail again, so it is surfaced immediately.
 *
 * Resolves to `{ ok: true, duplicate: boolean, message?: string }`.
 */
export async function submitApplication(fields, { retries = 3 } = {}) {
  if (!supabaseUrl || !supabaseAnon) {
    throw new Error("This form is not configured. Please contact HR.");
  }

  let lastErr = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnon}`,
        },
        body: JSON.stringify({ action: "submit", ...fields }),
      });

      const data = await res.json().catch(() => null);

      if (res.status >= 400 && res.status < 500) {
        throw new InputError(data?.error || "Please check your details and try again.");
      }
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`);

      return data || { ok: true, duplicate: false };
    } catch (e) {
      if (e instanceof InputError) throw e;

      lastErr = /failed to fetch/i.test(e?.message || "")
        ? new Error("No internet connection. Please check your network and try again.")
        : e;

      if (attempt < retries) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }

  throw lastErr || new Error("Could not submit. Please try again.");
}
