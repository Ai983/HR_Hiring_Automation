// ============================================================
// assessment-bank — the walk-in assessment paper and its answer key.
//
// SERVER ONLY. This module holds the correct answers. It is imported by the
// `assessment` edge function and must never be bundled into anything the
// browser downloads. Everything the candidate page receives goes through
// publicQuestions(), which strips `answer` and `explanation`.
//
// HAG-WALKIN-L1-v3 — 25 questions, 25 marks, 35 minutes.
//
// WHAT CHANGED FROM v2 AND WHY
// v1 (13 Q, printed) and v2 (20 Q) tested numeracy, general reasoning and site
// vocabulary. Those are cheap to test and cheap to fake: "what does BOQ stand
// for" separates people who have read a glossary from people who have not, not
// people who can run a site from people who cannot.
//
// v3 is almost entirely situational. Every question puts the candidate in a
// real situation and asks what they would DO, what procedure they would follow,
// or how they would handle a client. The distractors are the mistakes people
// actually make on site — the shortcut, the people-pleasing answer, the rigid
// rule-follower answer, the "not my job" answer — so a candidate cannot get
// there by elimination without having lived it.
//
// The four numerical questions (Section D) are deliberately embedded in
// commercial situations rather than asked as bare arithmetic, so they test
// whether someone can reason about money on a project, not whether they can
// multiply.
//
// ON AI: none of this makes the paper AI-proof. A large language model answers
// situational-judgement questions very well. Invigilation — phones collected at
// the desk — is the control for that. Question design only makes the paper hard
// to answer without real experience, which is what makes it discriminate
// between candidates.
//
// Per §7.4 there is still NO role-specific technical content that only one
// department could answer: all 13 positions sit the same paper. The situations
// are drawn from interior fit-out, façade, civil and PEB work because that is
// the business, but every correct answer turns on judgement, procedure or
// commercial sense rather than trade knowledge.
//
// Per §7.3 the paper is versioned, never edited in place once it has been sat.
// ============================================================

export const ASSESSMENT_ID = "HAG-WALKIN-L1-v3";
export const TOTAL_QUESTIONS = 25;
export const DURATION_MINUTES = 35;
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
  { id: "A", name: "Site Execution & Sequencing", count: 5 },
  { id: "B", name: "Client & Stakeholder Handling", count: 6 },
  { id: "C", name: "Procedure & Documentation", count: 6 },
  { id: "D", name: "Commercial Judgement", count: 4 },
  { id: "E", name: "Safety & Problem Diagnosis", count: 4 },
];

