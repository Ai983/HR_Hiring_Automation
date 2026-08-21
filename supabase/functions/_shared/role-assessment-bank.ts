// ============================================================
// role-assessment-bank — the SECOND-LEVEL, position-specific papers.
//
// SERVER ONLY. Holds the answer key for all 13 role papers. Same rule as
// assessment-bank.ts: never import this from anything under src/. The candidate
// bundle would ship the key to every phone in the hall. publicRoleQuestions()
// strips `answer` and `explanation`; that is the only way question text reaches
// a browser.
//
// WHY THIS EXISTS AS A SEPARATE INSTRUMENT
// HAGERSTONE_DRIVE_AND_ASSESSMENT.md §7.5 is explicit: do NOT add role-specific
// technical questions to the first-level paper, because all 13 positions sit
// that one and a question about plastering sequence tests exposure rather than
// judgement. So level 1 (HAG-WALKIN-L1-v5) stays general workplace behaviour and
// everybody sits it, and THIS is the second-level paper — sat after level 1,
// keyed to the position the candidate applied for (§2.2 of that document).
//
// WHY IT DOES NOT SHARE assessment-bank.ts's HELPERS
// The helpers there are bound to a single module-level QUESTIONS array. Making
// them generic would mean editing the file that marks the level-1 paper the day
// before a live drive. The ~70 lines of marking logic below are deliberately
// duplicated rather than refactored, so nothing in this file can affect level 1.
// If both papers survive this drive, unify them AFTER 22 Aug, not before.
//
// PAPER SHAPE — identical across all 13 positions, so the hall runs one process:
//   12 questions · 12 marks · 15 minutes · 4 sections of 3 · no negative marking.
// Kept proportional to level 1 (15 Q / 20 min). §7.5 warns that time per
// candidate is a real constraint on a walk-in queue: if the hall backs up, run
// MORE DEVICES, do not cut the time.
//
// DIFFICULTY: medium, and role-centric on purpose. Unlike level 1, these DO test
// exposure — a Site Engineer is asked about pour checklists and RFIs, a
// Procurement candidate about three-way matching. The wrong options are the
// mistakes people with partial exposure actually make, not nonsense.
//
// ⚠️ THE ANSWERS ARE ENGINEERING JUDGEMENT, NOT HAGERSTONE POLICY. Same caveat
// as level 1 (§9.3) and it bites harder here, because these encode how
// Hagerstone expects a role to be performed. None of it has HR or
// department-head sign-off. A candidate can defensibly challenge any of them at
// interview — that is a conversation, not a marking error.
//
// ⚠️ NOT AI-PROOF, and cannot be made so. Invigilation is the control.
//
// VERSIONING: same rule as §7.4 — never edit a paper in place once it has been
// sat. Bump that paper's id (…-v1 → …-v2). Papers are versioned INDIVIDUALLY, so
// fixing one role's question does not invalidate the other twelve.
// ============================================================

export const ROLE_DURATION_MINUTES = 15;
// A slow phone on venue Wi-Fi must not cost a candidate their paper.
export const ROLE_GRACE_SECONDS = 60;
export const ROLE_TOTAL_QUESTIONS = 12;

export type RoleSectionId = "A" | "B" | "C" | "D";

export interface RoleQuestion {
  n: number;
  section: RoleSectionId;
  /** The situation, shown above the question. Knowledge questions have none. */
  scenario?: string;
  q: string;
  options: string[];
  /** Index into `options`. NEVER sent to the browser. */
  answer: number;
  explanation: string;
}

export interface RoleSection {
  id: RoleSectionId;
  name: string;
  count: number;
}

export interface RolePaper {
  /** Versioned per paper. Recorded on the attempt row as assessment_id. */
  id: string;
  /** EXACT spelling from §2.2 — note the cedilla in Façade. */
  position: string;
  department: string;
  sections: RoleSection[];
  questions: RoleQuestion[];
}

// ── The 13 papers ────────────────────────────────────────────────────────────
// Order matches §2.2 of HAGERSTONE_DRIVE_AND_ASSESSMENT.md.

const PROJECT_MANAGER: RolePaper = {
  id: "HAG-ROLE-PROJECT-MANAGER-v1",
  position: "Project Manager",
  department: "Site Team",
  sections: [
    { id: "A", name: "Planning & Programme", count: 3 },
    { id: "B", name: "Cost & Commercial Control", count: 3 },
    { id: "C", name: "Client & Team Leadership", count: 3 },
    { id: "D", name: "Risk & Escalation", count: 3 },
  ],
  questions: [
    {
      n: 1, section: "A",
      scenario: "A 90-day interior fit-out is 15 days in. The client has still not approved the final flooring selection.",
      q: "What is the right project-management action?",
      options: [
        "Wait for the approval before planning anything further",
        "Start with the flooring option you expect will be approved",
        "Work out the last date the decision can be taken without delaying handover, tell the client that date in writing, and re-sequence the work that does not depend on it",
        "Extend the completion date now and inform the client",
      ],
      answer: 2,
      explanation: "A pending decision is managed by naming its deadline and protecting everything that does not depend on it. Waiting gives the delay away, and guessing the selection risks the whole floor.",
    },
    {
      n: 2, section: "A",
      q: "In a project programme, what does the critical path tell you?",
      options: [
        "The most expensive activities",
        "The sequence of activities where any delay directly delays the completion date",
        "The activities that need the most manpower",
        "The activities the client asks about most often",
      ],
      answer: 1,
      explanation: "The critical path is the chain with no float. Delay anything on it and the end date moves — that is what makes it the thing to protect.",
    },
    {
      n: 3, section: "A",
      scenario: "Three activities are running behind. Only one of them has float left.",
      q: "Which do you put resources into first?",
      options: [
        "The one with the largest budget",
        "The one whose delay moves the completion date",
        "The one the client asked about most recently",
        "All three equally",
      ],
      answer: 1,
      explanation: "Recovery effort belongs where the delay is actually costing you the end date. Spreading it across all three usually recovers none of them.",
    },
    {
      n: 4, section: "B",
      scenario: "During a site visit the client verbally asks for an additional false-ceiling design.",
      q: "What should the project manager do before starting it?",
      options: [
        "Start it — the client is paying for the project anyway",
        "Refuse until the next billing cycle",
        "Raise a written variation with its cost and time impact, and get it approved before execution",
        "Execute it and add the cost to the final bill",
      ],
      answer: 2,
      explanation: "Extra work done on a verbal instruction is the single most common cause of a disputed final bill. The variation record is what makes it payable.",
    },
    {
      n: 5, section: "B",
      q: "A project is 60% complete by time but 80% of the budget is already spent. What does this most likely indicate?",
      options: [
        "The project is ahead of schedule",
        "A cost overrun that needs to be investigated now",
        "Nothing — project costs are always front-loaded",
        "The client has released more payment than expected",
      ],
      answer: 1,
      explanation: "Spend running ahead of progress is the earliest reliable signal of an overrun, and it is only correctable while 40% of the work is still ahead of you.",
    },
    {
      n: 6, section: "B",
      scenario: "A subcontractor's quoted rate is the lowest by a wide margin, but their previous job with you finished late.",
      q: "What is the best action?",
      options: [
        "Award it — the lowest cost wins",
        "Reject them outright on the past record",
        "Compare on total cost including the risk of delay, and if awarded, tie the payments to a milestone schedule",
        "Ask them to raise their rate to a realistic level",
      ],
      answer: 2,
      explanation: "A low rate that arrives late is not cheap. Either price the risk in or structure the contract so the risk is controlled.",
    },
    {
      n: 7, section: "C",
      scenario: "The client is angry on site about a defect, and says so in front of your team.",
      q: "What is the best response?",
      options: [
        "Defend the team immediately",
        "Name the subcontractor responsible",
        "Acknowledge it, commit to a corrective action and a date, and deal with the team separately afterwards",
        "Say it will be looked into, and move the conversation on",
      ],
      answer: 2,
      explanation: "The client needs a correction and a date, not an explanation. Correcting your own team is a separate conversation and never a public one.",
    },
    {
      n: 8, section: "C",
      scenario: "Two of your engineers are blaming each other for a missed inspection.",
      q: "What should you do first?",
      options: [
        "Warn both of them",
        "Establish what actually happened and who owned the task, close the process gap, and make the ownership explicit going forward",
        "Take the task over yourself in future",
        "Ask the client to reschedule the inspection",
      ],
      answer: 1,
      explanation: "Two people blaming each other usually means the ownership was never defined. Warning both leaves the same gap in place for next time.",
    },
    {
      n: 9, section: "C",
      q: "What is the most useful purpose of a daily progress report from site?",
      options: [
        "It proves the team was present",
        "It gives an early signal of slippage while there is still time to correct it",
        "It is needed to prepare the final bill",
        "It reassures the client",
      ],
      answer: 1,
      explanation: "A report that is only read at the end is a record. A report read daily is a control — the difference is whether it is acted on in time.",
    },
    {
      n: 10, section: "D",
      scenario: "A material ordered six weeks ago is now confirmed to arrive three weeks late — after the date it is needed on site.",
      q: "What is the first action?",
      options: [
        "Escalate with the revised programme, the alternatives — another vendor, another material, re-sequencing — and your recommendation",
        "Wait; the vendor may still recover",
        "Inform the client that the project is delayed",
        "Order the same material from a second vendor without telling anyone",
      ],
      answer: 0,
      explanation: "Escalate with options, not just with the problem. Telling the client before you know your own recovery plan gives away a delay you may not have to take.",
    },
    {
      n: 11, section: "D",
      scenario: "A safety incident occurs on site. Nobody is injured.",
      q: "What should the project manager do?",
      options: [
        "Nothing — no one was hurt",
        "Record it, investigate the cause, close the gap, and report it as per procedure",
        "Warn the workers verbally and carry on",
        "Report it only if the client asks",
      ],
      answer: 1,
      explanation: "A near-miss is the same hazard as an injury with the consequence removed. It is the cheapest warning you will ever get.",
    },
    {
      n: 12, section: "D",
      scenario: "Handover is in a week and the snag list has 40 open items.",
      q: "What is the best approach?",
      options: [
        "Hand over and close the snags afterwards",
        "Delay handover until every item is closed",
        "Sort the snags by whether they block the client's use of the space, close those first, and agree a written schedule with the client for the rest",
        "Ask the client to reduce the list",
      ],
      answer: 2,
      explanation: "Not all snags are equal. What matters is whether the client can use the space; the rest is a scheduled commitment, made in writing so it is not read as an excuse.",
    },
  ],
};

