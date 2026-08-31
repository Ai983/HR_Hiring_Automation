import { useMemo, useRef, useState } from "react";
import { submitApplication } from "../../services/applyApi.js";
import "./ApplyForm.css";

// ─────────────────────────────────────────────────────────────────────
// Candidate self-application form — /apply.html
//
// Anonymous page. No Hub login, no supabase.from(), no App.jsx. The whole
// write goes through the `apply` edge function (see services/applyApi.js).
//
// Sized for a phone first: most people who receive this link open it from
// a WhatsApp message on an Android handset. 16px inputs (anything smaller
// makes iOS zoom on focus), 44px+ tap targets, single column under 560px.
// ─────────────────────────────────────────────────────────────────────

// Suggestions, not a whitelist. These render into <datalist> so the common
// answers are one tap away, and anything typed is still accepted — a public
// form that rejects a real job title because it is not on our list is worse
// than a slightly messy column. Normalise on the HR side, not here.
const DEPARTMENTS = [
  "Projects", "Design", "Site Execution", "Civil", "MEP", "Façade",
  "Factory / Production", "Procurement", "Sales", "Marketing", "Accounts",
  "Documentation", "HR & Admin", "IT",
];

const INDUSTRIES = [
  "Interior Fit-out", "Architecture", "Construction / Civil", "Façade / Glazing",
  "Real Estate", "Manufacturing", "MEP / HVAC", "Furniture / Joinery",
  "Retail", "Hospitality", "IT / Software", "Other",
];