export const QUESTIONS: Question[] = [
  // ══ Section A · Site Execution & Sequencing (5) ══════════════════════════
  {
    n: 1, section: "A",
    scenario:
      "The client wants handover pulled forward by a week. Your false ceiling grid is up, but the MEP services above the ceiling have not been pressure-tested or signed off yet. The ceiling boarding team is free today.",
    q: "What do you do?",
    options: [
      "Board the ceiling now; if the MEP fails testing later, open up the affected tiles",
      "Complete and sign off the MEP testing above the ceiling first, then board",
      "Board the full area and cut openings afterwards wherever testing fails",
      "Board it now and ask the client to sign that they accept the risk",
    ],
    answer: 1,
    explanation:
      "Concealed services are tested before they are concealed. Opening a boarded ceiling costs more than the week you saved, and without a signed test you own every leak that appears afterwards.",
  },
  {
    n: 2, section: "A",
    scenario:
      "PEB erection. The survey finds that the anchor bolts for one column are 12 mm off the grid line — the tolerance is ±3 mm. The crane is booked for today only.",
    q: "What is the right action?",
    options: [
      "Ream the base plate holes slightly so the bolts fit, and bolt it down",
      "Pull the column into line with the crane and grout the gap",
      "Hold that column, refer the deviation to the structural designer for a written remedy, and keep the crane erecting the unaffected bays",
      "Erect it as it is and correct it after the roof sheeting is on",
    ],
    answer: 2,
    explanation:
      "12 mm is four times the tolerance. A base plate deviation is a structural decision, not a site call — reaming or forcing it transfers load the connection was never designed for. Keeping the crane productive on the unaffected bays is the half that shows judgement.",
  },
  {
    n: 3, section: "A",
    scenario:
      "Flooring is scheduled for Monday. On Friday you find that the electrical team still has to pull cables in the same area, and the AC ducting above that ceiling is incomplete.",
    q: "What is the correct sequence?",
    options: [
      "Flooring on Monday as booked; the other trades can work around it",
      "Cabling, then flooring, then the ducting overhead",
      "All three together to save time",
      "Overhead ducting first, then cabling, then flooring",
    ],
    answer: 3,
    explanation:
      "Work top-down. Any overhead activity after the floor is laid means protection, damage and rework — and the floor is the finish you can least afford to redo.",
  },
  {
    n: 4, section: "A",
    scenario:
      "You have 12 painters on site. The floor is only half ready because the client's civil contractor handed over late. The painters will be idle from noon.",
    q: "What do you do?",
    options: [
      "Keep them on site idle and bill the client for standby",
      "Move them to areas that are ready, and record the civil handover delay in writing the same day",
      "Send them home to save the day's cost",
      "Start painting the unready area and touch it up later",
    ],
    answer: 1,
    explanation:
      "Two things have to happen together: keep the labour productive, and create the record on the day it happened. You only get an extension of time for a delay you notified when it occurred — a claim written up at the end of the job is worth very little.",
  },
  {
    n: 5, section: "A",
    scenario:
      "Handover is tomorrow. The snag list has 46 items: 3 are non-working power points, 40 are paint touch-ups, and 3 are door alignment issues.",
    q: "How do you use the last day?",
    options: [
      "Close the 40 paint touch-ups first — it clears the most items",
      "Split the team evenly across all three types",
      "Hand over and commit to closing every snag within a week",
      "Close the 3 dead power points first, then the doors, then the paint",
    ],
    answer: 3,
    explanation:
      "Close what stops the client using the space before what they can see. They can occupy an office with paint touch-ups outstanding; they cannot with dead power points. Clearing the biggest count is optimising the wrong number.",
  },

  // ══ Section B · Client & Stakeholder Handling (6) ════════════════════════
  {
    n: 6, section: "B",
    scenario:
      "During a site walk the client's manager says: \"Just move this partition two feet and add two more sockets — it's small, don't make a fuss about it.\" There is no written instruction.",
    q: "What do you do?",
    options: [
      "Do it — it is a small change and it keeps the client happy",
      "Refuse to touch it until a formal variation order has been issued",
      "Confirm it to the client in writing the same day with the cost and time impact, and start only once they confirm in writing",
      "Do it now and add the cost quietly to the next running bill",
    ],
    answer: 2,
    explanation:
      "Verbal changes with no written record are the single most common source of payment disputes at closeout — with no instruction, you have no contractual basis to recover the cost. But a flat refusal is the wrong kind of correct: it damages the relationship over paperwork the client will happily give you. Confirm in writing, then proceed.",
  },
  {
    n: 7, section: "B",
    scenario:
      "On Tuesday you learn that a key imported material will arrive three weeks late. The client's project review meeting is next Monday.",
    q: "When and how do you tell the client?",
    options: [
      "At Monday's review meeting, once you have a full recovery plan",
      "The same day — tell them the impact and the options you are working on, even though the plan is not final",
      "Once you have confirmed an alternative, so you do not alarm them unnecessarily",
      "Let your procurement team raise it with their procurement team",
    ],
    answer: 1,
    explanation:
      "Bad news does not improve with age. The client has their own dependencies — IT, furniture, the move-in date, their own landlord — and every day you sit on it is a day they cannot use. Waiting to have a perfect answer costs them five working days.",
  },
  {
    n: 8, section: "B",
    scenario:
      "The client calls you directly and asks for a design change, adding: \"Don't bother the PM with this, just get it done.\"",
    q: "What is the best response?",
    options: [
      "Do what the client asked — the client is the client",
      "Tell the client you are not authorised to help",
      "Forward it to the PM and leave the client to hear back from him",
      "Acknowledge it to the client, tell them you will have it confirmed through the PM the same day, and follow up so they see it moving",
    ],
    answer: 3,
    explanation:
      "Never leave a client feeling unheard, and never open an undocumented parallel channel. The difference between this and simply forwarding it is that the client gets an answer from you, on the day, and sees it moving.",
  },
  {
    n: 9, section: "B",
    scenario:
      "You notice the veneer on a large reception panel has a visible shade mismatch. The client has not seen it. Replacement takes 6 days; handover is in 8.",
    q: "What do you do?",
    options: [
      "Say nothing — the client may not notice the difference",
      "Try to match it on site with polish and see whether it passes",
      "Tell the client now, with the replacement plan and the date",
      "Raise it only if the client picks it up during snagging",
    ],
    answer: 2,
    explanation:
      "A defect you disclose is a professional handling it. The same defect found by the client after handover is a trust failure that colours every future conversation — and here you have the time to fix it properly.",
  },
  {
    n: 10, section: "B",
    scenario:
      "The client's certification of your running bill is six weeks overdue. Your subcontractors are threatening to pull labour off the site. The client's PM keeps saying \"next week\".",
    q: "What is the right step?",
    options: [
      "Stop work immediately to force the payment",
      "Put the position to the client in writing — certified amount, days overdue, contractual consequence — and escalate to your own management before taking any action on site",
      "Keep working and absorb it; stopping would damage the relationship",
      "Tell the subcontractors to take it up with the client directly",
    ],
    answer: 1,
    explanation:
      "Suspending work is a contractual act with consequences, and it is never a site-level decision. The written record and the internal escalation come first — they are also what makes any later suspension defensible.",
  },
  {
    n: 11, section: "B",
    scenario:
      "The client's own IT vendor is working in the same area and keeps blocking your ceiling team. Verbal requests to them have not worked.",
    q: "What is the best action?",
    options: [
      "Argue it out with the IT vendor's supervisor on site",
      "Tell your team to work around them and say nothing",
      "Wait for the client to notice the problem themselves",
      "Record the dates, areas and hours lost, notify the client in writing, and propose a zone-wise schedule between the two vendors",
    ],
    answer: 3,
    explanation:
      "You have no authority to instruct another vendor, so arguing achieves nothing. What you can do is create the record and hand the client a workable solution — coordination between their vendors is their responsibility, and proposing the schedule is what gets it acted on.",
  },

  // ══ Section C · Procedure & Documentation (6) ════════════════════════════
  {
    n: 12, section: "C",
    scenario:
      "A person arrives at site, introduces himself as the client's consultant, and instructs your team to change the tile layout.",
    q: "What is the correct procedure?",
    options: [
      "Follow the instruction — a consultant is the client's representative",
      "Ignore it; only your own PM instructs your team",
      "Do not act on it. Record the instruction and route it to your PM to confirm the person's authority and have it issued through the agreed channel",
      "Let the tiling contractor decide whether it is workable",
    ],
    answer: 2,
    explanation:
      "A valid instruction comes only from the designated representative named in the contract. But ignoring it outright loses information — recording it and routing it is what separates a professional from someone being difficult.",
  },
  {
    n: 13, section: "C",
    scenario:
      "A truck arrives with 200 aluminium sections. The challan quantity does not match the purchase order, and there is no test certificate with the load.",
    q: "What do you do?",
    options: [
      "Unload it and sort out the paperwork later — the truck cannot wait",
      "Reject the entire load and send it back",
      "Unload and sign the challan as received, to keep the vendor relationship smooth",
      "Receive it on a GRN recording the actual quantity and the shortfall, mark it quantity and quality under check, quarantine the material, and inform purchase the same day",
    ],
    answer: 3,
    explanation:
      "Signing a challan you have not verified is exactly how you lose the debit note two months later. Rejecting the whole load is wasteful when a documented partial receipt is available. The GRN with the recorded variance is the document that protects the company.",
  },
  {
    n: 14, section: "C",
    scenario:
      "A scaffold plank slips and falls four floors. Nobody is hit. The project is already behind schedule.",
    q: "What is the correct procedure?",
    options: [
      "Refix the plank and carry on — nobody was hurt",
      "Stop work in that zone, secure the area, report it to the supervisor immediately and in writing the same day, and investigate before resuming",
      "Raise it at the weekly safety meeting",
      "Note it in the site diary and continue",
    ],
    answer: 1,
    explanation:
      "A near miss is the free warning you get before the accident. \"Nobody was hurt\" is precisely the moment it gets buried, and schedule pressure is precisely the reason it should not be.",
  },
  {
    n: 15, section: "C",
    scenario:
      "The team is building from Rev 2 drawings. You find a Rev 4 sitting in your email from last week.",
    q: "What is your first action?",
    options: [
      "Tell the team to switch to Rev 4 straight away",
      "Carry on with Rev 2 — that is what was approved on site",
      "Ask each contractor to check whether they have the latest drawings",
      "Stop work in the affected area, confirm Rev 4 is the released-for-construction version, check what has already been built to Rev 2, and reissue through the document controller with the old copies withdrawn",
    ],
    answer: 3,
    explanation:
      "Switching is the easy part. The expensive part is what has already been built wrong, and the uncontrolled Rev 2 prints still lying on site that someone will pick up tomorrow.",
  },
  {
    n: 16, section: "C",
    scenario:
      "A subcontractor claims 1,200 sq m of gypsum partition. Your measurement shows 1,050 sq m. He insists his figure is right and threatens to stop work.",
    q: "What is the correct step?",
    options: [
      "Certify 1,200 sq m to keep him on site",
      "Certify 1,050 sq m and tell him to accept it",
      "Carry out a joint measurement at site with him and certify on the signed joint measurement sheet",
      "Escalate it to your PM without measuring anything",
    ],
    answer: 2,
    explanation:
      "A joint measurement signed by both parties is the only thing that ends this argument rather than postponing it. Certifying either number unilaterally guarantees the same fight again next month.",
  },
  {
    n: 17, section: "C",
    scenario:
      "Physical work is complete and the client wants the keys tomorrow.",
    q: "Besides the snag list, what must be handed over?",
    options: [
      "The keys — the documents can follow later",
      "As-built drawings only",
      "The warranties only",
      "As-built drawings, warranties and guarantees, O&M manuals, test certificates, and the signed completion/handover certificate",
    ],
    answer: 3,
    explanation:
      "Handover without the document set means the client cannot operate or maintain the space — and your retention does not get released. The paperwork is part of the deliverable, not an afterthought.",
  },

  // ══ Section D · Commercial Judgement (4) ═════════════════════════════════
  {
    n: 18, section: "D",
    scenario:
      "A BOQ line reads 850 sq m of vitrified tiles at ₹1,450 per sq m. Actual site measurement is 910 sq m — the extra 60 sq m is a corridor the client added during execution.",
    q: "What is the value of the additional work, and how should it be billed?",
    options: [
      "₹87,000 — absorb it, the variation is under 10%",
      "₹87,000 — bill it as a variation, supported by the client's written approval and a joint measurement",
      "₹1,30,500 — bill the extra area at a premium rate because it is additional work",
      "₹87,000 — add it to the next running bill without raising a separate variation",
    ],
    answer: 1,
    explanation:
      "60 × ₹1,450 = ₹87,000. Extra work at an existing BOQ item is billed at the BOQ rate, not a premium — but only as a properly raised variation with the client's written approval and a joint measurement behind it. Slipping it into a running bill is how it gets disallowed.",
  },
  {
    n: 19, section: "D",
    scenario:
      "Contract value ₹2.4 crore. Liquidated damages are 0.5% of contract value per week of delay, capped at 5%. You finish three weeks late. Two of those weeks were because the client's power connection was not ready, and you notified them in writing at the time.",
    q: "What is your realistic exposure?",
    options: [
      "₹36,00,000 — the delay applies in full",
      "₹3,60,000 — all three weeks are chargeable to you",
      "₹1,20,000 — only the one week that is yours, and you claim an extension of time for the two weeks you notified in writing",
      "Nothing — the whole delay was caused by the client",
    ],
    answer: 2,
    explanation:
      "0.5% of ₹2.4 crore is ₹1,20,000 per week. LD applies only to delay you caused — and the two weeks are only recoverable because you put the notice in writing when it happened. This is the whole reason contemporaneous records matter.",
  },
  {
    n: 20, section: "D",
    scenario:
      "Two quotes for the same 500 sq m of flooring. Vendor A: ₹1,200 per sq m, material only — you arrange the labour, which will cost about ₹180 per sq m — and delivery in 45 days. Vendor B: ₹1,420 per sq m, supply and install, delivery in 20 days.",
    q: "Which is the better decision?",
    options: [
      "Vendor A — the rate is clearly lower",
      "Vendor A, and use their quote to negotiate Vendor B down",
      "There is nothing between them",
      "Vendor B — Vendor A actually lands at ₹1,380 per sq m, and B is ₹40 more for 25 fewer days and single-point responsibility",
    ],
    answer: 3,
    explanation:
      "Compare landed, like-for-like cost: ₹1,200 + ₹180 = ₹1,380 against ₹1,420. The whole difference is ₹20,000 on a ₹7 lakh line, and it buys you 25 days and one party to hold responsible if the floor fails.",
  },
  {
    n: 21, section: "D",
    scenario:
      "480 bags of cement were issued to site. Theoretical consumption calculated from the work actually executed is 442 bags. Physical stock at site is 12 bags.",
    q: "What does this tell you, and what do you do?",
    options: [
      "Nothing unusual — 26 bags is normal wastage on a job this size",
      "26 bags are unaccounted for, about 5%. Do a physical verification, check the issue records against the work actually done, and record the variance with reasons in the reconciliation statement",
      "Write the 26 bags off as breakage and damage",
      "Reduce the next indent by 26 bags to balance the account",
    ],
    answer: 1,
    explanation:
      "480 − 442 − 12 = 26 bags unaccounted for. The number itself matters less than the discipline: an unexplained variance gets verified and recorded with a reason, never quietly absorbed. That record is what makes theft or over-issue visible at all.",
  },

  // ══ Section E · Safety & Problem Diagnosis (4) ═══════════════════════════
  {
    n: 22, section: "E",
    scenario:
      "You see a worker from a different agency — the client's own vendor — welding without a screen, right next to your painters and their open thinner cans.",
    q: "What do you do?",
    options: [
      "Nothing — he is not your worker and not your agency",
      "Tell your painters to keep their distance and carry on",
      "Stop the activity, move your painters and the thinner clear, and report it in writing to the client's safety in-charge and your PM",
      "Raise it at the next site safety meeting",
    ],
    answer: 2,
    explanation:
      "Whose worker he is has nothing to do with it. Hot work beside open solvent is a fire in waiting, it is in your area, and your people are the ones next to it. Stop it first, escalate second.",
  },
  {
    n: 23, section: "E",
    scenario:
      "After the first heavy rain, water appears on the inside sill of several windows on one elevation only. The glass and the frames look intact.",
    q: "What is the most likely cause and the right first check?",
    options: [
      "The glass units have failed — replace the affected units",
      "Blocked or missing weep holes and failed sealant joints on that elevation — check the drainage path and the joints, then water-test a sample window",
      "The building is settling and the frames have moved",
      "The rain was exceptionally heavy — keep it under observation",
    ],
    answer: 1,
    explanation:
      "Aluminium glazing systems are drained, not sealed: they expect water in and route it back out through weep holes. Water on the inside sill of one elevation is a drainage or sealant failure, not a glass failure. Replacing glass is the expensive way to not fix it.",
  },
  {
    n: 24, section: "E",
    scenario:
      "A laminate feature wall is 60% installed when you realise the laminate is the right colour but the wrong finish — matte instead of the approved suede.",
    q: "What do you do?",
    options: [
      "Finish the wall — at least it is consistent, and consistency matters more than the sample",
      "Change the remaining 40% to the correct finish",
      "Stop, put the approved sample and the installed material in front of the client and the designer, and get a written decision to replace or to accept the deviation",
      "Complete it and raise it during snagging",
    ],
    answer: 2,
    explanation:
      "Stop before you make it bigger, and put the decision where it belongs — with the client, in writing. Changing the remaining 40% looks like fixing it and is the worst outcome: it turns a deviation nobody might have noticed into a visible mismatch down the middle of the wall.",
  },
  {
    n: 25, section: "E",
    scenario:
      "Three separate false ceiling sections in the same building have sagged over two months. Each was repaired. It has now happened a fourth time.",
    q: "What is the best action?",
    options: [
      "Repair it again and keep it under observation",
      "Replace the false ceiling throughout the building",
      "Back-charge the ceiling contractor for the repeated failure",
      "Stop repairing them one by one — find what is common to all four (suspension spacing, anchor type, or water coming from above) and correct that across every similar area",
    ],
    answer: 3,
    explanation:
      "Four failures of the same type in one building is one cause, not four accidents. Repairing case by case guarantees a fifth. Find the common factor first — everything else, including who pays, follows from knowing what actually went wrong.",
  },
];

// ── Scoring bands ────────────────────────────────────────────────────────────
// The same percentage cuts as v1 and v2, rescaled to 25 marks, so a STRONG on
// any version means roughly the same thing.
//   21–25 (85%+) STRONG · 15–20 (60%+) AVERAGE · 10–14 (40%+) WEAK · 0–9 BELOW_BAR
//
// §6.3: this band is a QUEUE-PRIORITISATION signal, not a hiring gate. Nothing
// downstream may auto-reject on it.
export type Band = "STRONG" | "AVERAGE" | "WEAK" | "BELOW_BAR";

export function bandFor(total: number): Band {
  if (total >= 21) return "STRONG";
  if (total >= 15) return "AVERAGE";
  if (total >= 10) return "WEAK";
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
 * candidate sat, so an attempt stays reviewable even after v4 is minted.
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
