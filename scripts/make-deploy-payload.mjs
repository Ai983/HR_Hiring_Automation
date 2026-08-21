// Build the smallest faithful single-file edge function for a paste deploy.
// Data goes in as compact JSON (no indentation, no repeated TS formatting);
// logic is hand-written and tiny. Nothing about the DATA changes.
import { readFile, writeFile } from "node:fs/promises";
import { transform } from "esbuild";

const load = async (p) => {
  const src = await readFile(p, "utf8");
  const { code } = await transform(src, { loader: "ts", format: "esm" });
  return import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
};

const L1 = await load("supabase/functions/_shared/assessment-bank.ts");
const ROLE = await load("supabase/functions/_shared/role-assessment-bank.ts");

// One question per line. Compact JSON on a single 83 KB line is unreviewable in
// a diff and impossible to transcribe safely into the MCP deploy tool, which is
// how this artifact currently reaches production. Line-per-question keeps every
// line ~600 chars, so a mistake is localised, visible and cheap to fix.
const j = (v) => JSON.stringify(v);
const questionLines = (qs) => qs.map(j).join(",\n");

const l1Literal = `{\nid: ${j(L1.ASSESSMENT_ID)}, mins: ${L1.DURATION_MINUTES}, grace: ${L1.GRACE_SECONDS},\nsections: ${j(L1.SECTIONS)},\nbands: ${j(L1.BANDS)},\nquestions: [\n${questionLines(L1.QUESTIONS)}\n]}`;

const paperLiteral = (p) =>
  `{id: ${j(p.id)}, position: ${j(p.position)}, department: ${j(p.department)},\nsections: ${j(p.sections)},\nquestions: [\n${questionLines(p.questions)}\n]}`;

const roleLiteral = `{\nmins: ${ROLE.ROLE_DURATION_MINUTES}, grace: ${ROLE.ROLE_GRACE_SECONDS},\nbands: ${j(ROLE.ROLE_BANDS)},\npapers: [\n${ROLE.ROLE_PAPERS.map(paperLiteral).join(",\n")}\n]}`;

