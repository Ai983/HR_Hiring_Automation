// =====================================================================
// `website-apply` — job applications from hagerstone.com/careers
// ---------------------------------------------------------------------
// The caller is an ANONYMOUS browser on a different Supabase project's
// website. It holds no key for this project at all, so the function is
// deployed with verify_jwt = false and does every check itself. Same rules
// as `apply` (read its header): hr.applicants has no anon policy, every write
// goes through here on the service-role key, the browser is trusted for
// nothing.
//
// FLOW (order matters)
//   1. validate fields + the CV (size, and type by magic bytes, never by the
//      file name or the browser's Content-Type);
//   2. duplicate check — same email for the same opening is answered "we have
//      it" without uploading anything;
//   3. upload the CV to the PRIVATE `candidate-resumes` bucket;
//   4. insert the applicant (stage 'new', portal 'website'); if the insert
//      fails, delete the CV just uploaded so no orphan is left behind;
//   5. answer the browser;
//   6. in the background (EdgeRuntime.waitUntil): extract the CV text, store
//      it in resume_text, then ask `screen-resume` for an AI score.
// Step 6 is after the response on purpose. Text extraction is the CPU-heavy
// part; if it is slow or crashes, the application is already saved and HR
// can still open the CV and click "Screen with AI" by hand.
//
// SPAM. Honeypot field + "filled in under 3 s" are answered 200 OK and
// dropped (no human uploads a CV that fast). One row per email per opening.
// Hard caps on every string. If the board is ever flooded, add a captcha —
// not more heuristics here.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";
import { unzipSync, strFromU8 } from "npm:fflate@0.8.2";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

// ── CORS ──────────────────────────────────────────────────────────────
// Not a security boundary (curl ignores CORS), just keeps other sites'
// pages from posting into our pipeline through a visitor's browser.
const ALLOWED_ORIGIN = [
  /^https:\/\/(www\.)?hagerstone\.com$/,
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/,          // preview deploys
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,   // local dev
];

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED_ORIGIN.some((re) => re.test(origin)) ? origin : "https://hagerstone.com";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

// ── Limits ────────────────────────────────────────────────────────────
const MAX = {
  job_slug: 60,
  job_title: 120,
  full_name: 120,
  email: 254,
  phone: 32,
  location: 120,
  qualification: 160,
  current_employer: 160,
  notice_period: 60,
  cover_note: 1500,
  source_url: 300,
};
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_EXPERIENCE_YEARS = 60;
const MAX_CTC_LPA = 1000;
const MIN_FILL_MS = 3000;
const RESUME_TEXT_CAP = 50_000;
const BUCKET = "candidate-resumes";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SLUG_RE = /^[a-z0-9-]{2,60}$/;

function str(v: FormDataEntryValue | null, cap: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/\s+/g, " ").trim().slice(0, cap);
}

// Multi-line text keeps its line breaks; only runs of spaces collapse.
function text(v: FormDataEntryValue | null, cap: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, cap);
}

function num(v: FormDataEntryValue | null, label: string, max: number): number | null {
  if (v === null || v === "" || typeof v !== "string") return null;
  const n = Number(v.replace(/,/g, "").trim());
  if (!Number.isFinite(n)) throw new Error(`${label} must be a number.`);
  if (n < 0) throw new Error(`${label} cannot be negative.`);
  if (n > max) throw new Error(`${label} looks too large — please check the units.`);
  return n;
}

function normalisePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return input.trim();
}

type Kind = { ext: "pdf" | "docx" | "doc"; mime: string };

// Decide the type from the first bytes. A renamed .exe is not a PDF just
// because its name ends in .pdf.
function sniff(bytes: Uint8Array): Kind | null {
  const b = bytes;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
    return { ext: "pdf", mime: "application/pdf" };                       // %PDF
  }
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    return { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }; // PK zip
  }
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) {
    return { ext: "doc", mime: "application/msword" };                    // OLE2
  }
  return null;
}

async function extractResumeText(bytes: Uint8Array, kind: Kind): Promise<string> {
  if (kind.ext === "pdf") {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return String(text ?? "");
  }
  if (kind.ext === "docx") {
    const files = unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" });
    const xml = files["word/document.xml"];
    if (!xml) return "";
    return strFromU8(xml)
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:tab\/>/g, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  }
  return ""; // legacy .doc: stored and downloadable, but not parsed
}

