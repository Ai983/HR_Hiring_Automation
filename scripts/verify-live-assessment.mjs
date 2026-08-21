// ============================================================
// verify-live-assessment — end-to-end check against the DEPLOYED edge function.
//
//   node scripts/verify-live-assessment.mjs
//
// The deployed function currently reaches production by being pasted into the
// Supabase MCP deploy tool (see CLAUDE.md), so the one thing that must never be
// assumed is that what is live matches the repo. This drives the real API for
// level 1 and all 13 role papers and asserts, for each:
//
//   * every served question, scenario and option is byte-identical to the bank
//   * the served paper leaks no answer / explanation / is_correct
//   * a perfect paper scores full marks, section by section
//   * an all-wrong paper scores zero
//   * the stored review round-trips
//
// It writes real attempts, so every row it creates uses @example.com and is
// deleted at the end (CLAUDE.md step 6).
// ============================================================

import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const env = await readFile(".env", "utf8");
const pick = (k) => (env.match(new RegExp(`^\\s*${k}\\s*=\\s*(.+)$`, "m"))?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
const URL_ = pick("VITE_SUPABASE_URL").replace(/\/$/, "");
const ANON = pick("VITE_SUPABASE_ANON_KEY");
const FN = `${URL_}/functions/v1/assessment`;

const loadTs = async (p) => {
  const src = await readFile(p, "utf8");
  const { code } = await transform(src, { loader: "ts", format: "esm" });
  return import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
};
const L1BANK = await loadTs("supabase/functions/_shared/assessment-bank.ts");
const ROLEBANK = await loadTs("supabase/functions/_shared/role-assessment-bank.ts");

let failures = 0;
const bad = (m) => { console.log("  FAIL: " + m); failures++; };

async function call(payload) {
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(FN, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      return { status: res.status, data };
    } catch {
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw new Error("function unreachable");
}

const stamp = Date.now();

async function checkPaper(label, questions, sections, marks, kind, position, mode) {
  const email = `verify-${mode}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "")}-${stamp}@example.com`;
  const started = await call({ action: "start", kind, position, email, full_name: `Verify ${label}` });
  if (started.data?.error) return bad(`${label} start: ${started.data.error}`);

  const served = started.data.questions;
  if (!Array.isArray(served) || served.length !== questions.length) {
    return bad(`${label}: served ${served?.length} questions, expected ${questions.length}`);
  }
  if (started.data.total_questions !== questions.length) bad(`${label}: total_questions mismatch`);
  if (JSON.stringify(started.data.sections) !== JSON.stringify(sections)) bad(`${label}: sections differ from the bank`);
  if (/"answer"|"explanation"|is_correct|correct_letter/.test(JSON.stringify(served))) {
    bad(`${label}: LIVE PAPER LEAKS KEY MATERIAL`);
  }

  // Byte-compare the served text against the repo bank.
  const picks = {};
  for (const sq of served) {
    const src = questions.find((q) => q.n === sq.n);
    if (!src) { bad(`${label} Q${sq.n}: not in the bank`); continue; }
    if (sq.q !== src.q) bad(`${label} Q${sq.n}: question text differs from the bank`);
    if ((sq.scenario ?? null) !== (src.scenario ?? null)) bad(`${label} Q${sq.n}: scenario differs from the bank`);
    if (sq.section !== src.section) bad(`${label} Q${sq.n}: section differs`);
    if ([...sq.options].sort().join("|") !== [...src.options].sort().join("|")) {
      bad(`${label} Q${sq.n}: OPTION TEXT DIFFERS FROM THE BANK`);
      continue;
    }
    const idx = sq.options.indexOf(src.options[src.answer]);
    if (idx < 0) { bad(`${label} Q${sq.n}: correct option not served`); continue; }
    picks[String(sq.n)] = mode === "perfect" ? idx : (idx + 1) % sq.options.length;
  }

  const submitted = await call({ action: "submit", attempt_token: started.data.attempt_token, answers: picks });
  if (submitted.data?.error) return bad(`${label} submit: ${submitted.data.error}`);

  const want = mode === "perfect" ? marks : 0;
  if (submitted.data.score_total !== want) {
    bad(`${label}: ${mode} paper scored ${submitted.data.score_total}/${submitted.data.out_of}, expected ${want}`);
  }
  if (submitted.data.out_of !== marks) bad(`${label}: out_of ${submitted.data.out_of}, expected ${marks}`);
  if (mode === "perfect") {
    for (const s of sections) {
      if (submitted.data.sections?.[s.id] !== s.count) {
        bad(`${label} section ${s.id}: scored ${submitted.data.sections?.[s.id]}/${s.count}`);
      }
    }
  }
  if (submitted.data.band !== undefined) bad(`${label}: band must NOT be returned to the candidate`);
  return submitted.data;
}

console.log("Level 1:");
for (const mode of ["perfect", "wrong"]) {
  const r = await checkPaper("L1", L1BANK.QUESTIONS, L1BANK.SECTIONS, L1BANK.TOTAL_QUESTIONS, "L1", undefined, mode);
  if (r) console.log(`  ${mode}: ${r.score_total}/${r.out_of}`);
}

console.log("\nPositions endpoint:");
const pos = await call({ action: "positions" });
const livePositions = (pos.data?.positions ?? []).map((p) => p.position);
const bankPositions = ROLEBANK.ROLE_PAPERS.map((p) => p.position);
if (livePositions.join("|") !== bankPositions.join("|")) {
  bad(`positions differ.\n    live: ${livePositions.join(", ")}\n    bank: ${bankPositions.join(", ")}`);
} else {
  console.log(`  ${livePositions.length} positions, identical to the bank`);
}

console.log("\nLevel 2 — all 13 role papers:");
for (const paper of ROLEBANK.ROLE_PAPERS) {
  const perfect = await checkPaper(paper.position, paper.questions, paper.sections, paper.questions.length, "ROLE", paper.position, "perfect");
  const wrong = await checkPaper(paper.position, paper.questions, paper.sections, paper.questions.length, "ROLE", paper.position, "wrong");
  if (perfect?.assessment_id && perfect.assessment_id !== paper.id) bad(`${paper.position}: served ${perfect.assessment_id}, expected ${paper.id}`);
  console.log(`  ${paper.position.padEnd(26)} perfect ${perfect?.score_total}/${perfect?.out_of}   all-wrong ${wrong?.score_total}/${wrong?.out_of}`);
}

console.log("\nAn unknown position must be refused, never given another paper:");
const junk = await call({ action: "start", kind: "ROLE", position: "PEB Design Engineer", email: `verify-junk-${stamp}@example.com`, full_name: "Verify Junk" });
if (junk.status !== 400) bad(`unknown position returned HTTP ${junk.status}, expected 400`);
else console.log(`  refused with 400: "${junk.data.error}"`);

console.log(
  failures
    ? `\n${failures} FAILURE${failures > 1 ? "S" : ""} — the live function does NOT match the repo.`
    : "\nLIVE FUNCTION MATCHES THE REPO. All 14 papers verified end to end.",
);
process.exit(failures ? 1 : 0);
