// ============================================================
// verify-deploy-payload — prove the pasted deploy artifact marks IDENTICALLY
// to the repo banks, before it ever reaches production.
//
//   node scripts/make-deploy-payload.mjs <out.ts>
//   node scripts/verify-deploy-payload.mjs <out.ts>
//
// scripts/make-deploy-payload.mjs rewrites the two banks and the marking logic
// into one small file, because the Supabase MCP deploy tool takes file contents
// inline and cannot place a file outside the function directory. Rewritten
// marking logic is exactly the thing that fails silently: a wrong index mapping
// mis-marks every paper in the hall and nothing reports an error.
//
// So this runs BOTH implementations over the same shuffles and asserts they
// agree question by question:
//   * the payload's embedded data is byte-identical to the banks
//   * publicQuestions output matches, and leaks no answer/explanation
//   * a perfect paper scores full marks, an all-wrong paper scores zero
//   * total, per-section scores and band agree with the repo implementation
// ============================================================

import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const payloadPath = process.argv[2];
if (!payloadPath) {
  console.error("usage: node scripts/verify-deploy-payload.mjs <payload.ts>");
  process.exit(2);
}

const loadTs = async (p) => {
  const src = await readFile(p, "utf8");
  const { code } = await transform(src, { loader: "ts", format: "esm" });
  return import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
};

const L1BANK = await loadTs("supabase/functions/_shared/assessment-bank.ts");
const ROLEBANK = await loadTs("supabase/functions/_shared/role-assessment-bank.ts");

// The payload calls Deno.serve at module scope and reads env vars. Stub both,
// and capture the handler so nothing actually listens.
globalThis.Deno = { serve: () => {}, env: { get: () => "stub" } };

// Pull the payload's internals out by re-exporting them. The payload is not a
// module with exports, so append a probe that exposes what we need to compare.
const payloadSrc = await readFile(payloadPath, "utf8");
const probe = payloadSrc.replace(
  'import { createClient } from "https://esm.sh/@supabase/supabase-js@2";',
  "const createClient = () => ({});",
) + `
export { L1, ROLE, buildPresented, publicQuestions, toCanonical, score, buildReview, paperForPosition, POSITION_LIST, l1Band, roleBand, L1_CTX, roleCtx };
`;
const { code } = await transform(probe, { loader: "ts", format: "esm" });
const P = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

