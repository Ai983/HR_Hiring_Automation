// ============================================================
// assessment-bank — the walk-in assessment paper and its answer key.
//
// SERVER ONLY. This module holds the correct answers. It is imported by the
// `assessment` edge function and must never be bundled into anything the
// browser downloads. Everything the candidate page receives goes through
// publicQuestions(), which strips `answer` and `explanation`.
//
// HAG-WALKIN-L1-v5 — 15 questions, 15 marks, 20 minutes.
//
// WHAT THIS PAPER IS, AND WHAT IT IS NOT
// v5 reads like a DISC-style personality questionnaire — plain language, general
// workplace behaviour, no trade content — but unlike DISC it HAS correct
// answers and produces a score.
//
// That distinction matters and is deliberate. A true DISC profile measures
// preference, not ability: "do you prefer to lead, to work with people, or to
// work alone?" has no wrong answer, so it yields a style (High D, secondary C)
// and CANNOT rank candidates. This paper instead asks what a person would DO in
// an ordinary work situation, where one option is defensibly better than the
// others — so it still scores, and the drive can still use it to decide who the
// panel sees first (§6.3).
//
// If a real DISC profile is ever wanted, build it as a SEPARATE instrument with
// its own kind, not by removing the answers from this one — score_total, band
// and the whole admin panel assume right/wrong.
//
// WHY EVERYTHING IS GENERAL
// v4 was built around interior/façade/PEB situations. That was wrong for this
// drive: the same paper is sat by a Sales Executive, an Interior Designer, a
// Documentation Controller and a Factory Operations candidate, and a question
// about plastering sequence tests exposure to site work rather than judgement.
// Every v5 question is about attitude, ownership, communication, reliability
// and problem-solving — things every one of the 13 positions is expected to
// have, whatever their trade (§7.5).
//
// Medium difficulty: the wrong options are not stupid. Each set contains the
// two traps people actually fall into — the passive one (say nothing, wait) and
// the over-corrective one (refuse, cancel everything, argue).
//
// ON AI: not AI-proof and cannot be made so. Invigilation is the control.
//
// Per §7.4 the paper is versioned, never edited in place once it has been sat.
// ============================================================

export const ASSESSMENT_ID = "HAG-WALKIN-L1-v5";
export const TOTAL_QUESTIONS = 15;
export const DURATION_MINUTES = 20;
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

// Section E is unused on this paper. The column stays in the table so older
// five-section attempts (v3, v4) remain readable.
export const SECTIONS: { id: SectionId; name: string; count: number }[] = [
  { id: "A", name: "Work Attitude & Ownership", count: 4 },
  { id: "B", name: "Communication & Teamwork", count: 4 },
  { id: "C", name: "Reliability & Time Management", count: 4 },
  { id: "D", name: "Problem Solving & Judgement", count: 3 },
];

