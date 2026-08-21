// ============================================================
// AssessmentPortal — the page a walk-in candidate sits a test on.
//
// No login, no password, no Supabase session. The candidate types an email and
// a name; the email is what separates one person's answers and score from
// another's. Everything server-side goes through assessmentApi.js.
//
// ONE COMPONENT, TWO PAPERS. The `kind` prop selects which:
//   "L1"   → /test.html  — the general first-level paper. Email + name.
//   "ROLE" → /test2.html — the second-level paper, keyed to the position the
//            candidate applied for. Email + name + POSITION, because the
//            position is what decides which set of questions they are served.
// The two are separate URLs rather than a choice on one screen: the desk hands
// out one link or the other, so a nervous candidate on a borrowed phone never
// has to decide which test they are supposed to be taking. Everything below
// this line is identical for both — the server tells the page how many
// questions, how long, and what the sections are called.
//
// Built for a low-end Android on venue Wi-Fi (§7.2 of
// HAGERSTONE_DRIVE_AND_ASSESSMENT.md): one question per screen, big tap
// targets, and every answer mirrored to localStorage the moment it is tapped so
// a refresh, a dead battery or a dropped connection never costs the paper.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { startAttempt, submitAttempt, fetchPositions } from "../../services/assessmentApi.js";
import "./AssessmentPortal.css";

// Suffixed with the paper version so a half-finished older sheet cached on a
// phone can never be restored on top of a newer paper — and suffixed with the
// KIND so a phone that has just sat level 1 cannot restore that sheet onto the
// level-2 paper. Two candidates share a phone at this drive; two papers on one
// phone is the ordinary case, not the edge case.
const STORAGE_KEYS = {
  L1:   { session: "hag_assessment_session_v5",      answers: "hag_assessment_answers_v5" },
  ROLE: { session: "hag_assessment_role_session_v1", answers: "hag_assessment_role_answers_v1" },
};

// Shown on the start screen, before the server has told us anything. Keep in
// step with the banks — TOTAL_QUESTIONS / DURATION_MINUTES in
// assessment-bank.ts, and ROLE_TOTAL_QUESTIONS / ROLE_DURATION_MINUTES in
// role-assessment-bank.ts. The timer and the marking follow the server; this is
// only the briefing.
const BRIEF = {
  L1:   { questions: 15, minutes: 15, title: "First-Level Assessment" },
  ROLE: { questions: 12, minutes: 15, title: "Role Assessment" },
};

// Used only if the positions call fails on venue Wi-Fi — the candidate still
// gets a working dropdown. The server validates whatever is picked and returns
// a clear error if it does not match a paper, so a drift here cannot serve
// somebody the wrong questions. Exact spelling per §2.2, cedilla included.
const FALLBACK_POSITIONS = [
  "Project Manager", "Site Engineer", "Site Supervisor", "Civil Engineer",
  "MEP Engineer", "Interior Designer", "Architect", "Façade Factory Manager",
  "Factory Operations", "Procurement", "Sales Manager", "Sales Executive",
  "Documentation Controller", "Marketing", "Accounts",
];

const LETTERS = ["A", "B", "C", "D", "E", "F"];

const readJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};
const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private browsing — the network round-trip is still the source of truth */
  }
};
const clearStored = (keys) => {
  try {
    localStorage.removeItem(keys.session);
    localStorage.removeItem(keys.answers);
  } catch {
    /* ignore */
  }
};

