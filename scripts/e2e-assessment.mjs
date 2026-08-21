// ============================================================
// e2e-assessment — drive BOTH candidate papers in a real browser, at the
// screen sizes they will actually be sat on.
//
//   npm run assessment:e2e            # against production
//   npm run assessment:e2e -- http://localhost:5173
//
// The API verifier (verify-live-assessment.mjs) proves the server marks
// correctly. It says nothing about whether a candidate on a ₹7,000 Android can
// actually reach the options, read the question, or find Submit — and §7.2 is
// explicit that EVERY candidate sits this on a phone. So this drives the real
// pages: types the email and name, answers every question by tapping, opens the
// review sheet, submits, and reads the score off the result screen.
//
// What it asserts, per viewport:
//   * no horizontal scroll anywhere in the flow (the classic phone failure)
//   * every option is inside the viewport and not hidden behind the fixed bar
//   * tap targets are at least 40px tall
//   * the timer, the question and the options are all visible without zooming
//   * the score shown to the candidate is the score the server computed
//   * the band is NOT shown to the candidate (§6.3)
//   * a second start on the same email is blocked (§7.2)
//
// It writes real attempts, all on @example.com, and deletes nothing — run
// the cleanup SQL in CLAUDE.md afterwards, or let verify-live do it.
// ============================================================

import { chromium } from "playwright-core";
import { readFile, mkdir } from "node:fs/promises";
import { transform } from "esbuild";

const BASE = (process.argv[2] || "https://hr-hiring-automation.vercel.app").replace(/\/$/, "");
const SHOTS = "scratchpad-e2e";

const loadTs = async (p) => {
  const src = await readFile(p, "utf8");
  const { code } = await transform(src, { loader: "ts", format: "esm" });
  return import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
};
const L1BANK = await loadTs("supabase/functions/_shared/assessment-bank.ts");
const ROLEBANK = await loadTs("supabase/functions/_shared/role-assessment-bank.ts");

// The phones that actually turn up. 320 is the narrowest still in use; 360 is
// the median Android; 412 is a large Android; the last is landscape, which
// people hit by accident and which squeezes the fixed bottom bar hardest.
const VIEWPORTS = [
  { name: "320x568 (small Android)",  width: 320, height: 568 },
  { name: "360x640 (median Android)", width: 360, height: 640 },
  { name: "412x915 (large Android)",  width: 412, height: 915 },
  { name: "390x844 (iPhone 14)",      width: 390, height: 844 },
  { name: "640x360 (landscape)",      width: 640, height: 360 },
];

let failures = 0;
const bad = (m) => { console.log("      ✗ " + m); failures++; };
const ok  = (m) => console.log("      ✓ " + m);

const stamp = Date.now();

/** No page should ever scroll sideways on a phone. */
async function assertNoHScroll(page, where) {
  const r = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
  if (r.scrollW > r.clientW + 1) {
    bad(`${where}: horizontal scroll (content ${r.scrollW}px in ${r.clientW}px viewport)`);
    return false;
  }
  return true;
}

/**
 * Every option must be genuinely tappable.
 *
 * A candidate scrolls, so an option below the fold is NOT a bug — the bug is an
 * option that stays unreachable AFTER scrolling to it, which is what happens
 * when a fixed bottom bar sits over the end of the page and the content has no
 * padding to clear it. So: scroll it into view the way a thumb would, then ask
 * the browser what is actually at that point.
 */
async function assertOptionsUsable(page, where) {
  const opts = await page.locator(".as-option").all();
  if (!opts.length) { bad(`${where}: no options rendered`); return; }
  const vw = (await page.viewportSize()).width;
  for (let i = 0; i < opts.length; i++) {
    await opts[i].scrollIntoViewIfNeeded();
    const box = await opts[i].boundingBox();
    if (!box) { bad(`${where}: option ${i + 1} has no box`); continue; }
    if (box.height < 40) bad(`${where}: option ${i + 1} is only ${Math.round(box.height)}px tall (min 40)`);
    if (box.x < -1 || box.x + box.width > vw + 1) bad(`${where}: option ${i + 1} overflows horizontally`);
    // Playwright's own actionability check: scrolls, waits for stability, and
    // hit-tests the point it would actually dispatch the tap at. This is the
    // authoritative answer to "can a thumb press this?" — it is what a real
    // click does, minus the click.
    try {
      await opts[i].click({ trial: true, timeout: 3000 });
    } catch (e) {
      bad(`${where}: option ${i + 1} cannot receive a tap: ${String(e).split(String.fromCharCode(10))[0].slice(0, 90)}`);
    }
  }
}