const SHUFFLES = 25;
let failures = 0;
const bad = (m) => { console.log("  FAIL: " + m); failures++; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── 1. The embedded data must be identical to the banks ─────────────────────
if (!eq(P.L1.questions, L1BANK.QUESTIONS)) bad("L1 questions differ from assessment-bank.ts");
if (!eq(P.L1.sections, L1BANK.SECTIONS)) bad("L1 sections differ");
if (P.L1.id !== L1BANK.ASSESSMENT_ID) bad("L1 assessment id differs");
if (P.L1.mins !== L1BANK.DURATION_MINUTES) bad("L1 duration differs");
if (!eq(P.L1.bands, L1BANK.BANDS)) bad("L1 band table differs from the bank");
if (!eq(P.ROLE.bands, ROLEBANK.ROLE_BANDS)) bad("role band table differs from the bank");
if (!eq(P.ROLE.papers, ROLEBANK.ROLE_PAPERS)) bad("role papers differ from role-assessment-bank.ts");
if (P.ROLE.mins !== ROLEBANK.ROLE_DURATION_MINUTES) bad("role duration differs");
if (P.ROLE.papers.length !== 15) bad(`role papers: ${P.ROLE.papers.length}, expected 15`);

// ── 2. Marking must agree with the repo implementation, through the shuffle ──
const checkPaper = (label, questions, ctx, repo) => {
  for (let t = 0; t < SHUFFLES; t++) {
    const pres = ctx.build();
    const served = ctx.pub(pres);

    if (!eq(served, repo.publicQuestions(pres))) bad(`${label}: served questions differ from the bank`);
    if (/"answer"|"explanation"|is_correct/.test(JSON.stringify(served))) bad(`${label}: served paper leaks key material`);

    const perfect = {}, wrong = {};
    for (const sq of served) {
      const src = questions.find((q) => q.n === sq.n);
      const idx = sq.options.indexOf(src.options[src.answer]);
      if (idx < 0) { bad(`${label} Q${sq.n}: correct option missing from served options`); continue; }
      perfect[String(sq.n)] = idx;
      wrong[String(sq.n)] = (idx + 1) % sq.options.length;
    }

    const canonical = ctx.canon(perfect, pres);
    if (!eq(canonical, repo.toCanonical(perfect, pres))) bad(`${label}: canonical mapping differs from the bank`);

    const got = ctx.score(canonical);
    const want = repo.score(canonical);
    if (got.total !== want.total) bad(`${label}: total ${got.total} vs bank ${want.total}`);
    if (got.band !== want.band) bad(`${label}: band ${got.band} vs bank ${want.band}`);
    for (const s of ctx.sections) {
      if (got.sections[s.id] !== want.sections[s.id]) bad(`${label} section ${s.id}: ${got.sections[s.id]} vs bank ${want.sections[s.id]}`);
      if (got.sections[s.id] !== s.count) bad(`${label} section ${s.id}: perfect scored ${got.sections[s.id]}/${s.count}`);
    }
    if (got.total !== questions.length) bad(`${label}: perfect paper scored ${got.total}/${questions.length}`);

    const zero = ctx.score(ctx.canon(wrong, pres));
    if (zero.total !== 0) bad(`${label}: all-wrong paper scored ${zero.total}, expected 0`);

    if (t === 0) {
      const rev = ctx.review(canonical, pres);
      if (!eq(rev, repo.buildReview(canonical, pres))) bad(`${label}: review differs from the bank`);
      if (rev.some((r) => !r.is_correct)) bad(`${label}: review disagrees with the marking`);
    }
  }
};

checkPaper("L1", L1BANK.QUESTIONS, P.L1_CTX, {
  publicQuestions: (pres) => L1BANK.publicQuestions(pres),
  toCanonical: (raw, pres) => L1BANK.toCanonicalAnswers(raw, pres),
  score: (c) => L1BANK.scoreAnswers(c),
  buildReview: (c, pres) => L1BANK.buildReview(c, pres),
});

for (const paper of ROLEBANK.ROLE_PAPERS) {
  checkPaper(paper.position, paper.questions, P.roleCtx(paper), {
    publicQuestions: (pres) => ROLEBANK.publicRoleQuestions(paper, pres),
    toCanonical: (raw, pres) => ROLEBANK.toCanonicalRoleAnswers(paper, raw, pres),
    score: (c) => ROLEBANK.scoreRoleAnswers(paper, c),
    buildReview: (c, pres) => ROLEBANK.buildRoleReview(paper, c, pres),
  });
}

// ── 3. Position lookup, including the cedilla ───────────────────────────────
const FACADE = "HAG-ROLE-FACADE-FACTORY-MANAGER-v1";
for (const [input, want] of [
  ["Façade Factory Manager", FACADE],
  ["Facade Factory Manager", FACADE],
  ["FAÇADE FACTORY MANAGER", FACADE],
  ["Fac" + String.fromCharCode(0x327) + "ade Factory Manager", FACADE],
  ["  sales  executive ", "HAG-ROLE-SALES-EXECUTIVE-v1"],
]) {
  const got = P.paperForPosition(input)?.id;
  if (got !== want) bad(`paperForPosition(${JSON.stringify(input)}) = ${got}, expected ${want}`);
}
for (const junk of ["", "PEB Design Engineer", null, undefined]) {
  if (P.paperForPosition(junk) !== null) bad(`paperForPosition(${JSON.stringify(junk)}) should be null`);
}
if (P.POSITION_LIST.length !== 15) bad(`position list has ${P.POSITION_LIST.length} entries`);
if (/answer|explanation/.test(JSON.stringify(P.POSITION_LIST))) bad("position list leaks key material");

// ── 4. Bands ────────────────────────────────────────────────────────────────
for (const [n, w] of [[15,"STRONG"],[13,"STRONG"],[12,"AVERAGE"],[9,"AVERAGE"],[8,"WEAK"],[6,"WEAK"],[5,"BELOW_BAR"]]) {
  if (P.l1Band(n) !== w) bad(`l1Band(${n}) = ${P.l1Band(n)}, expected ${w}`);
}
for (const [n, w] of [[12,"STRONG"],[9,"STRONG"],[8,"AVERAGE"],[6,"AVERAGE"],[5,"WEAK"],[4,"WEAK"],[3,"BELOW_BAR"]]) {
  if (P.roleBand(n) !== w) bad(`roleBand(${n}) = ${P.roleBand(n)}, expected ${w}`);
}

if (failures) {
  console.log(`\n${failures} FAILURE${failures > 1 ? "S" : ""} — do NOT deploy this payload.`);
  process.exit(1);
}
console.log(
  `Payload agrees with the repo banks: 1 L1 paper + ${P.ROLE.papers.length} role papers, ` +
  `${SHUFFLES} shuffles each, data / marking / sections / bands / review all identical.`,
);