function formatClock(ms) {
  if (ms === null) return "--:--"; // not measured yet — never flash 00:00
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function AssessmentPortal({ kind = "L1" }) {
  const isRole = kind === "ROLE";
  const keys = STORAGE_KEYS[isRole ? "ROLE" : "L1"];
  const brief = BRIEF[isRole ? "ROLE" : "L1"];

  // "start" | "test" | "result" | "blocked"
  const [screen, setScreen] = useState("start");

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [positions, setPositions] = useState(FALLBACK_POSITIONS);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const [session, setSession] = useState(null); // { attempt_token, ends_at, questions, sections, … }
  const [answers, setAnswers] = useState({});   // { [questionNumber]: displayedOptionIndex }
  const [index, setIndex] = useState(0);
  const [showPalette, setShowPalette] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  // null = the countdown has not measured yet. It must NOT start at 0, or the
  // auto-submit effect below fires on the first render of the test screen
  // (effects run after the render that set screen="test", and the countdown's
  // setRemaining has not landed yet) and submits a blank paper instantly.
  const [remaining, setRemaining] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [submitFailed, setSubmitFailed] = useState(false);

  // Guards a race between the auto-submit timer and a manual tap.
  const submitLock = useRef(false);
  // Client clocks on borrowed phones are not trustworthy; the server's are.
  const skewRef = useRef(0);

  // ── Restore an interrupted sitting ────────────────────────────────────────
  useEffect(() => {
    const stored = readJson(keys.session);
    if (!stored?.attempt_token || !Array.isArray(stored.questions)) return;
    if (new Date(stored.ends_at).getTime() + 60000 < Date.now()) {
      clearStored(keys);
      return;
    }
    setSession(stored);
    setAnswers(readJson(keys.answers)?.[stored.attempt_token] || {});
    setEmail(stored.email || "");
    setFullName(stored.full_name || "");
    setPosition(stored.position || "");
    setScreen("test");
  }, [keys.session, keys.answers]);

  // The dropdown comes from the server so it cannot drift from the papers that
  // actually exist. A failure here is not worth blocking on — FALLBACK_POSITIONS
  // is already in state and the server validates the pick either way.
  useEffect(() => {
    if (!isRole) return;
    let live = true;
    fetchPositions()
      .then((res) => {
        const list = (res?.positions || []).map((p) => p.position).filter(Boolean);
        if (live && list.length) setPositions(list);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [isRole]);

  // Every screen change and every question change starts at the top. Without
  // this, scrolling to the bottom of a long Section D case and tapping Next
  // drops the candidate halfway down the next question and they miss the stem.
  useEffect(() => { window.scrollTo(0, 0); }, [index, screen]);

  // The bottom sheet is an overlay — the paper behind it must not scroll with
  // the finger, or the candidate loses their place while reviewing.
  useEffect(() => {
    if (!showPalette) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [showPalette]);

  // Keep the screen on while the paper is open. A candidate reading a long case
  // stem stops touching the phone, the display sleeps, and the timer keeps
  // running. Progressive enhancement — absent on older browsers, and the lock
  // is dropped by the OS whenever the page is hidden, so re-acquire on return.
  useEffect(() => {
    if (screen !== "test" || !navigator.wakeLock) return;
    let lock = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (document.visibilityState !== "visible") return;
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) { lock.release().catch(() => {}); lock = null; }
      } catch { /* unsupported, denied, or battery saver — not worth surfacing */ }
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      lock?.release().catch(() => {});
    };
  }, [screen]);

  const questions = session?.questions ?? [];
  const current = questions[index] ?? null;
  const answeredCount = Object.keys(answers).length;
  const unanswered = questions.length - answeredCount;

  // ── Countdown ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "test" || !session?.ends_at) return;
    const endsAt = new Date(session.ends_at).getTime();
    const tick = () => setRemaining(endsAt - (Date.now() - skewRef.current));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [screen, session?.ends_at]);

  const doSubmit = useCallback(
    async (auto = false) => {
      if (submitLock.current || !session?.attempt_token) return;
      submitLock.current = true;
      setSubmitting(true);
      setSubmitFailed(false);
      setError("");
      try {
        const res = await submitAttempt({
          attemptToken: session.attempt_token,
          answers,
        });
        setResult({ ...res, auto });
        clearStored(keys);
        setScreen("result");
      } catch (e) {
        // The answers stay in localStorage. HR can retry from this screen.
        setSubmitFailed(true);
        setError(e.message || "Could not submit.");
        submitLock.current = false;
      } finally {
        setSubmitting(false);
      }
    },
    [answers, session?.attempt_token]
  );

  // Auto-submit on expiry. Whatever is answered is scored (§5: no negative
  // marking, partial papers are marked).
  useEffect(() => {
    if (screen !== "test" || !session) return;
    if (remaining === null || remaining > 0) return;
    doSubmit(true);
  }, [remaining, screen, session, doSubmit]);

  const onStart = async (e) => {
    e.preventDefault();
    setError("");
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim().replace(/\s+/g, " ");
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(cleanEmail)) {
      return setError("Please enter a valid email address.");
    }
    if (cleanName.length < 2) return setError("Please enter your full name.");
    if (isRole && !position) return setError("Please select the position you applied for.");

    setStarting(true);
    try {
      const res = await startAttempt({
        email: cleanEmail,
        fullName: cleanName,
        kind,
        position: isRole ? position : undefined,
      });

      if (res.blocked) {
        setPrevious(res.previous);
        setScreen("blocked");
        return;
      }

      skewRef.current = res.server_now ? Date.now() - new Date(res.server_now).getTime() : 0;

      const next = {
        attempt_token: res.attempt_token,
        email: res.email,
        full_name: res.full_name,
        position: res.position || null,
        ends_at: res.ends_at,
        questions: res.questions,
        sections: res.sections,
        total_questions: res.total_questions,
      };
      setSession(next);
      writeJson(keys.session, next);

      const restored = res.resumed ? readJson(keys.answers)?.[res.attempt_token] || {} : {};
      setAnswers(restored);
      setIndex(0);
      setScreen("test");
    } catch (err) {
      setError(err.message || "Could not start the test.");
    } finally {
      setStarting(false);
    }
  };

  const pick = (qn, optionIndex) => {
    setAnswers((prev) => {
      const next = { ...prev, [qn]: optionIndex };
      // Persist on every tap, keyed by token so a stale sheet from an earlier
      // attempt can never bleed into a new one.
      writeJson(keys.answers, { [session.attempt_token]: next });
      return next;
    });
  };

  const sectionMeta = useMemo(() => {
    const map = {};
    (session?.sections || []).forEach((s) => (map[s.id] = s.name));
    return map;
  }, [session?.sections]);

  // ── Start screen ──────────────────────────────────────────────────────────
  if (screen === "start") {
    return (
      <div className="as-shell as-center fade-in">
        <div className="as-brand">
          <div className="as-logo">H</div>
          <div>
            <div className="as-company">Hagerstone International</div>
            <div className="as-tagline">
              {isRole ? "Role Assessment" : "Walk-in Assessment"} · 22 August 2026
            </div>
          </div>
        </div>

        <form className="as-card" onSubmit={onStart}>
          <div className="as-card-title">{brief.title}</div>

          <ul className="as-rules">
            <li><b>{brief.questions} questions</b> · 1 mark each</li>
            <li><b>{brief.minutes} minutes.</b> The test submits automatically when time is up.</li>
            {isRole ? (
              <li>The questions are for the <b>position you applied for</b>. Select it carefully — it decides your question paper.</li>
            ) : (
              <li>Most questions describe a real work situation. Choose the <b>best</b> action.</li>
            )}
            <li>No negative marking — a wrong answer costs nothing, so attempt all.</li>
            <li>You may go back and change any answer before submitting.</li>
            <li>One attempt only. Your email identifies your paper.</li>
          </ul>

          <div className="as-field">
            <label className="as-label" htmlFor="as-email">Email address</label>
            <input
              id="as-email"
              className="as-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="as-field">
            <label className="as-label" htmlFor="as-name">Full name</label>
            <input
              id="as-name"
              className="as-input"
              type="text"
              autoComplete="name"
              placeholder="As written on your CV"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          {/* Level 2 only. This is the field that selects the question paper,
              so it is required and there is no "Other" — a position with no
              paper is a candidate who cannot start. */}
          {isRole && (
            <div className="as-field">
              <label className="as-label" htmlFor="as-position">Position applied for</label>
              <select
                id="as-position"
                className="as-input as-select"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              >
                <option value="">Select your position…</option>
                {positions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}

          {error && <div className="as-error">{error}</div>}

          <button className="as-btn as-btn-primary" type="submit" disabled={starting}>
            {starting ? <span className="as-spinner" /> : "Start Test"}
          </button>
          <div className="as-note">
            {isRole
              ? "Check your email spelling and your position — the email matches your score to you, and the position decides your questions."
              : "Please check your email spelling — it is how your score is matched to you."}
          </div>
        </form>
      </div>
    );
  }

  // ── Blocked (already sat the paper) ───────────────────────────────────────
  if (screen === "blocked") {
    return (
      <div className="as-shell as-center fade-in">
        <div className="as-card as-card-narrow">
          <div className="as-icon">✓</div>
          <div className="as-card-title">You have already taken this test</div>
          {previous?.score_total != null ? (
            <p className="as-body">
              Your recorded score is <b>{previous.score_total} / {previous.out_of ?? brief.questions}</b>.
            </p>
          ) : (
            <p className="as-body">An earlier attempt is already on record against this email.</p>
          )}
          <p className="as-body">
            If this is not you, or your last attempt was interrupted, please speak to the HR desk.
          </p>
          <button className="as-btn as-btn-ghost" onClick={() => { setScreen("start"); setPrevious(null); }}>
            Back
          </button>
        </div>
      </div>
    );
  }

  // ── Result ────────────────────────────────────────────────────────────────
  if (screen === "result" && result) {
    const meta = result.section_meta || session?.sections || [];
    return (
      <div className="as-shell as-center fade-in">
        <div className="as-card as-card-narrow">
          <div className="as-icon">✓</div>
          <div className="as-card-title">Test submitted</div>
          {isRole && session?.position && (
            <div className="as-note">{session.position}</div>
          )}
          {result.auto && <div className="as-note as-note-warn">Time was up — your answers were submitted automatically.</div>}

          <div className="as-score">
            <div className="as-score-value">{result.score_total}</div>
            <div className="as-score-of">out of {result.out_of}</div>
          </div>

          <div className="as-sections">
            {meta.map((s) => {
              const got = result.sections?.[s.id] ?? 0;
              const pct = s.count ? Math.round((got / s.count) * 100) : 0;
              return (
                <div className="as-section-row" key={s.id}>
                  <div className="as-section-head">
                    <span>{s.name}</span>
                    <b>{got} / {s.count}</b>
                  </div>
                  <div className="as-bar"><div className="as-bar-fill" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>

          <p className="as-body as-body-strong">Please return to the HR desk.</p>
          <p className="as-note">
            This score is one input among several. Your interview is based on your experience
            and the panel discussion.
          </p>
        </div>
      </div>
    );
  }

  // ── Test ──────────────────────────────────────────────────────────────────
  if (!current) {
    return (
      <div className="as-shell as-center">
        <div className="as-card as-card-narrow"><div className="as-body">Loading…</div></div>
      </div>
    );
  }

  const low = remaining !== null && remaining <= 2 * 60 * 1000;

  return (
    <div className="as-shell as-test">
      <header className={`as-topbar ${low ? "as-topbar-low" : ""}`}>
        <div className="as-topbar-left">
          <span className="as-qcount">Q {current.n} <span className="as-dim">/ {questions.length}</span></span>
          <span className="as-section-tag">{sectionMeta[current.section] || ""}</span>
        </div>
        <div className="as-timer">{formatClock(remaining)}</div>
      </header>

      <main className="as-question fade-in" key={current.n}>
        {current.scenario && (
          <div className="as-scenario">
            <div className="as-scenario-label">Situation</div>
            {current.scenario}
          </div>
        )}
        <h1 className="as-qtext">{current.q}</h1>

        <div className="as-options">
          {current.options.map((opt, i) => {
            const selected = answers[current.n] === i;
            return (
              <button
                type="button"
                key={i}
                className={`as-option ${selected ? "as-option-on" : ""}`}
                onClick={() => pick(current.n, i)}
              >
                <span className="as-option-letter">{LETTERS[i]}</span>
                <span className="as-option-text">{opt}</span>
              </button>
            );
          })}
        </div>
      </main>

      {showPalette && (
        <div className="as-palette-sheet" onClick={() => { setShowPalette(false); setConfirmSubmit(false); }}>
          <div className="as-palette" onClick={(e) => e.stopPropagation()}>
            <div className="as-palette-title">
              {answeredCount} of {questions.length} answered
            </div>
            <div className="as-palette-grid">
              {questions.map((q, i) => (
                <button
                  type="button"
                  key={q.n}
                  className={`as-cell ${answers[q.n] != null ? "as-cell-on" : ""} ${i === index ? "as-cell-now" : ""}`}
                  onClick={() => { setIndex(i); setShowPalette(false); setConfirmSubmit(false); }}
                >
                  {q.n}
                </button>
              ))}
            </div>

            {/* Submitting is final and there is no retake without HR. A mistap on
                a phone must not end the paper with 19 questions blank, so an
                incomplete sheet asks once before it goes. */}
            {confirmSubmit && (
              <div className="as-note as-note-warn">
                {unanswered > 0 ? (
                  <>
                    {unanswered} question{unanswered > 1 ? "s are" : " is"} still unanswered. Once
                    you submit you cannot change your answers. There is no negative marking — a
                    guess is always better than a blank.
                  </>
                ) : (
                  <>All {questions.length} answered. Once you submit you cannot change them.</>
                )}
              </div>
            )}

            {confirmSubmit ? (
              <>
                <button className="as-btn as-btn-primary" onClick={() => doSubmit(false)} disabled={submitting}>
                  {submitting ? <span className="as-spinner" /> : "Yes, submit now"}
                </button>
                <button className="as-btn as-btn-ghost" onClick={() => setConfirmSubmit(false)}>
                  Go back and answer
                </button>
              </>
            ) : (
              <>
                <button className="as-btn as-btn-primary" onClick={() => setConfirmSubmit(true)} disabled={submitting}>
                  Submit Test
                </button>
                <button className="as-btn as-btn-ghost" onClick={() => setShowPalette(false)}>
                  Keep answering
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {submitFailed && (
        <div className="as-error as-error-fixed">
          {error} Your answers are saved on this device — do not close this page. Show this
          screen to the HR desk.
          <button className="as-btn as-btn-ghost" onClick={() => doSubmit(false)} disabled={submitting}>
            Try again
          </button>
        </div>
      )}

      <footer className="as-navbar">
        <button
          type="button"
          className="as-btn as-btn-ghost"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          ← Back
        </button>
        <button type="button" className="as-btn as-btn-ghost as-btn-review" onClick={() => setShowPalette(true)}>
          {answeredCount}/{questions.length}
        </button>
        {index < questions.length - 1 ? (
          <button
            type="button"
            className="as-btn as-btn-primary"
            onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            className="as-btn as-btn-primary"
            onClick={() => setShowPalette(true)}
          >
            Finish
          </button>
        )}
      </footer>
    </div>
  );
}
