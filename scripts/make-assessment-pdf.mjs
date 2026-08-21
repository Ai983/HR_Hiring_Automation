// ============================================================
// make-assessment-pdf — the evaluator answer-key PDF.
//
// Built straight from supabase/functions/_shared/assessment-bank.ts, the same
// module the edge function marks against, so the printed sheet can never drift
// from the live test. Question text, options, the correct answer, the section
// counts and the band table are all derived — nothing is hardcoded here.
// (A hardcoded band table silently kept the v3 numbers when the paper became
// v4. That is why everything is derived now.)
//
//   npm run assessment:pdf
//
// Needs a Chromium: `npx playwright-core install chromium` once. playwright-core
// is a devDependency and is not used by the app at runtime.
// ============================================================
import { chromium } from "playwright-core";
import path from "path";
import { fileURLToPath } from "url";

// Windows gives back backslashes; the file:// import URL below needs forward.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..").split(path.sep).join("/");
const bank = await import(
  "file:///" + path.posix.join(REPO, "supabase/functions/_shared/assessment-bank.ts")
);

const { QUESTIONS, SECTIONS, ASSESSMENT_ID, TOTAL_QUESTIONS, DURATION_MINUTES, bandFor } = bank;

// Derive the band table by walking every possible score through bandFor(),
// rather than hardcoding it. A hardcoded table silently kept v3's numbers when
// the paper became v4 — never again.
const BAND_ACTION = {
  STRONG:    "Shortlist — send to the technical panel first",
  AVERAGE:   "Proceed to interview normally",
  WEAK:      "Judge by role and experience",
  BELOW_BAR: "Interview only if experience is strong",
};
const bandRanges = [];
for (let sc = 0; sc <= TOTAL_QUESTIONS; sc++) {
  const b = bandFor(sc);
  const last = bandRanges[bandRanges.length - 1];
  if (last && last.band === b) last.hi = sc;
  else bandRanges.push({ band: b, lo: sc, hi: sc });
}
const bandRowsHtml = bandRanges
  .slice()
  .reverse()
  .map((r) => {
    const pct = Math.round((r.lo / TOTAL_QUESTIONS) * 100);
    return `<tr><td>${r.lo}–${r.hi}</td><td>${pct}%+</td><td><b>${r.band}</b></td>` +
           `<td>${BAND_ACTION[r.band] ?? ""}</td></tr>`;
  })
  .join("");
const LETTERS = ["A", "B", "C", "D"];
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ── Question blocks, grouped by section ────────────────────────────────────
let body = "";
for (const sec of SECTIONS) {
  const qs = QUESTIONS.filter((q) => q.section === sec.id);
  body += `<h2 class="sec">Section ${sec.id} — ${esc(sec.name)}
    <span class="secmeta">Q${qs[0].n}–Q${qs[qs.length - 1].n} · ${sec.count} marks</span></h2>`;
  for (const q of qs) {
    const opts = q.options
      .map((o, i) => {
        const right = i === q.answer;
        return `<div class="opt${right ? " right" : ""}">
          <span class="let">${LETTERS[i]}</span>
          <span class="otext">${esc(o)}</span>
          ${right ? '<span class="tick">✔</span>' : ""}
        </div>`;
      })
      .join("");
    body += `<div class="q">
      <div class="qhead"><span class="qn">Q${q.n}</span>
        <span class="qsec">${sec.id}</span></div>
      ${q.scenario ? `<div class="scen"><b>Situation.</b> ${esc(q.scenario)}</div>` : ""}
      <div class="qtext">${esc(q.q)}</div>
      <div class="opts">${opts}</div>
      <div class="why"><b>Answer: ${LETTERS[q.answer]}.</b> ${esc(q.explanation)}</div>
    </div>`;
  }
}