async function runPaper(browser, vp, kind) {
  const label = kind === "ROLE" ? "Level 2" : "Level 1";
  const position = kind === "ROLE" ? "Site Engineer" : null;
  const paper = kind === "ROLE"
    ? ROLEBANK.ROLE_PAPERS.find((p) => p.position === position)
    : { questions: L1BANK.QUESTIONS };
  const url = kind === "ROLE" ? `${BASE}/test2.html` : `${BASE}/test.html`;
  const email = `e2e-${kind.toLowerCase()}-${vp.width}-${stamp}@example.com`;

  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 11; Redmi 9A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

  console.log(`   ${label} @ ${vp.name}`);
  await page.goto(url, { waitUntil: "networkidle" });

  // ── Start screen ──────────────────────────────────────────────────────────
  await page.waitForSelector("#as-email", { timeout: 20000 });
  await assertNoHScroll(page, "start screen");

  const briefed = await page.locator(".as-rules").innerText();
  const wantMins = kind === "ROLE" ? ROLEBANK.ROLE_DURATION_MINUTES : L1BANK.DURATION_MINUTES;
  const wantQs = paper.questions.length;
  if (!briefed.includes(`${wantMins} minutes`)) bad(`start screen does not brief ${wantMins} minutes`);
  if (!briefed.includes(`${wantQs} questions`)) bad(`start screen does not brief ${wantQs} questions`);

  await page.fill("#as-email", email);
  await page.fill("#as-name", `E2E ${label} ${vp.width}`);

  if (kind === "ROLE") {
    const sel = page.locator("#as-position");
    if (!(await sel.count())) { bad("level 2 start screen has no position dropdown"); }
    const options = await sel.locator("option").allInnerTexts();
    const missing = ROLEBANK.ROLE_PAPERS.map((p) => p.position).filter((p) => !options.includes(p));
    if (missing.length) bad(`position dropdown missing: ${missing.join(", ")}`);
    else ok(`position dropdown lists all ${ROLEBANK.ROLE_PAPERS.length} positions`);
    await sel.selectOption(position);
  }

  await page.screenshot({ path: `${SHOTS}/${kind}-${vp.width}-1-start.png` });
  await page.click(".as-btn-primary");

  // ── Test screen ───────────────────────────────────────────────────────────
  await page.waitForSelector(".as-option", { timeout: 25000 });
  await assertNoHScroll(page, "question 1");
  await assertOptionsUsable(page, "question 1");

  const timer = await page.locator(".as-timer").innerText();
  if (!/^\d{2}:\d{2}$/.test(timer)) bad(`timer shows "${timer}", expected MM:SS`);
  const startMins = Number(timer.split(":")[0]);
  if (startMins !== wantMins - 1 && startMins !== wantMins) {
    bad(`timer starts at ${timer}, expected about ${wantMins}:00`);
  } else ok(`timer starts at ${timer}`);

  await page.screenshot({ path: `${SHOTS}/${kind}-${vp.width}-2-question.png` });

  // Answer every question correctly, by option TEXT — the same thing the API
  // verifier does, but through the real UI, so the shuffle is exercised end to end.
  let expected = 0;
  for (let i = 0; i < wantQs; i++) {
    await page.waitForSelector(".as-option");
    const qNum = Number((await page.locator(".as-qcount").innerText()).match(/\d+/)[0]);
    const src = paper.questions.find((q) => q.n === qNum);
    if (!src) { bad(`question ${qNum} is not in the bank`); break; }

    const shown = await page.locator(".as-qtext").innerText();
    if (shown.trim() !== src.q.trim()) bad(`Q${qNum}: on-screen text differs from the bank`);

    if (i === 0 || i === wantQs - 1) {
      await assertNoHScroll(page, `question ${qNum}`);
      await assertOptionsUsable(page, `question ${qNum}`);
    }

    const texts = await page.locator(".as-option-text").allInnerTexts();
    const idx = texts.findIndex((t) => t.trim() === src.options[src.answer].trim());
    if (idx < 0) { bad(`Q${qNum}: correct option not on screen`); continue; }
    await page.locator(".as-option").nth(idx).click();
    expected++;

    const isLast = i === wantQs - 1;
    await page.click(isLast ? ".as-navbar .as-btn-primary" : ".as-navbar .as-btn-primary");
    if (!isLast) await page.waitForTimeout(120);
  }

  // ── Review sheet ──────────────────────────────────────────────────────────
  await page.waitForSelector(".as-palette", { timeout: 10000 });
  await assertNoHScroll(page, "review sheet");
  const palette = await page.locator(".as-palette-title").innerText();
  if (!palette.includes(`${wantQs} of ${wantQs}`) && !palette.includes(`${wantQs} answered`)) {
    if (!palette.includes(String(wantQs))) bad(`review sheet says "${palette}"`);
  }
  // Submit must be reachable without the sheet scrolling off screen.
  // The sheet itself scrolls (max-height:88dvh; overflow-y:auto), so "below the
  // fold" is fine — unreachable after scrolling inside the sheet is not.
  const submitBtn = page.locator(".as-palette .as-btn-primary").first();
  await submitBtn.scrollIntoViewIfNeeded();
  const sb = await submitBtn.boundingBox();
  if (!sb) bad("review sheet: Submit button has no box");
  else if (sb.y < 0 || sb.y + sb.height > vp.height + 1) {
    bad(`review sheet: Submit still off screen after scrolling (y=${Math.round(sb.y)}, viewport ${vp.height})`);
  } else if (sb.height < 40) bad(`review sheet: Submit is only ${Math.round(sb.height)}px tall`);
  else ok(`Submit reachable in the review sheet (${Math.round(sb.height)}px tall)`);
  await page.screenshot({ path: `${SHOTS}/${kind}-${vp.width}-3-review.png` });

  await submitBtn.click();                       // "Submit Test" → confirm step
  await page.waitForTimeout(200);
  const confirm = page.locator(".as-palette .as-btn-primary").first();
  if (await confirm.count()) await confirm.click();

  // ── Result screen ─────────────────────────────────────────────────────────
  await page.waitForSelector(".as-score-value", { timeout: 25000 });
  await assertNoHScroll(page, "result screen");
  const score = Number(await page.locator(".as-score-value").innerText());
  const outOf = await page.locator(".as-score-of").innerText();
  if (score !== expected) bad(`result shows ${score}, expected ${expected}`);
  else ok(`scored ${score}/${wantQs} through the UI`);
  if (!outOf.includes(String(wantQs))) bad(`result shows "${outOf}", expected out of ${wantQs}`);

  // §6.3 — the candidate must never see the band.
  const resultText = await page.locator(".as-card").innerText();
  if (/STRONG|AVERAGE|WEAK|BELOW.?BAR/i.test(resultText)) bad("RESULT SCREEN LEAKS THE BAND to the candidate");
  else ok("band not shown to the candidate");
  // ...nor the correct answers.
  if (/correct answer|explanation/i.test(resultText)) bad("result screen leaks answers");

  const sectionRows = await page.locator(".as-section-row").count();
  const wantSections = kind === "ROLE" ? paper.sections.length : L1BANK.SECTIONS.length;
  if (sectionRows !== wantSections) bad(`result shows ${sectionRows} section rows, expected ${wantSections}`);
  else ok(`${sectionRows} section scores shown`);

  await page.screenshot({ path: `${SHOTS}/${kind}-${vp.width}-4-result.png` });

  // ── One attempt only (§7.2) ───────────────────────────────────────────────
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("#as-email");
  await page.fill("#as-email", email);
  await page.fill("#as-name", `E2E ${label} ${vp.width}`);
  if (kind === "ROLE") await page.locator("#as-position").selectOption(position);
  await page.click(".as-btn-primary");
  // Wait for a definite outcome rather than a fixed sleep: either the blocked
  // card, the paper (which would be the bug), or an error the desk would see.
  try {
    await page.waitForFunction(() => {
      const t = document.body.innerText || "";
      return /already taken this test/i.test(t) || document.querySelector(".as-option") || /as-error/.test(document.body.innerHTML);
    }, { timeout: 20000 });
  } catch { /* fall through to the assertion below */ }
  const blockedText = await page.locator(".as-shell").innerText();
  if (/already taken this test/i.test(blockedText)) ok("second attempt blocked");
  else if (await page.locator(".as-option").count()) bad("a second attempt was ALLOWED — the one-attempt block failed");
  else bad(`second attempt: neither blocked nor started — "${blockedText.replace(/\s+/g, " ").slice(0, 110)}"`);
  await page.screenshot({ path: `${SHOTS}/${kind}-${vp.width}-5-blocked.png` });

  if (consoleErrors.length) {
    bad(`${consoleErrors.length} console error(s): ${consoleErrors[0].slice(0, 160)}`);
  } else ok("no console errors");

  await ctx.close();
  return { email, score, expected };
}

await mkdir(SHOTS, { recursive: true });
console.log(`E2E against ${BASE}\n`);
const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  console.log(`\n── ${vp.name} ──────────────────────────────`);
  await runPaper(browser, vp, "L1");
  await runPaper(browser, vp, "ROLE");
}

await browser.close();

console.log(
  failures
    ? `\n${failures} PROBLEM${failures > 1 ? "S" : ""} FOUND.`
    : `\nAll viewports passed: both papers sat end to end on ${VIEWPORTS.length} phone sizes, scored correctly, no horizontal scroll, no leaks.`,
);
console.log(`Screenshots in ${SHOTS}/`);
process.exit(failures ? 1 : 0);
