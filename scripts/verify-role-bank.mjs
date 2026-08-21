// ============================================================
// verify-role-bank — offline proof that the 13 level-2 papers are sound.
//
//   npm run assessment:verify-roles
//
// There is no test runner in this repo, and the one failure mode that matters
// here is silent: if the display→canonical mapping is wrong, every paper in the
// hall is mis-marked and nothing anywhere reports an error. So this does the
// whole of the CLAUDE.md "Verifying a change" checklist against the bank
// directly, with no deploy and no network:
//
//   * 13 papers, 12 questions each, numbered 1..n
//   * every section's declared count matches the questions actually in it
//   * every answer index is in range, no duplicate option text
//   * publicRoleQuestions() leaks no `answer` / `explanation` / `is_correct`
//   * 40 shuffles per paper: answering BY OPTION TEXT against the shuffled
//     options scores full marks, and answering deliberately wrong scores zero
//   * position lookup survives the cedilla, case, spacing and NFD/NFC
//   * the band cuts are where the bank says they are
//
// The bank is Deno TypeScript, so it is transpiled in memory with esbuild (a
// devDependency, already present for vite) and imported as a data: URL. Nothing
// is written to disk and nothing here reaches the app bundle.
// ============================================================

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { transform } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const BANK = path.join(here, "..", "supabase", "functions", "_shared", "role-assessment-bank.ts");

const source = await readFile(BANK, "utf8");
const { code } = await transform(source, { loader: "ts", format: "esm" });
const bank = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

const {
  ROLE_PAPERS, ROLE_TOTAL_QUESTIONS, ROLE_POSITION_LIST, paperForPosition,
  buildRolePresented, publicRoleQuestions, toCanonicalRoleAnswers,
  scoreRoleAnswers, buildRoleReview, roleBandFor,
} = bank;

const SHUFFLES = 40;
let failures = 0;
const bad = (msg) => { console.log("  FAIL: " + msg); failures++; };

// ── Structure ────────────────────────────────────────────────────────────────
if (ROLE_PAPERS.length !== 15) bad(`expected 15 papers, got ${ROLE_PAPERS.length}`);

const ids = new Set();
for (const p of ROLE_PAPERS) {
  if (ids.has(p.id)) bad(`duplicate paper id ${p.id}`);
  ids.add(p.id);

  if (p.questions.length !== ROLE_TOTAL_QUESTIONS) {
    bad(`${p.position}: ${p.questions.length} questions, expected ${ROLE_TOTAL_QUESTIONS}`);
  }
  const declared = p.sections.reduce((n, s) => n + s.count, 0);
  if (declared !== p.questions.length) {
    bad(`${p.position}: sections declare ${declared}, paper has ${p.questions.length}`);
  }
  for (const s of p.sections) {
    const actual = p.questions.filter((q) => q.section === s.id).length;
    if (actual !== s.count) bad(`${p.position} section ${s.id}: declares ${s.count}, has ${actual}`);
  }
  p.questions.forEach((q, i) => {
    if (q.n !== i + 1) bad(`${p.position} Q${q.n}: numbering is not 1..n`);
    if (q.options.length !== 4) bad(`${p.position} Q${q.n}: ${q.options.length} options, expected 4`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) {
      bad(`${p.position} Q${q.n}: answer index ${q.answer} out of range`);
    }
    if (new Set(q.options).size !== q.options.length) bad(`${p.position} Q${q.n}: duplicate option text`);
    if (!q.explanation || q.explanation.length < 20) bad(`${p.position} Q${q.n}: missing explanation`);
  });

  // ── The mapping that mis-marks the whole day if it is wrong ────────────────
  for (let trial = 0; trial < SHUFFLES; trial++) {
    const presented = buildRolePresented(p);
    const served = publicRoleQuestions(p, presented);

    if (/"answer"|"explanation"|is_correct/.test(JSON.stringify(served))) {
      bad(`${p.position}: publicRoleQuestions leaked key material`);
    }

    const perfect = {};
    const wrong = {};
    for (const sq of served) {
      const src = p.questions.find((q) => q.n === sq.n);
      const idx = sq.options.indexOf(src.options[src.answer]);
      if (idx < 0) { bad(`${p.position} Q${sq.n}: correct option missing from served options`); continue; }
      perfect[String(sq.n)] = idx;
      wrong[String(sq.n)] = (idx + 1) % sq.options.length;
    }

    const full = scoreRoleAnswers(p, toCanonicalRoleAnswers(p, perfect, presented));
    if (full.total !== p.questions.length) bad(`${p.position}: perfect paper scored ${full.total}/${p.questions.length}`);
    if (full.answered !== p.questions.length) bad(`${p.position}: answered count is ${full.answered}`);
    for (const s of p.sections) {
      if (full.sections[s.id] !== s.count) bad(`${p.position} section ${s.id}: perfect scored ${full.sections[s.id]}/${s.count}`);
    }

    const zero = scoreRoleAnswers(p, toCanonicalRoleAnswers(p, wrong, presented));
    if (zero.total !== 0) bad(`${p.position}: all-wrong paper scored ${zero.total}, expected 0`);

    if (trial === 0) {
      const review = buildRoleReview(p, toCanonicalRoleAnswers(p, perfect, presented), presented);
      if (review.length !== p.questions.length) bad(`${p.position}: review length is ${review.length}`);
      if (review.some((r) => !r.is_correct)) bad(`${p.position}: review disagrees with the marking`);
      const blank = buildRoleReview(p, {}, presented);
      if (blank.some((r) => r.chosen !== null || r.is_correct)) bad(`${p.position}: blank review marked as answered`);
    }
  }
}

