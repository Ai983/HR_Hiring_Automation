// ============================================================
// assessment — the walk-in test's only server.
//
// The candidate is a walk-in with no Hub account: they type an email and a name
// and sit the paper. That makes the browser anonymous, and anon has no policy
// and no grant on hr.assessment_attempts (see the migration for why that is
// deliberate). So every read and write for the candidate side happens here, on
// the service-role key — the same shape as attendance-punch.
//
// The browser is trusted for nothing that matters:
//   * identity — attempt_token is issued here, never accepted from the client;
//   * time     — ends_at is computed from the server's started_at;
//   * marking  — the answer key lives in _shared/assessment-bank.ts and is
//                applied here. Nothing sent to the browser contains an answer.
//
// Actions: "start" | "submit".
// Callable with the project anon key in the Authorization header (a valid
// project JWT), so the default verify_jwt passes with no dashboard change —
// same call shape as applicantService.screenApplicant.
//
// Plan: HAGERSTONE_DRIVE_AND_ASSESSMENT.md §7
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ASSESSMENT_ID,
  DURATION_MINUTES,
  GRACE_SECONDS,
  TOTAL_QUESTIONS,
  SECTIONS,
  buildPresented,
  publicQuestions,
  toCanonicalAnswers,
  scoreAnswers,
  buildReview,
  type Presented,
} from "../_shared/assessment-bank.ts";

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

// Deliberately permissive — this is a typo guard at the door of a walk-in hall,
// not an ownership check. Nothing is emailed to this address.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

const durationMs = DURATION_MINUTES * 60 * 1000;
const graceMs = GRACE_SECONDS * 1000;

const endsAtOf = (startedAt: string) =>
  new Date(new Date(startedAt).getTime() + durationMs).toISOString();

