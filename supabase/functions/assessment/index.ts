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
// Actions: "start" | "submit" | "positions".
//
// TWO PAPERS, ONE SERVER
// `kind` selects which:
//   "L1"   (the default, and what an absent `kind` means) — the general
//          first-level paper every candidate sits. _shared/assessment-bank.ts.
//   "ROLE" — the second-level paper, keyed to the position the candidate
//          applied for. _shared/role-assessment-bank.ts. Added 21 Aug 2026 per
//          §7.5, which reserved role-specific questions for a separate
//          instrument precisely so the level-1 paper stays sittable by all 13
//          positions.
// The level-1 request and response shapes are unchanged — an older cached
// candidate page that sends no `kind` still gets exactly the level-1 paper.
//
// `submit` takes no `kind`: the attempt row records which paper was sat, so it
// is marked against that paper and cannot be marked against the other one.
//
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
  QUESTIONS,
  BANDS as L1_BANDS,
  buildPresented,
  publicQuestions,
  toCanonicalAnswers,
  scoreAnswers,
  buildReview,
  type Presented,
} from "../_shared/assessment-bank.ts";
import {
  ROLE_DURATION_MINUTES,
  ROLE_GRACE_SECONDS,
  ROLE_POSITION_LIST,
  ROLE_BANDS,
  paperForPosition,
  buildRolePresented,
  publicRoleQuestions,
  toCanonicalRoleAnswers,
  scoreRoleAnswers,
  buildRoleReview,
  type RolePaper,
  type RolePresented,
} from "../_shared/role-assessment-bank.ts";

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

// ── Paper context ────────────────────────────────────────────────────────────
// The two papers differ in their bank, their duration and their section list,
// but every other rule — token issued here, ends_at from the server's
// started_at, marking here, one attempt per paper unless HR unlocks — is
// identical. So both start and submit run one code path over this, and the
// level-1 behaviour is exactly what it was before the role paper existed.
interface PaperCtx {
  kind: "L1" | "ROLE";
  assessmentId: string;
  /** null for L1 — the paper is the same for all 13 positions. */
  position: string | null;
  durationMinutes: number;
  graceSeconds: number;
  totalQuestions: number;
  sections: { id: string; name: string; count: number }[];
  buildPresented: () => Presented | RolePresented;
  publicQuestions: (p: never) => unknown;
  toCanonical: (raw: Record<string, unknown>, p: never) => Record<string, string>;
  score: (c: Record<string, string>) => {
    total: number;
    sections: Record<string, number>;
    band: string;
    answered: number;
  };
  buildReview: (c: Record<string, string>, p: never) => unknown;
}

const L1_CTX: PaperCtx = {
  kind: "L1",
  assessmentId: ASSESSMENT_ID,
  position: null,
  durationMinutes: DURATION_MINUTES,
  graceSeconds: GRACE_SECONDS,
  totalQuestions: TOTAL_QUESTIONS,
  sections: SECTIONS,
  buildPresented: () => buildPresented(),
  publicQuestions: (p) => publicQuestions(p as Presented),
  toCanonical: (raw, p) => toCanonicalAnswers(raw, p as Presented),
  score: (c) => scoreAnswers(c),
  buildReview: (c, p) => buildReview(c, p as Presented),
};

const roleCtx = (paper: RolePaper): PaperCtx => ({
  kind: "ROLE",
  assessmentId: paper.id,
  position: paper.position,
  durationMinutes: ROLE_DURATION_MINUTES,
  graceSeconds: ROLE_GRACE_SECONDS,
  totalQuestions: paper.questions.length,
  sections: paper.sections,
  buildPresented: () => buildRolePresented(paper),
  publicQuestions: (p) => publicRoleQuestions(paper, p as RolePresented),
  toCanonical: (raw, p) => toCanonicalRoleAnswers(paper, raw, p as RolePresented),
  score: (c) => scoreRoleAnswers(paper, c),
  buildReview: (c, p) => buildRoleReview(paper, c, p as RolePresented),
});

const endsAtOf = (ctx: PaperCtx, startedAt: string) =>
  new Date(new Date(startedAt).getTime() + ctx.durationMinutes * 60 * 1000).toISOString();

const isExpired = (ctx: PaperCtx, startedAt: string, now: Date) =>
  now.getTime() >
  new Date(startedAt).getTime() + ctx.durationMinutes * 60 * 1000 + ctx.graceSeconds * 1000;