const SITE_ENGINEER: RolePaper = {
  id: "HAG-ROLE-SITE-ENGINEER-v1",
  position: "Site Engineer",
  department: "Site Team",
  sections: [
    { id: "A", name: "Execution & Quality", count: 3 },
    { id: "B", name: "Measurement & Documentation", count: 3 },
    { id: "C", name: "Coordination", count: 3 },
    { id: "D", name: "Problem Solving on Site", count: 3 },
  ],
  questions: [
    {
      n: 1, section: "A",
      q: "Before starting any activity on site, which document must the engineer work from?",
      options: [
        "The tender drawing",
        "The latest Good for Construction drawing, at its current revision",
        "The architect's presentation drawing",
        "The instruction received on WhatsApp",
      ],
      answer: 1,
      explanation: "Only the released GFC revision is authorised for construction. Building from a tender or presentation drawing is how work gets executed to superseded information.",
    },
    {
      n: 2, section: "A",
      scenario: "The drawing and the actual site condition do not match — a wall is 75mm off.",
      q: "What should you do?",
      options: [
        "Adjust it on site and carry on",
        "Stop that activity, record the deviation with measurements and photographs, and get a written instruction from the designer before proceeding",
        "Follow the drawing exactly and break the wall",
        "Let the mason decide, since he is doing the work",
      ],
      answer: 1,
      explanation: "75mm is not a site adjustment — it may move services, joinery and finishes downstream. The record and the written instruction are what protect you when it does.",
    },
    {
      n: 3, section: "A",
      q: "What is the purpose of a mock-up before full-scale execution?",
      options: [
        "To use up leftover material",
        "To fix and get approved the workmanship, finish and dimensions in advance, so the whole area is not rejected later",
        "To show the client that the site is active",
        "It applies only to façade work",
      ],
      answer: 1,
      explanation: "A mock-up moves the argument about acceptable quality to one square metre, before it becomes an argument about a whole floor.",
    },
    {
      n: 4, section: "B",
      q: "You and the contractor measure the same BOQ item differently. What settles it?",
      options: [
        "Whoever measured first",
        "The method of measurement agreed in the contract",
        "The higher of the two figures",
        "The site supervisor's opinion",
      ],
      answer: 1,
      explanation: "Measurement disputes are settled by the agreed method, not by negotiation. That is exactly why the method is named in the contract.",
    },
    {
      n: 5, section: "B",
      q: "Why is a joint measurement record signed by both parties?",
      options: [
        "It is a formality",
        "It settles the quantity while the work can still be seen, because once it is covered up it cannot be re-measured",
        "It speeds up the payment",
        "It is required only by the client",
      ],
      answer: 1,
      explanation: "Concealed work cannot be verified later. The signature at the right moment is the only evidence that survives.",
    },
    {
      n: 6, section: "B",
      scenario: "Concrete is to be poured tomorrow.",
      q: "What must be completed and recorded before the pour?",
      options: [
        "Nothing — the pour can start once the material reaches site",
        "Reinforcement, cover, level and shuttering checks completed and signed off on a pour card or checklist",
        "Only the client's approval",
        "A photograph of the area",
      ],
      answer: 1,
      explanation: "Everything checked before a pour becomes impossible to check after it. The signed checklist is the point of no return.",
    },
    {
      n: 7, section: "C",
      scenario: "The MEP contractor wants to cut a 150mm slot through a beam to pass a duct.",
      q: "What should you do?",
      options: [
        "Allow it — the duct has to pass somewhere",
        "Refuse, and let them find their own route",
        "Do not allow a structural member to be cut; refer it to the structural consultant and get a written solution",
        "Allow it if it is a small beam",
      ],
      answer: 2,
      explanation: "No one on site has the authority to cut a structural member. Refusing without routing it to the consultant just moves the problem — the duct still has to pass.",
    },
    {
      n: 8, section: "C",
      scenario: "Two agencies want the same area on the same day.",
      q: "What is the best action?",
      options: [
        "Give it to whoever reached site first",
        "Sequence the area by what physically has to happen first, put the sequence to both in writing, and inform the project manager",
        "Split the area between them",
        "Let the two of them settle it",
      ],
      answer: 1,
      explanation: "The sequence is decided by the work, not by arrival. Splitting an area between two trades usually means both do half a job and one redoes it.",
    },
    {
      n: 9, section: "C",
      q: "What is the most reliable way to close a design query raised from site?",
      options: [
        "A phone call with the designer",
        "A written RFI with the site photograph and the question, and the designer's written reply, both filed",
        "A voice note on WhatsApp",
        "An entry in the site diary",
      ],
      answer: 1,
      explanation: "A verbal clarification cannot be reissued to the people who need it and cannot be produced six months later when the detail is questioned.",
    },
    {
      n: 10, section: "D",
      scenario: "Plaster is cracking in the same wall again, after three repairs.",
      q: "What is the best action?",
      options: [
        "Repair it a fourth time with better material",
        "Investigate the cause — curing, mix, background or movement — and correct that before repairing again",
        "Cover it with a false wall",
        "Report the mason who did it",
      ],
      answer: 1,
      explanation: "Three failed repairs is one unresolved cause, not three bad repairs. A fourth repair without a diagnosis buys a fifth crack.",
    },
    {
      n: 11, section: "D",
      scenario: "A worker refuses to wear a safety harness while working at height.",
      q: "What should you do?",
      options: [
        "Stop the activity until the harness is worn, and report it",
        "Let him work — he is experienced",
        "Warn him and allow the work to continue",
        "Report it at the end of the day",
      ],
      answer: 0,
      explanation: "Work at height without a harness is stopped, not warned about. Experience is exactly what makes people take the risk.",
    },
    {
      n: 12, section: "D",
      scenario: "The client's representative on site instructs you directly to change a detail.",
      q: "What should you do?",
      options: [
        "Do it — he represents the client",
        "Refuse the instruction",
        "Note the instruction, tell him it has to come through the project manager in writing as a variation, and inform your PM the same day",
        "Do it, and inform the project manager afterwards",
      ],
      answer: 2,
      explanation: "The instruction may well be reasonable; the route is what makes it payable and traceable. Doing it first and reporting later removes both.",
    },
  ],
};

const SITE_SUPERVISOR: RolePaper = {
  id: "HAG-ROLE-SITE-SUPERVISOR-v1",
  position: "Site Supervisor",
  department: "Site Team",
  sections: [
    { id: "A", name: "Daily Execution & Manpower", count: 3 },
    { id: "B", name: "Quality & Checking", count: 3 },
    { id: "C", name: "Safety & Housekeeping", count: 3 },
    { id: "D", name: "Reporting & Escalation", count: 3 },
  ],
  questions: [
    {
      n: 1, section: "A",
      scenario: "Twelve workers have reported, you had planned for eighteen, and today's target is tiling a full floor.",
      q: "What is the best action?",
      options: [
        "Start and see how far the work gets",
        "Re-plan the day to complete a smaller area fully and to the required quality, and tell the engineer about the shortfall immediately",
        "Ask the twelve to work faster",
        "Send the twelve home and restart tomorrow",
      ],
      answer: 1,
      explanation: "A smaller area finished properly is worth more than a whole floor half-done, and the engineer can only re-plan around a shortfall he is told about today.",
    },
    {
      n: 2, section: "A",
      q: "What is the first thing a supervisor should do at the start of a shift?",
      options: [
        "Take attendance and brief each gang on what they are doing, where, and to what standard",
        "Check the material stock",
        "Call the engineer for instructions",
        "Inspect the previous day's work",
      ],
      answer: 0,
      explanation: "A gang that starts without a clear allocation and standard produces work that has to be checked twice. Everything else in the day depends on that first briefing.",
    },
    {
      n: 3, section: "A",
      scenario: "A gang finishes its allotted work by 2pm.",
      q: "What is the best action?",
      options: [
        "Let them leave early",
        "Report it to the engineer and get them allocated to the next priority activity",
        "Ask them to redo part of the work to fill the time",
        "Give them a break until the next day",
      ],
      answer: 1,
      explanation: "Spare capacity found at 2pm is half a day of progress if it is reallocated, and nothing at all if it is not. Filling time with rework is worse than either.",
    },
    {
      n: 4, section: "B",
      q: "When should a supervisor check work?",
      options: [
        "At the end of the day",
        "While it is being done, and at every stage that is about to be covered up",
        "When the engineer asks for a check",
        "When there is a complaint",
      ],
      answer: 1,
      explanation: "A defect caught in the first metre is an instruction; the same defect caught at the end of the day is demolition.",
    },
    {
      n: 5, section: "B",
      scenario: "A tile course is running a few millimetres out of level over three metres.",
      q: "What should you do?",
      options: [
        "Continue — it will not be noticed",
        "Stop the gang, correct the line and level now, and check the reference line before restarting",
        "Complete the room and correct it at the end",
        "Report it to the engineer at the end of the day",
      ],
      answer: 1,
      explanation: "An error in the reference line multiplies across the room. Stopping now costs a few tiles; completing the room costs the room.",
    },
    {
      n: 6, section: "B",
      q: "Why must material be checked at the time of delivery rather than at the time of use?",
      options: [
        "It is easier to do then",
        "Wrong or damaged material can still be rejected and returned, and the shortage is known while there is time to act on it",
        "Because the driver is waiting",
        "It is the storekeeper's responsibility, not the supervisor's",
      ],
      answer: 1,
      explanation: "Once the vehicle has left and the material is opened, the argument is about who damaged it — and you are short on the day you need it.",
    },
    {
      n: 7, section: "C",
      q: "A scaffold has been erected by a subcontractor. Before workers use it, what must happen?",
      options: [
        "It must be inspected and cleared for use by a competent person",
        "Nothing — it is the subcontractor's responsibility",
        "The workers can test it themselves",
        "It can be used if it looks stable",
      ],
      answer: 0,
      explanation: "Access equipment is cleared before use, by someone competent to clear it. Whose scaffold it is does not change who falls off it.",
    },
    {
      n: 8, section: "C",
      q: "Why does housekeeping matter on an active site?",
      options: [
        "It looks good for the client",
        "Most slips, trips and falls and much of the material damage come from a cluttered work area, and clutter slows the work down",
        "It is needed only before a client visit",
        "It keeps idle workers occupied",
      ],
      answer: 1,
      explanation: "Housekeeping is a safety and productivity control that happens to look tidy — not a presentation activity done before a visit.",
    },
    {
      n: 9, section: "C",
      scenario: "You see an electrical cable lying in standing water in a work area.",
      q: "What is the first action?",
      options: [
        "Mention it to the electrician when you next see him",
        "Barricade the area, get the supply isolated, and have it corrected before anyone works there",
        "Move the cable to one side",
        "Note it in the daily report",
      ],
      answer: 1,
      explanation: "Isolate first, then correct. Moving a live cable by hand is the version of this that kills someone.",
    },
    {
      n: 10, section: "D",
      q: "What makes a daily report useful to the engineer?",
      options: [
        "That it is detailed and long",
        "That it states what was actually completed against what was planned, with the reason for any shortfall",
        "That it lists the workers present",
        "That it includes photographs",
      ],
      answer: 1,
      explanation: "Planned versus actual, with a reason, is what allows a decision tomorrow. A list of activities without that is a diary.",
    },
    {
      n: 11, section: "D",
      scenario: "You have been told to complete a work by evening, but the material needed will not reach site until tomorrow.",
      q: "What should you do?",
      options: [
        "Wait for the material and explain tomorrow",
        "Tell the engineer as soon as you know, and ask for the gang to be redeployed to other work today",
        "Use whatever similar material is available on site",
        "Complete whatever part of the work you can",
      ],
      answer: 1,
      explanation: "The material is not recoverable today but the labour is. Substituting material on your own authority turns a delay into a defect.",
    },
    {
      n: 12, section: "D",
      scenario: "Your engineer is on leave and an urgent decision is needed on site.",
      q: "What is the best action?",
      options: [
        "Take the decision yourself",
        "Stop all work until he returns",
        "Escalate to the next person in the reporting line, get the decision, and record what was decided and by whom",
        "Ask the client's representative to decide",
      ],
      answer: 2,
      explanation: "An absent engineer does not remove the reporting line. Recording who decided is what protects you if the decision is later questioned.",
    },
  ],
};

