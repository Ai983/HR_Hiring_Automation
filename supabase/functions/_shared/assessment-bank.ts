// ============================================================
// assessment-bank — the walk-in assessment paper and its answer key.
//
// SERVER ONLY. This module holds the correct answers. It is imported by the
// `assessment` edge function and must never be bundled into anything the
// browser downloads. Everything the candidate page receives goes through
// publicQuestions(), which strips `answer` and `explanation`.
//
// HAG-WALKIN-L1-v2 — 20 questions, 20 marks, 25 minutes.
// v1 was the printed 13-question paper in HAGERSTONE_DRIVE_AND_ASSESSMENT.md §5.
// Its 13 questions are carried over verbatim; 7 are new (B9, B10, C16, D17–D20).
// Per §7.3 the paper is versioned, never edited in place — a changed question
// mints v3, because scores from different versions are not comparable.
//
// Per §7.4 there is deliberately NO role-specific technical content: all 13
// positions sit the same paper. The Section D cases test judgement in the
// general site/office register, not trade knowledge.
// ============================================================

export const ASSESSMENT_ID = "HAG-WALKIN-L1-v2";
export const TOTAL_QUESTIONS = 20;
export const DURATION_MINUTES = 25;
// A slow phone on venue Wi-Fi must not cost a candidate their paper.
export const GRACE_SECONDS = 60;

export type SectionId = "A" | "B" | "C" | "D";

export interface Question {
  n: number;
  section: SectionId;
  /** Case stem, shown above the question. Section D only. */
  scenario?: string;
  q: string;
  options: string[];
  /** Index into `options`. NEVER sent to the browser. */
  answer: number;
  explanation: string;
}

export const SECTIONS: { id: SectionId; name: string; count: number }[] = [
  { id: "A", name: "Numerical Aptitude", count: 5 },
  { id: "B", name: "Logical Reasoning", count: 5 },
  { id: "C", name: "General Industry Awareness", count: 6 },
  { id: "D", name: "Situational Judgement", count: 4 },
];

