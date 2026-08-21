// ============================================================
// assessment-bank — the walk-in assessment paper and its answer key.
//
// SERVER ONLY. This module holds the correct answers. It is imported by the
// `assessment` edge function and must never be bundled into anything the
// browser downloads. Everything the candidate page receives goes through
// publicQuestions(), which strips `answer` and `explanation`.
//
// HAG-WALKIN-L1-v4 — 20 questions, 20 marks, 25 minutes.
//
// WHAT CHANGED FROM v3, AND THE TRADE-OFF
// v3 was 25 questions and deliberately hard: long scenarios, and distractors
// that were plausible-but-subtly-wrong so that only someone who had actually
// run a site could tell them apart. It was judged too tough for a walk-in
// queue, so v4 keeps the situational format and drops the difficulty:
//
//   * scenarios are one or two plain sentences, not a paragraph;
//   * the wrong options are clearly wrong — do nothing, hide it, cut the
//     corner, blame someone — rather than defensible alternatives;
//   * no specialist thresholds (the ±3mm anchor bolt tolerance, LD caps,
//     debit notes, weep holes are all gone);
//   * the numbers in Section D are round and single-step.
//
// **This costs discrimination.** An easier paper clusters scores near the top,
// and a score everybody gets 17+ on cannot decide who the panel sees first —
// which is the only thing this score is for (§6.3). If the spread on the day is
// too tight, the fix is to RE-CUT THE BANDS in bandFor() against real attempt
// data, not to make the questions hard again mid-drive. Bands can change
// without changing the paper; questions cannot (§7.4).
//
// ON AI: none of this makes the paper AI-proof — easier questions are, if
// anything, easier for a model. Invigilation, phones collected at the desk, is
// the control. Question design is not.
//
// Per §7.5 there is still NO role-specific technical content: all 13 positions
// sit the same paper, and every answer turns on judgement or basic procedure
// rather than trade knowledge.
//
// Per §7.4 the paper is versioned, never edited in place once it has been sat.
// ============================================================

export const ASSESSMENT_ID = "HAG-WALKIN-L1-v4";
export const TOTAL_QUESTIONS = 20;
export const DURATION_MINUTES = 25;
// A slow phone on venue Wi-Fi must not cost a candidate their paper.
export const GRACE_SECONDS = 60;

export type SectionId = "A" | "B" | "C" | "D" | "E";

export interface Question {
  n: number;
  section: SectionId;
  /** The situation, shown above the question. */
  scenario?: string;
  q: string;
  options: string[];
  /** Index into `options`. NEVER sent to the browser. */
  answer: number;
  explanation: string;
}

export const SECTIONS: { id: SectionId; name: string; count: number }[] = [
  { id: "A", name: "Site Execution & Sequencing", count: 4 },
  { id: "B", name: "Client & Stakeholder Handling", count: 5 },
  { id: "C", name: "Procedure & Documentation", count: 5 },
  { id: "D", name: "Commercial Judgement", count: 3 },
  { id: "E", name: "Safety & Problem Diagnosis", count: 3 },
];