// ── Position lookup ──────────────────────────────────────────────────────────
// The cedilla in "Façade" is the one that will actually be got wrong: §2.2 keeps
// it, an Android keyboard may not, and a paste from the Google Form may arrive
// NFD-decomposed. All three must reach the same paper.
const FACADE = "HAG-ROLE-FACADE-FACTORY-MANAGER-v1";
const lookups = [
  ["Façade Factory Manager", FACADE],
  ["Facade Factory Manager", FACADE],
  ["FAÇADE FACTORY MANAGER", FACADE],
  ["  façade  factory manager ", FACADE],
  // Built from a char code so it cannot be normalised back into the
  // precomposed form above by an editor or a git filter, which would
  // silently stop this case testing anything.
  ["Fac" + String.fromCharCode(0x327) + "ade Factory Manager", FACADE],
  ["Sales Executive", "HAG-ROLE-SALES-EXECUTIVE-v1"],
  ["sales-executive", "HAG-ROLE-SALES-EXECUTIVE-v1"],
];
for (const [input, expected] of lookups) {
  const got = paperForPosition(input)?.id;
  if (got !== expected) bad(`paperForPosition(${JSON.stringify(input)}) = ${got}, expected ${expected}`);
}
// An unknown position must be null so the server can 400 with a clear message —
// never a silent fallback to somebody else's paper.
for (const junk of ["", "PEB Design Engineer", "Sales", null, undefined]) {
  if (paperForPosition(junk) !== null) bad(`paperForPosition(${JSON.stringify(junk)}) should be null`);
}

if (ROLE_POSITION_LIST.length !== 15) bad(`position list has ${ROLE_POSITION_LIST.length} entries`);
if (/answer|explanation/.test(JSON.stringify(ROLE_POSITION_LIST))) bad("position list leaks key material");

// ── Bands ────────────────────────────────────────────────────────────────────
for (const [n, expected] of [[12,"STRONG"],[9,"STRONG"],[8,"AVERAGE"],[6,"AVERAGE"],[5,"WEAK"],[4,"WEAK"],[3,"BELOW_BAR"],[0,"BELOW_BAR"]]) {
  if (roleBandFor(n) !== expected) bad(`roleBandFor(${n}) = ${roleBandFor(n)}, expected ${expected}`);
}

if (failures) {
  console.log(`\n${failures} FAILURE${failures > 1 ? "S" : ""}`);
  process.exit(1);
}
console.log(
  `All checks passed — ${ROLE_PAPERS.length} papers x ${ROLE_TOTAL_QUESTIONS} questions, ` +
  `${SHUFFLES} shuffles each, marking verified by option text.`,
);