const CIVIL_ENGINEER: RolePaper = {
  id: "HAG-ROLE-CIVIL-ENGINEER-v1",
  position: "Civil Engineer",
  department: "Site Team",
  sections: [
    { id: "A", name: "Civil Works & Materials", count: 3 },
    { id: "B", name: "Quality Control & Testing", count: 3 },
    { id: "C", name: "Measurement & Billing", count: 3 },
    { id: "D", name: "Site Judgement", count: 3 },
  ],
  questions: [
    {
      n: 1, section: "A",
      q: "What does the grade M25 specify in concrete?",
      options: [
        "The quantity of cement per cubic metre",
        "A characteristic compressive strength of 25 N/mm² at 28 days",
        "A maximum aggregate size of 25mm",
        "The slump value",
      ],
      answer: 1,
      explanation: "The number in a concrete grade is the 28-day characteristic compressive strength in N/mm². The mix proportions follow from it, not the other way round.",
    },
    {
      n: 2, section: "A",
      q: "What is the main reason concrete must be cured?",
      options: [
        "To keep the surface clean",
        "To retain moisture so hydration continues and the design strength develops",
        "To cool it down after placing",
        "To make the surface smooth",
      ],
      answer: 1,
      explanation: "Concrete gains strength by hydration, not by drying. Concrete allowed to dry out early never reaches its design strength, however good the mix was.",
    },
    {
      n: 3, section: "A",
      q: "Adding water beyond the design water-cement ratio primarily does what?",
      options: [
        "Increases the strength",
        "Reduces the strength and increases shrinkage and permeability",
        "Has no effect if extra cement is added later",
        "Improves the durability",
      ],
      answer: 1,
      explanation: "Water added for workability at the point of placing is the most common single cause of weak, porous concrete on Indian sites.",
    },
    {
      n: 4, section: "B",
      q: "Cube samples are taken at the time of pouring in order to:",
      options: [
        "Show the client that work is happening",
        "Verify that the concrete actually placed achieved the specified strength",
        "Check the slump of the mix",
        "Estimate the quantity poured",
      ],
      answer: 1,
      explanation: "The cube is the evidence for that pour, from that batch, on that day. Taken at any other moment it proves nothing about what is in the structure.",
    },
    {
      n: 5, section: "B",
      q: "A slump test checks:",
      options: [
        "The compressive strength",
        "The workability and consistency of the fresh mix",
        "The cement content",
        "The adequacy of curing",
      ],
      answer: 1,
      explanation: "Slump is a workability check done at the point of placing. It is a useful early warning of added water, but it is not a strength test.",
    },
    {
      n: 6, section: "B",
      scenario: "Seven-day cube results come back well below expectation.",
      q: "What is the best action?",
      options: [
        "Wait for the 28-day result before doing anything",
        "Flag it immediately, hold further pours from the same mix design and source pending review, and investigate the mix, the materials and the batching",
        "Take fresh cubes from the next pour and compare",
        "Increase the curing on the element already poured",
      ],
      answer: 1,
      explanation: "Waiting three more weeks means three more weeks of pours from the same suspect source. The 7-day result is early enough to stop that.",
    },
    {
      n: 7, section: "C",
      q: "What is a deduction in the measurement of brickwork?",
      options: [
        "Money withheld for poor quality",
        "The volume of openings such as doors and windows, removed from the gross measured quantity as per the method of measurement",
        "A discount given to the client",
        "Retention money",
      ],
      answer: 1,
      explanation: "Deductions are a measurement rule, not a commercial penalty. Missing them is how a bill quietly overstates the quantity built.",
    },
    {
      n: 8, section: "C",
      q: "Retention money in a construction contract is held to:",
      options: [
        "Reduce the contract value",
        "Secure the correction of defects during the defect liability period",
        "Pay for materials",
        "Cover the contractor's taxes",
      ],
      answer: 1,
      explanation: "Retention is the leverage that survives completion. It is released when the defect liability period closes, not when the work is handed over.",
    },
    {
      n: 9, section: "C",
      scenario: "A contractor's bill claims a quantity higher than your joint measurement record.",
      q: "What is the best action?",
      options: [
        "Pass it — the difference is small",
        "Certify only the jointly measured quantity, share the measurement basis in writing, and let them submit any additional claim with evidence",
        "Reject the whole bill",
        "Ask the project manager to decide without checking",
      ],
      answer: 1,
      explanation: "Certify what is proven and leave the route open for what is not. Passing an unverified quantity sets the precedent for every bill after it.",
    },
    {
      n: 10, section: "D",
      scenario: "An excavation three metres deep in loose soil is being worked in without shoring.",
      q: "What should you do?",
      options: [
        "Allow it if the work will be finished today",
        "Stop the work until proper shoring or benching is in place",
        "Ask the workers to be careful",
        "Reduce the number of workers in the pit",
      ],
      answer: 1,
      explanation: "A trench collapse gives no warning and does not care how long the work had left. Fewer people in an unsupported pit is still people in an unsupported pit.",
    },
    {
      n: 11, section: "D",
      scenario: "A structural crack appears in an existing column during renovation work.",
      q: "What is the first action?",
      options: [
        "Fill it and keep it under observation",
        "Stop work in that area, support or barricade as needed, and get the structural consultant to inspect before anything else is done",
        "Continue — the building is old and it is probably long-standing",
        "Photograph it and raise it at the weekly meeting",
      ],
      answer: 1,
      explanation: "A new crack in a load-bearing element during work is a structural question, not a finishing one. Filling it destroys the evidence needed to assess it.",
    },
    {
      n: 12, section: "D",
      scenario: "The client asks you to reduce the reinforcement in a slab to save cost.",
      q: "What is the best action?",
      options: [
        "Reduce it marginally, within a safe margin",
        "Explain that any change to the structural design has to come from the structural consultant in writing, and route it there",
        "Make the change and record it in the site diary",
        "Ask the contractor whether it is feasible",
      ],
      answer: 1,
      explanation: "Reinforcement is not a site variable and there is no safe margin to give away informally. The route back to the designer is the only correct answer.",
    },
  ],
};

const MEP_ENGINEER: RolePaper = {
  id: "HAG-ROLE-MEP-ENGINEER-v1",
  position: "MEP Engineer",
  department: "Site Team",
  sections: [
    { id: "A", name: "Electrical & Plumbing", count: 3 },
    { id: "B", name: "HVAC & Fire", count: 3 },
    { id: "C", name: "Services Coordination", count: 3 },
    { id: "D", name: "Testing & Handover", count: 3 },
  ],
  questions: [
    {
      n: 1, section: "A",
      q: "The main purpose of earthing an electrical installation is to:",
      options: [
        "Reduce the electricity consumption",
        "Provide a low-resistance path for fault current so the protective device operates and exposed metal does not stay live",
        "Improve the power factor",
        "Stabilise the supply voltage",
      ],
      answer: 1,
      explanation: "Earthing exists so that a fault becomes a large current that trips something, instead of a live enclosure waiting for someone to touch it.",
    },
    {
      n: 2, section: "A",
      q: "An MCB protects primarily against:",
      options: [
        "Earth leakage through a person",
        "Overload and short circuit in the circuit",
        "Voltage fluctuation",
        "Lightning strikes",
      ],
      answer: 1,
      explanation: "Overload and short circuit are the MCB's job; earth leakage through a person is the RCCB's. Confusing the two is how installations end up protected against the wrong thing.",
    },
    {
      n: 3, section: "A",
      q: "A trap under a plumbing fixture is provided to:",
      options: [
        "Slow the flow of water",
        "Hold a water seal that stops foul gases entering the room",
        "Filter out solids",
        "Reduce the noise of drainage",
      ],
      answer: 1,
      explanation: "The trap's water seal is the only thing between the room and the drainage system. A trap that dries out or is siphoned stops working while still looking correct.",
    },
    {
      n: 4, section: "B",
      q: "One TR (ton of refrigeration) is a unit of:",
      options: [
        "Airflow",
        "Cooling capacity",
        "Electrical load",
        "The weight of the unit",
      ],
      answer: 1,
      explanation: "TR measures heat removed, not power drawn or air moved. The electrical load follows from it via the unit's efficiency.",
    },
    {
      n: 5, section: "B",
      q: "Why must an air-conditioned space have a fresh-air provision?",
      options: [
        "To reduce the cooling load",
        "To maintain indoor air quality by diluting CO₂ and contaminants for the occupants",
        "To balance the duct pressure",
        "It is not required in interior fit-outs",
      ],
      answer: 1,
      explanation: "Fresh air increases the cooling load — it is provided in spite of that, because a sealed recirculating space becomes unfit to occupy.",
    },
    {
      n: 6, section: "B",
      q: "In a sprinkler system, a sprinkler head operates when:",
      options: [
        "The fire alarm panel triggers it",
        "Heat at that head bursts its glass bulb or fusible link, so only the heads near the fire discharge",
        "All heads discharge together on detection",
        "Somebody opens the control valve",
      ],
      answer: 1,
      explanation: "Sprinklers are individually heat-operated. The belief that a whole floor discharges at once comes from films, and it changes how people design and defend the system.",
    },
    {
      n: 7, section: "C",
      scenario: "The false-ceiling void leaves 250mm, and the duct, the sprinkler pipe and the light fitting together need more than that.",
      q: "What is the best action?",
      options: [
        "Reduce the duct size on site to make it fit",
        "Raise it as a clash on a coordinated services drawing and resolve it jointly with the architect and structural team before anything is installed",
        "Lower the ceiling level without informing the designer",
        "Install the duct first and let the other trades work around it",
      ],
      answer: 1,
      explanation: "Resizing a duct on site changes the airflow the system was designed for. A clash resolved on paper costs a drawing; resolved on site it costs three trades.",
    },
    {
      n: 8, section: "C",
      q: "What is the purpose of a services coordination (composite) drawing?",
      options: [
        "To show the client where the services run",
        "To overlay all services and the structure so clashes are found on paper before they are found on site",
        "To estimate the quantities",
        "To satisfy the consultant's requirement",
      ],
      answer: 1,
      explanation: "The composite drawing is the cheapest place to have the argument. Every clash not found there is found by a contractor with material already on site.",
    },
    {
      n: 9, section: "C",
      scenario: "The civil team is ready to cast a slab and your conduits and sleeves are not laid.",
      q: "What should you do?",
      options: [
        "Let them cast — conduits can be chased in afterwards",
        "Hold the pour until the sleeves and conduits are laid and checked, because chasing a cast slab damages it and some sleeves cannot be added at all",
        "Lay only the sleeves and chase the conduits later",
        "Let them cast and core-cut the openings afterwards",
      ],
      answer: 1,
      explanation: "Holding a pour is expensive and unpopular, and it is still cheaper than core-cutting a structural slab in the positions you needed.",
    },
    {
      n: 10, section: "D",
      q: "A plumbing line is pressure-tested before it is concealed because:",
      options: [
        "It is a contractual requirement",
        "A leak found after the finishes are complete costs many times more to fix, and damages other completed work",
        "It checks the flow rate",
        "It removes air from the line",
      ],
      answer: 1,
      explanation: "Concealment is the point of no return. Everything the test would have found becomes a demolition job the moment the wall closes.",
    },
    {
      n: 11, section: "D",
      q: "An insulation-resistance (megger) test on a cable checks:",
      options: [
        "The current rating",
        "The integrity of the insulation between conductors and to earth, before the cable is energised",
        "The voltage drop under load",
        "The length of the cable run",
      ],
      answer: 1,
      explanation: "It confirms the insulation has not been damaged during pulling or installation — checked before energising, because after that the damage announces itself.",
    },
    {
      n: 12, section: "D",
      q: "What must be handed over with a completed MEP installation?",
      options: [
        "The final invoice",
        "As-built drawings, test reports, warranties and O&M manuals",
        "A photographic record of the installation",
        "The list of workers deployed",
      ],
      answer: 1,
      explanation: "The building has to be operated and maintained after you leave. Without as-builts and test records, the next fault starts with opening the ceiling to find out what is there.",
    },
  ],
};

const INTERIOR_DESIGNER: RolePaper = {
  id: "HAG-ROLE-INTERIOR-DESIGNER-v1",
  position: "Interior Designer",
  department: "Interiors",
  sections: [
    { id: "A", name: "Design & Detailing", count: 3 },
    { id: "B", name: "Materials & Finishes", count: 3 },
    { id: "C", name: "Client Handling & Revisions", count: 3 },
    { id: "D", name: "Site Feasibility", count: 3 },
  ],
  questions: [
    {
      n: 1, section: "A",
      q: "What is the main purpose of a 1:5 or 1:10 detail drawing for a joinery item?",
      options: [
        "To make the drawing set look complete",
        "To define exactly how the item is built — materials, joints, edges, hardware and tolerances — so the factory and the site build the same thing",
        "To present the design to the client",
        "To calculate the cost",
      ],
      answer: 1,
      explanation: "A layout says where it goes; the detail says what it is. Anything not detailed gets decided by whoever is holding the tool.",
    },
    {
      n: 2, section: "A",
      q: "The standard working height of a kitchen counter is closest to:",
      options: ["650mm", "850–900mm", "1050mm", "1200mm"],
      answer: 1,
      explanation: "850–900mm is the normal working height. Anthropometric dimensions like this are the ones a designer is expected to know without checking.",
    },
    {
      n: 3, section: "A",
      q: "In a drawing set, a finish schedule specifies:",
      options: [
        "The date by which each finish will be completed",
        "The material, finish, colour or code, and location for every surface",
        "The list of approved vendors",
        "The sequence in which finishing work is carried out",
      ],
      answer: 1,
      explanation: "It is a specification, not a programme. It exists so no surface on the project is left to be chosen by whoever reaches it first.",
    },
    {
      n: 4, section: "B",
      q: "For a wardrobe shutter in a humid coastal apartment, which substrate is generally the more appropriate choice?",
      options: ["MDF", "BWP or BWR grade plywood", "Particle board", "HDF"],
      answer: 1,
      explanation: "Boiling-water-proof or boiling-water-resistant plywood uses a moisture-resistant adhesive. MDF and particle board swell and lose their fixings in humid conditions.",
    },
    {
      n: 5, section: "B",
      q: "Laminate and veneer differ mainly in that:",
      options: [
        "Laminate is natural wood and veneer is printed",
        "Veneer is a thin layer of real wood polished after fixing, while laminate is a factory-finished pressed sheet",
        "They are the same product under two names",
        "Veneer is the cheaper of the two",
      ],
      answer: 1,
      explanation: "Veneer is real wood and needs a site or factory polish, and it varies between sheets. Laminate arrives finished and consistent. That difference drives cost, lead time and how it is approved.",
    },
    {
      n: 6, section: "B",
      q: "What does a dry-area / wet-area distinction change in an interior specification?",
      options: [
        "Nothing, only the layout",
        "The material, adhesive, waterproofing and joinery substrate all have to suit moisture exposure",
        "Only the floor finish",
        "Only the lighting specification",
      ],
      answer: 1,
      explanation: "It runs through the whole build-up, not just the visible surface. Most bathroom failures are an adhesive or a substrate that belonged in a dry area.",
    },
    {
      n: 7, section: "C",
      scenario: "The client asks for the fourth change to the same layout, after the drawings were signed off.",
      q: "What is the best action?",
      options: [
        "Refuse — the layout was approved",
        "Make the change quietly to keep the client happy",
        "Record it as a design revision, tell the client the cost and time impact before doing it, and proceed once that is confirmed",
        "Escalate to your manager without speaking to the client",
      ],
      answer: 2,
      explanation: "Changes after sign-off are normal; absorbing them silently is what makes a project unprofitable. The client can only decide sensibly if the impact is stated first.",
    },
    {
      n: 8, section: "C",
      scenario: "The client dislikes a finish after it is installed, although it matches the approved sample.",
      q: "What is the best response?",
      options: [
        "Point out that it was approved and decline to change it",
        "Replace it free of cost",
        "Show the approved sample and the approval record, explain the implication, and offer the options with their cost and time so the client can decide",
        "Attribute it to the contractor's execution",
      ],
      answer: 2,
      explanation: "Being right about the approval does not resolve it. Turning it into a costed choice keeps the relationship and keeps the commercial position.",
    },
    {
      n: 9, section: "C",
      q: "Why should a material sample be signed and dated by the client?",
      options: [
        "It is a formality",
        "It fixes exactly which shade and finish was approved, because the same product code varies between batches and memory does not settle it",
        "To keep track of the vendor",
        "To prove the site visit took place",
      ],
      answer: 1,
      explanation: "Finish disputes are almost always about shade, and shade is exactly what a signed physical sample records and a product code does not.",
    },
    {
      n: 10, section: "D",
      scenario: "Your design shows a full-height mirror on a wall that turns out to contain an electrical panel.",
      q: "What is the best action?",
      options: [
        "Have the panel relocated",
        "Check what the panel serves and whether it must stay accessible — access to a live panel cannot be blocked — and revise the design accordingly",
        "Provide the mirror with a small cut-out around it",
        "Continue — the panel is rarely opened",
      ],
      answer: 1,
      explanation: "Panel access is a safety and statutory requirement, not a preference. Relocating a panel may be the answer, but only after you know what it serves.",
    },
    {
      n: 11, section: "D",
      scenario: "A site measurement comes back 60mm smaller than the drawing, on a wall of fitted units.",
      q: "What is the best action?",
      options: [
        "Force-fit the units on site",
        "Revise the module sizes, or provide a scribe or filler to absorb the difference, before the units are manufactured",
        "Trim one unit on site with a cutter",
        "Ask the civil team to chip the wall back",
      ],
      answer: 1,
      explanation: "Walls are never exactly as drawn, which is why fitted joinery is designed with somewhere for the tolerance to go. Cutting a finished unit on site shows.",
    },
    {
      n: 12, section: "D",
      q: "When should the designer visit site during execution?",
      options: [
        "Only at handover",
        "At the stages where the design is being set out and where finishes are being fixed, so a deviation is caught while it can still be corrected",
        "Whenever the client asks for a visit",
        "Every day, throughout the project",
      ],
      answer: 1,
      explanation: "Visits are worth most at setting-out and at finishing, because those are the two moments where a deviation is still cheap to correct.",
    },
  ],
};