export const QUESTIONS: Question[] = [
  // ══ Section A · Site Execution & Sequencing (4) ══════════════════════════
  {
    n: 1, section: "A",
    scenario:
      "The plastering team arrives to start work in a room, but the electrical conduits in that room have not been laid yet.",
    q: "What should be done?",
    options: [
      "Start plastering; the electrical team can break the wall later",
      "Send the plastering team home for the day",
      "Wait for the conduits to be laid, and move the plastering team to another room in the meantime",
      "Plaster only half the room",
    ],
    answer: 2,
    explanation:
      "Electrical goes in before plaster. Breaking a finished wall afterwards means doing the same work twice. Moving the team to another room keeps the day productive.",
  },
  {
    n: 2, section: "A",
    q: "What is the correct order of these activities on a site?",
    options: [
      "Painting → Plastering → Brickwork → Flooring",
      "Brickwork → Plastering → Flooring → Painting",
      "Flooring → Brickwork → Painting → Plastering",
      "Plastering → Brickwork → Painting → Flooring",
    ],
    answer: 1,
    explanation: "Structure first, finishes last: brickwork, then plaster, then floor, then paint.",
  },
  {
    n: 3, section: "A",
    scenario:
      "Handover is tomorrow. Two things are pending: 3 power points are not working, and 40 small paint touch-ups are left.",
    q: "What should be finished first?",
    options: [
      "The 40 paint touch-ups, because there are more of them",
      "The 3 power points, because the client cannot use the office without them",
      "Neither — hand over and finish everything next week",
      "Do a little of both and leave the rest",
    ],
    answer: 1,
    explanation:
      "Finish what stops the client using the space before what they can only see. Paint touch-ups can be closed after they move in; dead power points cannot.",
  },
  {
    n: 4, section: "A",
    scenario:
      "Your painters have nothing to do because the area they were supposed to paint is not ready yet.",
    q: "What is the best thing to do?",
    options: [
      "Let them sit idle until the area is ready",
      "Send them home for the day",
      "Start painting the area anyway and correct it later",
      "Move them to an area that is ready, and inform your senior about the delay",
    ],
    answer: 3,
    explanation:
      "Keep the labour working, and make sure your senior knows why the original area was held up — a delay nobody was told about becomes your delay.",
  },

  // ══ Section B · Client & Stakeholder Handling (5) ════════════════════════
  {
    n: 5, section: "B",
    scenario:
      "During a site visit the client verbally asks you to shift a partition and add two extra sockets. Nothing is given in writing.",
    q: "What should you do?",
    options: [
      "Do the work immediately to keep the client happy",
      "Confirm the change by email or message, get the client's approval in writing, and then start",
      "Refuse and tell the client it is not your job",
      "Do the work and quietly add the cost to the bill later",
    ],
    answer: 1,
    explanation:
      "A verbal change with nothing in writing is the most common reason extra work never gets paid for. Confirming it takes five minutes and protects both sides.",
  },
  {
    n: 6, section: "B",
    scenario:
      "You come to know that an important material will reach the site three weeks late.",
    q: "When should you inform the client?",
    options: [
      "Immediately, along with the reason and what you are doing about it",
      "At the next monthly meeting",
      "Only after you have arranged a replacement",
      "Only if the client asks about it",
    ],
    answer: 0,
    explanation:
      "Bad news does not get better by waiting. The client may have their own plans depending on that date, and the earlier they know, the more options everyone has.",
  },
  {
    n: 7, section: "B",
    scenario:
      "You notice a finishing defect that the client has not seen yet. There is enough time to correct it before handover.",
    q: "What should you do?",
    options: [
      "Say nothing and hope the client does not notice",
      "Cover it up as best you can",
      "Inform the client and correct it before handover",
      "Wait and see if the client points it out",
    ],
    answer: 2,
    explanation:
      "A defect you report and fix shows you are on top of the job. The same defect found by the client after handover damages trust in everything else you have done.",
  },
  {
    n: 8, section: "B",
    scenario:
      "A client is angry on a call about a delay and is raising their voice.",
    q: "What is the best way to handle it?",
    options: [
      "Argue back and explain that it is not your fault",
      "Listen without interrupting, apologise for the inconvenience, explain the reason, and give a clear new date",
      "Blame the vendor and the other contractors",
      "End the call and let your senior deal with it",
    ],
    answer: 1,
    explanation:
      "Let the client finish, acknowledge the problem, then give them something concrete — a reason and a date. Arguing or blaming others makes the call longer and the client angrier.",
  },
  {
    n: 9, section: "B",
    scenario:
      "The client asks you to do some extra work that is not part of the agreed scope and has not been approved.",
    q: "What should you do?",
    options: [
      "Start the work straight away",
      "Tell the client flatly that it is not possible",
      "Politely tell the client it needs approval, and get it confirmed through your manager",
      "Agree to it and then forget about it",
    ],
    answer: 2,
    explanation:
      "Never refuse a client outright, and never start unapproved work on your own. Take it through your manager so it is approved properly and the client still feels heard.",
  },

  // ══ Section C · Procedure & Documentation (5) ════════════════════════════
  {
    n: 10, section: "C",
    scenario:
      "A person you do not know comes to the site and tells your team to change the work that is going on.",
    q: "What should you do?",
    options: [
      "Follow the instruction immediately",
      "Do not change anything; check with your manager first about who this person is",
      "Ignore him completely and say nothing to anyone",
      "Let the contractor decide whether to follow it",
    ],
    answer: 1,
    explanation:
      "Only an authorised person can change the work. Check first — but do tell your manager, rather than simply ignoring it.",
  },
  {
    n: 11, section: "C",
    scenario:
      "Material arrives at site. When you count it, the quantity is less than what is written on the challan.",
    q: "What should you do?",
    options: [
      "Sign the challan as it is to avoid an argument",
      "Unload it and sort the paperwork out later",
      "Send the entire truck back",
      "Write down the actual quantity received, get it signed, and inform the purchase team the same day",
    ],
    answer: 3,
    explanation:
      "Signing for material you did not receive means the company pays for it. Recording the real quantity on the spot is what makes the shortage recoverable.",
  },
  {
    n: 12, section: "C",
    scenario:
      "A plank falls from a height at the site. Nobody is injured.",
    q: "What should you do?",
    options: [
      "Nothing — no one was hurt",
      "Stop work in that area, make it safe, and report it immediately",
      "Mention it in the next weekly meeting",
      "Just note it down and continue working",
    ],
    answer: 1,
    explanation:
      "An accident where nobody was hurt is a warning. Reporting it is how the same thing is prevented from happening again with somebody standing underneath.",
  },
  {
    n: 13, section: "C",
    scenario:
      "You find that a newer version of the drawing has been issued, but the team is still working from the old one.",
    q: "What should you do?",
    options: [
      "Continue with the old drawing since work has already started",
      "Switch to the new drawing without telling anyone",
      "Stop work in that area, confirm with your manager which drawing is correct, and remove the old copies from site",
      "Let each contractor decide which drawing to follow",
    ],
    answer: 2,
    explanation:
      "Confirm which drawing is valid before anything more is built, and take the old copies away — otherwise somebody picks one up tomorrow and builds from it again.",
  },
  {
    n: 14, section: "C",
    scenario: "The project is complete and the client is taking handover.",
    q: "Apart from the keys, what should be handed over?",
    options: [
      "Only the keys — the rest can be sent later",
      "Only the warranty papers",
      "Drawings, warranties, operation manuals and the signed handover document",
      "Nothing else is required",
    ],
    answer: 2,
    explanation:
      "The client needs the documents to run and maintain the space, and the signed handover is what formally closes the job.",
  },

  // ══ Section D · Commercial Judgement (3) ═════════════════════════════════
  {
    n: 15, section: "D",
    scenario:
      "The client asks for an extra 100 sq m of flooring. The agreed rate is ₹1,200 per sq m.",
    q: "What is the value of the extra work, and what should you do?",
    options: [
      "₹1,20,000 — bill it as extra work after taking the client's written approval",
      "₹1,20,000 — do it free of cost, it is a small quantity",
      "₹12,000 — bill it as extra work",
      "Do the work and add the cost quietly to the next bill",
    ],
    answer: 0,
    explanation: "100 × ₹1,200 = ₹1,20,000. Extra work is chargeable, but only if the client approves it in writing first.",
  },
  {
    n: 16, section: "D",
    scenario:
      "You need 200 units of a material. Vendor A quotes ₹500 per unit and Vendor B quotes ₹450 per unit. Quality and delivery time are the same.",
    q: "Which should you choose?",
    options: [
      "Vendor A",
      "Vendor B — it saves ₹10,000",
      "Vendor B — it saves ₹1,000",
      "Split the order between both vendors",
    ],
    answer: 1,
    explanation: "The difference is ₹50 per unit. 200 × ₹50 = ₹10,000 saved, for the same quality and the same delivery.",
  },
  {
    n: 17, section: "D",
    scenario:
      "500 bags of cement were issued to site. 470 bags were used in the work. 10 bags are lying in stock.",
    q: "What does this show, and what should you do?",
    options: [
      "Nothing is wrong — the account is complete",
      "10 bags are missing — write them off",
      "20 bags are not accounted for — inform your senior and check the records",
      "20 bags are extra — reduce the next order",
    ],
    answer: 2,
    explanation:
      "500 − 470 − 10 = 20 bags unaccounted for. It may turn out to be wastage or a recording error, but it has to be checked and reported, not ignored.",
  },

  // ══ Section E · Safety & Problem Diagnosis (3) ═══════════════════════════
  {
    n: 18, section: "E",
    scenario:
      "You see a worker on a ladder about 3 metres above the ground. He is not wearing a helmet and has no safety belt.",
    q: "What should you do first?",
    options: [
      "Continue with your own work and mention it later",
      "Stop the work immediately and arrange a helmet and safety belt before he continues",
      "Take a photo and send it to the group",
      "Tell him to finish quickly and come down",
    ],
    answer: 1,
    explanation: "A fall cannot be undone. Stop the unsafe work first; everything else comes after the person is safe.",
  },
  {
    n: 19, section: "E",
    scenario:
      "A worker from another agency is doing unsafe work right next to your team.",
    q: "What should you do?",
    options: [
      "Nothing — he is not your worker",
      "Only tell your own team to stay away from him",
      "Stop the unsafe work and inform the safety in-charge and your senior",
      "Wait and raise it in the next safety meeting",
    ],
    answer: 2,
    explanation:
      "It does not matter whose worker he is. The danger is next to your people, so stopping it and reporting it is your responsibility.",
  },
  {
    n: 20, section: "E",
    scenario:
      "The same false ceiling problem has happened three times in the same building. It has been repaired each time and has now happened again.",
    q: "What is the best action?",
    options: [
      "Repair it once more and watch it",
      "Replace all the false ceilings in the building",
      "Find out the reason why it keeps happening and fix that",
      "Blame the ceiling contractor and recover the cost",
    ],
    answer: 2,
    explanation:
      "The same failure happening again and again means there is one underlying cause. Repairing it a fourth time without finding that cause guarantees a fifth.",
  },
];