const out = `// AUTO-GENERATED DEPLOY ARTIFACT — do not edit here.
// Source of truth: supabase/functions/assessment/index.ts and
// supabase/functions/_shared/{assessment,role-assessment}-bank.ts.
// Regenerate with scripts/make-deploy-payload.mjs. Behaviour is identical;
// only the file layout differs, because the MCP deploy tool takes files inline
// and cannot place one outside the function directory.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const L1 = ${l1Literal};

const ROLE = ${roleLiteral};

const LETTERS = ["A","B","C","D","E","F"];
const norm = (v) => String(v ?? "").normalize("NFD").toLowerCase().replace(/[^a-z0-9]+/g, "");
const BY_POS = new Map(ROLE.papers.map((p) => [norm(p.position), p]));
const paperForPosition = (p) => BY_POS.get(norm(p)) ?? null;
const POSITION_LIST = ROLE.papers.map((p) => ({ position: p.position, department: p.department, assessment_id: p.id, total_questions: p.questions.length }));

// Derived from the same band tables the review page is shown, so a cut cannot
// be changed in one place and not the other.
const bandFrom = (table, t) => (table.find((b) => t >= b.min) ?? table[table.length - 1]).band;
const l1Band = (t) => bandFrom(L1.bands, t);
const roleBand = (t) => bandFrom(ROLE.bands, t);

// Question order fixed; options shuffled per candidate. \`presented\` records the
// order this candidate saw so the attempt stays re-markable.
function buildPresented(qs) {
  const out = {};
  for (const q of qs) {
    const order = q.options.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    out[String(q.n)] = order;
  }
  return out;
}
// Strips \`answer\` and \`explanation\`. The only way question text reaches a browser.
const publicQuestions = (qs, pres) => qs.map((q) => ({
  n: q.n, section: q.section, scenario: q.scenario ?? null, q: q.q,
  options: (pres[String(q.n)] ?? q.options.map((_, i) => i)).map((i) => q.options[i]),
}));
function toCanonical(qs, raw, pres) {
  const out = {};
  for (const q of qs) {
    const k = String(q.n);
    const pos = Number(raw?.[k]);
    if (!Number.isInteger(pos)) continue;
    const c = (pres[k] ?? q.options.map((_, i) => i))[pos];
    if (c == null) continue;
    out[k] = LETTERS[c];
  }
  return out;
}
function score(qs, canonical, bandFn, ids) {
  const sections = {};
  for (const id of ids) sections[id] = 0;
  let total = 0, answered = 0;
  for (const q of qs) {
    const picked = canonical[String(q.n)];
    if (!picked) continue;
    answered++;
    if (LETTERS.indexOf(picked) === q.answer) { total++; sections[q.section]++; }
  }
  return { total, sections, band: bandFn(total), answered };
}
// The marked paper, snapshotted at submit so the HR panel never needs the key.
const buildReview = (qs, canonical, pres) => qs.map((q) => {
  const picked = canonical[String(q.n)] ?? null;
  const pi = picked ? LETTERS.indexOf(picked) : -1;
  return {
    n: q.n, section: q.section, scenario: q.scenario ?? null, q: q.q,
    options: (pres[String(q.n)] ?? q.options.map((_, i) => i)).map((i) => q.options[i]),
    chosen: pi >= 0 ? q.options[pi] : null, chosen_letter: picked,
    correct: q.options[q.answer], correct_letter: LETTERS[q.answer],
    is_correct: pi === q.answer, explanation: q.explanation,
  };
});

const L1_CTX = {
  kind: "L1", assessmentId: L1.id, position: null,
  mins: L1.mins, grace: L1.grace, total: L1.questions.length, sections: L1.sections,
  build: () => buildPresented(L1.questions),
  pub: (p) => publicQuestions(L1.questions, p),
  canon: (r, p) => toCanonical(L1.questions, r, p),
  score: (c) => score(L1.questions, c, l1Band, ["A","B","C","D","E"]),
  review: (c, p) => buildReview(L1.questions, c, p),
};
const roleCtx = (paper) => ({
  kind: "ROLE", assessmentId: paper.id, position: paper.position,
  mins: ROLE.mins, grace: ROLE.grace, total: paper.questions.length, sections: paper.sections,
  build: () => buildPresented(paper.questions),
  pub: (p) => publicQuestions(paper.questions, p),
  canon: (r, p) => toCanonical(paper.questions, r, p),
  score: (c) => score(paper.questions, c, roleBand, ["A","B","C","D"]),
  review: (c, p) => buildReview(paper.questions, c, p),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[a-z]{2,}$/i;
const endsAtOf = (ctx, s) => new Date(new Date(s).getTime() + ctx.mins * 60000).toISOString();
const isExpired = (ctx, s, now) => now.getTime() > new Date(s).getTime() + ctx.mins * 60000 + ctx.grace * 1000;
const sectionScoresOf = (r) => ({ A: r.score_section_a, B: r.score_section_b, C: r.score_section_c, D: r.score_section_d, E: r.score_section_e });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      { db: { schema: "hr" } },
    );
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "positions") return json({ ok: true, positions: POSITION_LIST });

    // PAPER — the full paper WITH the answer key, for HR to review and sign off.
    // The only action that returns answers, and the reason the key never has to
    // sit in a browser bundle: the reviewer fetches it at runtime, authorised.
    // Edge functions bypass RLS, so this does its own authorisation — a real Hub
    // session AND the hireflow module, the same gate as the Assessment panel.
    if (action === "paper") {
      const authClient = createClient(
        Deno.env.get("SUPABASE_URL"),
        Deno.env.get("SUPABASE_ANON_KEY"),
        { db: { schema: "hr" }, global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
      );
      // The candidate pages call with the bare anon key — a valid project JWT
      // with no user behind it. getUser() is what separates a signed-in
      // reviewer from a candidate's phone.
      const { data: { user }, error: userErr } = await authClient.auth.getUser();
      if (userErr || !user) return json({ error: "Not signed in." }, 401);
      const { data: allowed, error: rpcErr } = await authClient.rpc("has_hireflow");
      if (rpcErr) return json({ error: "Could not check your access.", details: rpcErr.message }, 500);
      if (allowed !== true) return json({ error: "You do not have access to the question bank." }, 403);

      const want = String(body?.kind ?? "L1").toUpperCase() === "ROLE" ? "ROLE" : "L1";
      if (want === "L1") {
        return json({
          ok: true, paper_kind: "L1", assessment_id: L1.id, position: null,
          duration_minutes: L1.mins, total_questions: L1.questions.length,
          sections: L1.sections, bands: L1.bands,
          // Canonical order with the answer index. This is a review view, not a
          // paper being sat, so nothing is shuffled.
          questions: L1.questions,
        });
      }
      const paper = paperForPosition(String(body?.position ?? ""));
      if (!paper) return json({ error: "That position was not recognised.", positions: POSITION_LIST.map((p) => p.position) }, 400);
      return json({
        ok: true, paper_kind: "ROLE", assessment_id: paper.id, position: paper.position,
        department: paper.department, duration_minutes: ROLE.mins,
        total_questions: paper.questions.length, sections: paper.sections, bands: ROLE.bands,
        questions: paper.questions,
      });
    }

    if (action === "start") {
      const email = String(body?.email ?? "").trim().toLowerCase();
      const fullName = String(body?.full_name ?? "").trim().replace(/\\s+/g, " ");
      const userAgent = String(body?.user_agent ?? "").slice(0, 500);
      if (!EMAIL_RE.test(email)) return json({ error: "Please enter a valid email address." }, 400);
      if (fullName.length < 2) return json({ error: "Please enter your full name." }, 400);

      // Absent kind means level 1, so an older cached page keeps working.
      const kind = String(body?.kind ?? "L1").toUpperCase() === "ROLE" ? "ROLE" : "L1";
      let ctx = L1_CTX;
      if (kind === "ROLE") {
        const raw = String(body?.position ?? "").trim();
        if (!raw) return json({ error: "Please select the position you applied for." }, 400);
        const paper = paperForPosition(raw);
        // Never silently hand the candidate somebody else's paper.
        if (!paper) return json({ error: "That position was not recognised. Please tell the HR desk.", positions: POSITION_LIST.map((p) => p.position) }, 400);
        ctx = roleCtx(paper);
      }

      const now = new Date();
      const { data: existing, error: exErr } = await supabase.from("assessment_attempts").select("*")
        .eq("assessment_id", ctx.assessmentId).eq("email", email)
        .order("attempt_no", { ascending: false }).limit(1);
      if (exErr) return json({ error: "Could not check your record.", details: exErr.message }, 500);
      let latest = existing?.[0] ?? null;

      if (latest?.status === "in_progress" && isExpired(ctx, latest.started_at, now)) {
        await supabase.from("assessment_attempts")
          .update({ status: "expired", submitted_at: now.toISOString() })
          .eq("id", latest.id).eq("status", "in_progress");
        latest = { ...latest, status: "expired" };
      }

      // Genuine resume: same attempt, same shuffled paper, same remaining time.
      if (latest?.status === "in_progress") {
        return json({
          ok: true, resumed: true, attempt_token: latest.attempt_token,
          full_name: latest.full_name, email: latest.email,
          paper_kind: ctx.kind, position: ctx.position, assessment_id: ctx.assessmentId,
          ends_at: endsAtOf(ctx, latest.started_at), server_now: now.toISOString(),
          duration_minutes: ctx.mins, total_questions: ctx.total, sections: ctx.sections,
          questions: ctx.pub(latest.presented),
        });
      }

      // One attempt per candidate PER PAPER. Sitting level 1 does not block level 2.
      if (latest && !latest.retake_unlocked) {
        return json({
          ok: true, blocked: true, paper_kind: ctx.kind, position: ctx.position,
          previous: {
            status: latest.status, score_total: latest.score_total,
            out_of: ctx.total, submitted_at: latest.submitted_at,
            sections: sectionScoresOf(latest),
          },
        });
      }

      // An unlock grants exactly one re-sit, so it is consumed here.
      if (latest?.retake_unlocked) {
        await supabase.from("assessment_attempts").update({ retake_unlocked: false }).eq("id", latest.id);
      }

      const presented = ctx.build();
      const { data: created, error: insErr } = await supabase.from("assessment_attempts").insert({
        assessment_id: ctx.assessmentId, paper_kind: ctx.kind, position_applied: ctx.position,
        email, full_name: fullName, attempt_no: (latest?.attempt_no ?? 0) + 1,
        started_at: now.toISOString(), presented,
        // Written at START so the panel never has to know which paper this is.
        section_meta: ctx.sections, status: "in_progress", user_agent: userAgent,
      }).select("attempt_token, started_at").single();
      if (insErr || !created) return json({ error: "Could not start the test. Please tell the HR desk.", details: insErr?.message }, 500);

      return json({
        ok: true, resumed: false, attempt_token: created.attempt_token,
        full_name: fullName, email,
        paper_kind: ctx.kind, position: ctx.position, assessment_id: ctx.assessmentId,
        ends_at: endsAtOf(ctx, created.started_at), server_now: now.toISOString(),
        duration_minutes: ctx.mins, total_questions: ctx.total, sections: ctx.sections,
        questions: ctx.pub(presented),
      }, 201);
    }

    if (action === "submit") {
      const token = String(body?.attempt_token ?? "").trim();
      if (!token) return json({ error: "Missing attempt token." }, 400);
      const rawAnswers = body?.answers ?? {};

      const { data: attempt, error: findErr } = await supabase.from("assessment_attempts")
        .select("*").eq("attempt_token", token).maybeSingle();
      if (findErr) return json({ error: "Could not load your attempt.", details: findErr.message }, 500);
      if (!attempt) return json({ error: "This test session is not recognised. Please tell the HR desk." }, 404);

      // The ROW says which paper this is, never the caller.
      let ctx = L1_CTX;
      if (attempt.paper_kind === "ROLE") {
        const paper = paperForPosition(String(attempt.position_applied ?? ""));
        // Refuse rather than mis-mark against a bumped paper.
        if (!paper || paper.id !== attempt.assessment_id) {
          return json({ error: "This paper is no longer available for marking. Please tell the HR desk." }, 409);
        }
        ctx = roleCtx(paper);
      }

      if (attempt.status !== "in_progress") {
        return json({
          ok: true, already_submitted: true, score_total: attempt.score_total,
          out_of: ctx.total, sections: sectionScoresOf(attempt),
          section_meta: attempt.section_meta ?? ctx.sections,
        });
      }

      const now = new Date();
      const canonical = ctx.canon(rawAnswers, attempt.presented);
      const result = ctx.score(canonical);
      const elapsed = Math.round((now.getTime() - new Date(attempt.started_at).getTime()) / 1000);
      // Past the timer everything answered is still scored. Never lose a paper.
      const autoSubmitted = isExpired(ctx, attempt.started_at, now);

      const { data: updated, error: updErr } = await supabase.from("assessment_attempts").update({
        answers: canonical,
        review: ctx.review(canonical, attempt.presented),
        score_total: result.total,
        score_section_a: result.sections.A, score_section_b: result.sections.B,
        score_section_c: result.sections.C, score_section_d: result.sections.D,
        score_section_e: result.sections.E ?? null,
        band: result.band, status: "submitted", submitted_at: now.toISOString(),
        duration_seconds: elapsed, auto_submitted: autoSubmitted,
      }).eq("id", attempt.id).eq("status", "in_progress").select("id").maybeSingle();
      if (updErr) return json({ error: "Could not save your answers.", details: updErr.message }, 500);
      if (!updated) return json({ error: "This test has already been submitted." }, 409);

      // The band is deliberately NOT returned to the candidate (§6.3).
      return json({
        ok: true, score_total: result.total, out_of: ctx.total,
        answered: result.answered, auto_submitted: autoSubmitted,
        sections: result.sections, section_meta: ctx.sections,
        paper_kind: ctx.kind, position: ctx.position,
      });
    }

    return json({ error: "Unknown action. Expected 'start', 'submit' or 'positions'." }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
`;

await writeFile(process.argv[2], out, "utf8");
console.log("bytes:", out.length);