const ARCHITECT: RolePaper = {
  id: "HAG-ROLE-ARCHITECT-v1",
  position: "Architect",
  department: "Interiors",
  sections: [
    { id: "A", name: "Drawings & Documentation", count: 3 },
    { id: "B", name: "Codes, Approvals & Standards", count: 3 },
    { id: "C", name: "Consultant Coordination", count: 3 },
    { id: "D", name: "Design Judgement", count: 3 },
  ],
  questions: [
    {
      n: 1, section: "A",
      q: "What distinguishes a Good For Construction drawing from a design drawing?",
      options: [
        "The sheet size and title block",
        "It is the coordinated, checked and released version that site is authorised to build from, carrying a revision number",
        "It is printed in colour",
        "It is issued only to the client",
      ],
      answer: 1,
      explanation: "GFC is a status, not a style. It means the drawing has been coordinated and released, and that someone has taken responsibility for it.",
    },
    {
      n: 2, section: "A",
      q: "Why does every issued drawing carry a revision number and date?",
      options: [
        "For filing convenience",
        "So site can be certain it is building from the latest released information, and superseded copies can be withdrawn",
        "For the client's records",
        "To count how many changes were made",
      ],
      answer: 1,
      explanation: "Without a revision, two people holding the same sheet number cannot tell whose copy is current — which is exactly how work gets built to a superseded detail.",
    },
    {
      n: 3, section: "A",
      q: "A scale of 1:50 means:",
      options: [
        "1mm on the drawing represents 50mm actual",
        "50mm on the drawing represents 1m actual",
        "The drawing is 50 times larger than actual",
        "The drawing is indicative and not to scale",
      ],
      answer: 0,
      explanation: "The ratio is drawing:actual. At 1:50, a 20mm line on paper is a metre on site.",
    },
    {
      n: 4, section: "B",
      q: "The National Building Code of India primarily provides:",
      options: [
        "Standard contract terms",
        "Requirements and guidance for building design, construction, fire and life safety, and services",
        "Standard material rates",
        "Labour law requirements",
      ],
      answer: 1,
      explanation: "The NBC is the technical baseline for how a building must be designed and made safe. Contracts and rates are governed elsewhere entirely.",
    },
    {
      n: 5, section: "B",
      q: "What is FAR / FSI?",
      options: [
        "The ratio of permitted built-up area to the plot area",
        "The required setback from the plot boundary",
        "The permitted floor-to-floor height",
        "The required number of parking spaces",
      ],
      answer: 0,
      explanation: "FAR caps how much you may build on a given plot. Setbacks, heights and parking are separate controls that apply on top of it.",
    },
    {
      n: 6, section: "B",
      q: "In a commercial fit-out, why must the means of egress be checked before a layout is finalised?",
      options: [
        "Because the client expects it",
        "Because exit width, travel distance and unobstructed access are statutory life-safety requirements that a layout cannot compromise",
        "Because it applies only to buildings above 15m",
        "Because it is the MEP consultant's responsibility",
      ],
      answer: 1,
      explanation: "Egress is not negotiable against a layout preference, and finding the conflict after the layout is approved means redoing the layout.",
    },
    {
      n: 7, section: "C",
      scenario: "The structural consultant's beam depth destroys your ceiling height in a key area.",
      q: "What is the best action?",
      options: [
        "Have the beam reduced on site",
        "Take it back to the structural consultant with the architectural requirement and resolve it jointly — alternative framing, rerouted services, or an accepted revised ceiling — before drawings are released",
        "Show the lower ceiling and explain it to the client at handover",
        "Leave it — the contractor will find a way",
      ],
      answer: 1,
      explanation: "The resolution has to be agreed by the person responsible for the structure, and it has to happen before release — after release the site is already building it.",
    },
    {
      n: 8, section: "C",
      q: "What is the value of a design freeze date?",
      options: [
        "It stops the client from asking for changes",
        "It fixes the point after which changes are handled as recorded variations with cost and time impact, so procurement and fabrication can start on stable information",
        "It marks the end of the architect's involvement",
        "It is purely a contractual formality",
      ],
      answer: 1,
      explanation: "A freeze does not forbid change — it changes how change is handled, which is what lets long-lead items be ordered at all.",
    },
    {
      n: 9, section: "C",
      scenario: "The contractor raises an RFI on a detail that is genuinely unclear in your drawing.",
      q: "What is the best response?",
      options: [
        "Tell them to build it the way it is normally done",
        "Issue a written clarification with a revised detail and a new revision number, and reissue it to everyone holding that drawing",
        "Explain it to them over a call",
        "Mark it up on the site copy of the drawing",
      ],
      answer: 1,
      explanation: "If one contractor found it unclear, everyone holding that drawing has the same ambiguity. A site mark-up fixes it for one copy only.",
    },
    {
      n: 10, section: "D",
      scenario: "An approved material is unavailable and the project cannot wait for it.",
      q: "What is the best action?",
      options: [
        "Let the contractor substitute something similar",
        "Evaluate alternatives against the original performance and appearance requirements, propose one with the differences stated, and get the client's written approval",
        "Redesign the element to avoid the material",
        "Hold the project until the material is available",
      ],
      answer: 1,
      explanation: "A substitution is a design decision, so it is made against the requirement the original was chosen to meet — and it is the client's to approve, in writing.",
    },
    {
      n: 11, section: "D",
      scenario: "The client wants to remove a proposed provision that you believe is a statutory safety requirement.",
      q: "What is the best action?",
      options: [
        "Remove it — it is the client's building",
        "Explain in writing why it is a statutory safety requirement that cannot be removed, and keep the exchange on record",
        "Remove it, having recorded your verbal objection",
        "Ask the contractor to quietly leave it out",
      ],
      answer: 1,
      explanation: "A statutory requirement is not a design opinion to be overruled by the client, and a verbal objection is worth nothing when it is later examined.",
    },
    {
      n: 12, section: "D",
      q: "What is the strongest reason to visit site regularly during construction?",
      options: [
        "The client expects the architect to be present",
        "To confirm the work is being built to the released drawings, and to resolve deviations while they are still cheap to correct",
        "To supervise the labour",
        "To verify attendance and progress for billing",
      ],
      answer: 1,
      explanation: "The architect's site role is conformity and early resolution, not supervision — which belongs to the contractor's own line.",
    },
  ],
};

const FACADE_FACTORY_MANAGER: RolePaper = {
  // §2.2: the cedilla in "Façade" is load-bearing — the form dropdown value and
  // the pre-filled ad links depend on the exact string. Do not normalise it here.
  id: "HAG-ROLE-FACADE-FACTORY-MANAGER-v1",
  position: "Façade Factory Manager",
  department: "Fabrication / Factory Operations",
  sections: [
    { id: "A", name: "Aluminium Fabrication", count: 3 },
    { id: "B", name: "Production Planning", count: 3 },
    { id: "C", name: "Quality & Testing", count: 3 },
    { id: "D", name: "Manpower & Dispatch", count: 3 },
  ],
  questions: [
    {
      n: 1, section: "A",
      q: "In an aluminium window, what is the primary purpose of a thermal break in the profile?",
      options: [
        "To increase the strength of the frame",
        "To reduce heat transfer through the frame between inside and outside",
        "To hold the glass in position",
        "To provide a drainage path",
      ],
      answer: 1,
      explanation: "Aluminium conducts heat readily. The break is a non-conductive separation between the inner and outer halves of the profile, and it is why the frame does not sweat.",
    },
    {
      n: 2, section: "A",
      q: "Weep holes in an aluminium window frame are provided to:",
      options: [
        "Ventilate the room",
        "Drain water that has entered the frame back to the outside",
        "Reduce the weight of the profile",
        "Allow the glass units to be replaced",
      ],
      answer: 1,
      explanation: "Water will get into the frame; the design accepts that and gives it a controlled way out. Blocked or omitted weep holes are a common cause of leakage complaints.",
    },
    {
      n: 3, section: "A",
      q: "Anodising and powder coating are both:",
      options: [
        "Structural treatments that increase the profile's strength",
        "Surface finishing treatments for aluminium, chosen for appearance and corrosion resistance",
        "Methods of joining profiles",
        "Types of coating applied to glass",
      ],
      answer: 1,
      explanation: "Both are finishes on the aluminium surface. Neither adds structural capacity, and the choice between them is about appearance, durability and cost.",
    },
    {
      n: 4, section: "B",
      scenario: "Three site orders are due in the same week and your CNC capacity covers only two.",
      q: "What is the best action?",
      options: [
        "Run them in the order the orders were received",
        "Confirm the actual installation dates with the sites, run the one genuinely needed first, and give the other site a firm revised date",
        "Run partial quantities of all three",
        "Ask all three sites to wait a week",
      ],
      answer: 1,
      explanation: "The order date is not the need date. Partial quantities of three orders means no site can start installing, which is the worst of the four outcomes.",
    },
    {
      n: 5, section: "B",
      q: "Why is cutting optimisation, or nesting, important in aluminium fabrication?",
      options: [
        "It makes the cutting operation faster",
        "It reduces offcut wastage from a fixed-length extrusion, which is a direct material cost",
        "It improves the surface finish",
        "It reduces wear on the machine",
      ],
      answer: 1,
      explanation: "Extrusions come in fixed lengths and the offcut is paid for either way. Nesting is one of the few levers that reduces material cost without touching quality.",
    },
    {
      n: 6, section: "B",
      q: "Before starting bulk production of a façade element, what should be produced first?",
      options: [
        "The full quantity for the first floor",
        "An approved prototype or mock-up, tested against the specification, so an error is caught in one unit rather than in hundreds",
        "The most difficult unit in the order",
        "Nothing — the production drawings are sufficient",
      ],
      answer: 1,
      explanation: "The prototype is where a specification error costs one unit. After bulk release, the same error is a recall from site.",
    },
    {
      n: 7, section: "C",
      q: "A water-leakage test on a façade sample checks:",
      options: [
        "The strength of the glass",
        "That the joints, gaskets and drainage keep water out under the specified pressure",
        "The thermal performance of the assembly",
        "The consistency of the colour",
      ],
      answer: 1,
      explanation: "It tests the assembly as a system — joints, gaskets and drainage together. Individually good components still leak if they are not assembled correctly.",
    },
    {
      n: 8, section: "C",
      scenario: "A batch of profiles arrives with a visible shade variation from the approved sample.",
      q: "What is the best action?",
      options: [
        "Use them on the rear elevation where it will not be noticed",
        "Quarantine the batch, raise it with the supplier, and keep it out of production until it is accepted in writing",
        "Use them and inform the site afterwards",
        "Mix them with the correct batch so the difference is spread out",
      ],
      answer: 1,
      explanation: "Shade variation on a façade reads across the whole elevation in daylight. Mixing or hiding it converts a supplier's problem into your rework.",
    },
    {
      n: 9, section: "C",
      q: "Why must sealant be applied to a clean, dry and, where required, primed surface?",
      options: [
        "It gives a neater appearance",
        "Adhesion fails otherwise, and the joint leaks even though it looks complete",
        "It cures faster that way",
        "It reduces the quantity of sealant used",
      ],
      answer: 1,
      explanation: "A sealant joint that has not adhered looks identical to one that has. The failure appears in the first monsoon, on an installed façade.",
    },
    {
      n: 10, section: "D",
      scenario: "A dispatch of 40 units is ready, but two of them have failed inspection.",
      q: "What is the best action?",
      options: [
        "Dispatch all 40 and replace the two later",
        "Dispatch the 38 passed units with a packing list that states the shortfall and a committed date for the two, and inform the site",
        "Hold the entire dispatch until all 40 pass",
        "Dispatch the two as well and let the site decide whether to use them",
      ],
      answer: 1,
      explanation: "Holding 38 good units to wait for two stops the site's installation entirely. Sending known-failed units transfers your rejection to somebody else's wall.",
    },
    {
      n: 11, section: "D",
      q: "What is the most important reason to number and label every fabricated unit?",
      options: [
        "For stock counting",
        "Each unit belongs to a specific opening; without identification the site cannot install it and it cannot be traced back to its measurement",
        "For billing purposes",
        "It presents a more professional image",
      ],
      answer: 1,
      explanation: "Façade units are made to individual opening dimensions. An unlabelled unit on site is a unit that has to be re-measured against every opening.",
    },
    {
      n: 12, section: "D",
      scenario: "An operator is running a machine with its guard removed because it is faster that way.",
      q: "What should you do?",
      options: [
        "Allow it while the order is urgent",
        "Stop the machine, restore the guard, and deal with it as a safety and discipline matter",
        "Warn him verbally and let the work continue",
        "Raise it at the monthly review",
      ],
      answer: 1,
      explanation: "A removed guard tolerated once becomes the way the machine is run. The manager's response is the standard, whatever the notice board says.",
    },
  ],
};