// ── Scoring bands ────────────────────────────────────────────────────────────
// The same percentage cuts used since v1, rescaled to 20 marks:
//   17–20 (85%+) STRONG · 12–16 (60%+) AVERAGE · 8–11 (40%+) WEAK · 0–7 BELOW_BAR
//
// ⚠ v4 is an EASIER paper than v3, so expect scores to bunch towards the top.
// If the spread on the day is too tight to sort the queue with, re-cut these
// numbers against real attempt data — bands can change freely, questions cannot
// once they have been sat (§7.4).
//
// §6.3: this band is a QUEUE-PRIORITISATION signal, not a hiring gate. Nothing
// downstream may auto-reject on it.
export type Band = "STRONG" | "AVERAGE" | "WEAK" | "BELOW_BAR";

export function bandFor(total: number): Band {
  if (total >= 17) return "STRONG";
  if (total >= 12) return "AVERAGE";
  if (total >= 8) return "WEAK";
  return "BELOW_BAR";
}

// ── Presentation order ───────────────────────────────────────────────────────
// Question order is FIXED (§7.3 — sections are meaningful and the printed paper
// must match). Option order is shuffled within each question, because in a
// walk-in hall candidates sit shoulder to shoulder.
//
// `Presented` maps question number → the canonical option indices in the order
// they were displayed. presented["1"] = [2,0,3,1] means the candidate's first
// option on screen was canonical option 2.
export type Presented = Record<string, number[]>;