// ── Answer key quick reference ─────────────────────────────────────────────
const keyRows = QUESTIONS.map(
  (q) => `<tr><td>${q.n}</td><td>${q.section}</td><td class="ans">${LETTERS[q.answer]}</td></tr>`
);
const half = Math.ceil(keyRows.length / 2);
const keyTable = (rows) =>
  `<table class="key"><thead><tr><th>Q</th><th>Sec</th><th>Ans</th></tr></thead>
   <tbody>${rows.join("")}</tbody></table>`;

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 14mm 14mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color:#1a1612; font-size:10pt; line-height:1.45; margin:0; }

  .cover { text-align:center; padding-top:40mm; page-break-after:always; }
  .logo { width:64px;height:64px;border-radius:16px;margin:0 auto 14px;
          background:linear-gradient(135deg,#e8a24a,#c97a2a);
          display:flex;align-items:center;justify-content:center;
          font-size:30pt;font-weight:700;color:#1a1612; }
  .co { font-size:19pt; font-weight:700; letter-spacing:-0.2px; }
  .sub { color:#6b6157; margin-top:4px; font-size:11pt; }
  .title { font-size:23pt; font-weight:700; margin-top:26px; }
  .idline { font-family:Consolas,monospace; font-size:11pt; color:#8a7e72; margin-top:6px; }
  .facts { margin:22px auto 0; width:120mm; border:1px solid #e0d9cf; border-radius:8px;
           padding:12px 16px; text-align:left; font-size:10pt; }
  .facts div { display:flex; justify-content:space-between; padding:3px 0; }
  .facts span:first-child { color:#6b6157; }
  .warn { margin:26px auto 0; width:130mm; border:2px solid #b3261e; border-radius:8px;
          padding:14px 16px; background:#fdf3f2; text-align:left; }
  .warn h3 { margin:0 0 6px; color:#b3261e; font-size:12pt; }
  .warn p { margin:0 0 6px; font-size:9.5pt; line-height:1.5; }
  .warn p:last-child { margin-bottom:0; }

  h2.sec { font-size:12.5pt; margin:0 0 10px; padding:7px 10px; border-radius:6px;
           background:#1a1612; color:#fff; page-break-after:avoid; }
  h2.sec .secmeta { float:right; font-weight:400; font-size:9.5pt; color:#d8cfc2; }

  .q { border:1px solid #e0d9cf; border-radius:7px; padding:9px 11px; margin-bottom:9px;
       page-break-inside:avoid; }
  .qhead { margin-bottom:5px; }
  .qn { font-weight:700; font-size:11pt; }
  .qsec { float:right; font-size:8pt; color:#8a7e72; border:1px solid #e0d9cf;
          border-radius:9px; padding:1px 7px; }
  .scen { background:#faf8f5; border-left:3px solid #c97a2a; border-radius:4px;
          padding:6px 9px; margin-bottom:6px; font-size:9.5pt; color:#3f382f; }
  .qtext { font-weight:600; margin-bottom:6px; }
  .opt { display:flex; gap:7px; align-items:flex-start; padding:3.5px 7px;
         border-radius:5px; margin-bottom:3px; font-size:9.5pt; }
  .opt.right { background:#eaf6ec; border:1px solid #b7ddbf; font-weight:600; }
  .let { flex:0 0 15px; font-weight:700; color:#8a7e72; }
  .opt.right .let { color:#1e7a34; }
  .otext { flex:1; }
  .tick { color:#1e7a34; font-weight:700; }
  .why { margin-top:6px; padding-top:5px; border-top:1px dashed #e0d9cf;
         font-size:9pt; color:#4a423a; }
  .why b { color:#1e7a34; }

  .keywrap { page-break-before:always; }
  .keywrap h2 { font-size:14pt; margin:0 0 4px; }
  .keynote { color:#6b6157; font-size:9.5pt; margin:0 0 12px; }
  .keycols { display:flex; gap:10mm; }
  table.key { border-collapse:collapse; flex:1; font-size:9.5pt; }
  table.key th, table.key td { border:1px solid #e0d9cf; padding:3px 8px; text-align:center; }
  table.key th { background:#f2ede6; font-size:8.5pt; text-transform:uppercase;
                 letter-spacing:0.4px; color:#6b6157; }
  table.key td.ans { font-weight:700; }

  .bands { margin-top:16px; border-collapse:collapse; width:100%; font-size:9.5pt; }
  .bands th, .bands td { border:1px solid #e0d9cf; padding:5px 9px; text-align:left; }
  .bands th { background:#f2ede6; font-size:8.5pt; text-transform:uppercase;
              letter-spacing:0.4px; color:#6b6157; }
  .foot { margin-top:14px; font-size:8.5pt; color:#8a7e72; line-height:1.5;
          border-top:1px solid #e0d9cf; padding-top:8px; }
</style></head><body>

<div class="cover">
  <div class="logo">H</div>
  <div class="co">Hagerstone International Pvt. Ltd.</div>
  <div class="sub">Mass Interview Drive · Saturday, 22 August 2026</div>
  <div class="title">First-Level Assessment</div>
  <div class="idline">${ASSESSMENT_ID}</div>

  <div class="facts">
    <div><span>Questions</span><b>${TOTAL_QUESTIONS} (all multiple choice)</b></div>
    <div><span>Marks</span><b>${TOTAL_QUESTIONS} — 1 per question</b></div>
    <div><span>Duration</span><b>${DURATION_MINUTES} minutes</b></div>
    <div><span>Negative marking</span><b>None</b></div>
    <div><span>Sections</span><b>${SECTIONS.map((s) => `${s.id} (${s.count})`).join(" · ")}</b></div>
    <div><span>Taken at</span><b>hr-hiring-automation.vercel.app/test.html</b></div>
  </div>

  <div class="warn">
    <h3>⚠ EVALUATOR COPY — CONTAINS THE ANSWER KEY</h3>
    <p><b>Never issue this document to a candidate.</b> It marks the correct
    option for every question. One copy leaked in the hall invalidates the
    day's results.</p>
    <p><b>Option order is shuffled per candidate</b> on the online test. The
    A/B/C/D letters here are the canonical order and will <i>not</i> match what
    any individual candidate saw on their phone — match by the option text, not
    the letter.</p>
    <p><b>The paper is not AI-proof.</b> A language model answers these
    situational questions very well. Invigilation — phones collected at the
    desk — is the control.</p>
  </div>
</div>

${body}

<div class="keywrap">
  <h2>Answer key — quick reference</h2>
  <p class="keynote">Canonical option order. The online test shuffles options per
  candidate, so verify by option text when checking a printed sheet.</p>
  <div class="keycols">
    ${keyTable(keyRows.slice(0, half))}
    ${keyTable(keyRows.slice(half))}
  </div>

  <table class="bands">
    <thead><tr><th>Score</th><th>%</th><th>Band</th><th>Action</th></tr></thead>
    <tbody>${bandRowsHtml}</tbody>
  </table>

  <div class="foot">
    <b>This score is a queue-prioritisation tool, not a hiring gate.</b> It decides who the
    panel sees first on a busy day. A low score must never auto-reject a candidate with
    strong relevant experience — an experienced site supervisor may score low and still be
    the right hire. See §6.3 of HAGERSTONE_DRIVE_AND_ASSESSMENT.md.<br><br>
    Generated from <code>supabase/functions/_shared/assessment-bank.ts</code>, the same
    module the server marks against. If the paper changes, regenerate this file — do not
    edit it by hand.
  </div>
</div>

</body></html>`;

const out = path.join(REPO, "Hagerstone_Walkin_Assessment_v5_15Q_ANSWER_KEY.pdf");
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.pdf({
  path: out,
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: `<div style="font-size:7pt;color:#b3261e;width:100%;padding:0 14mm;text-align:right;">
      EVALUATOR COPY — CONTAINS ANSWER KEY — DO NOT ISSUE TO CANDIDATES</div>`,
  footerTemplate: `<div style="font-size:7pt;color:#8a7e72;width:100%;padding:0 14mm;display:flex;justify-content:space-between;">
      <span>${ASSESSMENT_ID} · Hagerstone International Pvt. Ltd.</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
  margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
});
await browser.close();
console.log("written:", out);