const NOTICE_PERIODS = [
  "Immediate", "7 days", "15 days", "30 days", "45 days", "60 days", "90 days",
  "Serving notice", "Negotiable",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const EMPTY = {
  full_name: "",
  email: "",
  phone: "",
  designation: "",
  department: "",
  location: "",
  industry: "",
  total_experience_years: "",
  current_ctc: "",
  notice_period: "",
  expected_ctc: "",
};

export default function ApplyForm() {
  const [form, setForm] = useState(EMPTY);
  const [skills, setSkills] = useState([]);
  const [skillDraft, setSkillDraft] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [done, setDone] = useState(null); // null | { duplicate, message }
  const formTopRef = useRef(null);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    // Clear a field's error the moment the candidate starts fixing it —
    // leaving red text under a field they are actively correcting reads as
    // "still wrong" and gets them stuck.
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  // ── Skills chip input ──────────────────────────────────────────────
  const addSkill = (raw) => {
    const parts = String(raw).split(/[,;\n]/).map((s) => s.replace(/\s+/g, " ").trim());
    setSkills((prev) => {
      const next = [...prev];
      const seen = new Set(next.map((s) => s.toLowerCase()));
      for (const p of parts) {
        if (!p || seen.has(p.toLowerCase()) || next.length >= 30) continue;
        seen.add(p.toLowerCase());
        next.push(p.slice(0, 60));
      }
      return next;
    });
    setSkillDraft("");
  };

  const onSkillKeyDown = (e) => {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      if (skillDraft.trim()) addSkill(skillDraft);
    } else if (e.key === "Backspace" && !skillDraft && skills.length) {
      setSkills((prev) => prev.slice(0, -1));
    }
  };

  const removeSkill = (i) => setSkills((prev) => prev.filter((_, idx) => idx !== i));

  // ── Validation ─────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (form.full_name.trim().length < 2) e.full_name = "Please enter your full name.";
    if (!EMAIL_RE.test(form.email.trim())) e.email = "Please enter a valid email address.";

    const digits = form.phone.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) e.phone = "Please enter a valid phone number.";

    if (!form.designation.trim()) e.designation = "Please enter your designation.";

    const expRaw = form.total_experience_years.trim();
    if (!expRaw) {
      e.total_experience_years = "Please enter your total experience.";
    } else {
      const n = Number(expRaw);
      if (!Number.isFinite(n) || n < 0 || n > 60) {
        e.total_experience_years = "Enter experience in years, e.g. 4 or 4.5";
      }
    }

    for (const [key, label] of [["current_ctc", "Current CTC"], ["expected_ctc", "Expected CTC"]]) {
      const v = form[key].trim();
      if (!v) continue;
      const n = Number(v.replace(/,/g, ""));
      if (!Number.isFinite(n) || n < 0 || n > 1000) e[key] = `${label} should be a number in ₹ lakh per annum.`;
    }

    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (submitting) return;

    setServerError("");
    const e = validate();
    setErrors(e);

    if (Object.keys(e).length) {
      // Jump to the first problem. On a phone the offending field is often
      // several screens up and an inline-only error goes unseen.
      const firstKey = Object.keys(e)[0];
      document.getElementById(`af-${firstKey}`)?.focus({ preventScroll: false });
      document.getElementById(`af-${firstKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    try {
      // A skill still sitting in the input has not been turned into a chip.
      // Losing it silently is the classic chip-input bug — take it too.
      const finalSkills = skillDraft.trim()
        ? [...skills, skillDraft.replace(/\s+/g, " ").trim().slice(0, 60)]
        : skills;

      const res = await submitApplication({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        designation: form.designation,
        department: form.department,
        location: form.location,
        industry: form.industry,
        total_experience_years: form.total_experience_years,
        skills: finalSkills,
        current_ctc: form.current_ctc,
        notice_period: form.notice_period,
        expected_ctc: form.expected_ctc,
        company_website: honeypot, // honeypot — a human never fills this
      });
      setDone({ duplicate: !!res?.duplicate, message: res?.message || "" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setServerError(err?.message || "Could not submit. Please try again.");
      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      setSubmitting(false);
    }
  };

  const filledCount = useMemo(
    () => Object.values(form).filter((v) => String(v).trim()).length + (skills.length ? 1 : 0),
    [form, skills],
  );

  // ── Done ───────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="af-shell af-center fade-in">
        <Brand />
        <div className="af-card af-card-narrow">
          <div className="af-icon">✓</div>
          <div className="af-card-title">
            {done.duplicate ? "You're already on file" : "Application received"}
          </div>
          <p className="af-body">
            {done.duplicate
              ? done.message ||
                "We already have an application for this email address. Our team will be in touch."
              : "Thank you. Your details have gone straight to the Hagerstone hiring team. If your profile matches an opening, someone will contact you on the number you gave."}
          </p>
          <p className="af-note">You can close this page.</p>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────
  return (
    <div className="af-shell fade-in" ref={formTopRef}>
      <div className="af-head">
        <Brand />
        <h1 className="af-title">Candidate Application</h1>
        <p className="af-sub">
          Tell us about yourself. It takes about two minutes — fields marked
          <span className="af-req"> *</span> are required.
        </p>
      </div>

      {serverError && <div className="af-error af-error-block">{serverError}</div>}

      <form className="af-form" onSubmit={handleSubmit} noValidate>
        {/* Honeypot. Hidden from people, offered to bots. Not display:none —
            some bots skip those; this is moved off-screen instead. */}
        <div className="af-hp" aria-hidden="true">
          <label htmlFor="af-company_website">Company website</label>
          <input
            id="af-company_website"
            name="company_website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <Section title="About you">
          <Field id="af-full_name" label="Full Name" required error={errors.full_name} span2>
            <input
              id="af-full_name"
              className="af-input"
              value={form.full_name}
              onChange={set("full_name")}
              placeholder="As it appears on your ID"
              autoComplete="name"
              autoFocus
            />
          </Field>

          <Field id="af-email" label="Email" required error={errors.email}>
            <input
              id="af-email"
              className="af-input"
              type="email"
              inputMode="email"
              value={form.email}
              onChange={set("email")}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Field>

          <Field id="af-phone" label="Phone" required error={errors.phone}>
            <input
              id="af-phone"
              className="af-input"
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={set("phone")}
              placeholder="+91 98XXXXXXXX"
              autoComplete="tel"
            />
          </Field>
        </Section>

        <Section title="Your role">
          <Field id="af-designation" label="Designation" required error={errors.designation} span2
                 hint="Your current or most recent job title.">
            <input
              id="af-designation"
              className="af-input"
              value={form.designation}
              onChange={set("designation")}
              placeholder="e.g. Site Engineer"
              autoComplete="organization-title"
            />
          </Field>

          <Field id="af-department" label="Department">
            <input
              id="af-department"
              className="af-input"
              list="af-departments"
              value={form.department}
              onChange={set("department")}
              placeholder="e.g. Projects"
            />
            <datalist id="af-departments">
              {DEPARTMENTS.map((d) => <option key={d} value={d} />)}
            </datalist>
          </Field>

          <Field id="af-industry" label="Industry">
            <input
              id="af-industry"
              className="af-input"
              list="af-industries"
              value={form.industry}
              onChange={set("industry")}
              placeholder="e.g. Interior Fit-out"
            />
            <datalist id="af-industries">
              {INDUSTRIES.map((d) => <option key={d} value={d} />)}
            </datalist>
          </Field>

          <Field id="af-location" label="Location" span2 hint="The city you are based in.">
            <input
              id="af-location"
              className="af-input"
              value={form.location}
              onChange={set("location")}
              placeholder="e.g. New Delhi"
              autoComplete="address-level2"
            />
          </Field>

          <Field
            id="af-total_experience_years"
            label="Total Experience"
            required
            error={errors.total_experience_years}
            hint="In years. Use a decimal for part years — 1.5 means 18 months."
            span2
          >
            <div className="af-suffix-wrap">
              <input
                id="af-total_experience_years"
                className="af-input af-input-suffixed"
                type="number"
                inputMode="decimal"
                min="0"
                max="60"
                step="0.5"
                value={form.total_experience_years}
                onChange={set("total_experience_years")}
                placeholder="4.5"
              />
              <span className="af-suffix">years</span>
            </div>
          </Field>
        </Section>

        <Section title="Skills">
          <Field
            id="af-skill_draft"
            label="Skills"
            span2
            hint="Type a skill and press Enter or comma. Add as many as you like."
          >
            <div className="af-chips">
              {skills.map((s, i) => (
                <span className="af-chip" key={`${s}-${i}`}>
                  {s}
                  <button
                    type="button"
                    className="af-chip-x"
                    onClick={() => removeSkill(i)}
                    aria-label={`Remove ${s}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
              <input
                id="af-skill_draft"
                className="af-chip-input"
                value={skillDraft}
                onChange={(e) => setSkillDraft(e.target.value)}
                onKeyDown={onSkillKeyDown}
                onBlur={() => skillDraft.trim() && addSkill(skillDraft)}
                placeholder={skills.length ? "Add another…" : "e.g. AutoCAD, Site Supervision"}
              />
            </div>
          </Field>
        </Section>

        <Section title="Compensation & availability">
          <Field id="af-current_ctc" label="Current CTC" error={errors.current_ctc} hint="₹ lakh per annum.">
            <div className="af-suffix-wrap">
              <input
                id="af-current_ctc"
                className="af-input af-input-suffixed"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={form.current_ctc}
                onChange={set("current_ctc")}
                placeholder="6.5"
              />
              <span className="af-suffix">LPA</span>
            </div>
          </Field>

          <Field id="af-expected_ctc" label="Expected CTC" error={errors.expected_ctc} hint="₹ lakh per annum.">
            <div className="af-suffix-wrap">
              <input
                id="af-expected_ctc"
                className="af-input af-input-suffixed"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={form.expected_ctc}
                onChange={set("expected_ctc")}
                placeholder="8"
              />
              <span className="af-suffix">LPA</span>
            </div>
          </Field>

          <Field id="af-notice_period" label="Notice Period" span2>
            <input
              id="af-notice_period"
              className="af-input"
              list="af-notice"
              value={form.notice_period}
              onChange={set("notice_period")}
              placeholder="e.g. 30 days"
            />
            <datalist id="af-notice">
              {NOTICE_PERIODS.map((d) => <option key={d} value={d} />)}
            </datalist>
          </Field>
        </Section>

        <div className="af-actions">
          <button className="af-btn" type="submit" disabled={submitting}>
            {submitting ? <><span className="af-spinner" /> Submitting…</> : "Submit application"}
          </button>
          <p className="af-note af-privacy">
            Your details are shared only with the Hagerstone hiring team and are
            used to consider you for current and future openings.
          </p>
        </div>

        {/* Cheap progress cue on a long mobile form. */}
        <div className="af-progress" aria-hidden="true">{filledCount} of 12 filled</div>
      </form>
    </div>
  );
}

/* ── Small presentational helpers ──────────────────────────────────── */

function Brand() {
  return (
    <div className="af-brand">
      <div className="af-logo">H</div>
      <div>
        <div className="af-company">Hagerstone</div>
        <div className="af-tagline">International</div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="af-section">
      <h2 className="af-section-title">{title}</h2>
      <div className="af-grid">{children}</div>
    </section>
  );
}

function Field({ id, label, required, error, hint, span2, children }) {
  return (
    <div className={`af-field${span2 ? " af-span2" : ""}`}>
      <label className="af-label" htmlFor={id}>
        {label}
        {required && <span className="af-req"> *</span>}
      </label>
      {children}
      {hint && !error && <div className="af-hint">{hint}</div>}
      {error && <div className="af-field-error">{error}</div>}
    </div>
  );
}