const FACTORY_OPERATIONS: RolePaper = {
  id: "HAG-ROLE-FACTORY-OPERATIONS-v1",
  position: "Factory Operations",
  department: "Fabrication / Factory Operations",
  sections: [
    { id: "A", name: "Production & Machines", count: 3 },
    { id: "B", name: "Material & Inventory", count: 3 },
    { id: "C", name: "Quality & Rework", count: 3 },
    { id: "D", name: "Safety & Discipline", count: 3 },
  ],
  questions: [
    {
      n: 1, section: "A",
      q: "What does a job card or work order on the shop floor tell the operator?",
      options: [
        "The wages payable for the job",
        "What to make, how many, to which drawing or specification, and by when",
        "Only which machine to use",
        "The name of the customer",
      ],
      answer: 1,
      explanation: "The job card is the instruction. Anything it does not state gets supplied by the operator's assumption, which is where variation enters.",
    },
    {
      n: 2, section: "A",
      q: "Preventive maintenance is carried out in order to:",
      options: [
        "Repair a machine after it has failed",
        "Keep the machine in working condition so unplanned breakdowns and rejections are avoided",
        "Keep the machine clean and presentable",
        "Satisfy the auditor",
      ],
      answer: 1,
      explanation: "The word is preventive — it is done on a schedule while the machine is still running. Maintenance after a failure is a breakdown, by definition.",
    },
    {
      n: 3, section: "A",
      scenario: "A machine starts producing parts slightly outside tolerance.",
      q: "What is the first action?",
      options: [
        "Continue, and sort the bad parts out later",
        "Stop production, quarantine everything made since the last good check, and get the machine checked and reset before restarting",
        "Widen the tolerance limit for this batch",
        "Report it at the end of the shift",
      ],
      answer: 1,
      explanation: "You do not know when it drifted, so everything back to the last good check is suspect. Continuing simply adds to the quantity that has to be sorted.",
    },
    {
      n: 4, section: "B",
      q: "Why is FIFO used for issuing stock?",
      options: [
        "It is easier to record",
        "Older stock is consumed first, so material does not deteriorate or become obsolete sitting in storage",
        "It reduces the value of stock held",
        "It is a supplier requirement",
      ],
      answer: 1,
      explanation: "Without FIFO the oldest stock is always at the back and is eventually written off, having been paid for.",
    },
    {
      n: 5, section: "B",
      q: "A physical stock count does not match the system stock. What is the correct response?",
      options: [
        "Correct the system figure to match the count",
        "Investigate the difference — unbooked issues, a wrong receipt, damage or pilferage — and then correct it with a recorded adjustment",
        "Ignore it if the difference is small",
        "Order more material to cover the shortfall",
      ],
      answer: 1,
      explanation: "Overwriting the system hides the cause, and the same difference reappears next month. The adjustment comes after the reason is known, not instead of it.",
    },
    {
      n: 6, section: "B",
      q: "What is a reorder level?",
      options: [
        "The maximum stock that may be held",
        "The stock level at which a fresh purchase must be initiated so material arrives before the stock runs out",
        "The supplier's minimum order quantity",
        "The value of stock held",
      ],
      answer: 1,
      explanation: "It is set from the consumption rate and the lead time. A reorder level that ignores lead time triggers an order that arrives after production has stopped.",
    },
    {
      n: 7, section: "C",
      q: "When rejections rise, the most useful record is:",
      options: [
        "The total rejection count",
        "The rejection reason and the stage it occurred at, so the cause can be traced and corrected",
        "The name of the operator involved",
        "The shift in which they occurred",
      ],
      answer: 1,
      explanation: "A count tells you that something is wrong. Reason and stage tell you what to change — which is the only part that reduces the count.",
    },
    {
      n: 8, section: "C",
      scenario: "A rejected part can either be reworked or scrapped.",
      q: "What should decide it?",
      options: [
        "Always rework — it saves material",
        "Whether the reworked part will genuinely meet the specification, and whether reworking costs less than making a new one",
        "Always scrap — rework is unreliable",
        "The operator's preference",
      ],
      answer: 1,
      explanation: "Rework that cannot reach the specification is scrap with extra labour added. The specification question comes first, the cost question second.",
    },
    {
      n: 9, section: "C",
      q: "In-process inspection is better than final inspection alone because:",
      options: [
        "It requires fewer inspectors",
        "A defect is caught before more time and value are added to a part that will be rejected anyway",
        "It is a faster process overall",
        "It makes final inspection unnecessary",
      ],
      answer: 1,
      explanation: "The cost of a defect grows with every operation performed after it. In-process checks cap that cost; they do not replace the final check.",
    },
    {
      n: 10, section: "D",
      q: "When should PPE be worn on the shop floor?",
      options: [
        "When the supervisor is present",
        "Whenever you are in the designated area, however short the task",
        "Only while actually operating a machine",
        "During audits and client visits",
      ],
      answer: 1,
      explanation: "The injuries happen during the short task nobody bothered to put glasses on for. The rule is the area, not the task.",
    },
    {
      n: 11, section: "D",
      scenario: "A colleague is injured at a machine.",
      q: "What is the correct sequence?",
      options: [
        "Complete the running job, then attend to him",
        "Stop and isolate the machine, give first aid and get medical help, inform the supervisor, and record the incident",
        "Move him out of the area and let production continue",
        "Wait for the supervisor to arrive and decide",
      ],
      answer: 1,
      explanation: "Isolate first so the machine cannot injure the person helping, then treat, then report. The record is what stops it happening to the next person.",
    },
    {
      n: 12, section: "D",
      q: "Why is a near-miss — an incident with no injury — worth reporting?",
      options: [
        "It is not; nothing happened",
        "It reveals the same hazard that could cause an injury next time, while it can still be corrected at no cost",
        "It is required for the insurance record",
        "It identifies careless workers",
      ],
      answer: 1,
      explanation: "A near-miss is a free warning. Treating it as a way of identifying careless people is the surest way to stop hearing about them.",
    },
  ],
};

const PROCUREMENT: RolePaper = {
  id: "HAG-ROLE-PROCUREMENT-v1",
  position: "Procurement",
  department: "Procurement & Sales",
  sections: [
    { id: "A", name: "Sourcing & Vendor Selection", count: 3 },
    { id: "B", name: "Purchase Process & Documentation", count: 3 },
    { id: "C", name: "Negotiation & Commercial Terms", count: 3 },
    { id: "D", name: "Delivery & Site Coordination", count: 3 },
  ],
  questions: [
    {
      n: 1, section: "A",
      q: "When comparing three quotations, which basis is correct?",
      options: [
        "The lowest unit rate",
        "The landed cost, for the same specification, quantity, delivery date and payment terms",
        "The vendor who responded first",
        "The vendor already on the approved panel",
      ],
      answer: 1,
      explanation: "Quotes are only comparable once they are on the same basis. A lower rate with freight, taxes or a later delivery excluded is not a lower cost.",
    },
    {
      n: 2, section: "A",
      q: "What is a technical comparison, as distinct from a commercial comparison?",
      options: [
        "They are two names for the same exercise",
        "A check that each quote actually meets the required specification, done before the prices are compared at all",
        "A check of the vendor's GST registration",
        "A check of the promised delivery date",
      ],
      answer: 1,
      explanation: "Comparing prices across different specifications simply awards the order to whoever quoted the lowest specification.",
    },
    {
      n: 3, section: "A",
      q: "Why should a new vendor's capability be verified before a large first order?",
      options: [
        "It is a procedural formality",
        "A vendor who cannot deliver the quality or the quantity turns a saving into a project delay that costs more than the saving",
        "To gain leverage in the rate negotiation",
        "To satisfy the auditor",
      ],
      answer: 1,
      explanation: "The saving is certain and small; the delay risk is uncertain and large. Verification is how you find out which one you are buying.",
    },
    {
      n: 4, section: "B",
      q: "A purchase order should be raised:",
      options: [
        "After the material has arrived and been verified",
        "Before the supply, stating specification, quantity, rate, taxes, delivery date and payment terms",
        "Only for purchases above a certain value",
        "At the time the payment is made",
      ],
      answer: 1,
      explanation: "The PO is the agreement. Raised afterwards it is only a record of whatever the vendor chose to send.",
    },
    {
      n: 5, section: "B",
      q: "What is a goods receipt note for?",
      options: [
        "To place the order with the vendor",
        "To record what was actually received, in what quantity and condition, against the purchase order — it is what payment is checked against",
        "To return rejected goods",
        "To pay the transporter",
      ],
      answer: 1,
      explanation: "Without a GRN there is no independent record of what arrived, and the invoice becomes the only version of events.",
    },
    {
      n: 6, section: "B",
      q: "Three-way matching before payment compares:",
      options: [
        "Three competing quotations",
        "The purchase order, the goods receipt note and the supplier's invoice",
        "The rates of three vendors",
        "The budget, the bill and the payment made",
      ],
      answer: 1,
      explanation: "Ordered, received, invoiced. Payment is released only where all three agree — which is the basic control against paying for what never arrived.",
    },
    {
      n: 7, section: "C",
      q: "The difference between an ex-works rate and a delivered-at-site rate changes:",
      options: [
        "Only the paperwork",
        "Who bears the transport cost and the risk until the material reaches site — so the two rates cannot be compared as they stand",
        "Only the delivery date",
        "Nothing of substance",
      ],
      answer: 1,
      explanation: "Ex-works means the cost and the risk in transit are yours. Comparing it directly against a delivered rate flatters the wrong vendor.",
    },
    {
      n: 8, section: "C",
      scenario: "A vendor offers a 5% discount for full payment in advance.",
      q: "What should you weigh?",
      options: [
        "Take it — 5% is a real saving",
        "The discount against the risk of paying before delivery and the company's cash position, preferring milestone-linked terms if the vendor is not well established",
        "Refuse all advance payment as a matter of principle",
        "Push for 10% instead",
      ],
      answer: 1,
      explanation: "The discount is certain; the delivery is not. With an established vendor it may be worth taking, which is why it is a judgement and not a rule.",
    },
    {
      n: 9, section: "C",
      scenario: "A vendor offers you a personal gift after an order has been placed.",
      q: "What should you do?",
      options: [
        "Accept it — the order is already placed, so it cannot have influenced anything",
        "Decline it and inform your senior",
        "Accept it and disclose it later",
        "Accept it if it is of small value",
      ],
      answer: 1,
      explanation: "In a buying role the appearance matters as much as the fact, and the gift after this order is about the next one. Declining and reporting removes both problems.",
    },
    {
      n: 10, section: "D",
      scenario: "Material due at site on Friday is now confirmed by the vendor for Monday.",
      q: "What is the first action?",
      options: [
        "Wait — it is only a weekend",
        "Tell the site and the project manager immediately with the revised date so work can be re-sequenced, while simultaneously checking alternatives",
        "Cancel the order",
        "Ask the vendor to send a part quantity, without informing anyone",
      ],
      answer: 1,
      explanation: "Site can absorb a slip it knows about on Wednesday and cannot absorb the same slip discovered on Friday evening.",
    },
    {
      n: 11, section: "D",
      q: "Why should procurement work from the project programme rather than from requests as they arrive?",
      options: [
        "It reduces the paperwork",
        "Lead times are known in advance, so orders can be placed early enough for material to arrive before it is needed rather than after",
        "It secures better rates",
        "The project manager requires it",
      ],
      answer: 1,
      explanation: "A request that arrives when the material is needed has already lost the lead time. Working from the programme is what converts procurement from reactive to planned.",
    },
    {
      n: 12, section: "D",
      scenario: "Site rejects a delivered batch as not matching the approved sample.",
      q: "What is the best action?",
      options: [
        "Ask the site to use it, since it is close enough",
        "Hold the batch, raise it formally with the vendor for replacement or credit, and arrange the correct material against the site's requirement date",
        "Pay the vendor and place a fresh order",
        "Return it and stop dealing with that vendor",
      ],
      answer: 1,
      explanation: "Two things have to happen together: recover the commercial position with the vendor, and still get the right material to site on time.",
    },
  ],
};