export const QUESTIONS: Question[] = [
  // ── Section A · Numerical Aptitude (5) — carried over from v1 Q1–Q5 ──
  {
    n: 1, section: "A",
    q: "A room measures 12 feet by 10 feet. What is the floor area?",
    options: ["100 sq ft", "110 sq ft", "120 sq ft", "140 sq ft"],
    answer: 2,
    explanation: "12 × 10 = 120 sq ft.",
  },
  {
    n: 2, section: "A",
    q: "Material cost is ₹80,000. Labour is 25% of the material cost. What is the total cost?",
    options: ["₹85,000", "₹95,000", "₹1,00,000", "₹1,05,000"],
    answer: 2,
    explanation: "Labour = 25% of 80,000 = 20,000. Total = ₹1,00,000.",
  },
  {
    n: 3, section: "A",
    q: "A wall is 10 m long and 3 m high. What area needs painting?",
    options: ["13 sq m", "30 sq m", "33 sq m", "60 sq m"],
    answer: 1,
    explanation: "Area = length × height = 10 × 3 = 30 sq m.",
  },
  {
    n: 4, section: "A",
    q: "An item costs ₹1,200. With 18% GST, what is the final amount?",
    options: ["₹1,368", "₹1,416", "₹1,440", "₹1,516"],
    answer: 1,
    explanation: "GST = 18% of 1,200 = 216. Total = ₹1,416.",
  },
  {
    n: 5, section: "A",
    q: "If 1 metre is approximately 3.28 feet, roughly how many feet are in 5 metres?",
    options: ["12.4 ft", "14.8 ft", "16.4 ft", "18.2 ft"],
    answer: 2,
    explanation: "5 × 3.28 = 16.4 feet.",
  },

  // ── Section B · Logical Reasoning (5) — v1 Q6–Q8 plus two new ──
  // §7.4 asked for exactly this: expand B from 3 to 5 in the same easy register,
  // because 3 questions is a weak signal a candidate can pass or fail on luck.
  {
    n: 6, section: "B",
    q: "Which one does NOT belong with the others?",
    options: ["Hammer", "Screwdriver", "Cement", "Pliers"],
    answer: 2,
    explanation: "Cement is a material. The other three are hand tools.",
  },
  {
    n: 7, section: "B",
    q: "Complete the series: 5, 10, 20, 40, ___",
    options: ["50", "60", "80", "100"],
    answer: 2,
    explanation: "Each number doubles. 40 × 2 = 80.",
  },
  {
    n: 8, section: "B",
    q: "Put these site activities in the correct order of execution:",
    options: [
      "Painting → Plastering → Brickwork → Flooring",
      "Brickwork → Plastering → Flooring → Painting",
      "Flooring → Brickwork → Painting → Plastering",
      "Plastering → Brickwork → Painting → Flooring",
    ],
    answer: 1,
    explanation: "Structure first, finishes last: Brickwork → Plastering → Flooring → Painting.",
  },
  {
    n: 9, section: "B",
    q: "5 workers can plaster a wall in 6 days. Working at the same rate, how long would 3 workers take?",
    options: ["8 days", "10 days", "12 days", "15 days"],
    answer: 1,
    explanation: "The job is 5 × 6 = 30 worker-days. 30 ÷ 3 = 10 days.",
  },
  {
    n: 10, section: "B",
    q: "A supervisor says: \"If the material arrives on Monday, work will start on Tuesday.\" The material arrived on Wednesday. Which statement is definitely true?",
    options: [
      "Work started on Tuesday",
      "Work did not start on Tuesday",
      "Work will never start",
      "It cannot be determined from the statement",
    ],
    answer: 3,
    explanation:
      "The statement only says what happens if the material arrives on Monday. It says nothing about what happens if it arrives later, so nothing can be concluded.",
  },

  // ── Section C · General Industry Awareness (6) — v1 Q9–Q13 plus one new ──
  {
    n: 11, section: "C",
    q: "In construction, what does BOQ stand for?",
    options: ["Board of Quality", "Bill of Quantities", "Basic Order Quotation", "Builder's Operating Quote"],
    answer: 1,
    explanation: "BOQ = Bill of Quantities, the itemised list of materials and work with quantities.",
  },
  {
    n: 12, section: "C",
    q: "What does MEP refer to in a building project?",
    options: [
      "Material, Equipment, Personnel",
      "Measurement, Estimation, Planning",
      "Mechanical, Electrical, Plumbing",
      "Manpower, Engineering, Procurement",
    ],
    answer: 2,
    explanation: "MEP = Mechanical, Electrical and Plumbing services.",
  },
  {
    n: 13, section: "C",
    q: "What does PPE stand for on a construction site?",
    options: [
      "Personal Protective Equipment",
      "Project Planning Estimate",
      "Primary Power Extension",
      "Public Property Entry",
    ],
    answer: 0,
    explanation: "PPE = Personal Protective Equipment — helmet, safety shoes, gloves, harness.",
  },
  {
    n: 14, section: "C",
    q: "What is the main purpose of a false ceiling in an office interior?",
    options: [
      "To increase the room height",
      "To conceal ducts, wiring and pipes",
      "To support the floor above",
      "To reduce the cost of flooring",
    ],
    answer: 1,
    explanation: "A false ceiling hides MEP services and improves the finish.",
  },
  {
    n: 15, section: "C",
    q: "Which drawing shows the top view or layout of a floor?",
    options: ["Elevation", "Section", "Floor plan", "Isometric"],
    answer: 2,
    explanation: "A floor plan is the top view showing the layout of rooms and spaces.",
  },
  {
    n: 16, section: "C",
    q: "At the end of a project, what does \"snagging\" mean?",
    options: [
      "Fixing the project budget before work begins",
      "Listing and rectifying small defects before handover",
      "Ordering extra material to keep as safety stock",
      "Cleaning the site at the end of each working day",
    ],
    answer: 1,
    explanation:
      "A snag list records the small defects found at completion — paint touch-ups, faulty fittings, misaligned joints — which are rectified before the client takes handover.",
  },

  // ── Section D · Situational Judgement (4) — the case questions ──
  // Role-neutral by design (§7.4). Each tests judgement every one of the 13
  // positions is expected to have, not trade knowledge.
  {
    n: 17, section: "D",
    scenario:
      "You reach a site in the morning and see a labourer working on a ladder about 3 metres above the ground. He is not wearing a helmet and has no safety harness. The site supervisor is not on the floor at that moment.",
    q: "What should you do first?",
    options: [
      "Carry on with your own work and mention it to the supervisor when you see him",
      "Stop the work immediately, arrange a helmet and harness, and then inform the supervisor",
      "Take a photograph and post it in the team WhatsApp group",
      "Ask him to finish quickly so that he is off the ladder sooner",
    ],
    answer: 1,
    explanation:
      "An unsafe act at height is stopped first — a fall cannot be undone later. Reporting matters, but it comes after the person is safe.",
  },
  {
    n: 18, section: "D",
    scenario:
      "During a site visit the client points out that the flooring laid in one room does not match the shade that was approved. The correct material will take 4 days to arrive. Handover is scheduled in 3 days.",
    q: "What is the best response?",
    options: [
      "Tell the client the difference is barely visible and continue with the handover",
      "Quietly replace it with whatever similar material is available in stock",
      "Acknowledge it, check the laid material against the approved sample, and give the client a revised date in writing with the reason",
      "Tell the client in the meeting that the vendor sent the wrong material and it is not your fault",
    ],
    answer: 2,
    explanation:
      "Verify against the approved sample, own the problem, and commit to a realistic date in writing. Hiding it, substituting silently, or blaming a vendor in front of the client all cost more later.",
  },
  {
    n: 19, section: "D",
    scenario:
      "A BOQ line is budgeted at ₹4,00,000. One vendor quotes ₹4,50,000 and can deliver 5 days earlier than required. Another approved vendor quotes ₹3,95,000 on the normal schedule. The project is currently running on schedule.",
    q: "What is the best action?",
    options: [
      "Place the order with the faster vendor — earlier delivery is always worth the extra cost",
      "Split the order between the two vendors",
      "Place the order with the ₹3,95,000 vendor, since the project is already on schedule",
      "Delay the decision and push the cheaper vendor to reduce the price further",
    ],
    answer: 2,
    explanation:
      "You only pay a premium for speed you actually need. The project is on schedule, so the earlier delivery buys nothing, and the cheaper approved vendor is within budget.",
  },
  {
    n: 20, section: "D",
    scenario:
      "The plastering team arrives to start work in a room, but the electrical conduits in that room have not been laid yet.",
    q: "What should be done?",
    options: [
      "Start plastering; the electrical team can cut chases into the wall afterwards",
      "Send the plastering team home for the day",
      "Plaster only half the room and leave the rest",
      "Hold plastering in that room until the conduits are laid, and move the plastering team to another room",
    ],
    answer: 3,
    explanation:
      "Services go in before finishes. Chasing a finished wall means breaking and re-doing work. Holding that one room while keeping the team productive elsewhere loses neither quality nor a day's labour.",
  },
];

// ── Scoring bands ────────────────────────────────────────────────────────────
// Rescaled from §6.1's 13-mark bands at the same percentage cuts, so a v1 and a
// v2 candidate in the same band mean roughly the same thing.
//   17–20 (85%+) STRONG · 12–16 (60%+) AVERAGE · 8–11 (40%+) WEAK · 0–7 BELOW_BAR
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
// Question order is FIXED (§7.2 — sections are meaningful and the paper version
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
 * Mark the paper. No negative marking, unanswered = 0 (§5 rules).
 * Takes canonical letters — run toCanonicalAnswers() first.
 */
export function scoreAnswers(canonical: Record<string, string>): ScoreResult {
  const sections: Record<SectionId, number> = { A: 0, B: 0, C: 0, D: 0 };
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
 * candidate sat, so an attempt stays reviewable even after v3 is minted.
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