const isExpired = (startedAt: string, now: Date) =>
  now.getTime() > new Date(startedAt).getTime() + durationMs + graceMs;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { db: { schema: "hr" } },
    );

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    // ────────────────────────────────────────────────────────────────────────
    // START — identify the candidate, resume or create an attempt, hand back
    // the paper with no answers in it.
    // ────────────────────────────────────────────────────────────────────────
    if (action === "start") {
      const email = String(body?.email ?? "").trim().toLowerCase();
      const fullName = String(body?.full_name ?? "").trim().replace(/\s+/g, " ");
      const userAgent = String(body?.user_agent ?? "").slice(0, 500);

      if (!EMAIL_RE.test(email)) {
        return json({ error: "Please enter a valid email address." }, 400);
      }
      if (fullName.length < 2) {
        return json({ error: "Please enter your full name." }, 400);
      }

      const now = new Date();

      const { data: existing, error: exErr } = await supabase
        .from("assessment_attempts")
        .select("*")
        .eq("assessment_id", ASSESSMENT_ID)
        .eq("email", email)
        .order("attempt_no", { ascending: false })
        .limit(1);
      if (exErr) return json({ error: "Could not check your record.", details: exErr.message }, 500);

      let latest = existing?.[0] ?? null;

      // An attempt left open past the timer is over. We never saw its answers —
      // they were only ever in the candidate's browser — so it closes as
      // expired rather than resuming with a timer that already ran out.
      if (latest?.status === "in_progress" && isExpired(latest.started_at, now)) {
        await supabase
          .from("assessment_attempts")
          .update({ status: "expired", submitted_at: now.toISOString() })
          .eq("id", latest.id)
          .eq("status", "in_progress");
        latest = { ...latest, status: "expired" };
      }

      // Genuine resume: a refresh, a dead battery, a dropped connection. Same
      // attempt, same shuffled paper, same remaining time — not a fresh 25 min.
      if (latest?.status === "in_progress") {
        return json({
          ok: true,
          resumed: true,
          attempt_token: latest.attempt_token,
          full_name: latest.full_name,
          email: latest.email,
          ends_at: endsAtOf(latest.started_at),
          server_now: now.toISOString(),
          duration_minutes: DURATION_MINUTES,
          total_questions: TOTAL_QUESTIONS,
          sections: SECTIONS,
          questions: publicQuestions(latest.presented as Presented),
        });
      }

      // One attempt per candidate per drive (§7.2). A second sitting needs an
      // HR unlock from the admin panel.
      if (latest && !latest.retake_unlocked) {
        return json({
          ok: true,
          blocked: true,
          previous: {
            status: latest.status,
            score_total: latest.score_total,
            out_of: TOTAL_QUESTIONS,
            submitted_at: latest.submitted_at,
            sections: {
              A: latest.score_section_a,
              B: latest.score_section_b,
              C: latest.score_section_c,
              D: latest.score_section_d,
            },
          },
        });
      }

      // An unlock is consumed once. Leaving the flag set would turn a one-off
      // "his phone died, let him re-sit" into unlimited re-sits.
      if (latest?.retake_unlocked) {
        await supabase
          .from("assessment_attempts")
          .update({ retake_unlocked: false })
          .eq("id", latest.id);
      }

      const presented = buildPresented();

      const { data: created, error: insErr } = await supabase
        .from("assessment_attempts")
        .insert({
          assessment_id: ASSESSMENT_ID,
          email,
          full_name: fullName,
          attempt_no: (latest?.attempt_no ?? 0) + 1,
          started_at: now.toISOString(),
          presented,
          status: "in_progress",
          user_agent: userAgent,
        })
        .select("attempt_token, started_at")
        .single();
      if (insErr || !created) {
        return json({ error: "Could not start the test. Please tell the HR desk.", details: insErr?.message }, 500);
      }

      return json({
        ok: true,
        resumed: false,
        attempt_token: created.attempt_token,
        full_name: fullName,
        email,
        ends_at: endsAtOf(created.started_at),
        server_now: now.toISOString(),
        duration_minutes: DURATION_MINUTES,
        total_questions: TOTAL_QUESTIONS,
        sections: SECTIONS,
        questions: publicQuestions(presented),
      }, 201);
    }

    // ────────────────────────────────────────────────────────────────────────
    // SUBMIT — mark the paper here, write the result, hand back the score.
    // ────────────────────────────────────────────────────────────────────────
    if (action === "submit") {
      const token = String(body?.attempt_token ?? "").trim();
      if (!token) return json({ error: "Missing attempt token." }, 400);

      const rawAnswers = (body?.answers ?? {}) as Record<string, unknown>;

      const { data: attempt, error: findErr } = await supabase
        .from("assessment_attempts")
        .select("*")
        .eq("attempt_token", token)
        .maybeSingle();
      if (findErr) return json({ error: "Could not load your attempt.", details: findErr.message }, 500);
      if (!attempt) return json({ error: "This test session is not recognised. Please tell the HR desk." }, 404);

      // Already marked — return the same result rather than double-scoring, so
      // a retried submit on a flaky connection is harmless.
      if (attempt.status !== "in_progress") {
        return json({
          ok: true,
          already_submitted: true,
          score_total: attempt.score_total,
          out_of: TOTAL_QUESTIONS,
          sections: {
            A: attempt.score_section_a,
            B: attempt.score_section_b,
            C: attempt.score_section_c,
            D: attempt.score_section_d,
          },
          section_meta: SECTIONS,
        });
      }

      const now = new Date();
      const canonical = toCanonicalAnswers(rawAnswers, attempt.presented as Presented);
      const result = scoreAnswers(canonical);

      const elapsed = Math.round((now.getTime() - new Date(attempt.started_at).getTime()) / 1000);
      // Past the timer we still score everything answered. A candidate must
      // never lose their paper to a slow phone — the flag is for HR, not a
      // penalty (§5: no negative marking, partial submissions are scored).
      const autoSubmitted = isExpired(attempt.started_at, now);

      const { data: updated, error: updErr } = await supabase
        .from("assessment_attempts")
        .update({
          answers: canonical,
          // Snapshot the marked paper so the HR panel never needs the key.
          review: buildReview(canonical, attempt.presented as Presented),
          score_total: result.total,
          score_section_a: result.sections.A,
          score_section_b: result.sections.B,
          score_section_c: result.sections.C,
          score_section_d: result.sections.D,
          band: result.band,
          status: "submitted",
          submitted_at: now.toISOString(),
          duration_seconds: elapsed,
          auto_submitted: autoSubmitted,
        })
        .eq("id", attempt.id)
        .eq("status", "in_progress") // loses a double-submit race instead of scoring twice
        .select("id")
        .maybeSingle();
      if (updErr) return json({ error: "Could not save your answers.", details: updErr.message }, 500);
      if (!updated) return json({ error: "This test has already been submitted." }, 409);

      // The band is deliberately NOT returned. It is an internal routing signal
      // (§6.3) and a candidate reading "BELOW_BAR" in the waiting area may walk
      // out of a queue they were never going to be rejected from.
      return json({
        ok: true,
        score_total: result.total,
        out_of: TOTAL_QUESTIONS,
        answered: result.answered,
        auto_submitted: autoSubmitted,
        sections: result.sections,
        section_meta: SECTIONS,
      });
    }

    return json({ error: "Unknown action. Expected 'start' or 'submit'." }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