const SALES_MANAGER: RolePaper = {
  id: "HAG-ROLE-SALES-MANAGER-v1",
  position: "Sales Manager",
  department: "Procurement & Sales",
  sections: [
    { id: "A", name: "Pipeline & Forecasting", count: 3 },
    { id: "B", name: "Team & Performance", count: 3 },
    { id: "C", name: "Client Negotiation", count: 3 },
    { id: "D", name: "Judgement & Conduct", count: 3 },
  ],
  questions: [
    {
      n: 1, section: "A",
      q: "The most reliable indicator that a deal will close this month is:",
      options: [
        "The client has said they are very interested",
        "A defined scope, an agreed commercial, an identified decision-maker, and a date the client has committed to",
        "The number of meetings held so far",
        "The size of the opportunity",
      ],
      answer: 1,
      explanation: "Interest is not a forecast. Scope, commercial, decision-maker and a committed date are the four things whose absence explains almost every slipped deal.",
    },
    {
      n: 2, section: "A",
      q: "A pipeline five times the target that converts at 5% tells you:",
      options: [
        "The team is performing well on activity",
        "The problem is qualification — unqualified leads are being carried, and effort is being spread across deals that will not close",
        "The target is set too high",
        "The pricing is uncompetitive",
      ],
      answer: 1,
      explanation: "A large pipeline with poor conversion is not a coverage problem, it is a qualification problem — and adding more leads makes it worse.",
    },
    {
      n: 3, section: "A",
      q: "Why should a forecast separate committed from best case?",
      options: [
        "It is a reporting convention",
        "So the business plans capacity and cash on what is genuinely likely, while the upside stays visible without being relied on",
        "To protect the salesperson from a missed target",
        "To make the headline number look larger",
      ],
      answer: 1,
      explanation: "Delivery capacity and cash flow get committed against the forecast. A forecast that blends likely and possible causes real decisions to be made on the possible.",
    },
    {
      n: 4, section: "B",
      scenario: "One executive consistently generates meetings but rarely closes.",
      q: "What is the best action?",
      options: [
        "Move him permanently to lead generation",
        "Sit in on his meetings, find the stage where deals stall, and coach that specific stage",
        "Reduce his target to something achievable",
        "Warn him about the numbers",
      ],
      answer: 1,
      explanation: "Someone who can open and cannot close has one identifiable gap. You cannot coach it from the numbers — you have to see where the conversation stops.",
    },
    {
      n: 5, section: "B",
      scenario: "A high performer has behaved rudely with a client.",
      q: "What is the best action?",
      options: [
        "Let it go — he brings in the revenue",
        "Address it directly and privately, make the standard explicit, and repair the client relationship yourself",
        "Move him to a different account",
        "Warn the whole team about conduct in the next meeting",
      ],
      answer: 1,
      explanation: "Exempting a performer from the standard sets the standard. Warning the whole team punishes everyone except the person concerned.",
    },
    {
      n: 6, section: "B",
      q: "A weekly sales review is most useful when it:",
      options: [
        "Reports the numbers achieved against target",
        "Examines which deals moved and which did not, and decides the specific next action on each",
        "Motivates the team for the week ahead",
        "Ranks the executives against each other",
      ],
      answer: 1,
      explanation: "The number is the output and it is already known. The review is worth an hour only if it changes what happens to specific deals this week.",
    },
    {
      n: 7, section: "C",
      scenario: "A client demands a 15% discount to close today.",
      q: "What is the best response?",
      options: [
        "Give it — the order is large enough to absorb it",
        "Understand what is actually driving the demand, protect the rate by adjusting scope or payment terms instead, and escalate if a genuine exception is warranted",
        "Refuse and end the discussion",
        "Offer 7.5% immediately as a middle position",
      ],
      answer: 1,
      explanation: "A deadline attached to a discount is usually a negotiating device. Moving scope or terms answers the client's real constraint without resetting the rate.",
    },
    {
      n: 8, section: "C",
      q: "Beyond the lost margin, why is discounting to win a project risky?",
      options: [
        "It is not particularly risky",
        "It resets the client's price expectation, and the same client compares your next quotation to the discounted one",
        "It provokes competitors to cut their prices",
        "It reduces the executive's commission",
      ],
      answer: 1,
      explanation: "A discount is remembered as the price. The margin is lost once; the expectation persists across every subsequent project with that client.",
    },
    {
      n: 9, section: "C",
      scenario: "A client asks for a timeline your delivery team has already said is not achievable.",
      q: "What is the best action?",
      options: [
        "Commit to it and let delivery find a way",
        "Tell the client what is achievable and why, and offer a phased handover if the date genuinely matters to them",
        "Give a date somewhere between the two",
        "Say it will be confirmed later and move on",
      ],
      answer: 1,
      explanation: "A date sold that delivery cannot meet is a dispute you have scheduled in advance. A phase that meets the client's real deadline is usually the answer.",
    },
    {
      n: 10, section: "D",
      scenario: "An executive has promised a client a specification the company cannot deliver at the quoted price.",
      q: "What is the best action?",
      options: [
        "Deliver it at a loss to protect the relationship",
        "Correct it with the client immediately, before the contract is signed, and take responsibility for the error",
        "Deliver a lower specification and hope it is not noticed",
        "Let the delivery team handle it after signing",
      ],
      answer: 1,
      explanation: "Before signature it is an awkward correction. After signature it is either a loss taken silently or a dispute, and both cost more than the conversation.",
    },
    {
      n: 11, section: "D",
      scenario: "You lose a large project to a competitor.",
      q: "What is the most useful action?",
      options: [
        "Reduce the price on the next bid",
        "Find out from the client what actually decided it, and feed that back into how the next proposal is built",
        "Move on to the next opportunity",
        "Attribute it to the delivery team's reputation",
      ],
      answer: 1,
      explanation: "Assuming it was price is the most common and most expensive guess. Most losses turn out to be about scope clarity, confidence or timeline.",
    },
    {
      n: 12, section: "D",
      q: "For a project-based interiors and façade business, the strongest source of new business is usually:",
      options: [
        "Cold calling",
        "Delivered projects, and the referrals and repeat work they generate",
        "Advertising spend",
        "Competitive discounting",
      ],
      answer: 1,
      explanation: "Clients buying a fit-out are buying confidence in delivery, and the cheapest evidence of delivery is a project they can go and see.",
    },
  ],
};

const SALES_EXECUTIVE: RolePaper = {
  id: "HAG-ROLE-SALES-EXECUTIVE-v1",
  position: "Sales Executive",
  department: "Procurement & Sales",
  sections: [
    { id: "A", name: "Lead Handling & Follow-up", count: 3 },
    { id: "B", name: "Client Conversation & Needs", count: 3 },
    { id: "C", name: "Quotation & Closing", count: 3 },
    { id: "D", name: "Conduct & Judgement", count: 3 },
  ],
  questions: [
    {
      n: 1, section: "A",
      q: "A new enquiry comes in. What matters most?",
      options: [
        "Sending a detailed proposal quickly",
        "Responding quickly and qualifying — what they need, the scale, the timeline, the budget range and who decides",
        "Quoting the lowest possible price",
        "Meeting them in person the same day",
      ],
      answer: 1,
      explanation: "Speed gets you the conversation; qualification tells you whether the conversation is worth pursuing and what to say in it.",
    },
    {
      n: 2, section: "A",
      scenario: "On a first call the client says only 'send me a quotation'.",
      q: "What is the best action?",
      options: [
        "Send a standard quotation straight away",
        "Ask the questions needed to quote meaningfully — scope, area, quality level and timeline — and then quote",
        "Decline to quote without a site visit",
        "Quote low so that it gets a response",
      ],
      answer: 1,
      explanation: "A quotation sent without scope will be compared purely on the number. The questions are also what make you the person they discuss it with.",
    },
    {
      n: 3, section: "A",
      q: "What is the right way to close a client meeting?",
      options: [
        "Thank them and wait for their response",
        "Agree the specific next step, who does it and by when, and confirm it in writing the same day",
        "Ask directly for the order",
        "Promise to send the proposal later in the week",
      ],
      answer: 1,
      explanation: "A meeting that ends without a named next step and a date restarts from the beginning next time.",
    },
    {
      n: 4, section: "B",
      q: "In a first meeting, which is more useful?",
      options: [
        "Presenting the company profile in full",
        "Asking questions and listening, so that the proposal addresses what they actually need",
        "Quoting an indicative rate",
        "Showing photographs of completed projects",
      ],
      answer: 1,
      explanation: "The profile and the photographs matter, but they are the answer to a need you have not yet found out.",
    },
    {
      n: 5, section: "B",
      scenario: "A client objects that your price is higher than another quotation.",
      q: "What is the best response?",
      options: [
        "Match the price to stay in the running",
        "Ask what is included in the other quotation, and explain the difference in specification, scope and delivery so like is compared with like",
        "Point out that the competitor's quality is poor",
        "Say you will check with your manager",
      ],
      answer: 1,
      explanation: "Most price gaps in fit-out work are scope gaps. Matching the number without checking that means agreeing to do more work for less money.",
    },
    {
      n: 6, section: "B",
      q: "A client who keeps postponing a decision usually means:",
      options: [
        "They are not genuinely interested",
        "Something is unresolved — the budget, an internal decision-maker, or a doubt — and it should be identified rather than chased with reminders",
        "They are waiting for a discount",
        "They will decide in their own time",
      ],
      answer: 1,
      explanation: "Repeated follow-ups against an unnamed obstacle achieve nothing. The useful question is what has to happen before they can decide.",
    },
    {
      n: 7, section: "C",
      q: "A quotation should always state:",
      options: [
        "The price",
        "The scope included, what is excluded, taxes, timeline and validity",
        "The price and the discount offered",
        "The company profile and credentials",
      ],
      answer: 1,
      explanation: "Exclusions are the half that prevents the dispute. A quotation that lists only what is included leaves everything else arguable.",
    },
    {
      n: 8, section: "C",
      q: "Why does a quotation carry a validity date?",
      options: [
        "It puts pressure on the client to decide",
        "Material and labour rates move, and the company should not be bound to a rate quoted months earlier",
        "It is a legal formality",
        "It helps with sales forecasting",
      ],
      answer: 1,
      explanation: "It exists to protect the rate, not to pressure the client — which is why the validity period should be realistic rather than artificially short.",
    },
    {
      n: 9, section: "C",
      scenario: "The client agrees verbally to go ahead.",
      q: "What should you do next?",
      options: [
        "Tell the delivery team to start immediately",
        "Get the written confirmation or work order and the agreed advance, then hand over to delivery with the confirmed scope",
        "Raise the invoice",
        "Wait for their formal letter to arrive",
      ],
      answer: 1,
      explanation: "Starting work on a verbal go-ahead means the scope and the commercial are still open when the first cost is already incurred.",
    },
    {
      n: 10, section: "D",
      scenario: "A client asks whether you have done a project of this scale before, and you have not.",
      q: "What is the best response?",
      options: [
        "Say yes — the company can manage it",
        "Answer honestly, and show the closest comparable work along with the team and the process that will deliver it",
        "Avoid the question and move to another strength",
        "Say the company has, without giving detail",
      ],
      answer: 1,
      explanation: "The claim will be checked, and being caught costs the deal and the reputation. The honest answer with comparable evidence usually holds.",
    },
    {
      n: 11, section: "D",
      scenario: "You realise you quoted a rate lower than you were authorised to.",
      q: "What is the best action?",
      options: [
        "Honour it and let the company absorb the difference",
        "Tell your manager immediately and correct it with the client before it is confirmed",
        "Wait and see whether the client accepts it",
        "Adjust it quietly in the final bill",
      ],
      answer: 1,
      explanation: "Before confirmation it is a correctable error. Adjusting it later in the bill is the version that ends the client relationship.",
    },
    {
      n: 12, section: "D",
      q: "After a project is handed over, the executive's most valuable action is:",
      options: [
        "Move on to the next lead",
        "Stay in touch, confirm the client is satisfied, and ask for referrals and repeat work",
        "Ask for a written testimonial",
        "Nothing — delivery owns the client from that point",
      ],
      answer: 1,
      explanation: "The handover is the moment the client's goodwill is highest and their network is most relevant. Almost nobody asks then.",
    },
  ],
};