Deno.serve(async (req) => {
  const headers = cors(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return json({ error: "Please submit the application form." }, 400);
    }

    // ── Bot checks: answer OK, save nothing ────────────────────────────
    const elapsed = Number(form.get("elapsed_ms") ?? "");
    if (str(form.get("company_website"), 200) || (Number.isFinite(elapsed) && elapsed > 0 && elapsed < MIN_FILL_MS)) {
      return json({ ok: true, duplicate: false });
    }

    // ── Required fields ───────────────────────────────────────────────
    const job_slug = str(form.get("job_slug"), MAX.job_slug).toLowerCase();
    const job_title = str(form.get("job_title"), MAX.job_title);
    const full_name = str(form.get("full_name"), MAX.full_name);
    const email = str(form.get("email"), MAX.email).toLowerCase();
    const phone = normalisePhone(str(form.get("phone"), MAX.phone));
    const location = str(form.get("location"), MAX.location);
    const qualification = str(form.get("qualification"), MAX.qualification);

    if (!SLUG_RE.test(job_slug) || !job_title) return json({ error: "Please choose the position you are applying for." }, 400);
    if (full_name.length < 2) return json({ error: "Please enter your full name." }, 400);
    if (!EMAIL_RE.test(email)) return json({ error: "Please enter a valid email address." }, 400);
    if (!phone) return json({ error: "Please enter a valid mobile number." }, 400);
    if (!location) return json({ error: "Please enter your current city." }, 400);
    if (!qualification) return json({ error: "Please enter your highest qualification." }, 400);
    if (form.get("consent") !== "yes") {
      return json({ error: "Please confirm we may store your details and CV for this application." }, 400);
    }

    let total_experience_years: number | null;
    let current_ctc: number | null;
    let expected_ctc: number | null;
    try {
      total_experience_years = num(form.get("total_experience_years"), "Total experience", MAX_EXPERIENCE_YEARS);
      current_ctc = num(form.get("current_ctc"), "Current CTC", MAX_CTC_LPA);
      expected_ctc = num(form.get("expected_ctc"), "Expected CTC", MAX_CTC_LPA);
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
    if (total_experience_years === null) return json({ error: "Please enter your total experience in years." }, 400);

    // ── The CV ────────────────────────────────────────────────────────
    const file = form.get("resume");
    if (!(file instanceof File) || file.size === 0) return json({ error: "Please attach your CV." }, 400);
    if (file.size > MAX_FILE_BYTES) return json({ error: "Your CV is larger than 5 MB. Please upload a smaller file." }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniff(bytes);
    if (!kind) return json({ error: "Please upload your CV as a PDF or Word document." }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { db: { schema: "hr" }, auth: { persistSession: false } },
    );

    // ── Which opening ─────────────────────────────────────────────────
    // A slug HireFlow does not know still saves — with job_id NULL and the
    // title as designation — rather than losing the candidate. HR attaches
    // them from the Kanban, exactly like an /apply.html submission.
    const { data: job, error: jobErr } = await supabase
      .from("jobs").select("id, title").eq("website_slug", job_slug).maybeSingle();
    if (jobErr) console.error("website-apply: job lookup failed", jobErr);
    const job_id: string | null = job?.id ?? null;
    const designation = job?.title ?? job_title;

    // ── One application per email per opening ─────────────────────────
    const dupBase = supabase.from("applicants").select("id").ilike("email", email);
    const dupQuery = job_id
      ? dupBase.eq("job_id", job_id)
      : dupBase.is("job_id", null).ilike("designation", designation);
    const { data: existing, error: dupErr } = await dupQuery.limit(1);
    if (dupErr) {
      console.error("website-apply: duplicate lookup failed", dupErr);
      return json({ error: "Could not save your application. Please try again." }, 500);
    }
    if (existing && existing.length > 0) {
      return json({ ok: true, duplicate: true });
    }

    // ── Upload, then insert ───────────────────────────────────────────
    const path = `${job_id ?? "unassigned"}/${crypto.randomUUID()}.${kind.ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: kind.mime,
      upsert: false,
    });
    if (upErr) {
      console.error("website-apply: upload failed", upErr);
      return json({ error: "Could not upload your CV. Please try again." }, 500);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const { error: insErr } = await supabase.from("applicants").insert({
      id,
      job_id,
      full_name,
      email,
      phone,
      designation,
      location,
      qualification,
      current_employer: str(form.get("current_employer"), MAX.current_employer) || null,
      total_experience_years,
      current_ctc,
      expected_ctc,
      notice_period: str(form.get("notice_period"), MAX.notice_period) || null,
      cover_note: text(form.get("cover_note"), MAX.cover_note) || null,
      source_url: str(form.get("source_url"), MAX.source_url) || null,
      consent_at: now,
      resume_path: path,
      resume_bucket: BUCKET,
      portal: "website",
      stage: "new",
      applied_at: now,
    });

    if (insErr) {
      console.error("website-apply: insert failed", insErr);
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
      return json({ error: "Could not save your application. Please try again." }, 500);
    }

    // ── Background: CV text, then AI score ────────────────────────────
    const followUp = (async () => {
      try {
        const raw = await extractResumeText(bytes, kind);
        const resume_text = raw.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, RESUME_TEXT_CAP);
        if (!resume_text) return;
        const { error } = await supabase.from("applicants").update({ resume_text }).eq("id", id);
        if (error) { console.error("website-apply: resume_text update failed", error); return; }
        if (!job_id) return; // screen-resume needs a job to compare against

        const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
        const res = await fetch(`${base}/functions/v1/screen-resume`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") ?? ""}`,
          },
          body: JSON.stringify({ applicant_id: id }),
        });
        if (!res.ok) console.error("website-apply: screen-resume", res.status, await res.text());
      } catch (e) {
        console.error("website-apply: follow-up failed", e);
      }
    })();
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(followUp);

    // Like `apply`, the applicant id is not returned to the anonymous caller.
    return json({ ok: true, duplicate: false }, 201);
  } catch (e) {
    console.error("website-apply: unhandled", e);
    return json({ error: "Unexpected error. Please try again." }, 500);
  }
});
