// =====================================================================
// `apply` — candidate self-application intake
// ---------------------------------------------------------------------
// Serves the public form at /apply.html. The caller is an ANONYMOUS
// browser: there is no Hub account, no session, and nothing about the
// request can be trusted.
//
// That forces the same shape as the walk-in `assessment` function:
//   · hr.applicants has RLS on, no anon policy and no anon grant;
//   · every write goes through this function on the SERVICE-ROLE key;
//   · therefore this function does its own authorisation and validation,
//     because the service-role key bypasses RLS entirely.
//
// The anon key is a valid project JWT, so the default `verify_jwt` passes
// with no dashboard change — exactly as `assessment` relies on. That is
// not authentication: the anon key ships in the page bundle. It only keeps
// out traffic that has not even read the page.
//
// SPAM. A public unauthenticated INSERT is a flooding target. Three cheap
// controls, in order of how much they actually catch:
//   1. one row per email address — a resubmit is answered "we have it"
//      rather than adding a second card to the Kanban;
//   2. a honeypot field the real form keeps empty and hidden;
//   3. hard length caps on every string, before anything reaches Postgres.
// None of these stop a determined attacker. If the board ever does get
// flooded, the fix is a captcha, not a longer list of heuristics here.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Limits ────────────────────────────────────────────────────────────
// Generous enough that no real candidate is ever truncated, small enough
// that a scripted submit cannot post a megabyte.
const MAX = {
  full_name: 120,
  email: 254,          // RFC 5321 maximum
  phone: 32,
  designation: 120,
  department: 80,
  location: 120,
  industry: 80,
  notice_period: 60,
  skill: 60,           // per skill
};
const MAX_SKILLS = 30;
const MAX_EXPERIENCE_YEARS = 60;
const MAX_CTC_LPA = 1000;   // ₹10 crore. Anything above is a units mistake.

// ── Helpers ───────────────────────────────────────────────────────────
function str(v: unknown, cap: number): string {
  if (typeof v !== "string") return "";
  // Collapse whitespace so "  Site   Engineer " and "Site Engineer" are the
  // same string in a CSV export and in a search box.
  return v.replace(/\s+/g, " ").trim().slice(0, cap);
}

// Returns null for "not supplied", a number for a valid figure, and throws
// for a value that was supplied but is not a number — silently dropping a
// mistyped CTC would show HR a blank where the candidate typed something.
function num(v: unknown, label: string, max: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim());
  if (!Number.isFinite(n)) throw new Error(`${label} must be a number.`);
  if (n < 0) throw new Error(`${label} cannot be negative.`);
  if (n > max) throw new Error(`${label} looks too large — please check the units.`);
  return n;
}

function skillList(v: unknown): string[] {
  const raw: unknown[] = Array.isArray(v)
    ? v
    : typeof v === "string"
      ? v.split(/[,\n;]/)
      : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const s = str(item, MAX.skill);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;   // "AutoCAD" and "autocad" are one skill
    seen.add(key);
    out.push(s);
    if (out.length >= MAX_SKILLS) break;
  }
  return out;
}

// Deliberately loose. A strict RFC-5322 regex rejects addresses that work,
// and the only cost of accepting a malformed one is an HR bounce.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Indian mobile numbers with or without +91 / 0 prefixes, plus a general
// international fallback. Digits are counted, not formatted.
function normalisePhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return input.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = (body as Record<string, unknown>)?.action ?? "submit";

    if (action !== "submit") {
      return json({ error: "Unknown action. Expected 'submit'." }, 400);
    }

    // ── Honeypot ──────────────────────────────────────────────────────
    // The real form renders `company_website` off-screen with autocomplete
    // off. A human never fills it; naive bots fill every input they find.
    // Answer 200 OK so the bot believes it succeeded and does not retry.
    if (str((body as Record<string, unknown>).company_website, 200)) {
      return json({ ok: true, duplicate: false });
    }

    // ── Required ──────────────────────────────────────────────────────
    const full_name = str((body as Record<string, unknown>).full_name, MAX.full_name);
    const emailRaw = str((body as Record<string, unknown>).email, MAX.email).toLowerCase();
    const phoneRaw = str((body as Record<string, unknown>).phone, MAX.phone);
    const designation = str((body as Record<string, unknown>).designation, MAX.designation);

    if (full_name.length < 2) return json({ error: "Please enter your full name." }, 400);
    if (!EMAIL_RE.test(emailRaw)) return json({ error: "Please enter a valid email address." }, 400);

    const phone = normalisePhone(phoneRaw);
    if (!phone) return json({ error: "Please enter a valid phone number." }, 400);

    if (!designation) return json({ error: "Please enter your designation." }, 400);

    // ── Optional ──────────────────────────────────────────────────────
    let total_experience_years: number | null;
    let current_ctc: number | null;
    let expected_ctc: number | null;
    try {
      total_experience_years = num(
        (body as Record<string, unknown>).total_experience_years,
        "Total experience",
        MAX_EXPERIENCE_YEARS,
      );
      current_ctc = num((body as Record<string, unknown>).current_ctc, "Current CTC", MAX_CTC_LPA);
      expected_ctc = num((body as Record<string, unknown>).expected_ctc, "Expected CTC", MAX_CTC_LPA);
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }

    const row = {
      full_name,
      email: emailRaw,
      phone,
      designation,
      department: str((body as Record<string, unknown>).department, MAX.department) || null,
      location: str((body as Record<string, unknown>).location, MAX.location) || null,
      industry: str((body as Record<string, unknown>).industry, MAX.industry) || null,
      total_experience_years,
      skills: skillList((body as Record<string, unknown>).skills),
      current_ctc,
      expected_ctc,
      notice_period: str((body as Record<string, unknown>).notice_period, MAX.notice_period) || null,
      // job_id stays NULL — the candidate applied to a designation, not to a
      // hr.jobs row. HR attaches them to a real opening from the Kanban.
      job_id: null,
      portal: "form",
      stage: "new",
      applied_at: new Date().toISOString(),
    };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { db: { schema: "hr" }, auth: { persistSession: false } },
    );

    // ── One row per email ─────────────────────────────────────────────
    // Not a unique constraint: HR legitimately keys in a second row for a
    // candidate who reapplies a year later, and a hard constraint would make
    // that fail with a raw Postgres error inside the Quick Add modal. Here,
    // on the public endpoint, a repeat submit is answered kindly instead.
    const { data: existing, error: dupErr } = await supabase
      .from("applicants")
      .select("id, stage")
      .ilike("email", emailRaw)
      .limit(1);

    if (dupErr) {
      console.error("apply: duplicate lookup failed", dupErr);
      return json({ error: "Could not save your application. Please try again." }, 500);
    }

    if (existing && existing.length > 0) {
      return json({
        ok: true,
        duplicate: true,
        message: "We already have an application on file for this email address. Our team will be in touch.",
      });
    }

    const { error: insErr } = await supabase.from("applicants").insert(row);

    if (insErr) {
      console.error("apply: insert failed", insErr);
      return json({ error: "Could not save your application. Please try again." }, 500);
    }

    // The applicant id is deliberately NOT returned. The browser is anonymous
    // and has no use for it, and handing out a real primary key from a public
    // endpoint invites someone to go looking for what else it unlocks.
    return json({ ok: true, duplicate: false }, 201);
  } catch (e) {
    console.error("apply: unhandled", e);
    return json({ error: (e as Error)?.message || "Unexpected error." }, 500);
  }
});