export const QUESTIONS: Question[] = [
  // ══ Section A · Work Attitude & Ownership (4) ════════════════════════════
  {
    n: 1, section: "A",
    scenario:
      "You realise you have made a mistake that will affect someone else's work. Nobody has noticed it yet.",
    q: "What should you do?",
    options: [
      "Say nothing — nobody has noticed it",
      "Inform your senior and the person affected, and correct it straight away",
      "Correct it quietly and do not mention it to anyone",
      "Wait until somebody points it out, then explain",
    ],
    answer: 1,
    explanation:
      "A mistake that touches somebody else's work is not yours to hide or to quietly patch — they may already be building on it. Reporting it early costs far less than it being discovered later.",
  },
  {
    n: 2, section: "A",
    scenario:
      "You are given a task you have never done before, and your senior is not available to explain it.",
    q: "What is the best thing to do?",
    options: [
      "Wait and do nothing until your senior is free",
      "Guess your way through the whole task",
      "Start with the part you clearly understand, note your doubts, and confirm them as soon as your senior is free",
      "Ask a colleague to do it for you",
    ],
    answer: 2,
    explanation:
      "Neither freezing nor guessing. Make progress where you are sure, and hold the parts you are not sure about until you can check them — that way no time is lost and nothing is done wrong.",
  },
  {
    n: 3, section: "A",
    scenario:
      "You have finished your work for the day. A colleague is struggling with an urgent job, and you have a personal commitment in the evening.",
    q: "What should you do?",
    options: [
      "Leave without saying anything — your work is done",
      "Help for as long as you can, then tell your senior what is still pending",
      "Cancel your commitment and stay however long it takes",
      "Tell the colleague it is not your responsibility",
    ],
    answer: 1,
    explanation:
      "Helping matters, but so does being honest about your limits. Give the time you have and hand over clearly — silently leaving and silently sacrificing everything are both worse than a clear handover.",
  },
  {
    n: 4, section: "A",
    scenario:
      "Your senior asks you to do something in a way that you believe is wrong.",
    q: "What should you do?",
    options: [
      "Refuse to do it",
      "Do it without saying anything",
      "Do it your own way instead",
      "Tell your senior clearly why you think it is wrong, and then follow their decision",
    ],
    answer: 3,
    explanation:
      "You owe your senior your opinion, and then their decision. Staying silent wastes what you know; refusing or quietly doing it your own way removes their ability to decide at all.",
  },

  // ══ Section B · Communication & Teamwork (4) ═════════════════════════════
  {
    n: 5, section: "B",
    scenario:
      "In a meeting, a decision is taken that you disagree with.",
    q: "What is the right thing to do?",
    options: [
      "Say your view clearly in the meeting, and once the decision is made, support it",
      "Stay quiet in the meeting and share your disagreement with others afterwards",
      "Keep arguing until the decision is changed",
      "Agree in the meeting but do it your own way later",
    ],
    answer: 0,
    explanation:
      "Disagree in the room, commit outside it. Complaining afterwards or quietly doing something else is how teams stop trusting each other.",
  },
  {
    n: 6, section: "B",
    scenario:
      "You will not be able to finish your work by the deadline you were given.",
    q: "When and how should you tell your senior?",
    options: [
      "On the deadline day, once it is confirmed you cannot finish",
      "As soon as you know, with the reason and a realistic new date",
      "Say it is done and finish it quietly afterwards",
      "Explain that it was not possible because of others",
    ],
    answer: 1,
    explanation:
      "Early warning gives your senior options; a deadline-day surprise gives them none. The reason and a realistic new date are what make it useful rather than just an apology.",
  },
  {
    n: 7, section: "B",
    scenario:
      "Someone gives you critical feedback about your work in front of others.",
    q: "What is the best response?",
    options: [
      "Explain immediately why they are wrong",
      "Accept it politely and then ignore it",
      "Listen, ask what specifically you should improve, and act on it",
      "Say nothing and avoid that person afterwards",
    ],
    answer: 2,
    explanation:
      "The useful part of feedback is the specific change it asks for. Asking for that turns criticism into something you can act on — arguing, ignoring or withdrawing all waste it.",
  },
  {
    n: 8, section: "B",
    scenario:
      "A colleague repeatedly presents your work as their own.",
    q: "What should you do first?",
    options: [
      "Say nothing to avoid conflict",
      "Confront them about it in front of the team",
      "Speak to the colleague privately first, and raise it with your senior if it continues",
      "Start doing the same with their work",
    ],
    answer: 2,
    explanation:
      "A private conversation solves most of these and costs nothing. Escalate only if it continues — and never handle it by embarrassing them publicly or by copying the behaviour.",
  },

  // ══ Section C · Reliability & Time Management (4) ════════════════════════
  {
    n: 9, section: "C",
    scenario:
      "You have three tasks to do and it is clear you cannot finish all of them today.",
    q: "What should you do?",
    options: [
      "Do the easiest ones first so that more tasks get completed",
      "Do them in the order you received them",
      "Do a little of each so that all three show some progress",
      "Ask your senior which is most important, and finish that one properly",
    ],
    answer: 3,
    explanation:
      "Only the person who owns the work knows what matters most today. Order of arrival, ease, or spreading yourself across all three are all ways of choosing without asking.",
  },
  {
    n: 10, section: "C",
    scenario: "You come to know that you will not be able to come to work tomorrow.",
    q: "What should you do?",
    options: [
      "Inform your senior today, as early as possible",
      "Inform your senior tomorrow morning",
      "Ask a colleague to pass on the message",
      "Send a message after the working day has already started",
    ],
    answer: 0,
    explanation:
      "The earlier it is known, the easier your work is covered. Passing the message through somebody else leaves it to chance whether it arrives at all.",
  },
  {
    n: 11, section: "C",
    scenario:
      "Your senior gives you a long list of instructions verbally, one after another.",
    q: "What is the best thing to do?",
    options: [
      "Concentrate hard and try to remember everything",
      "Note them down, and repeat them back to confirm you have understood correctly",
      "Start with whatever you remember and ask again later",
      "Ask a colleague afterwards what was said",
    ],
    answer: 1,
    explanation:
      "Writing it down protects against forgetting; repeating it back protects against having misunderstood. The second half is the part most people skip.",
  },
  {
    n: 12, section: "C",
    scenario:
      "You are given a repetitive task that you find boring, and it takes up most of your day.",
    q: "What should you do?",
    options: [
      "Rush through it to get it over with",
      "Keep postponing it and do more interesting work first",
      "Do it properly, and suggest to your senior a better way of doing it in future",
      "Do it slowly, since it is boring anyway",
    ],
    answer: 2,
    explanation:
      "Boring work still has to be right. The person who does it properly and then proposes a better method is the one who gets trusted with more interesting work.",
  },

  // ══ Section D · Problem Solving & Judgement (3) ══════════════════════════
  {
    n: 13, section: "D",
    scenario:
      "The same problem has come up three times. Each time it was fixed, and it has now happened again.",
    q: "What is the best action?",
    options: [
      "Fix it again and keep watching it",
      "Find out why it keeps happening and correct the cause",
      "Report the person who keeps causing it",
      "Accept that it will keep happening and plan around it",
    ],
    answer: 1,
    explanation:
      "The same problem four times is one cause, not four incidents. Fixing it a fourth time without finding out why guarantees a fifth.",
  },
  {
    n: 14, section: "D",
    scenario:
      "Someone asks you a question about your work and you do not know the answer.",
    q: "What should you do?",
    options: [
      "Give the most likely answer so that you do not look unprepared",
      "Say you do not know and leave it there",
      "Tell them you will find out, give them a time, and get back to them",
      "Change the subject and hope they forget",
    ],
    answer: 2,
    explanation:
      "Not knowing is normal; not following up is not. Committing to a time turns it into a promise you can keep, and guessing risks somebody acting on a wrong answer.",
  },
  {
    n: 15, section: "D",
    scenario:
      "Two different seniors give you instructions that contradict each other.",
    q: "What should you do?",
    options: [
      "Follow whichever one is more senior",
      "Follow whichever instruction seems more sensible to you",
      "Tell both of them about the conflict and let them agree on what should be done",
      "Do neither until somebody notices the problem",
    ],
    answer: 2,
    explanation:
      "You cannot resolve a conflict between two people's instructions by choosing one of them privately — whichever you pick, the other is left thinking their instruction is being followed.",
  },
];

// ── Scoring bands ────────────────────────────────────────────────────────────
// The same percentage cuts used since v1, rescaled to 15 marks:
//   13–15 (85%+) STRONG · 9–12 (60%+) AVERAGE · 6–8 (40%+) WEAK · 0–5 BELOW_BAR
//
// Medium difficulty, so the spread should be usable. If it is not, RE-CUT THESE
// against real attempt data — bands can change freely, questions cannot once
// they have been sat (§7.4).
//
// §6.3: this band is a QUEUE-PRIORITISATION signal, not a hiring gate. Nothing
// downstream may auto-reject on it.
export type Band = "STRONG" | "AVERAGE" | "WEAK" | "BELOW_BAR";

export function bandFor(total: number): Band {
  if (total >= 13) return "STRONG";
  if (total >= 9) return "AVERAGE";
  if (total >= 6) return "WEAK";
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
 * candidate sat, so an attempt stays reviewable even after v6 is minted.
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