/** The five section scores of an attempt row, in the response shape. */
const sectionScoresOf = (row: Record<string, unknown>) => ({
  A: row.score_section_a,
  B: row.score_section_b,
  C: row.score_section_c,
  D: row.score_section_d,
  E: row.score_section_e,
});

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

      // Absent or unrecognised `kind` means level 1 — an older cached candidate
      // page must keep getting exactly the paper it has always got.
      const kind = String(body?.kind ?? "L1").toUpperCase() === "ROLE" ? "ROLE" : "L1";

      let ctx = L1_CTX;
      if (kind === "ROLE") {
        const rawPosition = String(body?.position ?? "").trim();
        if (!rawPosition) {
          return json({ error: "Please select the position you applied for." }, 400);
        }
        const paper = paperForPosition(rawPosition);
        if (!paper) {
          // The dropdown should make this unreachable. If it happens, it is a
          // spelling drift between the page and §2.2 and the desk needs to know
          // — never silently hand the candidate somebody else's paper.
          return json({
            error: "That position was not recognised. Please tell the HR desk.",
            positions: ROLE_POSITION_LIST.map((p) => p.position),
          }, 400);
        }
        ctx = roleCtx(paper);
      }

      const now = new Date();

      const { data: existing, error: exErr } = await supabase
        .from("assessment_attempts")
        .select("*")
        .eq("assessment_id", ctx.assessmentId)
        .eq("email", email)
        .order("attempt_no", { ascending: false })
        .limit(1);
      if (exErr) return json({ error: "Could not check your record.", details: exErr.message }, 500);

      let latest = existing?.[0] ?? null;

      // An attempt left open past the timer is over. We never saw its answers —
      // they were only ever in the candidate's browser — so it closes as
      // expired rather than resuming with a timer that already ran out.
      if (latest?.status === "in_progress" && isExpired(ctx, latest.started_at, now)) {
        await supabase
          .from("assessment_attempts")
          .update({ status: "expired", submitted_at: now.toISOString() })
          .eq("id", latest.id)
          .eq("status", "in_progress");
        latest = { ...latest, status: "expired" };
      }

      // Genuine resume: a refresh, a dead battery, a dropped connection. Same
      // attempt, same shuffled paper, same remaining time — not a fresh timer.
      if (latest?.status === "in_progress") {
        return json({
          ok: true,
          resumed: true,
          attempt_token: latest.attempt_token,
          full_name: latest.full_name,
          email: latest.email,
          paper_kind: ctx.kind,
          position: ctx.position,
          assessment_id: ctx.assessmentId,
          ends_at: endsAtOf(ctx, latest.started_at),
          server_now: now.toISOString(),
          duration_minutes: ctx.durationMinutes,
          total_questions: ctx.totalQuestions,
          sections: ctx.sections,
          questions: ctx.publicQuestions(latest.presented as never),
        });
      }

      // One attempt per candidate per paper (§7.2). A second sitting needs an
      // HR unlock from the admin panel. Note this is PER PAPER: a candidate who
      // has sat level 1 is not blocked from their role paper, because the two
      // carry different assessment_ids.
      if (latest && !latest.retake_unlocked) {
        return json({
          ok: true,
          blocked: true,
          paper_kind: ctx.kind,
          position: ctx.position,
          previous: {
            status: latest.status,
            score_total: latest.score_total,
            out_of: ctx.totalQuestions,
            submitted_at: latest.submitted_at,
            sections: sectionScoresOf(latest),
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

      const presented = ctx.buildPresented();

      const { data: created, error: insErr } = await supabase
        .from("assessment_attempts")
        .insert({
          assessment_id: ctx.assessmentId,
          paper_kind: ctx.kind,
          position_applied: ctx.position,
          email,
          full_name: fullName,
          attempt_no: (latest?.attempt_no ?? 0) + 1,
          started_at: now.toISOString(),
          presented,
          // Written at start, not at submit, so an attempt abandoned mid-paper
          // is still legible in the panel — and so the panel never has to know
          // which of the fourteen papers this row's sections belong to.
          section_meta: ctx.sections,
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
        paper_kind: ctx.kind,
        position: ctx.position,
        assessment_id: ctx.assessmentId,
        ends_at: endsAtOf(ctx, created.started_at),
        server_now: now.toISOString(),
        duration_minutes: ctx.durationMinutes,
        total_questions: ctx.totalQuestions,
        sections: ctx.sections,
        questions: ctx.publicQuestions(presented as never),
      }, 201);
    }

    // ────────────────────────────────────────────────────────────────────────
    // POSITIONS — the level-2 dropdown, served from the same module that owns
    // the papers. The candidate page could hardcode §2.2, but then a position
    // renamed in the bank and not on the page would show a candidate an option
    // that cannot start. Carries no question content.
    // ────────────────────────────────────────────────────────────────────────
    if (action === "positions") {
      return json({ ok: true, positions: ROLE_POSITION_LIST });
    }

    // ────────────────────────────────────────────────────────────────────────
    // PAPER — the full paper INCLUDING the answer key and explanations, for HR
    // to review and sign off (§9.3).
    //
    // This is the only action that returns answers, and it is the reason the
    // key still never has to sit in a browser bundle: the reviewer fetches it
    // at runtime, authenticated, instead of the app shipping it to everyone.
    //
    // Edge functions bypass RLS by design and must do their own authorisation
    // (CLAUDE.md hard rule 4). So unlike start/submit — which are deliberately
    // anonymous — this one demands a real Hub session AND the hireflow module,
    // which is the same gate the Assessment panel already sits behind. anon
    // calling this gets 401, and an attendance-only user gets 403.
    // ────────────────────────────────────────────────────────────────────────
    if (action === "paper") {
      const authHeader = req.headers.get("Authorization") ?? "";
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const authClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
        db: { schema: "hr" },
        global: { headers: { Authorization: authHeader } },
      });

      // The candidate pages call every action with the bare anon key, which is
      // a valid project JWT but has no user — getUser() is what separates a
      // signed-in reviewer from a candidate's phone.
      const { data: { user }, error: userErr } = await authClient.auth.getUser();
      if (userErr || !user) return json({ error: "Not signed in." }, 401);

      // Evaluated as the caller, not as the service role: has_hireflow() is
      // security definer over auth.uid().
      const { data: allowed, error: rpcErr } = await authClient.rpc("has_hireflow");
      if (rpcErr) return json({ error: "Could not check your access.", details: rpcErr.message }, 500);
      if (allowed !== true) return json({ error: "You do not have access to the question bank." }, 403);

      const kind = String(body?.kind ?? "L1").toUpperCase() === "ROLE" ? "ROLE" : "L1";
      if (kind === "L1") {
        return json({
          ok: true,
          paper_kind: "L1",
          assessment_id: ASSESSMENT_ID,
          position: null,
          duration_minutes: DURATION_MINUTES,
          total_questions: TOTAL_QUESTIONS,
          sections: SECTIONS,
          bands: L1_BANDS,
          // Canonical order, with the answer index — this is the review view,
          // not a paper being sat, so nothing is shuffled.
          questions: QUESTIONS,
        });
      }

      const paper = paperForPosition(String(body?.position ?? ""));
      if (!paper) {
        return json({
          error: "That position was not recognised.",
          positions: ROLE_POSITION_LIST.map((p) => p.position),
        }, 400);
      }
      return json({
        ok: true,
        paper_kind: "ROLE",
        assessment_id: paper.id,
        position: paper.position,
        department: paper.department,
        duration_minutes: ROLE_DURATION_MINUTES,
        total_questions: paper.questions.length,
        sections: paper.sections,
        bands: ROLE_BANDS,
        questions: paper.questions,
      });
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

      // WHICH PAPER IS THIS? The row says, not the caller. A submit cannot be
      // steered onto the other paper's answer key by anything sent from the
      // browser.
      let ctx = L1_CTX;
      if (attempt.paper_kind === "ROLE") {
        const paper = paperForPosition(String(attempt.position_applied ?? ""));
        // Refuse rather than mis-mark. `presented` indexes into the question
        // array of the paper this candidate SAT; if that paper has since been
        // bumped to v2, marking against the current array would silently score
        // the wrong answers. §7.4 says never edit a paper in place once it has
        // been sat, so this should be unreachable — and if it ever is reached,
        // failing loudly lets HR unlock a re-sit instead of filing a wrong score.
        if (!paper || paper.id !== attempt.assessment_id) {
          return json({
            error: "This paper is no longer available for marking. Please tell the HR desk.",
            details: `attempt on ${attempt.assessment_id}; current paper for "${attempt.position_applied}" is ${paper?.id ?? "none"}`,
          }, 409);
        }
        ctx = roleCtx(paper);
      }

      // Already marked — return the same result rather than double-scoring, so
      // a retried submit on a flaky connection is harmless.
      if (attempt.status !== "in_progress") {
        return json({
          ok: true,
          already_submitted: true,
          score_total: attempt.score_total,
          out_of: ctx.totalQuestions,
          sections: sectionScoresOf(attempt),
          section_meta: attempt.section_meta ?? ctx.sections,
        });
      }

      const now = new Date();
      const canonical = ctx.toCanonical(rawAnswers, attempt.presented as never);
      const result = ctx.score(canonical);

      const elapsed = Math.round((now.getTime() - new Date(attempt.started_at).getTime()) / 1000);
      // Past the timer we still score everything answered. A candidate must
      // never lose their paper to a slow phone — the flag is for HR, not a
      // penalty (§5: no negative marking, partial submissions are scored).
      const autoSubmitted = isExpired(ctx, attempt.started_at, now);

      const { data: updated, error: updErr } = await supabase
        .from("assessment_attempts")
        .update({
          answers: canonical,
          // Snapshot the marked paper so the HR panel never needs the key.
          review: ctx.buildReview(canonical, attempt.presented as never),
          score_total: result.total,
          score_section_a: result.sections.A,
          score_section_b: result.sections.B,
          score_section_c: result.sections.C,
          score_section_d: result.sections.D,
          // Role papers have four sections. Explicit null rather than undefined,
          // which supabase-js would drop from the PATCH body entirely.
          score_section_e: result.sections.E ?? null,
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
        out_of: ctx.totalQuestions,
        answered: result.answered,
        auto_submitted: autoSubmitted,
        sections: result.sections,
        section_meta: ctx.sections,
        paper_kind: ctx.kind,
        position: ctx.position,
      });
    }

    return json({ error: "Unknown action. Expected 'start', 'submit' or 'positions'." }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