export function buildPresented(): Presented {
  const out: Presented = {};
  for (const q of QUESTIONS) {
    const order = q.options.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    out[String(q.n)] = order;
  }
  return out;
}

/**
 * The paper as the candidate sees it: options in their shuffled order, and no
 * `answer` or `explanation` field anywhere in the returned object.
 */
export function publicQuestions(presented: Presented) {
  return QUESTIONS.map((q) => {
    const order = presented[String(q.n)] ?? q.options.map((_, i) => i);
    return {
      n: q.n,
      section: q.section,
      scenario: q.scenario ?? null,
      q: q.q,
      options: order.map((i) => q.options[i]),
    };
  });
}

// Display position → canonical option letter, e.g. 0 → "C".
const LETTERS = ["A", "B", "C", "D", "E", "F"];

/**
 * Turn the candidate's raw picks (question number → display position) into
 * canonical option letters, so the stored `answers` are readable in the admin
 * panel without having to resolve `presented` first.
 */
export function toCanonicalAnswers(
  raw: Record<string, unknown>,
  presented: Presented,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of QUESTIONS) {
    const key = String(q.n);
    const pos = Number(raw?.[key]);
    if (!Number.isInteger(pos)) continue; // unanswered
    const order = presented[key] ?? q.options.map((_, i) => i);
    const canonical = order[pos];
    if (canonical == null) continue;
    out[key] = LETTERS[canonical];
  }
  return out;
}

export interface ScoreResult {
  total: number;
  sections: Record<SectionId, number>;
  band: Band;
  answered: number;
}

/**
 * Mark the paper. No negative marking, unanswered = 0.
 * Takes canonical letters — run toCanonicalAnswers() first.
 */
export function scoreAnswers(canonical: Record<string, string>): ScoreResult {
  const sections: Record<SectionId, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  let total = 0;
  let answered = 0;

  for (const q of QUESTIONS) {
    const picked = canonical[String(q.n)];
    if (!picked) continue;
    answered++;
    if (LETTERS.indexOf(picked) === q.answer) {
      total++;
      sections[q.section]++;
    }
  }

  return { total, sections, band: bandFor(total), answered };
}

/**
 * The marked paper, for storage on the attempt row.
 *
 * This is what the HR panel renders. Building it here and persisting it means
 * the answer key never has to exist in a browser bundle — the admin app reads a
 * row, it does not re-mark anything. It also freezes the exact paper the
 * candidate sat, so an attempt stays reviewable even after v5 is minted.
 */
export function buildReview(canonical: Record<string, string>, presented: Presented) {
  return QUESTIONS.map((q) => {
    const picked = canonical[String(q.n)] ?? null;
    const pickedIdx = picked ? LETTERS.indexOf(picked) : -1;
    return {
      n: q.n,
      section: q.section,
      scenario: q.scenario ?? null,
      q: q.q,
      // The order this candidate actually saw, so the panel shows their paper.
      options: (presented[String(q.n)] ?? q.options.map((_, i) => i)).map((i) => q.options[i]),
      chosen: pickedIdx >= 0 ? q.options[pickedIdx] : null,
      chosen_letter: picked,
      correct: q.options[q.answer],
      correct_letter: LETTERS[q.answer],
      is_correct: pickedIdx === q.answer,
      explanation: q.explanation,
    };
  });
}