const DOCUMENTATION_CONTROLLER: RolePaper = {
  id: "HAG-ROLE-DOCUMENTATION-CONTROLLER-v1",
  position: "Documentation Controller",
  department: "Procurement & Sales",
  sections: [
    { id: "A", name: "Document Control Basics", count: 3 },
    { id: "B", name: "Drawing & Revision Management", count: 3 },
    { id: "C", name: "Records, Billing & Compliance", count: 3 },
    { id: "D", name: "Coordination & Judgement", count: 3 },
  ],
  questions: [
    {
      n: 1, section: "A",
      q: "The core purpose of document control is:",
      options: [
        "To store and back up project files",
        "To ensure everyone is working from the current approved version, and that superseded versions are withdrawn",
        "To reduce printing costs",
        "To keep records for the audit",
      ],
      answer: 1,
      explanation: "Storage is the easy half. The value is in withdrawal — making sure the old revision is no longer on somebody's desk being built from.",
    },
    {
      n: 2, section: "A",
      q: "A document numbering system should be:",
      options: [
        "Descriptive and free-form, so the name explains the document",
        "Structured and unique, so a document can be identified by project, discipline, type and number without opening it",
        "Simply sequential",
        "Based on the date of issue",
      ],
      answer: 1,
      explanation: "A structured number is what makes a register searchable and a transmittal unambiguous. Free-form names collide the moment two people name the same thing.",
    },
    {
      n: 3, section: "A",
      q: "A controlled copy means:",
      options: [
        "A copy that cannot be photocopied",
        "A copy registered to a named holder, so that when it is superseded the holder is issued the new revision and returns or destroys the old one",
        "A password-protected file",
        "A copy held only by management",
      ],
      answer: 1,
      explanation: "Control is about the holder, not the format. The register of who holds what is what allows a superseded revision to be recalled at all.",
    },
    {
      n: 4, section: "B",
      scenario: "Revision C of a drawing is issued while site is building from revision B.",
      q: "What must you do?",
      options: [
        "File revision C and update the register",
        "Issue revision C to every registered holder, record the transmittal, and ensure the revision B copies at site are withdrawn or marked superseded",
        "Tell the site engineer on a call",
        "Wait until site asks for the latest revision",
      ],
      answer: 1,
      explanation: "Issuing without withdrawing leaves two live revisions on site, and the one already pinned to the wall usually wins.",
    },
    {
      n: 5, section: "B",
      q: "A transmittal record exists to prove:",
      options: [
        "That the document was created",
        "What was issued, to whom, in which revision, and on what date",
        "That the document was technically approved",
        "That the drawing is correct",
      ],
      answer: 1,
      explanation: "It answers only the distribution question — but that is the question every rework claim eventually turns on.",
    },
    {
      n: 6, section: "B",
      scenario: "A contractor claims he never received a revised drawing and has built to the old one.",
      q: "What resolves it?",
      options: [
        "His account against yours",
        "The transmittal record, with the acknowledgement of receipt",
        "The site diary entry",
        "The project manager's recollection",
      ],
      answer: 1,
      explanation: "This is precisely what the acknowledgement is for. Without it the cost of the rework is genuinely arguable.",
    },
    {
      n: 7, section: "C",
      q: "Why must test certificates and warranties be collected during the project rather than at the end?",
      options: [
        "It spreads the workload more evenly",
        "At handover they are far harder to obtain from vendors who have already been paid and moved on",
        "Because the client asks for them early",
        "Because they expire quickly",
      ],
      answer: 1,
      explanation: "Leverage disappears with the final payment. A certificate not collected while the vendor still wants something from you often never arrives.",
    },
    {
      n: 8, section: "C",
      q: "A running account bill submission is normally supported by:",
      options: [
        "The relevant purchase orders",
        "The measurement sheets, the joint measurement records and the approved abstract",
        "The labour attendance register",
        "The drawings alone",
      ],
      answer: 1,
      explanation: "An RA bill is a claim for measured work, so it stands or falls on the measurement record behind it.",
    },
    {
      n: 9, section: "C",
      q: "In records management, a retention schedule defines:",
      options: [
        "Where each record is stored",
        "How long each type of record must be kept before it may be disposed of",
        "Who is permitted to access the record",
        "The naming convention for records",
      ],
      answer: 1,
      explanation: "It is about time, not place or access — and it exists because contractual and statutory obligations outlive the project by years.",
    },
    {
      n: 10, section: "D",
      scenario: "An engineer asks you to backdate a transmittal so that a drawing appears to have been issued on time.",
      q: "What should you do?",
      options: [
        "Do it — it is a minor administrative matter",
        "Decline, record and issue it with the correct date, and inform your senior if you are pressed",
        "Do it, but note the real date privately",
        "Ask the project manager to decide",
      ],
      answer: 1,
      explanation: "A falsified transmittal destroys the evidential value of every other transmittal in the file, which is the only thing document control produces.",
    },
    {
      n: 11, section: "D",
      scenario: "You notice a drawing has been issued to site without the consultant's approval stamp.",
      q: "What is the best action?",
      options: [
        "Let it pass — the drawing is probably fine",
        "Flag it immediately, hold the issue, and get it approved before site builds from it",
        "Apply the stamp yourself from the previous revision",
        "Note the omission in the register and continue",
      ],
      answer: 1,
      explanation: "The stamp is the record that someone qualified accepted the drawing. Catching its absence before site builds is exactly what the role is for.",
    },
    {
      n: 12, section: "D",
      q: "What makes a document register genuinely useful during a project?",
      options: [
        "That it is complete by the end of the project",
        "That it is updated as documents are issued and received, so at any moment it shows the current revision and status of everything",
        "That it is stored on a shared drive",
        "That every document in it has been scanned",
      ],
      answer: 1,
      explanation: "A register is a live control or it is an archive. Completed at the end, it can no longer prevent anything.",
    },
  ],
};

// ── Added 21 Aug 2026: two positions that are NOT in §2.2 ────────────────────
// Marketing and Accounts are not among the 13 drive positions. They are not on
// the Google Form, not on any poster and not in the Indeed listing, so nobody
// can have "applied for" them through the funnel — they exist here because the
// desk asked for them, presumably for walk-ins or internal candidates for roles
// the drive did not advertise.
//
// That has one consequence worth knowing: the /test2.html dropdown now offers
// two options the drive never advertised. If that is not wanted, remove these
// two papers rather than hiding them in the page — the server is what decides
// which positions exist, and a page-only change would drift from it.
//
// Same shape as the other 13: 12 questions, 12 marks, 15 minutes, 4 sections
// of 3, and the same caveat that the answers are engineering judgement rather
// than signed-off Hagerstone policy.

const MARKETING: RolePaper = {
  id: "HAG-ROLE-MARKETING-v1",
  position: "Marketing",
  department: "Marketing",
  sections: [
    { id: "A", name: "Brand & Positioning", count: 3 },
    { id: "B", name: "Digital & Campaigns", count: 3 },
    { id: "C", name: "Content & Collateral", count: 3 },
    { id: "D", name: "Measurement & Judgement", count: 3 },
  ],
  questions: [
    {
      n: 1, section: "A",
      q: "What is a positioning statement for?",
      options: [
        "It is the tagline used in advertisements",
        "It states who the offering is for, what it competes against and why it is different, so every campaign says the same thing",
        "It is the logo and colour guideline",
        "It is the company's mission statement",
      ],
      answer: 1,
      explanation: "Positioning is the decision every piece of communication inherits. Without it each campaign re-invents the argument and the market hears a different company each time.",
    },
    {
      n: 2, section: "A",
      scenario: "Hagerstone sells commercial interiors, luxury interiors, civil construction, PEB and façade. One campaign is being planned to cover all five.",
      q: "What is the best action?",
      options: [
        "Run one campaign covering everything, since it is one company",
        "Decide which vertical and which buyer this campaign is for, and speak to them — a message aimed at everyone reaches no one",
        "Launch five campaigns simultaneously",
        "Advertise only the largest vertical",
      ],
      answer: 1,
      explanation: "The person buying a luxury home interior and the person buying a PEB shed are not the same buyer and do not respond to the same proof. One campaign for both persuades neither.",
    },
    {
      n: 3, section: "A",
      q: "In a B2B business where one project is worth lakhs and the sales cycle runs months, marketing's main job is:",
      options: [
        "To generate the largest possible number of leads",
        "To generate qualified enquiries, and to give sales the credibility it needs to convert them",
        "To grow the social media following",
        "To bring the cost per click down",
      ],
      answer: 1,
      explanation: "Volume is the wrong target when each deal takes months of sales effort. Fifty unqualified leads cost more in wasted time than they could ever return.",
    },
    {
      n: 4, section: "B",
      scenario: "A campaign is getting a very low cost per click, but almost nobody completes the enquiry form.",
      q: "Where is the problem most likely to be?",
      options: [
        "The ad creative — it is not attractive enough",
        "The landing page or the form: people are clicking, so the ad is working, and losing them after the click",
        "The audience targeting",
        "The budget is too small",
      ],
      answer: 1,
      explanation: "A cheap click means the ad did its job. Everything after the click is where the loss is — usually a form that is too long, needs a login, or asks for a file the person does not have on their phone.",
    },
    {
      n: 5, section: "B",
      q: "A lookalike audience is:",
      options: [
        "People who resemble the company's own staff",
        "New people who resemble an existing source audience, such as past enquirers or customers",
        "The same people shown the ad repeatedly",
        "A competitor's followers",
      ],
      answer: 1,
      explanation: "It takes a source list you already have and finds people similar to it. The quality of the output is set entirely by the quality of the source list.",
    },
    {
      n: 6, section: "B",
      q: "Retargeting means:",
      options: [
        "Running the same campaign again next month",
        "Showing ads to people who have already visited the site or engaged, who convert far better than cold audiences",
        "Changing which audience is targeted",
        "Copying a competitor's targeting",
      ],
      answer: 1,
      explanation: "Someone who already looked is the warmest audience available and the cheapest to convert — which is why retargeting usually outperforms every cold campaign running beside it.",
    },
    {
      n: 7, section: "C",
      q: "For a firm selling fit-out and façade projects, the most persuasive content is usually:",
      options: [
        "A company profile PDF",
        "Completed project photographs and case studies — the brief, the constraints and what was delivered",
        "Festival greetings and daily posts",
        "Industry news and articles",
      ],
      answer: 1,
      explanation: "Clients are buying confidence that you can deliver. A finished project they can look at answers that question; a profile only asserts it.",
    },
    {
      n: 8, section: "C",
      scenario: "A project photograph is excellent, but the client has not approved its use publicly.",
      q: "What is the best action?",
      options: [
        "Publish it — the work is the company's own",
        "Get the client's written permission first, and confirm whether the client and the site may be named",
        "Publish it without naming the client",
        "Ask the site engineer whether it is acceptable",
      ],
      answer: 1,
      explanation: "Many clients treat their premises and their spend as confidential. Publishing without permission risks the relationship and any repeat work, and an unnamed photograph is often still recognisable.",
    },
    {
      n: 9, section: "C",
      q: "Why should every ad and post carry one clear call to action?",
      options: [
        "It makes the creative look professional",
        "Without one, an interested person has no obvious next step, and the enquiry is simply lost",
        "The platforms require it",
        "It increases the reach",
      ],
      answer: 1,
      explanation: "Interest decays in seconds. If the next step is not obvious and immediate, the person moves on and the money spent to reach them is gone.",
    },
    {
      n: 10, section: "D",
      q: "Which is the more useful measure of marketing for this business?",
      options: [
        "Impressions and reach",
        "Qualified enquiries, and the cost per qualified enquiry",
        "Follower count",
        "The number of posts published",
      ],
      answer: 1,
      explanation: "Reach and followers are activity, not outcome. Cost per qualified enquiry is the only number that connects the spend to revenue.",
    },
    {
      n: 11, section: "D",
      scenario: "Sales reports that the leads from your campaign are poor quality.",
      q: "What is the best action?",
      options: [
        "Increase the budget so more leads come through",
        "Sit with sales, define what a good lead actually looks like, and change the targeting, the message and the form's qualifying questions accordingly",
        "Stop the campaign",
        "Send the same leads across again",
      ],
      answer: 1,
      explanation: "More budget against the wrong definition buys more of the wrong leads. Marketing and sales disagreeing on what qualifies is the root of most of these arguments.",
    },
    {
      n: 12, section: "D",
      scenario: "A competitor is running ads making claims your company cannot match.",
      q: "What is the best action?",
      options: [
        "Make the same claims to stay competitive",
        "Compete on what can be substantiated — delivered projects, capability and timelines — because an unsupportable claim collapses at the first client question",
        "Report the competitor to the platform",
        "Cut prices in the advertising",
      ],
      answer: 1,
      explanation: "A claim you cannot stand behind wins the click and loses the meeting, and it damages credibility with exactly the clients you most want.",
    },
  ],
};

const ACCOUNTS: RolePaper = {
  id: "HAG-ROLE-ACCOUNTS-v1",
  position: "Accounts",
  department: "Accounts & Finance",
  sections: [
    { id: "A", name: "Bookkeeping Fundamentals", count: 3 },
    { id: "B", name: "GST & Statutory", count: 3 },
    { id: "C", name: "Payables, Receivables & Controls", count: 3 },
    { id: "D", name: "Reporting & Judgement", count: 3 },
  ],
  questions: [
    {
      n: 1, section: "A",
      q: "In double-entry bookkeeping, every transaction is:",
      options: [
        "Recorded once, in the cash book",
        "Recorded as an equal debit and credit, so the books always balance",
        "Recorded only when the payment is actually made",
        "Recorded only at month end",
      ],
      answer: 1,
      explanation: "Every entry has two sides of equal value. That is what makes an out-of-balance trial balance a signal that something is missing rather than a matter of opinion.",
    },
    {
      n: 2, section: "A",
      scenario: "Material was received last week and the purchase was booked then. The supplier is now being paid.",
      q: "How is the payment recorded?",
      options: [
        "Debit purchases, credit bank",
        "Debit the supplier's account, credit bank",
        "Debit bank, credit the supplier's account",
        "Debit expenses, credit the supplier's account",
      ],
      answer: 1,
      explanation: "The purchase was already expensed when the material was received, creating a payable. Paying it clears that payable — debiting purchases again would book the same cost twice.",
    },
    {
      n: 3, section: "A",
      q: "A credit note is issued to a customer when:",
      options: [
        "The customer places a new order",
        "An invoice already raised has to be reduced — goods returned, a rate correction, or a quantity rejected",
        "The customer pays later than agreed",
        "A fresh invoice has to be raised",
      ],
      answer: 1,
      explanation: "An invoice once issued is not edited or deleted; it is corrected by a credit note, which leaves both the original and the correction on record.",
    },
    {
      n: 4, section: "B",
      q: "Input tax credit under GST is:",
      options: [
        "A discount given by the supplier",
        "The GST paid on purchases, set off against the GST payable on sales — provided the supplier has actually reported that invoice",
        "A refund claimed from the customer",
        "An exemption from paying tax",
      ],
      answer: 1,
      explanation: "It is what stops tax being paid twice on the same value. The condition in the second half is the one that causes real problems, because it depends on somebody else filing.",
    },
    {
      n: 5, section: "B",
      q: "TDS is deducted:",
      options: [
        "By the person receiving the payment",
        "By the payer, out of the payment being made, and deposited with the government on the payee's behalf",
        "Only on salary payments",
        "Once a year, at the end of the financial year",
      ],
      answer: 1,
      explanation: "The obligation sits with the payer, not the payee. Failing to deduct makes the payer liable for the tax plus interest, regardless of what the payee did.",
    },
    {
      n: 6, section: "B",
      q: "The most common reason input tax credit gets denied is:",
      options: [
        "The invoice was handwritten",
        "The supplier has not filed their return, so the invoice does not appear in the buyer's GSTR-2B",
        "The payment was made in cash",
        "The goods were subsequently returned",
      ],
      answer: 1,
      explanation: "Your credit depends on your supplier's compliance, which is why unfiled suppliers have to be chased before the return is filed rather than after.",
    },
    {
      n: 7, section: "C",
      q: "Before a supplier invoice is passed for payment, it should be matched against:",
      options: [
        "The supplier's ledger balance",
        "The purchase order and the goods receipt note",
        "The original quotation",
        "The delivery challan alone",
      ],
      answer: 1,
      explanation: "Ordered, received, invoiced. Three-way matching is the basic control against paying for what was never ordered or never arrived.",
    },
    {
      n: 8, section: "C",
      q: "A receivables ageing report shows:",
      options: [
        "How long the company has been trading",
        "How long each customer's outstanding amount has been due, so collection effort goes where it is most overdue",
        "The total sales for the period",
        "Each customer's credit limit",
      ],
      answer: 1,
      explanation: "A single outstanding total hides which money is a week late and which is six months gone. The ageing is what turns it into a collection plan.",
    },
    {
      n: 9, section: "C",
      scenario: "A senior asks you to release a payment urgently, before the invoice has been verified.",
      q: "What is the best action?",
      options: [
        "Release it — a senior has instructed it",
        "Say clearly what verification is still outstanding, and get the approval in writing if it still has to go ahead",
        "Refuse the instruction",
        "Release it and complete the verification afterwards",
      ],
      answer: 1,
      explanation: "Urgent payments are sometimes genuinely necessary. What protects everyone is that the exception is visible and owned by the person who authorised it.",
    },
    {
      n: 10, section: "D",
      q: "A bank reconciliation is done in order to:",
      options: [
        "Increase the reported bank balance",
        "Explain the difference between the book balance and the bank statement, so errors, missing entries and unpresented cheques are found",
        "Satisfy the auditor at year end",
        "Calculate the interest earned",
      ],
      answer: 1,
      explanation: "It is a monthly control, not a year-end formality. Most bookkeeping errors surface here first, while they are still small enough to correct easily.",
    },
    {
      n: 11, section: "D",
      q: "In a project business, why does cash flow matter as much as profit?",
      options: [
        "It does not — profit is what counts",
        "A profitable project can still stop, because material and labour are paid for long before the client's payment arrives",
        "Profit only matters for tax purposes",
        "Cash flow is the auditor's concern rather than the company's",
      ],
      answer: 1,
      explanation: "Profit is earned over the project; cash goes out at the start and comes in at the end. Projects that are profitable on paper are exactly the ones that run out of money mid-way.",
    },
    {
      n: 12, section: "D",
      scenario: "You find an error in a previous month's accounts, which are already closed and reported.",
      q: "What is the best action?",
      options: [
        "Leave it — the month is closed",
        "Report it to your senior with the amount and its effect, and correct it through a recorded adjusting entry",
        "Quietly adjust the current month so the totals come right",
        "Wait and correct it at year end",
      ],
      answer: 1,
      explanation: "A silent adjustment in the current month makes two periods wrong instead of one and leaves no trace of why. The correction has to be visible to be auditable.",
    },
  ],
};

// ── The registry ─────────────────────────────────────────────────────────────
// The first 13 in §2.2 order, then the two added later (see above — they are
// NOT §2.2 positions). Keyed by the exact position string, cedilla included.

export const ROLE_PAPERS: RolePaper[] = [
  PROJECT_MANAGER,
  SITE_ENGINEER,
  SITE_SUPERVISOR,
  CIVIL_ENGINEER,
  MEP_ENGINEER,
  INTERIOR_DESIGNER,
  ARCHITECT,
  FACADE_FACTORY_MANAGER,
  FACTORY_OPERATIONS,
  PROCUREMENT,
  SALES_MANAGER,
  SALES_EXECUTIVE,
  DOCUMENTATION_CONTROLLER,
  MARKETING,
  ACCOUNTS,
];

/**
 * Normalise a position string for lookup.
 *
 * The candidate picks from a dropdown, so the string SHOULD arrive exact — but
 * "Façade" is one Unicode normalisation or one keyboard away from "Facade", and
 * a mismatch here would hand a Façade Factory Manager the wrong paper or no
 * paper at all. Decompose accents to base letter + combining mark, fold case,
 * then keep only a–z and 0–9 — which drops the combining marks, the spaces and
 * the punctuation in one pass, so "Façade Factory Manager", "facade factory
 * manager" and "Fa̧cade  Factory-Manager" all land on the same key.
 */
function normalisePosition(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const BY_POSITION = new Map<string, RolePaper>(
  ROLE_PAPERS.map((p) => [normalisePosition(p.position), p]),
);

/** The paper for a position, or null if the position is not one of the 13. */
export function paperForPosition(position: string): RolePaper | null {
  return BY_POSITION.get(normalisePosition(position)) ?? null;
}

/**
 * The position list, for the candidate page's dropdown and for HR reference.
 * Carries no question content, so this shape is safe to expose.
 */
export const ROLE_POSITION_LIST = ROLE_PAPERS.map((p) => ({
  position: p.position,
  department: p.department,
  assessment_id: p.id,
  total_questions: p.questions.length,
}));

// ── Scoring bands ────────────────────────────────────────────────────────────
// Cut LOWER than level 1 on purpose. Level 1 is general behaviour where 85% is a
// reasonable bar; these papers test role exposure, where a genuinely capable
// candidate can legitimately miss three of twelve — a good Site Supervisor may
// never have been asked about a method of measurement.
//
//   9–12 (75%+) STRONG · 6–8 (50%+) AVERAGE · 4–5 (33%+) WEAK · 0–3 BELOW_BAR
//
// RE-CUT THESE against real attempt data after the drive. Bands can change
// freely; questions cannot once they have been sat (§7.4).
//
// §6.3: the band is a QUEUE-PRIORITISATION signal, not a hiring gate. Nothing
// downstream may auto-reject on it — least of all here, where a low score may
// only mean the candidate applied for the position next to the one they have
// actually spent ten years doing.
export type RoleBand = "STRONG" | "AVERAGE" | "WEAK" | "BELOW_BAR";

// As data, so the HR review page and roleBandFor() cannot drift apart. Ordered
// highest first — roleBandFor() takes the first match.
export const ROLE_BANDS: { band: RoleBand; min: number; label: string }[] = [
  { band: "STRONG",    min: 9, label: "Strong" },
  { band: "AVERAGE",   min: 6, label: "Average" },
  { band: "WEAK",      min: 4, label: "Weak" },
  { band: "BELOW_BAR", min: 0, label: "Below Bar" },
];

export function roleBandFor(total: number): RoleBand {
  return (ROLE_BANDS.find((b) => total >= b.min) ?? ROLE_BANDS[ROLE_BANDS.length - 1]).band;
}

// ── Presentation, marking and review ─────────────────────────────────────────
// Deliberately duplicated from assessment-bank.ts rather than shared — see the
// header. Same semantics: question order fixed, option order shuffled per
// candidate, `presented` records what they saw so the attempt stays re-markable.

export type RolePresented = Record<string, number[]>;

export function buildRolePresented(paper: RolePaper): RolePresented {
  const out: RolePresented = {};
  for (const q of paper.questions) {
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
export function publicRoleQuestions(paper: RolePaper, presented: RolePresented) {
  return paper.questions.map((q) => {
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

/** Raw picks (question number → display position) → canonical option letters. */
export function toCanonicalRoleAnswers(
  paper: RolePaper,
  raw: Record<string, unknown>,
  presented: RolePresented,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of paper.questions) {
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

export interface RoleScoreResult {
  total: number;
  sections: Record<RoleSectionId, number>;
  band: RoleBand;
  answered: number;
}

/** Mark the paper. No negative marking, unanswered = 0. */
export function scoreRoleAnswers(
  paper: RolePaper,
  canonical: Record<string, string>,
): RoleScoreResult {
  const sections: Record<RoleSectionId, number> = { A: 0, B: 0, C: 0, D: 0 };
  let total = 0;
  let answered = 0;

  for (const q of paper.questions) {
    const picked = canonical[String(q.n)];
    if (!picked) continue;
    answered++;
    if (LETTERS.indexOf(picked) === q.answer) {
      total++;
      sections[q.section]++;
    }
  }

  return { total, sections, band: roleBandFor(total), answered };
}

/**
 * The marked paper, snapshotted onto the attempt row at submit.
 *
 * Same reason as level 1: the HR panel renders THIS, so the answer key never has
 * to exist in a browser bundle, and the row keeps the exact paper this candidate
 * sat even after that role's paper is bumped to v2.
 */
export function buildRoleReview(
  paper: RolePaper,
  canonical: Record<string, string>,
  presented: RolePresented,
) {
  return paper.questions.map((q) => {
    const picked = canonical[String(q.n)] ?? null;
    const pickedIdx = picked ? LETTERS.indexOf(picked) : -1;
    return {
      n: q.n,
      section: q.section,
      scenario: q.scenario ?? null,
      q: q.q,
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
